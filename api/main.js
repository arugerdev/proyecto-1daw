require('dotenv').config();

const { execFile } = require("child_process");
const cors = require('cors')
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const express = require('express')
const mysql = require('mysql2')
const multer = require('multer')
const fs = require('fs')
const path = require('path')
const ffmpegPath = require("ffmpeg-static");



const app = express()

app.use(express.json());

app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Origin', 'X-Requested-With', 'Accept'],
    credentials: true,
    optionsSuccessStatus: 200
}));

app.options(/.*/, cors());

const port = 3000

const { HOST: host, USER: user, PASSWORD: password, DATABASE: database, SECRET_KEY: secret, MEDIA_PATH: mediaPath } = process.env;
const connection = mysql.createPool({
    host,
    user,
    password,
    database,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

function verifyToken(req, res, next) {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) return res.status(401).json({ error: "Token requerido" });

    jwt.verify(token, secret, (err, decoded) => {
        if (err) return res.status(403).json({ error: "Token inválido" });

        req.user = decoded;
        next();
    });
}

const storage = multer.diskStorage({
    destination: function (req, file, cb) { // Usar la ruta base del .env 

        const basePath = mediaPath || path.join(__dirname, "media");
        const dir = path.join(basePath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: function (req, file, cb) {
        const uniqueName = Date.now() + "_" + file.originalname;
        cb(null, uniqueName);
    }
});
const upload = multer({ storage });

app.post('/api/login', async (req, res) => {
    const data = req.body;

    if (!data) return res.status(401).json({ error: "Necesidad de credenciales" });
    connection.promise().query(`SELECT * FROM users WHERE nombre = ?`, [data.username])
        .then(async ([rows]) => {

            if (rows.length === 0)
                return res.status(401).json({ error: "Usuario incorrecto" });
            const user = rows[0];
            const valid = await bcrypt.compare(data.password, user.contrasena);

            if (!valid)
                return res.status(401).json({ error: "Contraseña incorrecta" });

            const token = jwt.sign(
                { id_user: user.id_user, nombre: user.nombre, rol: user.rol },
                secret,
                { expiresIn: "7d" }
            );

            await connection.promise().query(
                `INSERT INTO sessions (id_user, key_session) VALUES (?, ?)`,
                [user.id_user, token]
            );

            delete user.contrasena;

            res.json({ ...user, token, success: true });
        })
        .catch(err => res.status(500).json({ error: err.message }))
});

app.post('/api/register', async (req, res) => {
    const data = req.body;

    if (!data || !data.username || !data.password)
        return res.status(401).json({ error: "Necesidad de credenciales" });

    try {

        const [rows] = await connection.promise().query(
            `SELECT * FROM users WHERE nombre = ?`,
            [data.username]
        );

        if (rows.length > 0)
            return res.status(409).json({ error: "El usuario ya existe" });

        const hashedPassword = await bcrypt.hash(data.password, 10);

        const [result] = await connection.promise().query(
            `INSERT INTO users (nombre, contrasena, rol) VALUES (?, ?, 'viewer')`,
            [data.username, hashedPassword]
        );

        const user = {
            id_user: result.insertId,
            nombre: data.username,
            rol: 'viewer'
        };

        const token = jwt.sign(
            { id_user: user.id_user, nombre: user.nombre, rol: user.rol },
            secret,
            { expiresIn: "7d" }
        );

        await connection.promise().query(
            `INSERT INTO sessions (id_user, key_session) VALUES (?, ?)`,
            [user.id_user, token]
        );

        res.json({ ...user, token, success: true });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Endpoint para logout
app.post('/api/logout', verifyToken, async (req, res) => {
    try {
        const token = req.headers.authorization?.split(" ")[1];

        await connection.promise().query(
            "DELETE FROM sessions WHERE key_session = ? AND id_user = ?",
            [token, req.user.id_user]
        );

        res.json({ success: true, message: "Sesión cerrada correctamente" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Endpoint para subir contenido (adaptado a la nueva estructura)
app.post('/api/upload-content', verifyToken, upload.single("file"), async (req, res) => {

    if (req.user.rol === "viewer")
        return res.status(403).json({ error: "No tienes permisos para subir contenido" });

    try {

        const {
            title,
            description,
            publication_year,
            media_type_id,
            media_location_id,
            tags,
            author_ids
        } = req.body;

        const file = req.file;

        if (!file)
            return res.status(400).json({ error: "Archivo requerido" });

        let [basePaths] = await connection.promise().query(
            "SELECT path FROM media_locations WHERE id = ?",
            [media_location_id]
        );

        if (!fs.existsSync(basePaths[0].path))
            fs.mkdirSync(basePaths[0].path, { recursive: true });

        const filename = Date.now() + "_" + file.originalname;
        const fullPath = path.join(basePaths[0].path, filename);

        // Insertar media
        const [result] = await connection.promise().query(`
            INSERT INTO media_items 
            (title, description, publication_year, media_path, filename, media_type_id, media_location_id, tags)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            title,
            description,
            publication_year || null,
            fullPath,
            filename,
            media_type_id,
            media_location_id,
            tags || null
        ]);

        const mediaId = result.insertId;

        // Insertar autores
        if (author_ids) {

            const authorIdsArray =
                Array.isArray(author_ids)
                    ? author_ids
                    : JSON.parse(author_ids);

            for (const authorId of authorIdsArray) {

                await connection.promise().query(
                    "INSERT INTO media_author (media_id, user_id) VALUES (?, ?)",
                    [mediaId, authorId]
                );

            }
        }

        // Guardar archivo        
        await fs.rename(req.file.path, fullPath, () => {
            res.json({
                success: true,
                id: mediaId,
                path: fullPath
            });
        });

    } catch (err) {

        console.error("Upload error:", err);

        res.status(500).json({
            success: false,
            error: err.message
        });

    }
});

// Endpoint para obtener archivos con filtros (adaptado)
app.get('/api/files', verifyToken, async (req, res) => {
    const { search, media_type, program, author } = req.query;

    let query = `
        SELECT 
            m.id,
            m.title,
            m.description,
            m.publication_year,
            m.media_path,
            m.filename,
            m.tags,
            m.date_added,
            m.date_updated,
            ct.name AS media_type,
            ml.path AS location_path,
            GROUP_CONCAT(DISTINCT a.nombre) AS authors,
            GROUP_CONCAT(DISTINCT a.id_user) AS author_ids
        FROM media_items m
        LEFT JOIN media_types ct ON m.media_type_id = ct.id
        LEFT JOIN media_locations ml ON m.media_location_id = ml.id
        LEFT JOIN media_author ma ON m.id = ma.media_id
        LEFT JOIN users a ON ma.user_id = a.id_user
        WHERE 1=1
    `;

    let params = [];

    if (search) {
        query += " AND (m.title LIKE ? OR m.description LIKE ? OR m.tags LIKE ?)";
        const searchPattern = `%${search}%`;
        params.push(searchPattern, searchPattern, searchPattern);
    }

    if (media_type) {
        query += " AND ct.name = ?";
        params.push(media_type);
    }

    if (author) {
        query += " AND a.nombre LIKE ?";
        params.push(`%${author}%`);
    }

    query += " GROUP BY m.id ORDER BY m.date_added DESC";

    const [rows] = await connection.promise().query(query, params);

    // Procesar los resultados para formatear autores
    const processedRows = rows.map(row => ({
        ...row,
        authors: row.authors ? row.authors.split(',') : [],
        author_ids: row.author_ids ? row.author_ids.split(',').map(Number) : []
    }));

    res.json(processedRows);
});

// Endpoint para obtener archivos paginados (adaptado)
app.get('/api/files/paginated', verifyToken, async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || '';
    const order = req.query.order || 'masReciente';
    const type = req.query.type || 0;

    const offset = (page - 1) * limit;

    let orderSentence = '';
    switch (order) {
        case 'masReciente':
            orderSentence = 'm.publication_year DESC, m.date_added DESC';
            break;
        case 'masAntiguo':
            orderSentence = 'm.publication_year ASC, m.date_added ASC';
            break;
        case 'nombreAZ':
            orderSentence = 'm.title ASC';
            break;
        case 'nombreZA':
            orderSentence = 'm.title DESC';
            break;
        default:
            orderSentence = 'm.date_added DESC';
            break;
    }

    const [rows] = await connection.promise().query(`
        SELECT 
            m.*,
            ct.name AS media_type,
            ml.path AS location_path,
            GROUP_CONCAT(DISTINCT a.nombre) AS authors,
            GROUP_CONCAT(DISTINCT a.id_user) AS author_ids
        FROM media_items m
        LEFT JOIN media_types ct ON m.media_type_id = ct.id
        LEFT JOIN media_locations ml ON m.media_location_id = ml.id
        LEFT JOIN media_author ma ON m.id = ma.media_id
        LEFT JOIN users a ON ma.user_id = a.id_user
        WHERE (m.title LIKE ? OR m.description LIKE ? OR m.tags LIKE ?)
        ${type != 0 ? `AND m.media_type_id = ${type}` : ''}
        GROUP BY m.id
        ORDER BY ${orderSentence}
        LIMIT ? OFFSET ?
    `, [`%${search}%`, `%${search}%`, `%${search}%`, limit, offset]);

    const [count] = await connection.promise().query(
        "SELECT COUNT(*) as total FROM media_items"
    );

    // Procesar los resultados
    const processedRows = rows.map(row => ({
        ...row,
        authors: row.authors ? row.authors.split(',') : [],
        author_ids: row.author_ids ? row.author_ids.split(',').map(Number) : []
    }));

    res.json({
        success: true,
        data: processedRows,
        pagination: {
            page,
            limit,
            total: count[0].total,
            pages: Math.ceil(count[0].total / limit)
        }
    });
});

// Endpoint para descargar archivo
app.get('/api/files/:id/download', async (req, res) => {
    const [rows] = await connection.promise().query(
        "SELECT media_path, filename FROM media_items WHERE id = ?",
        [req.params.id]
    );

    if (rows.length === 0)
        return res.status(404).json({ error: "Archivo no encontrado" });

    res.download(rows[0].media_path, rows[0].filename);
});

// Endpoint para eliminar archivo
app.delete('/api/files/:id', verifyToken, async (req, res) => {
    if (req.user.rol !== "admin")
        return res.status(403).json({ error: "Solo admin puede eliminar" });

    const [rows] = await connection.promise().query(
        "SELECT media_path FROM media_items WHERE id = ?",
        [req.params.id]
    );

    if (rows.length === 0)
        return res.status(404).json({ error: "No existe" });

    // Eliminar relaciones con autores primero (por la FK)
    await connection.promise().query(
        "DELETE FROM media_author WHERE media_id = ?",
        [req.params.id]
    );

    await connection.promise().query(
        "DELETE FROM media_items WHERE id = ?",
        [req.params.id]
    );

    if (fs.existsSync(rows[0].media_path))
        fs.unlinkSync(rows[0].media_path);

    if (fs.existsSync(rows[0].media_path + '_thumbnail.jpg'))
        fs.unlinkSync(rows[0].media_path + '_thumbnail.jpg');

    res.json({ success: true });
});

// Endpoint para actualizar archivo
app.put('/api/files/:id', verifyToken, async (req, res) => {
    if (req.user.rol === "viewer")
        return res.status(403).json({ error: "No tienes permisos" });

    const { title, description, publication_year, media_type_id, tags, author_ids } = req.body;

    try {
        await connection.promise().query(`
            UPDATE media_items 
            SET title = ?, 
                description = ?, 
                publication_year = ?, 
                media_type_id = ?, 
                tags = ?,
                date_updated = CURRENT_TIMESTAMP
            WHERE id = ?
        `, [
            title,
            description,
            publication_year,
            media_type_id,
            tags,
            req.params.id
        ]);

        // Actualizar autores si se proporcionaron
        if (author_ids) {
            // Eliminar relaciones antiguas
            await connection.promise().query(
                "DELETE FROM media_author WHERE media_id = ?",
                [req.params.id]
            );

            // Insertar nuevas relaciones
            const authorIdsArray = Array.isArray(author_ids) ? author_ids : JSON.parse(author_ids);

            for (const authorId of authorIdsArray) {
                await connection.promise().query(
                    "INSERT INTO media_author (media_id, user_id) VALUES (?, ?)",
                    [req.params.id, authorId]
                );
            }
        }

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Obtener el rol del usuario actual
app.get('/api/user/role', verifyToken, async (req, res) => {
    try {
        const [rows] = await connection.promise().query(
            "SELECT id_user, nombre, rol FROM users WHERE id_user = ?",
            [req.user.id_user]
        );

        if (rows.length === 0) {
            return res.status(404).json({ error: "Usuario no encontrado" });
        }

        res.json({
            success: true,
            user: rows[0],
            permissions: getPermissionsByRole(rows[0].rol)
        });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

function getPermissionsByRole(rol) {
    const permissions = {
        admin: {
            canUpload: true,
            canDelete: true,
            canEdit: true,
            canDownload: true,
            canManageUsers: true,
            canViewAllContent: true,
            role: 'admin',
            level: 3
        },
        moderator: {
            canUpload: true,
            canDelete: false,
            canEdit: true,
            canDownload: true,
            canManageUsers: false,
            canViewAllContent: true,
            role: 'moderator',
            level: 2
        },
        viewer: {
            canUpload: false,
            canDelete: false,
            canEdit: false,
            canDownload: false,
            canManageUsers: false,
            canViewAllContent: true,
            role: 'viewer',
            level: 1
        }
    };

    return permissions[rol] || permissions.viewer;
}

//Endpoint para generar thumbnail de video, no necesita token, esto deberia devolver la url directamente, si no existe el video, devolver un placeholder, si no existe el thumbnail, generarlo con ffmpeg y devolverlo
app.get('/api/files/:id/thumbnail', async (req, res) => {
    try {
        const [rows] = await connection.promise().query(
            "SELECT media_path, filename FROM media_items WHERE id = ?",
            [req.params.id]
        );
        if (rows.length === 0) return res.status(404).json({ error: "Archivo no encontrado" });

        const mediaPath = rows[0].media_path;
        const thumbnailPath = mediaPath + "_thumbnail.jpg";
        if (fs.existsSync(thumbnailPath)) {
            return res.sendFile(thumbnailPath);
        }

        if (fs.existsSync(mediaPath)) {
            execFile(ffmpegPath, [
                '-i', mediaPath,
                '-ss', '00:00:01.000',
                '-vframes', '1',
                thumbnailPath
            ], (error) => {
                if (error) {
                    console.error('Error generando thumbnail:', error);
                    return res.status(500).json({ error: "Error generando thumbnail" });
                }
                res.sendFile(thumbnailPath);
            });
        } else {
            res.status(404).json({ error: "Archivo de video no encontrado para generar thumbnail" });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Endpoint para estadísticas (adaptado)
app.get('/api/stats', verifyToken, async (req, res) => {
    try {
        const [total] = await connection.promise().query(
            "SELECT COUNT(*) as total FROM media_items"
        );

        const [byType] = await connection.promise().query(`
            SELECT ct.name, COUNT(*) as total
            FROM media_items m
            JOIN media_types ct ON m.media_type_id = ct.id
            GROUP BY ct.name
        `);

        // Estadísticas por año
        const [byYear] = await connection.promise().query(`
            SELECT publication_year, COUNT(*) as total
            FROM media_items
            WHERE publication_year IS NOT NULL
            GROUP BY publication_year
            ORDER BY publication_year DESC
        `);

        // Calcular uso del disco
        let totalBytes = 0;
        let diskStats = {
            total: 0,
            free: 0,
            used: 0,
            usedPercentage: 0,
            formatted: '0 Bytes'
        };

        try {
            const [files] = await connection.promise().query(
                "SELECT media_path FROM media_items"
            );

            for (const file of files) {
                if (fs.existsSync(file.media_path)) {
                    const stats = fs.statSync(file.media_path);
                    totalBytes += stats.size;
                }
            }

            if (process.platform === 'linux' || process.platform === 'darwin') {
                const { execSync } = require('child_process');

                if (fs.existsSync(mediaPath.toString())) {
                    const dfOutput = execSync(`df -k "${mediaPath}"`).toString();
                    const lines = dfOutput.trim().split('\n');

                    if (lines.length >= 2) {
                        const stats = lines[1].split(/\s+/);
                        const blockSize = 1024;

                        diskStats = {
                            total: parseInt(stats[1]) * blockSize,
                            used: parseInt(stats[2]) * blockSize,
                            free: parseInt(stats[3]) * blockSize,
                            usedPercentage: (parseInt(stats[2]) / parseInt(stats[1])) * 100,
                            formatted: formatBytes(parseInt(stats[2]) * blockSize)
                        };
                    }
                }
            }
        } catch (diskError) {
            console.error('Error obteniendo estadísticas del disco:', diskError);
        }

        res.json({
            success: true,
            stats: {
                total: total[0].total,
                byType,
                byYear,
                storage: {
                    bytes: totalBytes,
                    formatted: formatBytes(totalBytes),
                    total: diskStats.total,
                    free: diskStats.free,
                    usedPercentage: diskStats.usedPercentage
                }
            }
        });

    } catch (err) {
        console.error('Error en /api/stats:', err);
        res.status(500).json({
            success: false,
            error: err.message
        });
    }
});

// Endpoint para tipos de contenido
app.get('/api/media-type', verifyToken, async (req, res) => {
    try {
        const [rows] = await connection.promise().query(`
            SELECT id, name
            FROM media_types
            ORDER BY name ASC
        `);

        res.json({
            success: true,
            data: rows
        });

    } catch (err) {
        res.status(500).json({
            success: false,
            error: err.message
        });
    }
});

app.post('/api/media-type', verifyToken, async (req, res) => {
    if (req.user.rol !== "admin" && req.user.rol !== "moderator")
        return res.status(403).json({ error: "No tienes permisos" });

    const { name } = req.body;

    try {
        const [result] = await connection.promise().query(
            "INSERT INTO media_types (name) VALUES (?)",
            [name]
        );
        res.json({
            success: true,
            id: result.insertId
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            error: err.message
        });
    }
});

// Get all users (for admin)
app.get('/api/users', verifyToken, async (req, res) => {
    if (req.user.rol !== "admin")
        return res.status(403).json({ error: "Solo admin puede ver usuarios" });

    try {
        const [rows] = await connection.promise().query(`
            SELECT id_user, nombre, rol
            FROM users
            ORDER BY nombre ASC
        `);
        res.json({
            success: true,
            data: rows
        });

    } catch (err) {
        res.status(500).json({
            success: false,
            error: err.message
        });
    }
});

app.delete('/api/users/:id', verifyToken, async (req, res) => {
    if (req.user.rol !== "admin")
        return res.status(403).json({ error: "Solo admin puede eliminar usuarios" });

    if (req.params.id == req.user.id_user) {
        return res.status(400).json({ error: "No puedes eliminarte a ti mismo" });
    }

    try {
        await connection.promise().query(
            "DELETE FROM users WHERE id_user = ?",
            [req.params.id]
        );
        res.json({ success: true });

    } catch (err) {
        res.status(500).json({
            success: false,
            error: err.message
        });
    }
});

app.post('/api/users', verifyToken, async (req, res) => {
    if (req.user.rol !== "admin")
        return res.status(403).json({ error: "Solo admin puede crear usuarios" });

    const { username, password, role } = req.body;

    if (!username || !password || !role)
        return res.status(400).json({ error: "Faltan campos requeridos" });

    try {
        const hashedPassword = await bcrypt.hash(password, 10);

        await connection.promise().query(`
            INSERT INTO users (nombre, contrasena, rol)
            VALUES (?, ?, ?)
        `, [username, hashedPassword, role]);

        res.json({ success: true });

    } catch (err) {
        res.status(500).json({
            success: false,
            error: err.message
        });
    }
});

// Endpoint para actualizar usuario (admin)
app.put('/api/users/:id', verifyToken, async (req, res) => {
    if (req.user.rol !== "admin")
        return res.status(403).json({ error: "Solo admin puede editar usuarios" });

    const { username, password, role } = req.body;
    const userId = req.params.id;

    try {
        let query = "UPDATE users SET nombre = ?, rol = ?";
        let params = [username, role];

        if (password) {
            const hashedPassword = await bcrypt.hash(password, 10);
            query += ", contrasena = ?";
            params.push(hashedPassword);
        }

        query += " WHERE id_user = ?";
        params.push(userId);

        await connection.promise().query(query, params);

        res.json({ success: true });

    } catch (err) {
        res.status(500).json({
            success: false,
            error: err.message
        });
    }
});

// Endpoint para obtener un archivo específico con todos sus detalles
app.get('/api/files/:id', verifyToken, async (req, res) => {
    try {
        const [rows] = await connection.promise().query(`
            SELECT 
                m.*,
                ct.name AS media_type,
                ml.path AS location_path,
                GROUP_CONCAT(DISTINCT a.id_user) AS author_ids,
                GROUP_CONCAT(DISTINCT a.nombre) AS author_names,
                GROUP_CONCAT(DISTINCT a.role) AS author_roles
            FROM media_items m
            LEFT JOIN media_types ct ON m.media_type_id = ct.id
            LEFT JOIN media_locations ml ON m.media_location_id = ml.id
            LEFT JOIN media_author ma ON m.id = ma.media_id
            LEFT JOIN users a ON ma.user_id = a.id_user
            WHERE m.id = ?
            GROUP BY m.id
        `, [req.params.id]);

        if (rows.length === 0) {
            return res.status(404).json({ error: "Archivo no encontrado" });
        }

        const item = rows[0];

        // Procesar autores
        const authors = [];
        if (item.author_ids) {
            const ids = item.author_ids.split(',');
            const names = item.author_names ? item.author_names.split(',') : [];
            const roles = item.author_roles ? item.author_roles.split(',') : [];

            for (let i = 0; i < ids.length; i++) {
                authors.push({
                    id: parseInt(ids[i]),
                    name: names[i] || '',
                    role: roles[i] || ''
                });
            }
        }

        delete item.author_ids;
        delete item.author_names;
        delete item.author_roles;

        res.json({
            success: true,
            data: {
                ...item,
                authors
            }
        });

    } catch (err) {
        res.status(500).json({
            success: false,
            error: err.message
        });
    }
});

// Obtener todas las ubicaciones
app.get('/api/locations', verifyToken, async (req, res) => {
    try {
        const [rows] = await connection.promise().query(
            "SELECT id, path FROM media_locations ORDER BY path ASC"
        );

        // Si no hay ninguna ubicación, crear la base
        if (rows.length === 0) {
            const basePath = mediaPath || path.join(__dirname, "media");
            if (!fs.existsSync(basePath)) fs.mkdirSync(basePath, { recursive: true });

            const [result] = await connection.promise().query(
                "INSERT INTO media_locations (path) VALUES (?)",
                [basePath]
            );

            return res.json({
                success: true,
                locations: [{ id: result.insertId, path: basePath }]
            });
        }

        res.json({
            success: true,
            locations: rows
        });

    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Crear una nueva ubicación
app.post('/api/locations', verifyToken, async (req, res) => {
    if (req.user.rol !== "admin" && req.user.rol !== "moderator")
        return res.status(403).json({ error: "No tienes permisos para crear ubicaciones" });

    const { path: newPath } = req.body;
    if (!newPath) return res.status(400).json({ error: "Se requiere la ruta de la ubicación" });
    try {
        // Crear la carpeta si no existe
        if (!fs.existsSync(newPath)) fs.mkdirSync(newPath, { recursive: true });

        const [result] = await connection.promise().query(
            "INSERT INTO media_locations (path) VALUES (?)",
            [newPath]
        );

        res.json({ success: true, id: result.insertId, path: newPath });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Actualizar una ubicación
app.put('/api/locations/:id', verifyToken, async (req, res) => {
    if (req.user.rol !== "admin" && req.user.rol !== "moderator")
        return res.status(403).json({ error: "No tienes permisos para editar ubicaciones" });

    const locationId = req.params.id;
    const { path: newPath } = req.body;

    if (!newPath) return res.status(400).json({ error: "Se requiere la nueva ruta" });

    try {
        // Crear carpeta si no existe
        if (!fs.existsSync(newPath)) fs.mkdirSync(newPath, { recursive: true });

        const [result] = await connection.promise().query(
            "UPDATE media_locations SET path = ? WHERE id = ?",
            [newPath, locationId]
        );

        if (result.affectedRows === 0)
            return res.status(404).json({ error: "Ubicación no encontrada" });

        res.json({ success: true, id: locationId, path: newPath });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Eliminar una ubicación
app.delete('/api/locations/:id', verifyToken, async (req, res) => {
    if (req.user.rol !== "admin")
        return res.status(403).json({ error: "Solo admin puede eliminar ubicaciones" });

    const locationId = req.params.id;

    try {
        // Verificar que la ubicación existe
        const [rows] = await connection.promise().query(
            "SELECT path FROM media_locations WHERE id = ?",
            [locationId]
        );

        if (rows.length === 0) return res.status(404).json({ error: "Ubicación no encontrada" });

        const folderPath = rows[0].path;

        // Eliminar la ubicación de la base de datos
        await connection.promise().query(
            "DELETE FROM media_locations WHERE id = ?",
            [locationId]
        );

        if (fs.existsSync(folderPath)) fs.rmdirSync(folderPath, { recursive: true });

        res.json({ success: true, id: locationId, path: folderPath });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Función helper para formatear bytes
function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];

    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

app.listen(port, () => {
    console.log(`CMS API running on port ${port}`);
});