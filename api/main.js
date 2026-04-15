require('dotenv').config();

const { execFile, exec } = require("child_process");
const cors = require('cors')
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const express = require('express')
const mysql = require('mysql2')
const multer = require('multer')
const fs = require('fs')
const path = require('path')
const ffmpegPath = require("ffmpeg-static");
const mime = require('mime-types');
const os = require('os')
const util = require('util');
const execPromise = util.promisify(exec);

const { version } = require('../version.json');

// ─── CONFIGURACIÓN DE ENTORNO ────────────────────────────────────────────────
// Determinar el entorno actual (production, development, o custom)
const NODE_ENV = process.env.NODE_ENV || 'production';
const GIT_BRANCH = process.env.GIT_BRANCH || (NODE_ENV === 'production' ? 'main' : 'develop');

// Mapeo de entornos a ramas específicas
const BRANCH_MAP = {
    production: 'main',
    prod: 'main',
    develop: 'develop',
    dev: 'develop',
    staging: 'staging'
};

const TARGET_BRANCH = BRANCH_MAP[NODE_ENV] || GIT_BRANCH;

console.log(`[ENV] NODE_ENV: ${NODE_ENV}`);
console.log(`[ENV] Target branch: ${TARGET_BRANCH}`);

const PROJECT_ROOT = path.resolve(__dirname, '../');
const LOG_FILE = path.join(PROJECT_ROOT, `update-${NODE_ENV}.log`);
const STATUS_FILE = path.join(PROJECT_ROOT, `update-status-${NODE_ENV}.json`);
const UTILS_DIR = path.join(PROJECT_ROOT, 'utils');

// Crear directorio de logs si no existe
const logsDir = path.join(PROJECT_ROOT, 'logs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

const app = express()

app.use(express.json());

// ─── CORS FIX ────────────────────────────────────────────────────────────────
app.use(cors({
    origin: function (origin, callback) {
        callback(null, origin || '*');
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Origin', 'X-Requested-With', 'Accept'],
    credentials: true,
    optionsSuccessStatus: 200
}));

app.options(/.*/, cors());

const port = process.env.PORT || 3000;

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

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const tmpDir = os.tmpdir();
        cb(null, tmpDir);
    },
    filename: function (req, file, cb) {
        const uniqueName = Date.now() + "_" + file.originalname;
        cb(null, uniqueName);
    }
});

const upload = multer({ storage });

function verifyToken(req, res, next) {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) return res.status(401).json({ error: "Token requerido" });

    jwt.verify(token, secret, (err, decoded) => {
        if (err) return res.status(403).json({ error: "Token inválido" });

        req.user = decoded;
        next();
    });
}

async function moveFile(src, dest) {
    try {
        await fs.promises.rename(src, dest);
    } catch (err) {
        if (err.code === "EXDEV") {
            await copyFileWithSync(src, dest);
            await fs.promises.unlink(src);
        } else {
            throw err;
        }
    }

    await fs.promises.chmod(dest, 0o644);
}

function copyFileWithSync(src, dest) {
    return new Promise((resolve, reject) => {
        const readStream = fs.createReadStream(src);
        const writeStream = fs.createWriteStream(dest);

        readStream.on('error', reject);
        writeStream.on('error', reject);

        writeStream.on('finish', () => {
            fs.fdatasync(writeStream.fd, (syncErr) => {
                if (syncErr) return reject(syncErr);
                writeStream.close((closeErr) => {
                    if (closeErr) return reject(closeErr);
                    resolve();
                });
            });
        });

        readStream.pipe(writeStream);
    });
}

function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];

    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

async function writeLog(message, type = 'INFO') {
    const timestamp = new Date().toISOString();
    const logLine = `[${timestamp}] [${type}] [${NODE_ENV}] ${message}\n`;
    try {
        await fs.promises.appendFile(LOG_FILE, logLine);
        console.log(logLine);
    } catch (error) {
        console.error('Error writing log:', error);
    }
}

async function updateStatus(status, step, message, error = null) {
    const statusData = {
        status,
        step,
        message,
        error: error ? error.toString() : null,
        timestamp: new Date().toISOString(),
        lastUpdate: status === 'success' ? new Date().toISOString() : null,
        environment: NODE_ENV,
        branch: TARGET_BRANCH
    };
    try {
        await fs.promises.writeFile(STATUS_FILE, JSON.stringify(statusData, null, 2));
    } catch (error) {
        console.error('Error writing status:', error);
    }
    return statusData;
}

async function getCurrentStatus() {
    try {
        const data = await fs.promises.readFile(STATUS_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        return {
            status: 'idle',
            step: 'none',
            message: 'No hay actualizaciones previas',
            error: null,
            timestamp: new Date().toISOString(),
            lastUpdate: null,
            environment: NODE_ENV,
            branch: TARGET_BRANCH
        };
    }
}

// Función para verificar si hay actualizaciones disponibles en la rama específica
// Función mejorada para verificar actualizaciones
async function checkForUpdates() {
    try {
        await writeLog(`Checking for updates on branch: ${TARGET_BRANCH}`);

        // Verificar si estamos en un repositorio Git
        try {
            await execPromise('git rev-parse --git-dir', { cwd: PROJECT_ROOT });
        } catch (error) {
            throw new Error('Not a git repository. Cannot perform updates.');
        }

        // Obtener el commit actual
        const { stdout: currentCommit } = await execPromise('git rev-parse HEAD', {
            cwd: PROJECT_ROOT
        });

        // Fetch los últimos cambios (sin shell específico)
        await execPromise('git fetch origin --prune', {
            cwd: PROJECT_ROOT
        });

        // Verificar si la rama existe localmente
        let localBranchExists = false;
        try {
            await execPromise(`git rev-parse --verify ${TARGET_BRANCH}`, {
                cwd: PROJECT_ROOT
            });
            localBranchExists = true;
        } catch (error) {
            await writeLog(`Local branch ${TARGET_BRANCH} does not exist`, 'WARN');
        }

        // Verificar si la rama existe en remoto
        let remoteBranchExists = false;
        let remoteCommit = '';
        let actualRemoteBranch = TARGET_BRANCH;
        
        // Lista de posibles nombres de rama para probar
        const possibleBranches = [TARGET_BRANCH];
        if (TARGET_BRANCH === 'main') {
            possibleBranches.push('master');
        } else if (TARGET_BRANCH === 'develop') {
            possibleBranches.push('dev', 'development');
        }
        
        for (const branch of possibleBranches) {
            try {
                const { stdout } = await execPromise(`git rev-parse origin/${branch}`, {
                    cwd: PROJECT_ROOT
                });
                remoteCommit = stdout;
                remoteBranchExists = true;
                actualRemoteBranch = branch;
                break;
            } catch (error) {
                // Continuar con la siguiente rama
            }
        }
        
        if (!remoteBranchExists) {
            throw new Error(`No remote branch found. Tried: ${possibleBranches.join(', ')}`);
        }

        const hasUpdates = currentCommit.trim() !== remoteCommit.trim();

        // Obtener información de los cambios
        let changes = [];
        if (hasUpdates && localBranchExists) {
            try {
                const { stdout } = await execPromise(`git log ${currentCommit.trim()}..origin/${actualRemoteBranch} --oneline`, {
                    cwd: PROJECT_ROOT
                });
                changes = stdout.split('\n').filter(line => line.trim());
            } catch (error) {
                await writeLog(`Could not get change log: ${error.message}`, 'WARN');
            }
        }

        // Recuperar la versión remota
        let newVersion = '';
        if (hasUpdates) {
            try {
                const { stdout } = await execPromise(`git show origin/${actualRemoteBranch}:version.json`, {
                    cwd: PROJECT_ROOT
                });
                const remoteVersionData = JSON.parse(stdout);
                newVersion = remoteVersionData.version || '';
            } catch (error) {
                await writeLog(`Could not read remote version.json: ${error.message}`, 'WARN');
            }
        }

        return {
            hasUpdates,
            currentCommit: currentCommit.trim().substring(0, 7),
            remoteCommit: remoteCommit.trim().substring(0, 7),
            remoteVersion: newVersion,
            changes: changes.slice(0, 10),
            branch: actualRemoteBranch,
            environment: NODE_ENV
        };
    } catch (error) {
        await writeLog(`Error checking updates: ${error.message}`, 'ERROR');
        throw error;
    }
}


// Función para reiniciar la aplicación usando scripts batch específicos por entorno
async function restartApp() {
    try {
        await writeLog(`Restarting application in ${NODE_ENV} environment...`);

        const taskPrefix = NODE_ENV === 'production' ? 't_' : 't_dev_';
        const apiTask = `${taskPrefix}api`;
        const frontTask = `${taskPrefix}front`;

        // Detener las tareas si están corriendo
        await execPromise(`schtasks /end /tn "${apiTask}"`, { shell: 'powershell.exe' }).catch(() => { });
        await execPromise(`schtasks /end /tn "${frontTask}"`, { shell: 'powershell.exe' }).catch(() => { });

        await new Promise(resolve => setTimeout(resolve, 2000));

        // Iniciar las tareas nuevamente
        await execPromise(`schtasks /run /tn "${apiTask}"`, { shell: 'powershell.exe' });
        await execPromise(`schtasks /run /tn "${frontTask}"`, { shell: 'powershell.exe' });

        await writeLog('Scheduled tasks restarted successfully');
        return true;

    } catch (error) {
        await writeLog(`Error restarting scheduled tasks: ${error.message}`, 'ERROR');

        try {
            await writeLog('Fallback: Starting scripts directly...');

            const apiScript = path.join(UTILS_DIR, NODE_ENV === 'production' ? 'startApi.bat' : 'startApiDev.bat');
            const frontScript = path.join(UTILS_DIR, NODE_ENV === 'production' ? 'startFront.bat' : 'startFrontDev.bat');

            const { spawn } = require('child_process');

            if (fs.existsSync(apiScript)) {
                spawn('cmd.exe', ['/c', 'start', '/min', apiScript], {
                    detached: true,
                    stdio: 'ignore'
                }).unref();
            }

            if (fs.existsSync(frontScript)) {
                spawn('cmd.exe', ['/c', 'start', '/min', frontScript], {
                    detached: true,
                    stdio: 'ignore'
                }).unref();
            }

            await writeLog('Scripts started in background');
            return true;

        } catch (fallbackError) {
            await writeLog(`Fallback also failed: ${fallbackError.message}`, 'ERROR');
            return false;
        }
    }
}

// Función principal de actualización mejorada
async function performUpdate() {
    const updateId = Date.now();
    await writeLog(`=== Starting update process ${updateId} for ${NODE_ENV} (branch: ${TARGET_BRANCH}) ===`);

    try {
        await updateStatus('updating', 'checking', 'Verificando actualizaciones disponibles...');
        await writeLog('Step 1: Checking for updates');

        const updateInfo = await checkForUpdates();
        if (!updateInfo.hasUpdates) {
            await updateStatus('idle', 'completed', 'No hay actualizaciones disponibles');
            await writeLog('No updates available');
            return { success: false, message: 'No hay actualizaciones disponibles' };
        }

        await updateStatus('updating', 'fetching', 'Descargando cambios desde GitHub...');
        await writeLog('Step 2: Fetching latest changes');
        
        // Hacer fetch y reset hard para asegurar que estamos actualizados
        await execPromise('git fetch origin', { cwd: PROJECT_ROOT });
        
        // Guardar cambios locales si existen
        let hasStashed = false;
        try {
            const { stdout: statusOutput } = await execPromise('git status --porcelain', { cwd: PROJECT_ROOT });
            if (statusOutput.trim()) {
                await writeLog('Local changes detected, stashing...');
                await execPromise('git stash push -u -m "Auto-stash before update"', { cwd: PROJECT_ROOT });
                hasStashed = true;
            }
        } catch (error) {
            await writeLog(`No changes to stash or stash failed: ${error.message}`, 'WARN');
        }

        await updateStatus('updating', 'updating', `Actualizando código desde GitHub (${updateInfo.branch})...`);
        await writeLog(`Step 3: Resetting to origin/${updateInfo.branch}`);

        // Hacer reset hard en lugar de pull para evitar problemas de merge
        try {
            await execPromise(`git reset --hard origin/${updateInfo.branch}`, {
                cwd: PROJECT_ROOT
            });
            await writeLog(`Successfully reset to origin/${updateInfo.branch}`);
        } catch (pullError) {
            await writeLog(`Reset failed: ${pullError.message}`, 'ERROR');
            throw new Error(`Failed to update to ${updateInfo.branch}: ${pullError.message}`);
        }

        await updateStatus('updating', 'installing', 'Instalando dependencias...');
        await writeLog('Step 4: Installing dependencies');

        const apiDir = path.join(PROJECT_ROOT, 'api');
        const frontDir = path.join(PROJECT_ROOT, 'front');

        // Instalar dependencias solo si los directorios existen
        if (fs.existsSync(apiDir)) {
            await writeLog('Installing API dependencies...');
            await execPromise('npm install --production=false', {
                cwd: apiDir
            });
        }

        if (fs.existsSync(frontDir)) {
            await writeLog('Installing Frontend dependencies...');
            await execPromise('npm install --production=false', {
                cwd: frontDir
            });
        }

        await updateStatus('updating', 'migrations', 'Ejecutando migraciones de base de datos...');
        await writeLog('Step 5: Running migrations');
        
        const migrationsPath = path.join(PROJECT_ROOT, 'db', `migrations-${NODE_ENV}.sql`);
        const defaultMigrationsPath = path.join(PROJECT_ROOT, 'db', 'migrations.sql');
        
        try {
            const migrationsFile = fs.existsSync(migrationsPath) ? migrationsPath : defaultMigrationsPath;
            if (fs.existsSync(migrationsFile)) {
                const migrationsContent = await fs.promises.readFile(migrationsFile, 'utf8');
                // Dividir las migraciones por punto y coma, ejecutando cada una individualmente
                const statements = migrationsContent.split(';').filter(stmt => stmt.trim());
                for (const statement of statements) {
                    if (statement.trim()) {
                        await connection.promise().query(statement);
                    }
                }
                await writeLog('Database migrations executed successfully');
            } else {
                await writeLog('No migrations file found', 'WARN');
            }
        } catch (error) {
            await writeLog(`Migration error: ${error.message}`, 'ERROR');
            // No detenemos la actualización por errores de migración
        }

        // Restaurar cambios guardados si existían
        if (hasStashed) {
            await updateStatus('updating', 'restoring', 'Restaurando cambios locales...');
            await writeLog('Step 6: Restoring stashed changes');
            try {
                await execPromise('git stash pop', {
                    cwd: PROJECT_ROOT
                });
                await writeLog('Stashed changes restored successfully');
            } catch (error) {
                await writeLog(`Could not restore stashed changes: ${error.message}`, 'WARN');
            }
        }

        await updateStatus('success', 'completed', 'Actualización completada. La aplicación se reiniciará en unos segundos...');
        await writeLog(`=== Update completed successfully ${updateId} ===`);

        // Programar reinicio después de la actualización
        setTimeout(async () => {
            await writeLog('Initiating application restart...');
            await restartApp();
        }, 3000);

        return {
            success: true,
            message: 'Actualización completada. La aplicación se reiniciará en unos segundos.',
            updateInfo,
            environment: NODE_ENV,
            branch: TARGET_BRANCH
        };

    } catch (error) {
        await writeLog(`=== Update failed ${updateId}: ${error.message} ===`, 'ERROR');
        await updateStatus('error', 'failed', 'Error durante la actualización', error.message);

        return {
            success: false,
            message: `Error durante la actualización: ${error.message}`,
            error: error.message
        };
    }
}

function getPermissionsByRole(rol) {
    const permissions = {
        owner: {
            canUpload: true,
            canDelete: true,
            canEdit: true,
            canDownload: true,
            canManageUsers: true,
            canViewAllContent: true,
            canAccessAdminPanel: true,
            canPerformUpdates: true,
            canViewLogs: true,
            canViewAllUsers: true,
            role: 'owner',
            level: 4
        },
        admin: {
            canUpload: true,
            canDelete: true,
            canEdit: true,
            canDownload: true,
            canManageUsers: true,
            canViewAllContent: true,
            canAccessAdminPanel: true,
            canPerformUpdates: false,
            canViewLogs: false,
            canViewAllUsers: true,
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
            canAccessAdminPanel: false,
            canPerformUpdates: false,
            canViewLogs: false,
            canViewAllUsers: false,
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
            canAccessAdminPanel: false,
            canPerformUpdates: false,
            canViewLogs: false,
            canViewAllUsers: false,
            role: 'viewer',
            level: 1
        }
    };

    return permissions[rol] || permissions.viewer;
}

function requirePermission(permission) {
    return async (req, res, next) => {
        try {
            const [rows] = await connection.promise().query(
                "SELECT rol FROM users WHERE id_user = ?",
                [req.user.id_user]
            );
            
            if (rows.length === 0) {
                return res.status(404).json({ error: "Usuario no encontrado" });
            }
            
            const permissions = getPermissionsByRole(rows[0].rol);
            
            if (!permissions[permission]) {
                return res.status(403).json({ error: `No tienes permiso para: ${permission}` });
            }
            
            next();
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    };
}

// Endpoint para obtener información del entorno actual
app.get('/api/environment', verifyToken, requirePermission('canAccessAdminPanel'), async (req, res) => {
    res.json({
        success: true,
        environment: NODE_ENV,
        branch: TARGET_BRANCH,
        version: version
    });
});

// Endpoint para verificar actualizaciones (ahora específico por entorno)
app.get('/api/update/check', verifyToken, requirePermission('canPerformUpdates'), async (req, res) => {
    try {
        const updateInfo = await checkForUpdates();
        const status = await getCurrentStatus();

        res.json({
            success: true,
            data: {
                ...updateInfo,
                version: version,
                currentStatus: status,
                environment: NODE_ENV,
                targetBranch: TARGET_BRANCH
            }
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            error: err.message
        });
    }
});

// Endpoint para obtener estado de actualización
app.get('/api/update/status', verifyToken, requirePermission('canPerformUpdates'), async (req, res) => {
    try {
        const status = await getCurrentStatus();
        res.json({
            success: true,
            data: status
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            error: err.message
        });
    }
});

// Endpoint para ejecutar actualización
app.post('/api/update/execute', verifyToken, requirePermission('canPerformUpdates'), async (req, res) => {
    try {
        performUpdate().then(result => {
            writeLog(`Background update completed: ${result.success ? 'success' : 'failed'}`);
            if (result.success) {
                writeLog('Restart scheduled. The application will restart shortly.');
            }
        }).catch(error => {
            writeLog(`Background update error: ${error.message}`, 'ERROR');
        });

        res.json({
            success: true,
            message: `Actualización iniciada en segundo plano para entorno ${NODE_ENV} (${TARGET_BRANCH}). La aplicación se reiniciará automáticamente.`
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            error: err.message
        });
    }
});

// ============================================================================
// REST OF YOUR EXISTING ENDPOINTS (login, register, files, users, etc.)
// They remain unchanged from your original code
// ============================================================================

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

app.post('/api/upload-content', verifyToken, requirePermission('canUpload'), upload.single("file"), async (req, res) => {
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
        const fullPath = path.normalize(path.join(basePaths[0].path, filename));

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

        await moveFile(req.file.path, fullPath);

        res.json({
            success: true,
            id: mediaId,
            path: fullPath
        });
    } catch (err) {
        if (req.file?.path && fs.existsSync(req.file.path)) {
            fs.unlink(req.file.path, () => { });
        }

        console.error("Upload error:", err);

        res.status(500).json({
            success: false,
            error: err.message
        });
    }
});

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

    const processedRows = rows.map(row => ({
        ...row,
        authors: row.authors ? row.authors.split(',') : [],
        author_ids: row.author_ids ? row.author_ids.split(',').map(Number) : []
    }));

    res.json(processedRows);
});

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

app.get('/api/files/:id/download', async (req, res) => {
    const { embedded } = req.query;
    const [rows] = await connection.promise().query(
        "SELECT media_path, filename FROM media_items WHERE id = ?",
        [req.params.id]
    );

    if (rows.length === 0)
        return res.status(404).json({ error: "Archivo no encontrado" });

    const filePath = rows[0].media_path;
    const filename = rows[0].filename;
    const mimeType = mime.lookup(filename) || "application/octet-stream";

    if (!fs.existsSync(filePath))
        return res.status(404).json({ error: "Archivo no encontrado en disco" });

    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const rangeHeader = req.headers.range;

    if (rangeHeader) {
        const parts = rangeHeader.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

        if (start >= fileSize || end >= fileSize) {
            res.status(416).set("Content-Range", `bytes */${fileSize}`).end();
            return;
        }

        const chunkSize = end - start + 1;

        res.status(206).set({
            "Content-Range": `bytes ${start}-${end}/${fileSize}`,
            "Accept-Ranges": "bytes",
            "Content-Length": chunkSize,
            "Content-Type": mimeType,
            "Content-Disposition": embedded === "true"
                ? `inline; filename="${filename}"`
                : `attachment; filename="${filename}"`
        });

        fs.createReadStream(filePath, { start, end }).pipe(res);
    } else {
        res.set({
            "Accept-Ranges": "bytes",
            "Content-Length": fileSize,
            "Content-Type": mimeType,
            "Content-Disposition": embedded === "true"
                ? `inline; filename="${filename}"`
                : `attachment; filename="${filename}"`
        });

        const stream = fs.createReadStream(filePath);
        stream.on('error', (err) => {
            console.error("Stream error:", err);
            if (!res.headersSent) res.status(500).end();
        });
        stream.pipe(res);
    }
});

app.delete('/api/files/:id', verifyToken, requirePermission('canDelete'), async (req, res) => {
    const [rows] = await connection.promise().query(
        "SELECT media_path FROM media_items WHERE id = ?",
        [req.params.id]
    );

    if (rows.length === 0)
        return res.status(404).json({ error: "No existe" });

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

app.put('/api/files/:id', verifyToken, requirePermission('canEdit'), upload.single("file"), async (req, res) => {
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

        if (author_ids) {
            await connection.promise().query(
                "DELETE FROM media_author WHERE media_id = ?",
                [req.params.id]
            );

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
            permissions: getPermissionsByRole(rows[0].rol),
            environment: NODE_ENV
        });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

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

        const [byYear] = await connection.promise().query(`
            SELECT publication_year, COUNT(*) as total
            FROM media_items
            WHERE publication_year IS NOT NULL
            GROUP BY publication_year
            ORDER BY publication_year DESC
        `);

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

app.post('/api/media-type', verifyToken, requirePermission('canEdit'), async (req, res) => {
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

app.get('/api/users', verifyToken, requirePermission('canViewAllUsers'), async (req, res) => {
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

app.delete('/api/users/:id', verifyToken, requirePermission('canManageUsers'), async (req, res) => {
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

app.post('/api/users', verifyToken, requirePermission('canManageUsers'), async (req, res) => {
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

app.put('/api/users/:id', verifyToken, requirePermission('canManageUsers'), async (req, res) => {
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

app.get('/api/locations', verifyToken, async (req, res) => {
    try {
        const [rows] = await connection.promise().query(
            "SELECT id, path FROM media_locations ORDER BY path ASC"
        );

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

app.post('/api/locations', verifyToken, requirePermission('canEdit'), async (req, res) => {
    const { path: newPath } = req.body;
    if (!newPath) return res.status(400).json({ error: "Se requiere la ruta de la ubicación" });
    try {
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

app.put('/api/locations/:id', verifyToken, requirePermission('canEdit'), async (req, res) => {
    const locationId = req.params.id;
    const { path: newPath } = req.body;

    if (!newPath) return res.status(400).json({ error: "Se requiere la nueva ruta" });

    try {
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

app.delete('/api/locations/:id', verifyToken, requirePermission('canDelete'), async (req, res) => {
    const locationId = req.params.id;

    try {
        const [rows] = await connection.promise().query(
            "SELECT path FROM media_locations WHERE id = ?",
            [locationId]
        );

        if (rows.length === 0) return res.status(404).json({ error: "Ubicación no encontrada" });

        const folderPath = rows[0].path;

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

app.get('/api/filesystem/list', verifyToken, async (req, res) => {
    try {
        let requestedPath = req.query.path || "";

        if (!requestedPath) {
            if (os.platform() === "win32") {
                const disks = [];
                for (let i = 65; i <= 90; i++) {
                    const letter = String.fromCharCode(i);
                    const disk = `${letter}:\\`;
                    if (fs.existsSync(disk)) {
                        disks.push(disk);
                    }
                }
                return res.json({
                    success: true,
                    disks
                });
            } else {
                const disks = ["/"];
                const mountPoints = ["/mnt", "/media"];
                for (const mount of mountPoints) {
                    if (fs.existsSync(mount)) {
                        const entries = await fs.promises.readdir(mount);
                        for (const entry of entries) {
                            disks.push(path.join(mount, entry));
                        }
                    }
                }
                return res.json({
                    success: true,
                    disks
                });
            }
        }

        const resolvedPath = path.resolve(requestedPath);

        if (!fs.existsSync(resolvedPath)) {
            return res.status(404).json({
                success: false,
                error: "Ruta no encontrada"
            });
        }

        const entries = await fs.promises.readdir(resolvedPath, {
            withFileTypes: true
        });

        const folders = entries
            .filter(entry => entry.isDirectory())
            .map(entry => entry.name)
            .sort((a, b) => a.localeCompare(b));

        res.json({
            success: true,
            path: resolvedPath,
            folders
        });

    } catch (err) {
        console.error("Filesystem list error:", err);
        res.status(500).json({
            success: false,
            error: err.message
        });
    }
});

app.post('/api/filesystem/create', verifyToken, requirePermission('canEdit'), async (req, res) => {
    try {
        let { path: requestedPath, folderName } = req.body;

        if (!requestedPath || !folderName) {
            return res.status(400).json({ success: false, error: "Faltan parámetros" });
        }

        const resolvedPath = path.resolve(requestedPath);
        const newFolderPath = path.join(resolvedPath, folderName);

        if (!fs.existsSync(newFolderPath)) {
            fs.mkdirSync(newFolderPath, { recursive: true });
            return res.json({ success: true, path: newFolderPath });
        } else {
            return res.status(409).json({ success: false, error: "La carpeta ya existe" });
        }

    } catch (err) {
        console.error("Filesystem create error:", err);
        return res.status(500).json({ success: false, error: err.message });
    }
});

app.get('/api/version', (req, res) => {
    res.json({ version, environment: NODE_ENV, branch: TARGET_BRANCH });
});

app.listen(port, () => {
    console.log(`CMS API running on port ${port} (${NODE_ENV} - ${TARGET_BRANCH})`);
});