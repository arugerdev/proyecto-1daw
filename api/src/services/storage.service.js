const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');
const execFileAsync = promisify(execFile);
const { moveFile, isURL, getStorageType } = require('../utils/helpers');

const DEFAULT_UPLOAD_DIR = process.env.MEDIA_PATH || path.join(__dirname, '../../../uploads');

async function saveUploadedFile(tmpPath, filename, locationPath) {
    const targetDir = locationPath || DEFAULT_UPLOAD_DIR;
    await fs.promises.mkdir(targetDir, { recursive: true });
    const dest = path.join(targetDir, filename);
    await moveFile(tmpPath, dest);
    return dest;
}

async function deleteFile(filePath) {
    if (!filePath || isURL(filePath)) return;
    try {
        await fs.promises.unlink(filePath);
    } catch (err) {
        if (err.code !== 'ENOENT') throw err;
    }
}

async function fileExists(filePath) {
    if (isURL(filePath)) return true;
    try {
        await fs.promises.access(filePath, fs.constants.F_OK);
        return true;
    } catch {
        return false;
    }
}

async function getFileSize(filePath) {
    if (isURL(filePath)) return 0;
    try {
        const stat = await fs.promises.stat(filePath);
        return stat.size;
    } catch {
        return 0;
    }
}

async function listDirectory(dirPath) {
    try {
        const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
        return entries.map(e => ({
            name: e.name,
            path: path.join(dirPath, e.name),
            isDirectory: e.isDirectory()
        }));
    } catch {
        return [];
    }
}

/**
 * Enumerate available drive roots. On Windows we rely on PowerShell's
 * `Get-PSDrive -PSProvider FileSystem` which covers every mount point the
 * process can see: physical drives, SUBST virtual drives, mapped network
 * drives (net use), removable media and external disks. We fall back to the
 * A-Z scan if PowerShell is unavailable for any reason.
 */
async function getDriveRoots() {
    if (process.platform !== 'win32') {
        return [{ name: '/', path: '/', isDirectory: true }];
    }

    const drives = await getWindowsDrivesViaPowerShell();
    if (drives && drives.length > 0) return drives;

    // Fallback: brute-force A-Z scan (misses virtual/network drives but always works)
    const fallback = [];
    for (let i = 65; i <= 90; i++) {
        const drive = `${String.fromCharCode(i)}:\\`;
        try {
            await fs.promises.access(drive);
            fallback.push({ name: drive, path: drive, isDirectory: true });
        } catch {}
    }
    return fallback;
}

/**
 * Call PowerShell once to list all FileSystem PSDrives. Returns null on any
 * error (the caller falls back to a brute-force A-Z scan).
 *
 * The PowerShell output includes:
 *   - Name:        e.g. "C", "Z", "X"
 *   - Root:        e.g. "C:\", "Z:\"
 *   - DisplayRoot: only populated for network/substituted drives, e.g.
 *                  "\\server\share" or "C:\mapped\folder"
 *   - Description: free text
 */
async function getWindowsDrivesViaPowerShell() {
    try {
        const ps = 'Get-PSDrive -PSProvider FileSystem ' +
                   '| Select-Object Name, Root, DisplayRoot, Description ' +
                   '| ConvertTo-Json -Compress -Depth 2';
        const { stdout } = await execFileAsync('powershell.exe', [
            '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass',
            '-Command', ps
        ], { timeout: 8000, windowsHide: true });

        if (!stdout || !stdout.trim()) return null;

        let parsed = JSON.parse(stdout);
        // Single drive -> PS emits an object, multiple -> array
        if (!Array.isArray(parsed)) parsed = [parsed];

        return parsed
            .filter(d => d && d.Root)
            .map(d => {
                const root = String(d.Root).endsWith('\\') ? d.Root : d.Root + '\\';
                const label = d.DisplayRoot
                    ? `${root}  →  ${d.DisplayRoot}`
                    : (d.Description ? `${root}  (${d.Description})` : root);
                return { name: label, path: root, isDirectory: true };
            });
    } catch {
        return null;
    }
}

module.exports = { saveUploadedFile, deleteFile, fileExists, getFileSize, listDirectory, getDriveRoots, DEFAULT_UPLOAD_DIR };
