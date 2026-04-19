/**
 * Package-based update service — no git required.
 * Release packages (.zip) are placed in {PROJECT_ROOT}/updates/ or uploaded via admin panel.
 */
const fs   = require('fs');
const path = require('path');
const os   = require('os');
const { exec } = require('child_process');
const { promisify } = require('util');
const https = require('https');
const http  = require('http');

const execAsync = promisify(exec);

// ── Paths ──────────────────────────────────────────────────────────────────
const API_DIR      = path.resolve(__dirname, '../..');        // api/
const PROJECT_ROOT = path.resolve(API_DIR, '..');             // Servidor/
const UPDATES_DIR  = path.join(PROJECT_ROOT, 'updates');
const STATUS_FILE  = path.join(PROJECT_ROOT, 'update-status.json');
const LOG_FILE     = path.join(PROJECT_ROOT, 'logs', 'update.log');
const NODE_ENV     = process.env.NODE_ENV || 'production';
const UPDATE_MANIFEST_URL = process.env.UPDATE_MANIFEST_URL || '';

// Files/dirs never overwritten from a package
const PROTECTED = new Set(['.env', 'node_modules', 'logs', 'uploads', 'thumbnails', 'data', 'updates', 'update-status.json']);

// ── Helpers ────────────────────────────────────────────────────────────────
async function log(msg, level = 'INFO') {
    const line = `[${new Date().toISOString()}] [${level}] ${msg}\n`;
    console.log(line.trim());
    try {
        await fs.promises.mkdir(path.dirname(LOG_FILE), { recursive: true });
        await fs.promises.appendFile(LOG_FILE, line);
    } catch {}
}

async function setStatus(status, step, message, extra = {}) {
    const data = { status, step, message, timestamp: new Date().toISOString(), environment: NODE_ENV, ...extra };
    try { await fs.promises.writeFile(STATUS_FILE, JSON.stringify(data, null, 2)); } catch {}
    return data;
}

async function getStatus() {
    try {
        const raw = await fs.promises.readFile(STATUS_FILE, 'utf8');
        return JSON.parse(raw);
    } catch {
        return { status: 'idle', step: 'none', message: 'Sin actualizaciones previas', timestamp: new Date().toISOString(), environment: NODE_ENV };
    }
}

// ── Version helpers ────────────────────────────────────────────────────────
function getCurrentVersion() {
    try {
        const vpath = path.join(PROJECT_ROOT, 'version.json');
        return JSON.parse(fs.readFileSync(vpath, 'utf8')).version || '2.0.0';
    } catch {
        try { return JSON.parse(fs.readFileSync(path.join(API_DIR, 'package.json'), 'utf8')).version || '2.0.0'; } catch { return '2.0.0'; }
    }
}

function parseVersionFromFilename(filename) {
    const m = filename.match(/v?(\d+\.\d+\.\d+)/);
    return m ? m[1] : null;
}

function versionGt(a, b) {
    const pa = String(a).split('.').map(Number);
    const pb = String(b).split('.').map(Number);
    for (let i = 0; i < 3; i++) {
        if ((pa[i] || 0) > (pb[i] || 0)) return true;
        if ((pa[i] || 0) < (pb[i] || 0)) return false;
    }
    return false;
}

function formatBytes(bytes) {
    if (!bytes) return '0 B';
    const k = 1024, sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

// ── List local packages ────────────────────────────────────────────────────
async function listPackages() {
    try {
        await fs.promises.mkdir(UPDATES_DIR, { recursive: true });
        const files = await fs.promises.readdir(UPDATES_DIR);
        const current = getCurrentVersion();
        const packages = [];
        for (const f of files) {
            if (!f.endsWith('.zip')) continue;
            try {
                const stat = await fs.promises.stat(path.join(UPDATES_DIR, f));
                const version = parseVersionFromFilename(f);
                packages.push({
                    filename: f,
                    version: version || '?',
                    size: stat.size,
                    sizeFormatted: formatBytes(stat.size),
                    date: stat.mtime.toISOString(),
                    isNewer: version ? versionGt(version, current) : null
                });
            } catch {}
        }
        return packages.sort((a, b) => new Date(b.date) - new Date(a.date));
    } catch { return []; }
}

// ── Check remote manifest ──────────────────────────────────────────────────
async function checkRemoteManifest() {
    if (!UPDATE_MANIFEST_URL) return null;
    return new Promise((resolve) => {
        const mod = UPDATE_MANIFEST_URL.startsWith('https') ? https : http;
        const req = mod.get(UPDATE_MANIFEST_URL, { timeout: 10000 }, res => {
            let data = '';
            res.on('data', d => data += d);
            res.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve(null); } });
        });
        req.on('error', () => resolve(null));
        req.on('timeout', () => { req.destroy(); resolve(null); });
    });
}

// ── Check for updates ──────────────────────────────────────────────────────
async function checkForUpdates() {
    const current = getCurrentVersion();
    const packages = await listPackages();
    const hasLocal = packages.some(p => p.isNewer === true);

    let remote = null;
    if (UPDATE_MANIFEST_URL) {
        const manifest = await checkRemoteManifest();
        if (manifest && manifest.version) {
            remote = {
                version: manifest.version,
                changes: manifest.changes || [],
                downloadUrl: manifest.download || '',
                filename: manifest.filename || `release-${manifest.version}.zip`,
                isNewer: versionGt(manifest.version, current)
            };
        }
    }

    return {
        currentVersion: current,
        hasLocalUpdates: hasLocal,
        hasRemoteUpdate: remote?.isNewer || false,
        packages,
        remote,
        manifestConfigured: !!UPDATE_MANIFEST_URL
    };
}

// ── ZIP extraction ─────────────────────────────────────────────────────────
async function extractZip(zipPath, destDir) {
    await fs.promises.mkdir(destDir, { recursive: true });
    const isWin = os.platform() === 'win32';
    if (isWin) {
        await execAsync(
            `powershell.exe -NonInteractive -Command "Expand-Archive -LiteralPath '${zipPath.replace(/'/g, "''")}' -DestinationPath '${destDir.replace(/'/g, "''")}' -Force"`,
            { timeout: 300_000 }
        );
    } else {
        await execAsync(`unzip -o "${zipPath}" -d "${destDir}"`, { timeout: 300_000 });
    }
}

// ── Copy directory (skip protected) ───────────────────────────────────────
async function copyDirectory(src, dest) {
    const entries = await fs.promises.readdir(src, { withFileTypes: true });
    await fs.promises.mkdir(dest, { recursive: true });
    for (const entry of entries) {
        if (PROTECTED.has(entry.name)) continue;
        const srcPath  = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);
        if (entry.isDirectory()) {
            await copyDirectory(srcPath, destPath);
        } else {
            await fs.promises.copyFile(srcPath, destPath);
        }
    }
}

// ── Apply a local package ──────────────────────────────────────────────────
async function applyPackage(filename) {
    // Security: no path traversal
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
        throw new Error('Nombre de paquete inválido');
    }
    const zipPath = path.join(UPDATES_DIR, filename);
    if (!fs.existsSync(zipPath)) throw new Error(`Paquete no encontrado: ${filename}`);

    await log(`=== Aplicando paquete: ${filename} ===`);
    const tempDir = path.join(os.tmpdir(), `ec_update_${Date.now()}`);

    try {
        await setStatus('updating', 'extracting', `Extrayendo ${filename}...`);
        await extractZip(zipPath, tempDir);
        await log('Extracción completada');

        // Find extracted root (package might be nested in a subfolder)
        let extractedRoot = tempDir;
        const entries = await fs.promises.readdir(tempDir);
        if (entries.length === 1) {
            const onlyEntry = path.join(tempDir, entries[0]);
            const stat = await fs.promises.stat(onlyEntry);
            if (stat.isDirectory()) extractedRoot = onlyEntry;
        }

        await setStatus('updating', 'copying', 'Copiando archivos...');
        await copyDirectory(extractedRoot, PROJECT_ROOT);
        await log('Archivos copiados');

        // Install dependencies if api/ was part of the package
        const apiPkg = path.join(extractedRoot, 'api', 'package.json');
        if (fs.existsSync(apiPkg)) {
            await setStatus('updating', 'deps', 'Instalando dependencias de API...');
            await execAsync('npm install --omit=dev', { cwd: path.join(PROJECT_ROOT, 'api'), timeout: 300_000 });
            await log('npm install completado');
        }

        await setStatus('success', 'done', `✅ Paquete "${filename}" aplicado. Reiniciando en 3s...`);
        await log(`=== Actualización completada: ${filename} ===`);

        setTimeout(() => restartApp(), 3000);
        return { success: true };
    } catch (err) {
        await log(`Error: ${err.message}`, 'ERROR');
        await setStatus('error', 'failed', `Error durante la actualización: ${err.message}`, { error: err.message });
        throw err;
    } finally {
        fs.promises.rm(tempDir, { recursive: true, force: true }).catch(() => {});
    }
}

// ── Download remote package ────────────────────────────────────────────────
async function downloadPackage(url, filename) {
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
        throw new Error('Nombre de fichero inválido');
    }
    await fs.promises.mkdir(UPDATES_DIR, { recursive: true });
    const destPath = path.join(UPDATES_DIR, filename);
    return new Promise((resolve, reject) => {
        const mod = url.startsWith('https') ? https : http;
        const file = fs.createWriteStream(destPath);
        mod.get(url, res => {
            if (res.statusCode !== 200) {
                file.close();
                fs.unlink(destPath, () => {});
                return reject(new Error(`HTTP ${res.statusCode}`));
            }
            res.pipe(file);
            file.on('finish', () => { file.close(); resolve(destPath); });
        }).on('error', err => { file.close(); fs.unlink(destPath, () => {}); reject(err); });
    });
}

// ── Restart application ────────────────────────────────────────────────────
async function restartApp() {
    try {
        // Try PM2 first (cross-platform)
        try { await execAsync('pm2 restart all', { timeout: 15_000 }); return; } catch {}
        // Windows: scheduled tasks
        if (os.platform() === 'win32') {
            const taskName = 'EcijaComarca_API';
            try {
                await execAsync(`schtasks /end /tn "${taskName}"`, { shell: 'powershell.exe', timeout: 10_000 }).catch(() => {});
                await new Promise(r => setTimeout(r, 2000));
                await execAsync(`schtasks /run /tn "${taskName}"`, { shell: 'powershell.exe', timeout: 10_000 });
                return;
            } catch {}
        }
        // Last resort: exit (requires external watchdog to restart)
        process.exit(0);
    } catch (err) {
        await log(`Restart error: ${err.message}`, 'ERROR');
    }
}

module.exports = {
    checkForUpdates, listPackages, applyPackage, downloadPackage,
    getStatus, setStatus, getCurrentVersion, NODE_ENV
};
