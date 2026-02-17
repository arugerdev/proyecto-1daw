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
app.use(express.json(), cors({ origin: '*' }));

const port = 3000

const { HOST: host, USER: user, PASSWORD: password, DATABASE: database, SECRET_KEY: secret } = process.env;

const connection = mysql.createConnection({ host, user, password, database })

/* ===========================
   JWT MIDDLEWARE
=========================== */

function verifyToken(req, res, next) {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) return res.status(401).json({ error: "Token requerido" });

    jwt.verify(token, secret, (err, decoded) => {
        if (err) return res.status(403).json({ error: "Token inválido" });

        req.user = decoded;
        next();
    });
}

/* ===========================
   MULTER CONFIG
=========================== */

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

/* ===========================
   LOGIN
=========================== */

app.post('/api/login', async (req, res) => {
    const data = req.body;

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

/* ===========================
   SUBIR ARCHIVO
=========================== */

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
            (id_item, nombre_archivo, tipo_archivo, extension, tamaño, ruta_fisica)
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

/* ===========================
   LISTAR ARCHIVOS
=========================== */

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

/* ===========================
   DESCARGAR ARCHIVO
=========================== */

app.get('/api/files/:id/download', verifyToken, async (req, res) => {

    const [rows] = await connection.promise().query(
        "SELECT * FROM ARCHIVOS WHERE id_archivo = ?",
        [req.params.id]
    );

    if (rows.length === 0)
        return res.status(404).json({ error: "Archivo no encontrado" });

    res.download(rows[0].ruta_fisica);
});

/* ===========================
   ELIMINAR ARCHIVO
=========================== */

app.delete('/api/files/:id', verifyToken, async (req, res) => {

    if (req.user.rol !== "admin")
        return res.status(403).json({ error: "Solo admin puede eliminar" });

    const [rows] = await connection.promise().query(
        "SELECT * FROM ARCHIVOS WHERE id_archivo = ?",
        [req.params.id]
    );

    if (rows.length === 0)
        return res.status(404).json({ error: "No existe" });

    fs.unlinkSync(rows[0].ruta_fisica);

    await connection.promise().query(
        "DELETE FROM ARCHIVOS WHERE id_archivo = ?",
        [req.params.id]
    );

    res.json({ success: true });
});

/* ===========================
   EDITAR METADATA
=========================== */

app.put('/api/files/:id', verifyToken, async (req, res) => {

    const { nombre_archivo } = req.body;

    await connection.promise().query(
        "UPDATE ARCHIVOS SET nombre_archivo = ? WHERE id_archivo = ?",
        [nombre_archivo, req.params.id]
    );

    res.json({ success: true });
});

app.listen(port, () => {
    console.log(`CMS API running on port ${port}`);
});
