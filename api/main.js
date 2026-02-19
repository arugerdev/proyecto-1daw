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

    connection.promise().query(`SELECT * FROM USUARIOS WHERE nombre = ?`, [data.username])
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
                `INSERT INTO SESIONES (id_user, key_session) VALUES (?, ?)`,
                [user.id_user, token]
            );

            delete user.contraseña;

            res.json({ ...user, token, success: true });
        })
        .catch(err => res.status(500).json({ error: err.message }))
});

app.post('/api/upload-content', verifyToken, upload.single("file"), async (req, res) => {

    const file = req.file;

    if (!file) return res.status(400).json({ error: "Archivo requerido" });

    const tipo =
        file.mimetype.startsWith("image") ? "imagen" :
            file.mimetype.startsWith("video") ? "video" :
                file.mimetype.startsWith("audio") ? "audio" :
                    "documento";

    try {
        await connection.promise().query(`
            INSERT INTO ARCHIVOS 
            (id_item, nombre_archivo, tipo_archivo, extension, size, ruta_fisica)
            VALUES (?, ?, ?, ?, ?, ?)`,
            [
                null,
                file.filename,
                tipo,
                path.extname(file.originalname),
                file.size,
                file.path
            ]
        );

        res.json({ success: true, file: file.filename });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/files', verifyToken, async (req, res) => {

    const { tipo, search } = req.query;

    let query = "SELECT * FROM ARCHIVOS WHERE 1=1";
    let params = [];

    if (tipo) {
        query += " AND tipo_archivo = ?";
        params.push(tipo);
    }

    if (search) {
        query += " AND nombre_archivo LIKE ?";
        params.push("%" + search + "%");
    }

    const [rows] = await connection.promise().query(query, params);

    res.json(rows);
});

app.get('/api/files/:id/download', verifyToken, async (req, res) => {

    const [rows] = await connection.promise().query(
        "SELECT * FROM ARCHIVOS WHERE id_archivo = ?",
        [req.params.id]
    );

    if (rows.length === 0)
        return res.status(404).json({ error: "Archivo no encontrado" });

    res.download(rows[0].ruta_fisica);
});

app.delete('/api/files/:id', verifyToken, async (req, res) => {

    if (req.user.rol !== "admin")
        return res.status(403).json({ error: "Solo admin puede eliminar" });

    const [rows] = await connection.promise().query(
        "SELECT * FROM ARCHIVOS WHERE id_archivo = ?",
        [req.params.id]
    );

    if (rows.length === 0)
        return res.status(404).json({ error: "No existe" });


    await connection.promise().query(
        "DELETE FROM ARCHIVOS WHERE id_archivo = ?",
        [req.params.id]
    );
    
    if (!fs.existsSync(rows[0].ruta_fisica)) {
        return res.json({ success: true, message: "El archivo no existe" });
    }

    fs.unlinkSync(rows[0].ruta_fisica);

    res.json({ success: true });
});

app.put('/api/files/:id', verifyToken, async (req, res) => {

    const { nombre_archivo } = req.body;

    await connection.promise().query(
        "UPDATE ARCHIVOS SET nombre_archivo = ? WHERE id_archivo = ?",
        [nombre_archivo, req.params.id]
    );

    res.json({ success: true });
});

// Obtener el rol del usuario actual
app.get('/api/user/role', verifyToken, async (req, res) => {
    try {
        const [rows] = await connection.promise().query(
            "SELECT id_user, nombre, rol FROM USUARIOS WHERE id_user = ?",
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
app.get('/api/stats', verifyToken, async (req, res) => {
    try {
        const [total] = await connection.promise().query(
            "SELECT COUNT(*) as count FROM ARCHIVOS"
        );

        const [videos] = await connection.promise().query(
            "SELECT COUNT(*) as count FROM ARCHIVOS WHERE tipo_archivo = 'video'"
        );

        const [imagenes] = await connection.promise().query(
            "SELECT COUNT(*) as count FROM ARCHIVOS WHERE tipo_archivo = 'imagen'"
        );

        const [storage] = await connection.promise().query(
            "SELECT SUM(size) as total FROM ARCHIVOS"
        );

        // Obtener size total en KB/MB/GB según corresponda
        const totalBytes = storage[0].total || 0;

        res.json({
            success: true,
            stats: {
                total: total[0].count,
                videos: videos[0].count,
                imagenes: imagenes[0].count,
                storage: {
                    bytes: totalBytes,
                    formatted: formatBytes(totalBytes)
                }
            }
        });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Obtener archivos con paginación
app.get('/api/files/paginated', verifyToken, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const offset = (page - 1) * limit;
        const search = req.query.search || '';
        const tipo = req.query.tipo || '';
        const sort = req.query.sort || 'masReciente';

        let query = "SELECT * FROM ARCHIVOS WHERE 1=1";
        let countQuery = "SELECT COUNT(*) as total FROM ARCHIVOS WHERE 1=1";
        let params = [];

        // Filtro por búsqueda
        if (search) {
            query += " AND nombre_archivo LIKE ?";
            countQuery += " AND nombre_archivo LIKE ?";
            params.push(`%${search}%`);
        }

        // Filtro por tipo
        if (tipo) {
            query += " AND tipo_archivo = ?";
            countQuery += " AND tipo_archivo = ?";
            params.push(tipo);
        }

        // Ordenamiento
        switch (sort) {
            case 'masReciente':
                query += " ORDER BY fecha_subida DESC";
                break;
            case 'masAntiguo':
                query += " ORDER BY fecha_subida ASC";
                break;
            case 'nombreAZ':
                query += " ORDER BY nombre_archivo ASC";
                break;
            case 'nombreZA':
                query += " ORDER BY nombre_archivo DESC";
                break;
            case 'mayorTamano':
                query += " ORDER BY size DESC";
                break;
            case 'menorTamano':
                query += " ORDER BY size ASC";
                break;
            default:
                query += " ORDER BY fecha_subida DESC";
        }

        query += " LIMIT ? OFFSET ?";
        params.push(limit, offset);

        const [rows] = await connection.promise().query(query, params);
        const [totalRows] = await connection.promise().query(countQuery, params.slice(0, -2));

        res.json({
            success: true,
            files: rows,
            pagination: {
                page,
                limit,
                total: totalRows[0].total,
                pages: Math.ceil(totalRows[0].total / limit)
            }
        });

    } catch (err) {
        res.status(500).json({ error: err.message });
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
