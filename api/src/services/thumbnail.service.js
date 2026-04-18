const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

let ffmpegPath;
try { ffmpegPath = require('ffmpeg-static'); } catch { ffmpegPath = 'ffmpeg'; }

const THUMB_DIR = path.join(process.env.MEDIA_PATH || path.join(__dirname, '../../../uploads'), '.thumbnails');

async function ensureThumbDir() {
    await fs.promises.mkdir(THUMB_DIR, { recursive: true });
}

async function generateVideoThumbnail(videoPath, mediaId) {
    await ensureThumbDir();
    const thumbPath = path.join(THUMB_DIR, `${mediaId}.jpg`);

    if (fs.existsSync(thumbPath)) return thumbPath;

    const cmd = `"${ffmpegPath}" -ss 00:00:03 -i "${videoPath}" -vframes 1 -q:v 2 -y "${thumbPath}"`;
    try {
        await execAsync(cmd, { timeout: 30000 });
        return thumbPath;
    } catch {
        return null;
    }
}

async function generateImageThumbnail(imagePath, mediaId) {
    await ensureThumbDir();
    const thumbPath = path.join(THUMB_DIR, `${mediaId}.jpg`);
    if (fs.existsSync(thumbPath)) return thumbPath;

    try {
        await fs.promises.copyFile(imagePath, thumbPath);
        return thumbPath;
    } catch {
        return null;
    }
}

async function getThumbnail(mediaId, filePath, mimeType) {
    const thumbPath = path.join(THUMB_DIR, `${mediaId}.jpg`);
    if (fs.existsSync(thumbPath)) return thumbPath;

    if (!filePath || filePath.startsWith('http')) return null;

    if ((mimeType || '').startsWith('video/')) {
        return generateVideoThumbnail(filePath, mediaId);
    }
    if ((mimeType || '').startsWith('image/')) {
        return generateImageThumbnail(filePath, mediaId);
    }
    return null;
}

module.exports = { generateVideoThumbnail, generateImageThumbnail, getThumbnail, THUMB_DIR };
