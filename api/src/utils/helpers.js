const path = require('path');
const fs = require('fs');

function formatBytes(bytes, decimals = 2) {
    if (!bytes || bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(decimals))} ${sizes[i]}`;
}

async function moveFile(src, dest) {
    await fs.promises.mkdir(path.dirname(dest), { recursive: true });
    try {
        await fs.promises.rename(src, dest);
    } catch (err) {
        if (err.code === 'EXDEV') {
            await copyFile(src, dest);
            await fs.promises.unlink(src);
        } else {
            throw err;
        }
    }
    await fs.promises.chmod(dest, 0o644);
}

function copyFile(src, dest) {
    return new Promise((resolve, reject) => {
        const r = fs.createReadStream(src);
        const w = fs.createWriteStream(dest);
        r.on('error', reject);
        w.on('error', reject);
        w.on('finish', () => {
            fs.fdatasync(w.fd, err => {
                if (err) return reject(err);
                w.close(err2 => err2 ? reject(err2) : resolve());
            });
        });
        r.pipe(w);
    });
}

function sanitizeFilename(name) {
    return name.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').trim();
}

function resolveFilePath(filePath, baseDir) {
    if (!filePath) return null;
    if (isURL(filePath)) return filePath;
    if (path.isAbsolute(filePath)) return filePath;
    if (baseDir) return path.join(baseDir, filePath);
    return filePath;
}

function isURL(str) {
    try {
        const u = new URL(str);
        return u.protocol === 'http:' || u.protocol === 'https:' || u.protocol === 'ftp:';
    } catch {
        return false;
    }
}

function getStorageType(filePath) {
    if (!filePath) return 'local';
    if (isURL(filePath)) return 'url';
    if (filePath.startsWith('\\\\') || filePath.startsWith('smb://')) return 'smb';
    if (filePath.startsWith('ftp://') || filePath.startsWith('sftp://')) return 'ftp';
    return 'local';
}

function getFileExtension(filename) {
    return path.extname(filename || '').toLowerCase().replace('.', '');
}

function getMediaCategory(mimeType, extension) {
    if (!mimeType && !extension) return 'other';
    const mt = (mimeType || '').toLowerCase();
    const ext = (extension || '').toLowerCase();

    if (mt.startsWith('video/') || ['mp4','mkv','avi','mov','wmv','flv','webm','m4v','mpg','mpeg','ts'].includes(ext)) return 'video';
    if (mt.startsWith('audio/') || ['mp3','wav','flac','aac','ogg','m4a','wma','opus'].includes(ext)) return 'audio';
    if (mt.startsWith('image/') || ['jpg','jpeg','png','gif','bmp','webp','svg','tiff','ico'].includes(ext)) return 'image';
    if (mt === 'application/pdf' || ext === 'pdf') return 'document';
    if (['doc','docx','xls','xlsx','ppt','pptx','odt','ods','odp'].includes(ext)) return 'document';
    if (['md','markdown','txt','csv','json','xml','html','css','js','ts'].includes(ext)) return 'text';
    return 'other';
}

module.exports = { formatBytes, moveFile, sanitizeFilename, resolveFilePath, isURL, getStorageType, getFileExtension, getMediaCategory };
