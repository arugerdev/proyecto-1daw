const db = require('../config/database');
const { listDirectory, getDriveRoots } = require('../services/storage.service');

async function getLocations(req, res) {
    try {
        const [rows] = await db.query('SELECT * FROM storage_locations ORDER BY name ASC');
        res.json({ success: true, data: rows });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Error al obtener ubicaciones' });
    }
}

async function createLocation(req, res) {
    const { name, base_path, storage_type = 'local', description } = req.body;
    if (!name || !base_path) return res.status(400).json({ success: false, error: 'Nombre y ruta requeridos' });

    try {
        const [result] = await db.query(
            'INSERT INTO storage_locations (name, base_path, storage_type, description) VALUES (?, ?, ?, ?)',
            [name, base_path, storage_type, description || '']
        );
        res.status(201).json({ success: true, data: { id: result.insertId, name, base_path, storage_type } });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Error al crear ubicación' });
    }
}

async function updateLocation(req, res) {
    const { name, base_path, storage_type, description, is_active } = req.body;
    try {
        await db.query(
            'UPDATE storage_locations SET name = COALESCE(?, name), base_path = COALESCE(?, base_path), storage_type = COALESCE(?, storage_type), description = COALESCE(?, description), is_active = COALESCE(?, is_active) WHERE id = ?',
            [name, base_path, storage_type, description, is_active !== undefined ? (is_active ? 1 : 0) : undefined, req.params.id]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Error al actualizar ubicación' });
    }
}

async function deleteLocation(req, res) {
    try {
        const [rows] = await db.query('SELECT COUNT(*) as count FROM media_items WHERE storage_location_id = ?', [req.params.id]);
        if (rows[0].count > 0) {
            return res.status(409).json({ success: false, error: `Esta ubicación tiene ${rows[0].count} archivos asociados` });
        }
        await db.query('DELETE FROM storage_locations WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Error al eliminar ubicación' });
    }
}

async function browseFilesystem(req, res) {
    const dirPath = req.query.path;
    try {
        const entries = dirPath ? await listDirectory(dirPath) : await getDriveRoots();
        res.json({ success: true, data: entries, current: dirPath || '/' });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Error al explorar sistema de archivos' });
    }
}

module.exports = { getLocations, createLocation, updateLocation, deleteLocation, browseFilesystem };
