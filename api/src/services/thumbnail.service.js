const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

let ffmpegPath;
try { ffmpegPath = require('ffmpeg-static'); } catch { ffmpegPath = 'ffmpeg'; }

const THUMB_DIR = path.join(process.env.MEDIA_PATH || path.join(__dirname, '../../../uploads'), '.thumbnails');

/**
 * Thumbnails can be disabled globally via the DISABLE_THUMBNAILS env variable.
 * Useful on resource-constrained servers or when the media folder lives on a
 * slow network share where generating previews adds noticeable latency.
 */
const THUMBNAILS_DISABLED = (process.env.DISABLE_THUMBNAILS || '').toLowerCase() === 'true';

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

/**
 * Generic SVG thumbnail for binary files that don't have a dedicated preview
 * generator (PDF, DOCX, ZIP, EXE, audio, etc.). Shows a large glyph plus the
 * extension badge, colour-coded by kind — keeps the grid visually consistent
 * even for files we can't actually render.
 */
async function generateGenericSvgThumbnail(filePath, mediaId, mediaKind, mimeType = '') {
    await ensureThumbDir();
    const thumbPath = path.join(THUMB_DIR, `${mediaId}.svg`);
    if (fs.existsSync(thumbPath)) return thumbPath;

    try {
        const ext = (path.extname(filePath).slice(1) || mediaKind || 'file')
            .toUpperCase().slice(0, 5);

        // Palette per kind — keep values inline (no theme dependency on the server)
        const palette = {
            document: { bg: '#1c1810', fg: '#fbbf24', accent: '#f59e0b' }, // amber
            audio:    { bg: '#07190f', fg: '#34d399', accent: '#10b981' }, // emerald
            archive:  { bg: '#1a0a12', fg: '#fb7185', accent: '#f43f5e' }, // rose
            other:    { bg: '#0f172a', fg: '#94a3b8', accent: '#64748b' }
        };

        let kind = mediaKind;
        if (/\.(zip|rar|7z|tar|gz)$/i.test(filePath)) kind = 'archive';
        const c = palette[kind] || palette.other;

        // Icon path per kind (simple heroicons-style glyphs)
        const icons = {
            document: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Zm0 0v6h6M9 13h6M9 17h6M9 9h2',
            audio:    'M9 18V5l12-2v13 M6 18a3 3 0 1 0 6 0 3 3 0 0 0-6 0 M15 16a3 3 0 1 0 6 0 3 3 0 0 0-6 0',
            archive:  'M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z M3.27 6.96 12 12.01l8.73-5.05 M12 22.08V12',
            other:    'M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9l-7-7Z M13 2v7h7'
        };
        const iconPath = icons[kind] || icons.other;

        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="150" viewBox="0 0 200 150">
<rect width="200" height="150" fill="${c.bg}"/>
<g transform="translate(70 30)" fill="none" stroke="${c.fg}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" opacity="0.75">
<svg width="60" height="60" viewBox="0 0 24 24"><path d="${iconPath}"/></svg>
</g>
<rect x="0" y="116" width="200" height="34" fill="${c.accent}" opacity="0.12"/>
<text x="100" y="135" text-anchor="middle" font-family="sans-serif" font-size="13" font-weight="600" fill="${c.fg}">${ext}</text>
</svg>`;

        await fs.promises.writeFile(thumbPath, svg, 'utf8');
        return thumbPath;
    } catch {
        return null;
    }
}

async function getThumbnail(mediaId, filePath, mimeType, mediaKind = '') {
    if (THUMBNAILS_DISABLED) return null;

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

    // Plain text, markup, source code — render an actual preview of the contents
    if (mediaKind === 'text') {
        return generateTextSvgThumbnail(filePath, mediaId);
    }

    // Everything else (PDF, DOC, DOCX, XLS, audio, archives, binaries…) gets a
    // generic kind-coloured SVG so every file in the grid has a preview.
    return generateGenericSvgThumbnail(filePath, mediaId, mediaKind || 'other', mimeType);
}

/**
 * Remove any cached thumbnail files for a given media id (both the .jpg and
 * .svg variants). Called from the delete-media flow so we don't leak storage.
 */
async function deleteThumbnail(mediaId) {
    for (const ext of ['jpg', 'svg']) {
        const p = path.join(THUMB_DIR, `${mediaId}.${ext}`);
        try { await fs.promises.unlink(p); } catch { /* not there, ignore */ }
    }
}

module.exports = {
    generateVideoThumbnail,
    generateImageThumbnail,
    generateTextSvgThumbnail,
    generateGenericSvgThumbnail,
    getThumbnail,
    deleteThumbnail,
    THUMB_DIR,
    THUMBNAILS_DISABLED
};
