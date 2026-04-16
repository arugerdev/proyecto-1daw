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

const PROJECT_ROOT = path.resolve(__dirname, '../');
const LOG_FILE = path.join(PROJECT_ROOT, 'update.log');
const STATUS_FILE = path.join(PROJECT_ROOT, 'update-status.json');
const UTILS_DIR = path.join(PROJECT_ROOT, 'utils');

if (!fs.existsSync(path.join(PROJECT_ROOT, 'logs'))) {
    fs.mkdirSync(path.join(PROJECT_ROOT, 'logs'), { recursive: true });
}

const app = express()

app.use(express.json());

app.use(cors({
    origin:'*',
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

// ─── MEJORA 1 ────────────────────────────────────────────────────────────────
// Multer escribe ahora en el directorio temporal del sistema operativo.
// Esto evita fallos de cross-device rename cuando el destino final está
// en un volumen distinto al directorio de trabajo del proceso.
// ─────────────────────────────────────────────────────────────────────────────
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

// ─── MEJORA 2 (implementación) ────────────────────────────────────────────────
// moveFile mejorado:
//  1. Intenta rename() — operación atómica y rápida en el mismo filesystem.
//  2. Si falla por cross-device (EXDEV), copia con stream y fdatasync para
//     garantizar que los datos están en disco antes de considerar la escritura
//     completa, luego borra el original.
//  3. Asigna permisos 0o644 al fichero de destino en ambos casos, para que
//     el proceso web pueda leerlo independientemente de la umask del sistema.
// ─────────────────────────────────────────────────────────────────────────────
async function moveFile(src, dest) {
    try {
        await fs.promises.rename(src, dest);
    } catch (err) {
        if (err.code === "EXDEV") {
            // Cross-device: copiar con flush garantizado
            await copyFileWithSync(src, dest);
            await fs.promises.unlink(src);
        } else {
            throw err;
        }
    }

    // Asignar permisos de lectura/escritura para propietario y lectura para grupo/otros
    await fs.promises.chmod(dest, 0o644);
}

// Copia el fichero src → dest usando streams y hace fdatasync antes de cerrar,
// garantizando que el contenido esté completamente escrito en disco.
function copyFileWithSync(src, dest) {
    return new Promise((resolve, reject) => {
        const readStream = fs.createReadStream(src);
        const writeStream = fs.createWriteStream(dest);

        readStream.on('error', reject);

        writeStream.on('error', reject);

        writeStream.on('finish', () => {
            // fdatasync: fuerza que el kernel vacíe los buffers al disco
            // antes de resolver la promesa, evitando archivos truncados
            // si el proceso muere justo después de la escritura.
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

// Función helper para formatear bytes
function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];

    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}



// Función para escribir logs
async function writeLog(message, type = 'INFO') {
    const timestamp = new Date().toISOString();
    const logLine = `[${timestamp}] [${type}] ${message}\n`;
    try {
        await fs.promises.appendFile(LOG_FILE, logLine);
        console.log(logLine);
    } catch (error) {
        console.error('Error writing log:', error);
    }
}

// Función para actualizar estado
async function updateStatus(status, step, message, error = null) {
    const statusData = {
        status, // 'idle', 'updating', 'success', 'error'
        step,
        message,
        error: error ? error.toString() : null,
        timestamp: new Date().toISOString(),
        lastUpdate: status === 'success' ? new Date().toISOString() : null
    };
    try {
        await fs.promises.writeFile(STATUS_FILE, JSON.stringify(statusData, null, 2));
    } catch (error) {
        console.error('Error writing status:', error);
    }
    return statusData;
}

// Función para obtener el estado actual
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
            lastUpdate: null
        };
    }
}

// Función para verificar si hay actualizaciones disponibles
async function checkForUpdates() {
    try {
        // Obtener el commit actual
        const { stdout: currentCommit } = await execPromise('git rev-parse HEAD', {
            cwd: PROJECT_ROOT,
            shell: 'powershell.exe'
        });

        // Fetch los últimos cambios
        await execPromise('git fetch origin', {
            cwd: PROJECT_ROOT,
            shell: 'powershell.exe'
        });

        // Obtener el commit de la rama remota (main/master)
        let remoteCommit;
        try {
            const { stdout } = await execPromise('git rev-parse origin/main', {
                cwd: PROJECT_ROOT,
                shell: 'powershell.exe'
            });
            remoteCommit = stdout;
        } catch {
            const { stdout } = await execPromise('git rev-parse origin/master', {
                cwd: PROJECT_ROOT,
                shell: 'powershell.exe'
            });
            remoteCommit = stdout;
        }

        const hasUpdates = currentCommit.trim() !== remoteCommit.trim();

        // Obtener información de los cambios
        let changes = [];
        if (hasUpdates) {
            const { stdout } = await execPromise(`git log ${currentCommit.trim()}..${remoteCommit.trim()} --oneline`, {
                cwd: PROJECT_ROOT,
                shell: 'powershell.exe'
            });
            changes = stdout.split('\n').filter(line => line.trim());
        }

        // Recuperar la versión remota desde el archivo version.json en la rama remota
        let newVersion = '';
        if (hasUpdates) {
            try {
                const { stdout } = await execPromise(`git show origin/main:version.json`, {
                    cwd: PROJECT_ROOT,
                    shell: 'powershell.exe'
                });
                const remoteVersionData = JSON.parse(stdout);
                newVersion = remoteVersionData.version || '';
            } catch {
                try {
                    const { stdout } = await execPromise(`git show origin/master:version.json`, {
                        cwd: PROJECT_ROOT,
                        shell: 'powershell.exe'
                    });
                    const remoteVersionData = JSON.parse(stdout);
                    newVersion = remoteVersionData.version || '';
                } catch {
                    newVersion = '';
                }
            }
        }

        return {
            hasUpdates,
            currentCommit: currentCommit.trim().substring(0, 7),
            remoteCommit: remoteCommit.trim().substring(0, 7),
            remoteVersion: newVersion,
            changes: changes.slice(0, 10)
        };
    } catch (error) {
        await writeLog(`Error checking updates: ${error.message}`, 'ERROR');
        throw error;
    }
}

// Función para reiniciar la aplicación usando tus scripts batch
async function restartApp() {
    try {
        await writeLog('Restarting application using scheduled tasks...');

        // Opción 1: Reiniciar las tareas programadas
        // Suponiendo que tienes tareas programadas llamadas "t_api" y "t_front"

        // Detener las tareas si están corriendo
        await execPromise('schtasks /end /tn "t_api"', { shell: 'powershell.exe' }).catch(() => { });
        await execPromise('schtasks /end /tn "t_front"', { shell: 'powershell.exe' }).catch(() => { });

        // Esperar un momento
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Iniciar las tareas nuevamente
        await execPromise('schtasks /run /tn "t_api"', { shell: 'powershell.exe' });
        await execPromise('schtasks /run /tn "t_front"', { shell: 'powershell.exe' });

        await writeLog('Scheduled tasks restarted successfully');
        return true;

    } catch (error) {
        await writeLog(`Error restarting scheduled tasks: ${error.message}`, 'ERROR');

        // Opción 2: Fallback - Ejecutar los scripts batch directamente
        try {
            await writeLog('Fallback: Starting scripts directly...');

            // Iniciar API
            const apiScript = path.join(UTILS_DIR, 'startApi.bat');
            const frontScript = path.join(UTILS_DIR, 'startFront.bat');

            // Ejecutar scripts en segundo plano
            const { spawn } = require('child_process');

            spawn('cmd.exe', ['/c', 'start', '/min', apiScript], {
                detached: true,
                stdio: 'ignore'
            }).unref();

            spawn('cmd.exe', ['/c', 'start', '/min', frontScript], {
                detached: true,
                stdio: 'ignore'
            }).unref();

            await writeLog('Scripts started in background');
            return true;

        } catch (fallbackError) {
            await writeLog(`Fallback also failed: ${fallbackError.message}`, 'ERROR');
            return false;
        }
    }
}

// Función para detener la aplicación actual
async function stopCurrentApp() {
    try {
        await writeLog('Stopping current application...');

        // Detener el proceso actual de Node.js
        // Esto es necesario porque vamos a actualizar los archivos
        await execPromise('taskkill /F /IM node.exe', { shell: 'powershell.exe' }).catch(() => { });

        // Esperar un momento
        await new Promise(resolve => setTimeout(resolve, 3000));

        await writeLog('Current application stopped');
        return true;
    } catch (error) {
        await writeLog(`Error stopping app: ${error.message}`, 'ERROR');
        return false;
    }
}

// Función principal de actualización - VERSIÓN CORREGIDA
async function performUpdate() {
    const updateId = Date.now();
    await writeLog(`=== Starting update process ${updateId} ===`);

    try {
        // 1. Verificar estado inicial
        await updateStatus('updating', 'checking', 'Verificando actualizaciones disponibles...');
        await writeLog('Step 1: Checking for updates');

        const updateInfo = await checkForUpdates();
        if (!updateInfo.hasUpdates) {
            await updateStatus('idle', 'completed', 'No hay actualizaciones disponibles');
            await writeLog('No updates available');
            return { success: false, message: 'No hay actualizaciones disponibles' };
        }

        // 2. Descargar cambios (sin detener nada)
        await updateStatus('updating', 'fetching', 'Descargando cambios desde GitHub...');
        await writeLog('Step 2: Fetching changes from GitHub');
        await execPromise('git fetch origin', {
            cwd: PROJECT_ROOT,
            shell: 'powershell.exe'
        });

        // 3. Guardar cambios locales si existen
        await updateStatus('updating', 'stashing', 'Guardando cambios locales temporales...');
        await writeLog('Step 3: Stashing local changes');
        try {
            await execPromise('git stash push -m "Auto-stash before update"', {
                cwd: PROJECT_ROOT,
                shell: 'powershell.exe'
            });
        } catch (error) {
            await writeLog('No changes to stash or stash failed', 'WARN');
        }

        // 4. Actualizar código
        await updateStatus('updating', 'updating', 'Actualizando código desde GitHub...');
        await writeLog('Step 4: Pulling changes');

        let pullSuccess = false;
        try {
            await execPromise('git pull origin main', {
                cwd: PROJECT_ROOT,
                shell: 'powershell.exe'
            });
            pullSuccess = true;
        } catch {
            try {
                await execPromise('git pull origin master', {
                    cwd: PROJECT_ROOT,
                    shell: 'powershell.exe'
                });
                pullSuccess = true;
            } catch (pullError) {
                await writeLog(`Pull failed: ${pullError.message}`, 'ERROR');
            }
        }

        if (!pullSuccess) {
            throw new Error('Failed to pull changes');
        }

        // 5. Instalar dependencias
        await updateStatus('updating', 'installing', 'Instalando dependencias...');
        await writeLog('Step 5: Installing dependencies');

        // API dependencies
        await execPromise('npm install', {
            cwd: path.join(PROJECT_ROOT, 'api'),
            shell: 'powershell.exe'
        });

        // Front dependencies
        await execPromise('npm install', {
            cwd: path.join(PROJECT_ROOT, 'front'),
            shell: 'powershell.exe'
        });

        // 6. Ejecutar migraciones si existen
        await updateStatus('updating', 'migrations', 'Ejecutando migraciones de base de datos...');
        await writeLog('Step 6: Running migrations');
        try {
            await execPromise('npm run migrate', {
                cwd: path.join(PROJECT_ROOT, 'api'),
                shell: 'powershell.exe'
            });
        } catch (error) {
            await writeLog(`Migration warning: ${error.message}`, 'WARN');
        }

        // 7. Restaurar cambios guardados
        await updateStatus('updating', 'restoring', 'Restaurando cambios locales...');
        await writeLog('Step 7: Restoring stashed changes');
        try {
            await execPromise('git stash pop', {
                cwd: PROJECT_ROOT,
                shell: 'powershell.exe'
            });
        } catch (error) {
            await writeLog('No stashed changes to restore', 'WARN');
        }

        // 8. Crear script de reinicio en segundo plano
        await updateStatus('updating', 'preparing-restart', 'Preparando reinicio...');
        await writeLog('Step 8: Creating restart script');

        // Asegurar que la carpeta logs existe
        const logsDir = path.join(PROJECT_ROOT, 'logs');
        if (!fs.existsSync(logsDir)) {
            fs.mkdirSync(logsDir, { recursive: true });
        }

        const restartScriptPath = path.join(logsDir, 'restart-after-update.bat');
        const restartLogPath = path.join(logsDir, 'restart.log');

        // Escapar las rutas para Windows
        const escapedProjectRoot = PROJECT_ROOT.replace(/\\/g, '\\\\');
        const escapedRestartLogPath = restartLogPath.replace(/\\/g, '\\\\');

        const restartScriptContent = `@echo off
setlocal enabledelayedexpansion

echo [%date% %time%] ========================================== >> "${restartLogPath}"
echo [%date% %time%] Iniciando script de reinicio post-actualizacion >> "${restartLogPath}"
echo [%date% %time%] ========================================== >> "${restartLogPath}"

REM Obtener el directorio del proyecto
set "PROJECT_ROOT=${escapedProjectRoot}"
echo [%date% %time%] Project Root: !PROJECT_ROOT! >> "${restartLogPath}"

REM Esperar 5 segundos para asegurar que el proceso actual termine
echo [%date% %time%] Esperando 5 segundos... >> "${restartLogPath}"
timeout /t 5 /nobreak > nul

REM Verificar si las tareas existen
echo [%date% %time%] Verificando tareas programadas... >> "${restartLogPath}"
schtasks /query /tn "t_api" > nul 2>&1
if errorlevel 1 (
    echo [%date% %time%] ERROR: Tarea t_api no encontrada >> "${restartLogPath}"
) else (
    echo [%date% %time%] Tarea t_api encontrada >> "${restartLogPath}"
)

schtasks /query /tn "t_front" > nul 2>&1
if errorlevel 1 (
    echo [%date% %time%] ERROR: Tarea t_front no encontrada >> "${restartLogPath}"
) else (
    echo [%date% %time%] Tarea t_front encontrada >> "${restartLogPath}"
)

REM Detener las tareas programadas actuales
echo [%date% %time%] Deteniendo tareas programadas... >> "${restartLogPath}"
schtasks /end /tn "t_api" >> "${restartLogPath}" 2>&1
schtasks /end /tn "t_front" >> "${restartLogPath}" 2>&1

REM Esperar a que los procesos terminen
echo [%date% %time%] Esperando 3 segundos... >> "${restartLogPath}"
timeout /t 3 /nobreak > nul

REM Matar cualquier proceso Node.js remanente
echo [%date% %time%] Limpiando procesos Node.js remanentes... >> "${restartLogPath}"
taskkill /F /IM node.exe >> "${restartLogPath}" 2>&1

REM Esperar adicional
timeout /t 2 /nobreak > nul

REM Iniciar las tareas nuevamente
echo [%date% %time%] Iniciando tareas programadas... >> "${restartLogPath}"
schtasks /run /tn "t_api" >> "${restartLogPath}" 2>&1
if errorlevel 1 (
    echo [%date% %time%] ERROR: No se pudo iniciar t_api >> "${restartLogPath}"
) else (
    echo [%date% %time%] t_api iniciada correctamente >> "${restartLogPath}"
)

schtasks /run /tn "t_front" >> "${restartLogPath}" 2>&1
if errorlevel 1 (
    echo [%date% %time%] ERROR: No se pudo iniciar t_front >> "${restartLogPath}"
) else (
    echo [%date% %time%] t_front iniciada correctamente >> "${restartLogPath}"
)

REM Verificar que los procesos estan corriendo
echo [%date% %time%] Verificando procesos... >> "${restartLogPath}"
timeout /t 3 /nobreak > nul
tasklist /FI "IMAGENAME eq node.exe" >> "${restartLogPath}" 2>&1

echo [%date% %time%] ========================================== >> "${restartLogPath}"
echo [%date% %time%] Reinicio completado >> "${restartLogPath}"
echo [%date% %time%] ========================================== >> "${restartLogPath}"

REM Mantener el script para debug (no borrar)
echo [%date% %time%] Script de reinicio mantenido para debug >> "${restartLogPath}"

exit /b 0
`;

        try {
            await fs.promises.writeFile(restartScriptPath, restartScriptContent, 'utf8');
            await writeLog(`Restart script created successfully at: ${restartScriptPath}`);

            // Verificar que el archivo se creó
            if (fs.existsSync(restartScriptPath)) {
                await writeLog(`Restart script file size: ${(await fs.promises.stat(restartScriptPath)).size} bytes`);
            } else {
                throw new Error('File was not created');
            }
        } catch (error) {
            await writeLog(`Failed to create restart script: ${error.message}`, 'ERROR');
            throw error;
        }
        // 9. Ejecutar el script de reinicio en segundo plano (VERSIÓN CORREGIDA)
        await updateStatus('updating', 'scheduling-restart', 'Programando reinicio...');
        await writeLog('Step 9: Scheduling restart');

        // Verificar que el script existe antes de ejecutarlo
        if (!fs.existsSync(restartScriptPath)) {
            throw new Error(`Restart script not found at: ${restartScriptPath}`);
        }

        // Ejecutar el script de reinicio en un proceso separado
        const { spawn } = require('child_process');

        // Usar diferentes métodos para asegurar que se ejecute
        try {
            // Método 1: Usar start para ejecutar en ventana separada
            const restartProcess = spawn('cmd.exe', ['/c', 'start', '/min', 'cmd.exe', '/c', restartScriptPath], {
                detached: true,
                stdio: 'ignore',
                shell: true
            });
            restartProcess.unref();

            await writeLog(`Restart script executed with method 1 (PID: ${restartProcess.pid})`);
        } catch (error) {
            await writeLog(`Method 1 failed: ${error.message}`, 'WARN');

            // Método 2: Ejecutar directamente
            try {
                const { exec } = require('child_process');
                exec(`"${restartScriptPath}"`, {
                    detached: true,
                    stdio: 'ignore'
                }).unref();

                await writeLog('Restart script executed with method 2');
            } catch (error2) {
                await writeLog(`Method 2 also failed: ${error2.message}`, 'ERROR');
                throw error2;
            }
        }

        // 10. Marcar como completado
        await updateStatus('success', 'completed', 'Actualización completada. La aplicación se reiniciará en unos segundos...');
        await writeLog(`=== Update completed successfully ${updateId} ===`);

        // IMPORTANTE: NO detenemos el proceso actual aquí
        // El script de reinicio se encargará de reiniciar los servicios
        // mientras este proceso continúa ejecutándose hasta que sea reemplazado

        return {
            success: true,
            message: 'Actualización completada. La aplicación se reiniciará en unos segundos.',
            updateInfo
        };

    } catch (error) {
        await writeLog(`=== Update failed ${updateId}: ${error.message} ===`, 'ERROR');
        await updateStatus('error', 'failed', 'Error durante la actualización', error.message);

        // Intentar restaurar estado anterior
        try {
            await execPromise('git stash pop', {
                cwd: PROJECT_ROOT,
                shell: 'powershell.exe'
            }).catch(() => { });
        } catch (restoreError) {
            await writeLog(`Error restoring state: ${restoreError.message}`, 'ERROR');
        }

        return {
            success: false,
            message: `Error durante la actualización: ${error.message}`,
            error: error.message
        };
    }
}

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
        const fullPath = path.normalize(path.join(basePaths[0].path, filename));

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

        // ─── MEJORA 2 ─────────────────────────────────────────────────────────
        // moveFile ahora hace flush al disco (fdatasync) antes de cerrar
        // y asigna permisos 0o644 tras el movimiento, garantizando que el
        // archivo sea legible por el servidor web sin importar la umask del
        // proceso o del sistema de ficheros de destino.
        // ─────────────────────────────────────────────────────────────────────
        await moveFile(req.file.path, fullPath);

        res.json({
            success: true,
            id: mediaId,
            path: fullPath
        });
    } catch (err) {

        // ─── MEJORA 3 ─────────────────────────────────────────────────────────
        // Si algo falla después de que multer escribió el temporal, limpiarlo
        // para no dejar basura en os.tmpdir().
        // ─────────────────────────────────────────────────────────────────────
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
        // Parsear el header Range: bytes=start-end
        const parts = rangeHeader.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

        // Rango inválido
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
        // ─── MEJORA 5 ─────────────────────────────────────────────────────────
        // res.download() reescribe los headers internamente (llama a sendFile
        // que llama a send), pisando los headers CORS que puso el middleware y
        // provocando que el browser rechace la respuesta con status 0 / ERR_FAILED.
        // Siempre usamos createReadStream con headers explícitos para tener
        // control total y garantizar que los CORS headers llegan al cliente.
        // ─────────────────────────────────────────────────────────────────────
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
app.put('/api/files/:id', verifyToken, upload.single("file"), async (req, res) => {
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

app.post('/api/filesystem/create', verifyToken, async (req, res) => {
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

// Endpoint para verificar actualizaciones
app.get('/api/update/check', verifyToken, async (req, res) => {
    // Solo OWNER (id == 1)
    if (req.user.id_user !== 1) {
        return res.status(403).json({ error: "Solo el owner puede verificar actualizaciones" });
    }

    try {
        const updateInfo = await checkForUpdates();
        const status = await getCurrentStatus();

        res.json({
            success: true,
            data: {
                ...updateInfo,
                version: version,
                currentStatus: status
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
app.get('/api/update/status', verifyToken, async (req, res) => {
    // Solo OWNER (id == 1)
    if (req.user.id_user !== 1) {
        return res.status(403).json({ error: "Solo el owner puede ver el estado" });
    }

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
// Endpoint para ejecutar actualización
app.post('/api/update/execute', verifyToken, async (req, res) => {
    // Solo OWNER (id == 1)
    if (req.user.id_user !== 1) {
        return res.status(403).json({ error: "Solo el owner puede ejecutar actualizaciones" });
    }

    try {
        // Iniciar la actualización en segundo plano pero SIN detener el proceso actual
        // La actualización misma se encargará de programar el reinicio
        performUpdate().then(result => {
            writeLog(`Background update completed: ${result.success ? 'success' : 'failed'}`);

            // Si la actualización fue exitosa, el script de reinicio se encargará del resto
            if (result.success) {
                writeLog('Restart scheduled. The application will restart shortly.');
            }
        }).catch(error => {
            writeLog(`Background update error: ${error.message}`, 'ERROR');
        });

        // Responder inmediatamente
        res.json({
            success: true,
            message: 'Actualización iniciada en segundo plano. La aplicación se reiniciará automáticamente.'
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            error: err.message
        });
    }
});

app.get('/api/version', (req, res) => {
    res.json({ version });
});

app.listen(port, () => {
    console.log(`CMS API running on port ${port}`);
});