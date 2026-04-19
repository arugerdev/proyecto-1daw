const fs = require('fs');
const path = require('path');
const mime = require('mime-types');
const db = require('../config/database');
const { saveUploadedFile, deleteFile, fileExists, getFileSize, DEFAULT_UPLOAD_DIR } = require('../services/storage.service');
const { getThumbnail } = require('../services/thumbnail.service');
const { processCSV } = require('../services/csv.service');
const { getFileExtension, getMediaCategory, getStorageType, formatBytes } = require('../utils/helpers');

async function getMedia(req, res) {
    try {
        const {
            search = '',
            type = '',
            category = '',
            tag = '',
            year = '',
            sort = 'newest',
            page = 1,
            limit = 24,
            view = 'all'
        } = req.query;

        const offset = (parseInt(page) - 1) * parseInt(limit);
        const params = [];
        let where = 'WHERE 1=1';

        if (search) {
            where += ' AND (m.title LIKE ? OR m.description LIKE ?)';
            params.push(`%${search}%`, `%${search}%`);
        }
        if (type) {
            where += ' AND m.media_kind = ?';
            params.push(type);
        }
        if (category) {
            where += ' AND (c.id = ? OR c.name = ?)';
            params.push(category, category);
        }
        if (year) {
            where += ' AND m.publication_year = ?';
            params.push(parseInt(year));
        }
        if (tag) {
            where += ' AND EXISTS (SELECT 1 FROM media_tags mt JOIN tags t ON mt.tag_id = t.id WHERE mt.media_id = m.id AND t.name = ?)';
            params.push(tag);
        }

        const orderMap = {
            newest:     'm.created_at DESC',
            oldest:     'm.created_at ASC',
            title_asc:  'm.title ASC',
            title_desc: 'm.title DESC',
            year_desc:  'm.publication_year DESC',
            year_asc:   'm.publication_year ASC',
            size_desc:  'm.file_size DESC',
            size_asc:   'm.file_size ASC',
            views:      'm.view_count DESC'
        };
        const orderBy = orderMap[sort] || 'm.created_at DESC';

        const countSql = `SELECT COUNT(DISTINCT m.id) as total FROM media_items m LEFT JOIN categories c ON m.category_id = c.id ${where}`;
        const [countRows] = await db.query(countSql, params);
        const total = countRows[0].total;

        const sql = `
            SELECT m.*, c.name as category_name, c.color as category_color, c.icon as category_icon,
                   sl.name as location_name, sl.base_path as location_path, sl.storage_type,
                   u.username as created_by_name,
                   GROUP_CONCAT(DISTINCT t.name ORDER BY t.name SEPARATOR ',') as tags
            FROM media_items m
            LEFT JOIN categories c ON m.category_id = c.id
            LEFT JOIN storage_locations sl ON m.storage_location_id = sl.id
            LEFT JOIN users u ON m.created_by = u.id
            LEFT JOIN media_tags mt ON mt.media_id = m.id
            LEFT JOIN tags t ON mt.tag_id = t.id
            ${where}
            GROUP BY m.id
            ORDER BY ${orderBy}
            LIMIT ? OFFSET ?
        `;

        const [rows] = await db.query(sql, [...params, parseInt(limit), offset]);

        const items = rows.map(row => ({
            ...row,
            tags: row.tags ? row.tags.split(',') : [],
            file_size_formatted: formatBytes(row.file_size)
        }));

        res.json({
            success: true,
            data: items,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / parseInt(limit))
            }
        });
    } catch (err) {
        console.error('[media] getMedia error:', err);
        res.status(500).json({ success: false, error: 'Error al obtener archivos' });
    }
}

async function getMediaById(req, res) {
    try {
        const [rows] = await db.query(`
            SELECT m.*, c.name as category_name, c.color as category_color,
                   sl.name as location_name, sl.base_path as location_path,
                   u.username as created_by_name,
                   GROUP_CONCAT(DISTINCT t.name ORDER BY t.name SEPARATOR ',') as tags
            FROM media_items m
            LEFT JOIN categories c ON m.category_id = c.id
            LEFT JOIN storage_locations sl ON m.storage_location_id = sl.id
            LEFT JOIN users u ON m.created_by = u.id
            LEFT JOIN media_tags mt ON mt.media_id = m.id
            LEFT JOIN tags t ON mt.tag_id = t.id
            WHERE m.id = ?
            GROUP BY m.id
        `, [req.params.id]);

        if (!rows.length) return res.status(404).json({ success: false, error: 'Archivo no encontrado' });

        await db.query('UPDATE media_items SET view_count = view_count + 1 WHERE id = ?', [req.params.id]);

        res.json({ success: true, data: { ...rows[0], tags: rows[0].tags ? rows[0].tags.split(',') : [] } });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Error al obtener archivo' });
    }
}

async function uploadMedia(req, res) {
    try {
        if (!req.file) return res.status(400).json({ success: false, error: 'No se recibió ningún archivo' });

        const { title, description, publication_year, category_id, storage_location_id, tags } = req.body;
        const filename = req.file.filename;
        const mimeType = mime.lookup(req.file.originalname) || req.file.mimetype || 'application/octet-stream';
        const extension = getFileExtension(req.file.originalname);
        const mediaKind = getMediaCategory(mimeType, extension);

        let locationPath = DEFAULT_UPLOAD_DIR;
        if (storage_location_id) {
            const [locRows] = await db.query('SELECT base_path FROM storage_locations WHERE id = ?', [storage_location_id]);
            if (locRows[0]) locationPath = locRows[0].base_path;
        }

        const finalPath = await saveUploadedFile(req.file.path, filename, locationPath);
        const fileSize = await getFileSize(finalPath);

        const [result] = await db.query(
            `INSERT INTO media_items (title, description, file_path, filename, storage_location_id, mime_type, file_size, file_extension, media_kind, publication_year, category_id, created_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                title || req.file.originalname,
                description || '',
                finalPath,
                req.file.originalname,
                storage_location_id || null,
                mimeType,
                fileSize,
                extension,
                mediaKind,
                publication_year ? parseInt(publication_year) : null,
                category_id || null,
                req.user.id
            ]
        );

        const mediaId = result.insertId;

        if (tags) {
            const tagList = (typeof tags === 'string' ? tags.split(',') : tags).map(t => t.trim()).filter(Boolean);
            await syncTags(mediaId, tagList);
        }

        res.status(201).json({ success: true, data: { id: mediaId } });
    } catch (err) {
        console.error('[media] uploadMedia error:', err);
        if (req.file?.path) fs.promises.unlink(req.file.path).catch(() => {});
        res.status(500).json({ success: false, error: 'Error al subir archivo' });
    }
}

async function updateMedia(req, res) {
    try {
        const { title, description, publication_year, category_id, tags } = req.body;
        await db.query(
            'UPDATE media_items SET title = ?, description = ?, publication_year = ?, category_id = ?, updated_at = NOW() WHERE id = ?',
            [title, description, publication_year || null, category_id || null, req.params.id]
        );

        if (tags !== undefined) {
            const tagList = (typeof tags === 'string' ? tags.split(',') : (Array.isArray(tags) ? tags : [])).map(t => t.trim()).filter(Boolean);
            await syncTags(parseInt(req.params.id), tagList);
        }

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Error al actualizar archivo' });
    }
}

async function deleteMedia(req, res) {
    try {
        const [rows] = await db.query('SELECT file_path FROM media_items WHERE id = ?', [req.params.id]);
        if (!rows.length) return res.status(404).json({ success: false, error: 'Archivo no encontrado' });

        await deleteFile(rows[0].file_path);
        await db.query('DELETE FROM media_items WHERE id = ?', [req.params.id]);

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Error al eliminar archivo' });
    }
}

// Shared logic for serving a file with Range support
async function _serveFile(req, res, item, disposition) {
    if (item.file_path.startsWith('http://') || item.file_path.startsWith('https://')) {
        return res.redirect(item.file_path);
    }

    if (!fs.existsSync(item.file_path)) {
        return res.status(404).json({ success: false, error: 'Archivo físico no encontrado' });
    }

    const stat = fs.statSync(item.file_path);
    const mimeType = item.mime_type || mime.lookup(item.file_path) || 'application/octet-stream';
    const range = req.headers.range;
    const encodedName = encodeURIComponent(item.filename || path.basename(item.file_path));

    res.setHeader('Content-Disposition', `${disposition}; filename*=UTF-8''${encodedName}`);
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'no-store');

    if (range) {
        const [startStr, endStr] = range.replace(/bytes=/, '').split('-');
        const start = parseInt(startStr, 10);
        const end   = endStr ? Math.min(parseInt(endStr, 10), stat.size - 1) : stat.size - 1;

        if (isNaN(start) || start >= stat.size || start > end) {
            res.setHeader('Content-Range', `bytes */${stat.size}`);
            return res.status(416).end();
        }

        const chunkSize = end - start + 1;
        res.writeHead(206, {
            'Content-Range':  `bytes ${start}-${end}/${stat.size}`,
            'Content-Length': chunkSize
        });
        fs.createReadStream(item.file_path, { start, end }).pipe(res);
    } else {
        res.setHeader('Content-Length', stat.size);
        fs.createReadStream(item.file_path).pipe(res);
    }
}

// GET /:id/stream — for browser <video>/<audio> elements (inline, range-supported)
async function streamMedia(req, res) {
    try {
        const [rows] = await db.query('SELECT * FROM media_items WHERE id = ?', [req.params.id]);
        if (!rows.length) return res.status(404).json({ success: false, error: 'Archivo no encontrado' });
        await _serveFile(req, res, rows[0], 'inline');
    } catch (err) {
        console.error('[media] streamMedia error:', err);
        if (!res.headersSent) res.status(500).json({ success: false, error: 'Error al reproducir archivo' });
    }
}

// GET /:id/download — forces browser download + increments download_count
async function downloadMedia(req, res) {
    try {
        const [rows] = await db.query('SELECT * FROM media_items WHERE id = ?', [req.params.id]);
        if (!rows.length) return res.status(404).json({ success: false, error: 'Archivo no encontrado' });

        await db.query('UPDATE media_items SET download_count = download_count + 1 WHERE id = ?', [req.params.id]);
        await _serveFile(req, res, rows[0], 'attachment');
    } catch (err) {
        console.error('[media] downloadMedia error:', err);
        if (!res.headersSent) res.status(500).json({ success: false, error: 'Error al descargar archivo' });
    }
}

async function getThumbnailHandler(req, res) {
    try {
        const [rows] = await db.query('SELECT file_path, mime_type FROM media_items WHERE id = ?', [req.params.id]);
        if (!rows.length) return res.status(404).send();

        const thumbPath = await getThumbnail(req.params.id, rows[0].file_path, rows[0].mime_type);
        if (!thumbPath || !fs.existsSync(thumbPath)) return res.status(204).send();

        res.setHeader('Content-Type', 'image/jpeg');
        res.setHeader('Cache-Control', 'public, max-age=86400');
        fs.createReadStream(thumbPath).pipe(res);
    } catch {
        res.status(204).send();
    }
}

async function importCSV(req, res) {
    try {
        if (!req.file) return res.status(400).json({ success: false, error: 'No se recibió archivo CSV' });

        const buffer = await fs.promises.readFile(req.file.path);
        const { records, errors, total, valid } = processCSV(buffer);
        await fs.promises.unlink(req.file.path).catch(() => {});

        if (records.length === 0) {
            return res.status(400).json({ success: false, error: 'No hay registros válidos', errors });
        }

        let imported = 0;
        const importErrors = [];

        for (const record of records) {
            try {
                let categoryId = null;
                if (record.category) {
                    const [catRows] = await db.query('SELECT id FROM categories WHERE name = ?', [record.category]);
                    if (catRows.length > 0) {
                        categoryId = catRows[0].id;
                    } else {
                        const [catResult] = await db.query('INSERT INTO categories (name) VALUES (?)', [record.category]);
                        categoryId = catResult.insertId;
                    }
                }

                let locationId = null;
                const locPath = path.dirname(record.filePath);
                if (locPath && locPath !== '.') {
                    const [locRows] = await db.query('SELECT id FROM storage_locations WHERE base_path = ?', [locPath]);
                    if (locRows.length > 0) {
                        locationId = locRows[0].id;
                    } else {
                        const [locResult] = await db.query(
                            'INSERT INTO storage_locations (name, base_path, storage_type) VALUES (?, ?, ?)',
                            [`Import: ${locPath}`, locPath, record.storageType]
                        );
                        locationId = locResult.insertId;
                    }
                }

                const [mediaResult] = await db.query(
                    `INSERT INTO media_items (title, description, file_path, filename, storage_location_id, mime_type, file_extension, media_kind, publication_year, category_id, created_by)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [record.title, record.description, record.filePath, record.filename, locationId, record.mimeType, record.extension, record.mediaKind, record.year, categoryId, req.user.id]
                );

                if (record.tags.length > 0) {
                    await syncTags(mediaResult.insertId, record.tags);
                }

                imported++;
            } catch (e) {
                importErrors.push(`Error en "${record.title}": ${e.message}`);
            }
        }

        res.json({ success: true, imported, total, valid, errors: [...errors, ...importErrors] });
    } catch (err) {
        console.error('[media] importCSV error:', err);
        res.status(500).json({ success: false, error: 'Error al importar CSV' });
    }
}

async function registerExternalMedia(req, res) {
    try {
        const { title, description, file_path, publication_year, category_id, storage_location_id, tags } = req.body;
        if (!title || !file_path) {
            return res.status(400).json({ success: false, error: 'Título y ruta son requeridos' });
        }

        const filename = path.basename(file_path);
        const extension = getFileExtension(filename);
        const mimeType = mime.lookup(filename) || 'application/octet-stream';
        const mediaKind = getMediaCategory(mimeType, extension);
        const storageType = getStorageType(file_path);

        const [result] = await db.query(
            `INSERT INTO media_items (title, description, file_path, filename, storage_location_id, mime_type, file_extension, media_kind, publication_year, category_id, created_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [title, description || '', file_path, filename, storage_location_id || null, mimeType, extension, mediaKind, publication_year || null, category_id || null, req.user.id]
        );

        if (tags) {
            const tagList = (typeof tags === 'string' ? tags.split(',') : tags).map(t => t.trim()).filter(Boolean);
            await syncTags(result.insertId, tagList);
        }

        res.status(201).json({ success: true, data: { id: result.insertId } });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Error al registrar archivo' });
    }
}

async function syncTags(mediaId, tagNames) {
    // Sanitize: strip tags that exceed the DB column width (VARCHAR 50)
    const safe = tagNames.filter(n => n && n.length <= 50);
    await db.query('DELETE FROM media_tags WHERE media_id = ?', [mediaId]);
    for (const name of safe) {
        const [existing] = await db.query('SELECT id FROM tags WHERE name = ?', [name]);
        let tagId;
        if (existing.length > 0) {
            tagId = existing[0].id;
        } else {
            const [res] = await db.query('INSERT INTO tags (name) VALUES (?)', [name]);
            tagId = res.insertId;
        }
        await db.query('INSERT IGNORE INTO media_tags (media_id, tag_id) VALUES (?, ?)', [mediaId, tagId]);
    }
}

module.exports = { getMedia, getMediaById, uploadMedia, updateMedia, deleteMedia, streamMedia, downloadMedia, getThumbnailHandler, importCSV, registerExternalMedia };
