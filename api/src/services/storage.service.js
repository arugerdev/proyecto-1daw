const fs = require('fs');
const path = require('path');
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

async function getDriveRoots() {
    if (process.platform === 'win32') {
        const drives = [];
        for (let i = 65; i <= 90; i++) {
            const drive = `${String.fromCharCode(i)}:\\`;
            try {
                await fs.promises.access(drive);
                drives.push({ name: drive, path: drive, isDirectory: true });
            } catch {}
        }
        return drives;
    }
    return [{ name: '/', path: '/', isDirectory: true }];
}

module.exports = { saveUploadedFile, deleteFile, fileExists, getFileSize, listDirectory, getDriveRoots, DEFAULT_UPLOAD_DIR };
