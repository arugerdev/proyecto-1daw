const db = require('../config/database');

// ── Categories ──────────────────────────────────────────────────────────────

async function getCategories(req, res) {
    try {
        const [rows] = await db.query(`
            SELECT c.*, COUNT(DISTINCT m.id) as media_count
            FROM categories c
            LEFT JOIN media_items m ON m.category_id = c.id
            GROUP BY c.id
            ORDER BY c.name ASC
        `);
        res.json({ success: true, data: rows });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Error al obtener categorías' });
    }
}

async function createCategory(req, res) {
    const { name, description, color = '#6366f1', icon = 'folder', parent_id } = req.body;
    if (!name) return res.status(400).json({ success: false, error: 'Nombre requerido' });
    try {
        const [result] = await db.query(
            'INSERT INTO categories (name, description, color, icon, parent_id) VALUES (?, ?, ?, ?, ?)',
            [name, description || '', color, icon, parent_id || null]
        );
        res.status(201).json({ success: true, data: { id: result.insertId, name, description, color, icon } });
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ success: false, error: 'Ya existe una categoría con ese nombre' });
        res.status(500).json({ success: false, error: 'Error al crear categoría' });
    }
}

async function updateCategory(req, res) {
    const { name, description, color, icon, parent_id } = req.body;
    try {
        await db.query(
            'UPDATE categories SET name = COALESCE(?, name), description = COALESCE(?, description), color = COALESCE(?, color), icon = COALESCE(?, icon), parent_id = ? WHERE id = ?',
            [name, description, color, icon, parent_id || null, req.params.id]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Error al actualizar categoría' });
    }
}

async function deleteCategory(req, res) {
    try {
        await db.query('UPDATE media_items SET category_id = NULL WHERE category_id = ?', [req.params.id]);
        await db.query('DELETE FROM categories WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Error al eliminar categoría' });
    }
}

// ── Tags ────────────────────────────────────────────────────────────────────

async function getTags(req, res) {
    try {
        const [rows] = await db.query(`
            SELECT t.*, COUNT(DISTINCT mt.media_id) as media_count
            FROM tags t
            LEFT JOIN media_tags mt ON mt.tag_id = t.id
            GROUP BY t.id
            ORDER BY media_count DESC, t.name ASC
        `);
        res.json({ success: true, data: rows });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Error al obtener etiquetas' });
    }
}

async function createTag(req, res) {
    const { name, color = '#6366f1' } = req.body;
    if (!name) return res.status(400).json({ success: false, error: 'Nombre requerido' });
    try {
        const [result] = await db.query('INSERT INTO tags (name, color) VALUES (?, ?)', [name, color]);
        res.status(201).json({ success: true, data: { id: result.insertId, name, color } });
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ success: false, error: 'Etiqueta ya existe' });
        res.status(500).json({ success: false, error: 'Error al crear etiqueta' });
    }
}

async function deleteTag(req, res) {
    try {
        await db.query('DELETE FROM media_tags WHERE tag_id = ?', [req.params.id]);
        await db.query('DELETE FROM tags WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Error al eliminar etiqueta' });
    }
}

module.exports = { getCategories, createCategory, updateCategory, deleteCategory, getTags, createTag, deleteTag };
