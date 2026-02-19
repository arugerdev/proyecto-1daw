require('dotenv').config();

const cors = require('cors')
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const express = require('express')
const mysql = require('mysql2')
const multer = require('multer')
const fs = require('fs')
const path = require('path')

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

const { HOST: host, USER: user, PASSWORD: password, DATABASE: database, SECRET_KEY: secret } = process.env;

const connection = mysql.createConnection({ host, user, password, database })

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
    destination: function (req, file, cb) {
        let folder = "otros";

        if (file.mimetype.startsWith("image")) folder = "imagenes";
        else if (file.mimetype.startsWith("video")) folder = "videos";
        else if (file.mimetype.startsWith("audio")) folder = "audio";
        else folder = "documentos";

        const dir = path.join(__dirname, "media", folder);

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
            const valid = await bcrypt.compare(data.password, user.contraseña);

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

            delete user.contraseña;

            res.json({ ...user, token, success: true });
        })
        .catch(err => res.status(500).json({ error: err.message }))
});

app.post('/api/upload-content', verifyToken, upload.single("file"), async (req, res) => {

    if (req.user.rol === "viewer")
        return res.status(403).json({ error: "No tienes permisos para subir contenido" });

    const { title, description, recording_year, duration, content_type_id, program_id } = req.body;
    const file = req.file;

    if (!file) return res.status(400).json({ error: "Archivo requerido" });

    try {

        await connection.promise().query(`
            INSERT INTO media_items 
            (title, description, recording_year, duration, file_path, content_type_id, program_id)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [
            title,
            description,
            recording_year || null,
            duration || null,
            file.path,
            content_type_id,
            program_id
        ]);

        res.json({ success: true });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


app.get('/api/files', verifyToken, async (req, res) => {

    const { search, content_type, program } = req.query;

    let query = `
        SELECT 
            m.id,
            m.title,
            m.description,
            m.recording_year,
            m.duration,
            m.file_path,
            ct.name AS content_type,
            p.name AS program
        FROM media_items m
        LEFT JOIN content_types ct ON m.content_type_id = ct.id
        LEFT JOIN programs p ON m.program_id = p.id
        WHERE 1=1
    `;

    let params = [];

    if (search) {
        query += " AND m.title LIKE ?";
        params.push(`%${search}%`);
    }

    if (content_type) {
        query += " AND ct.name = ?";
        params.push(content_type);
    }

    if (program) {
        query += " AND p.name = ?";
        params.push(program);
    }

    const [rows] = await connection.promise().query(query, params);

    res.json(rows);
});

app.get('/api/files/:id/download', verifyToken, async (req, res) => {

    const [rows] = await connection.promise().query(
        "SELECT file_path FROM media_items WHERE id = ?",
        [req.params.id]
    );

    if (rows.length === 0)
        return res.status(404).json({ error: "Archivo no encontrado" });

    res.download(rows[0].file_path);
});


app.delete('/api/files/:id', verifyToken, async (req, res) => {

    if (req.user.rol !== "admin")
        return res.status(403).json({ error: "Solo admin puede eliminar" });

    const [rows] = await connection.promise().query(
        "SELECT file_path FROM media_items WHERE id = ?",
        [req.params.id]
    );

    if (rows.length === 0)
        return res.status(404).json({ error: "No existe" });

    await connection.promise().query(
        "DELETE FROM media_items WHERE id = ?",
        [req.params.id]
    );

    if (fs.existsSync(rows[0].file_path))
        fs.unlinkSync(rows[0].file_path);

    res.json({ success: true });
});


app.put('/api/files/:id', verifyToken, async (req, res) => {

    if (req.user.rol === "viewer")
        return res.status(403).json({ error: "No tienes permisos" });

    const { title, description, recording_year, duration, content_type_id, program_id } = req.body;

    await connection.promise().query(`
        UPDATE media_items 
        SET title = ?, 
            description = ?, 
            recording_year = ?, 
            duration = ?, 
            content_type_id = ?, 
            program_id = ?
        WHERE id = ?
    `, [
        title,
        description,
        recording_year,
        duration,
        content_type_id,
        program_id,
        req.params.id
    ]);

    res.json({ success: true });
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
            canDelete: false, // El moderador deberia borrar ?
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
            canDownload: true,
            canManageUsers: false,
            canViewAllContent: true,
            role: 'viewer',
            level: 1
        }
    };

    return permissions[rol] || permissions.viewer;
}

// Añade estos endpoints a tu API existente

// Obtener estadísticas del sistema
// Añade estos endpoints a tu API existente

// Obtener estadísticas del sistema
app.get('/api/stats', verifyToken, async (req, res) => {
    try {
        const [total] = await connection.promise().query(
            "SELECT COUNT(*) as total FROM media_items"
        );

        const [byType] = await connection.promise().query(`
            SELECT ct.name, COUNT(*) as total
            FROM media_items m
            JOIN content_types ct ON m.content_type_id = ct.id
            GROUP BY ct.name
        `);

        const [byProgram] = await connection.promise().query(`
            SELECT p.name, COUNT(*) as total
            FROM media_items m
            JOIN programs p ON m.program_id = p.id
            GROUP BY p.name
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
            // Obtener todos los archivos para calcular el tamaño total
            const [files] = await connection.promise().query(
                "SELECT file_path FROM media_items"
            );

            // Sumar tamaños de archivos existentes
            for (const file of files) {
                if (fs.existsSync(file.file_path)) {
                    const stats = fs.statSync(file.file_path);
                    totalBytes += stats.size;
                }
            }

            // En Linux/Unix, obtener estadísticas del disco
            if (process.platform === 'linux' || process.platform === 'darwin') {
                const { execSync } = require('child_process');

                // Obtener el directorio donde se guardan los archivos
                const mediaPath = path.join(__dirname, 'media');

                // Asegurarse de que el directorio existe
                if (fs.existsSync(mediaPath)) {
                    // Obtener estadísticas del disco usando df
                    const dfOutput = execSync(`df -k "${mediaPath}"`).toString();
                    const lines = dfOutput.trim().split('\n');

                    if (lines.length >= 2) {
                        const stats = lines[1].split(/\s+/);
                        // stats[1] = total blocks, stats[2] = used blocks, stats[3] = free blocks
                        // Los bloques están en kilobytes (1024 bytes)
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
            } else {
                // En Windows o si no se puede obtener estadísticas del disco
                // Usamos un límite ficticio de 10GB para la barra de progreso
                const maxStorage = 10 * 1024 * 1024 * 1024; // 10GB
                diskStats = {
                    total: maxStorage,
                    used: totalBytes,
                    free: maxStorage - totalBytes,
                    usedPercentage: (totalBytes / maxStorage) * 100,
                    formatted: formatBytes(totalBytes)
                };
            }
        } catch (diskError) {
            console.error('Error obteniendo estadísticas del disco:', diskError);
            // Si hay error, devolvemos valores por defecto
            diskStats = {
                total: 10 * 1024 * 1024 * 1024, // 10GB
                used: totalBytes,
                free: (10 * 1024 * 1024 * 1024) - totalBytes,
                usedPercentage: (totalBytes / (10 * 1024 * 1024 * 1024)) * 100,
                formatted: formatBytes(totalBytes)
            };
        }

        // Formatear los datos para el frontend
        const videos = byType.find(t => t.name.toLowerCase() === 'video')?.total || 0;
        const imagenes = byType.find(t => t.name.toLowerCase() === 'imagen')?.total || 0;
        const audio = byType.find(t => t.name.toLowerCase() === 'audio')?.total || 0;
        const documentos = byType.find(t => t.name.toLowerCase() === 'documento')?.total || 0;
        const otros = byType.find(t => t.name.toLowerCase() === 'otro')?.total || 0;

        res.json({
            success: true,
            stats: {
                total: total[0].total,
                videos,
                imagenes,
                audio,
                documentos,
                otros,
                byType,
                byProgram,
                storage: {
                    bytes: diskStats.used,
                    formatted: diskStats.formatted,
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


app.get('/api/files/paginated', verifyToken, async (req, res) => {

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    const [rows] = await connection.promise().query(`
        SELECT 
            m.*,
            ct.name AS content_type,
            p.name AS program
        FROM media_items m
        LEFT JOIN content_types ct ON m.content_type_id = ct.id
        LEFT JOIN programs p ON m.program_id = p.id
        ORDER BY m.id DESC
        LIMIT ? OFFSET ?
    `, [limit, offset]);

    const [count] = await connection.promise().query(
        "SELECT COUNT(*) as total FROM media_items"
    );
    res.json({
        success: true,
        data: rows,
        pagination: {
            page,
            limit,
            total: count[0].total,
            pages: Math.ceil(count[0].total / limit)
        }
    });
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
