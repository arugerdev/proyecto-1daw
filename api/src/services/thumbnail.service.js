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

// Generate a dark-themed SVG thumbnail showing the first lines of a text file.
async function generateTextSvgThumbnail(filePath, mediaId) {
    await ensureThumbDir();
    const thumbPath = path.join(THUMB_DIR, `${mediaId}.svg`);
    if (fs.existsSync(thumbPath)) return thumbPath;

    try {
        const fd = await fs.promises.open(filePath, 'r');
        const buf = Buffer.alloc(900);
        const { bytesRead } = await fd.read(buf, 0, 900, 0);
        await fd.close();

        const content = buf.slice(0, bytesRead).toString('utf8');
        const lines = content.split('\n').slice(0, 10).map(l =>
            l.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
             .replace(/"/g, '&quot;').slice(0, 44)
        );
        const textRows = lines.map((l, i) =>
            `<tspan x="8" y="${15 + i * 13}">${l}</tspan>`
        ).join('');

        const ext = path.extname(filePath).slice(1).toUpperCase().slice(0, 4);
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="150">
<rect width="200" height="150" fill="#0f172a"/>
<rect x="0" y="0" width="200" height="13" fill="#1e293b"/>
<text x="6" y="9.5" font-family="monospace" font-size="7" fill="#475569">${ext || 'TXT'}</text>
<text font-family="monospace" font-size="9" fill="#94a3b8">${textRows}</text>
</svg>`;

        await fs.promises.writeFile(thumbPath, svg, 'utf8');
        return thumbPath;
    } catch {
        return null;
    }
}

async function getThumbnail(mediaId, filePath, mimeType, mediaKind = '') {
    // Check for cached JPEG thumbnail
    const jpegThumb = path.join(THUMB_DIR, `${mediaId}.jpg`);
    if (fs.existsSync(jpegThumb)) return jpegThumb;

    // Check for cached SVG thumbnail (text files)
    const svgThumb = path.join(THUMB_DIR, `${mediaId}.svg`);
    if (fs.existsSync(svgThumb)) return svgThumb;

    if (!filePath || filePath.startsWith('http')) return null;

    if ((mimeType || '').startsWith('video/')) {
        return generateVideoThumbnail(filePath, mediaId);
    }
    if ((mimeType || '').startsWith('image/')) {
        return generateImageThumbnail(filePath, mediaId);
    }
    // Text files and non-PDF documents (HTML, CSS, JS, MD, etc.)
    if (mediaKind === 'text' || (mediaKind === 'document' && !(mimeType || '').includes('pdf'))) {
        return generateTextSvgThumbnail(filePath, mediaId);
    }
    return null;
}

module.exports = { generateVideoThumbnail, generateImageThumbnail, generateTextSvgThumbnail, getThumbnail, THUMB_DIR };
