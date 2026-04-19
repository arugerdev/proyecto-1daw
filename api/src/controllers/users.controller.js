const bcrypt = require('bcryptjs');
const db = require('../config/database');

async function getUsers(req, res) {
    try {
        const showHidden = req.user.role === 'owner';
        const hiddenFilter = showHidden ? '' : 'AND is_hidden = FALSE';
        const [rows] = await db.query(
            `SELECT id, username, role, is_active, created_at FROM users WHERE 1=1 ${hiddenFilter} ORDER BY role DESC, username ASC`
        );
        res.json({ success: true, data: rows });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Error al obtener usuarios' });
    }
}

async function createUser(req, res) {
    const { username, password, role = 'viewer' } = req.body;
    if (!username || !password) {
        return res.status(400).json({ success: false, error: 'Usuario y contraseña requeridos' });
    }

    const allowedRoles = req.user.role === 'owner' ? ['viewer', 'moderator', 'admin', 'owner'] : ['viewer', 'moderator', 'admin'];
    if (!allowedRoles.includes(role)) {
        return res.status(403).json({ success: false, error: 'No puedes asignar ese rol' });
    }

    try {
        const [existing] = await db.query('SELECT id FROM users WHERE username = ?', [username]);
        if (existing.length > 0) return res.status(409).json({ success: false, error: 'El nombre de usuario ya existe' });

        const hash = await bcrypt.hash(password, 12);
        const [result] = await db.query(
            'INSERT INTO users (username, password, role) VALUES (?, ?, ?)',
            [username, hash, role]
        );
        res.status(201).json({ success: true, data: { id: result.insertId, username, role } });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Error al crear usuario' });
    }
}

async function updateUser(req, res) {
    const { username, password, role, is_active } = req.body;
    const targetId = parseInt(req.params.id);

    try {
        const [rows] = await db.query('SELECT id, role, is_hidden FROM users WHERE id = ?', [targetId]);
        if (!rows.length) return res.status(404).json({ success: false, error: 'Usuario no encontrado' });

        const target = rows[0];
        if (target.is_hidden && req.user.role !== 'owner') {
            return res.status(403).json({ success: false, error: 'No puedes modificar ese usuario' });
        }

        const updates = [];
        const params = [];

        if (username) { updates.push('username = ?'); params.push(username); }
        if (password) {
            const hash = await bcrypt.hash(password, 12);
            updates.push('password = ?');
            params.push(hash);
        }
        if (role) {
            const allowedRoles = req.user.role === 'owner' ? ['viewer', 'moderator', 'admin', 'owner'] : ['viewer', 'moderator', 'admin'];
            if (!allowedRoles.includes(role)) return res.status(403).json({ success: false, error: 'Rol no permitido' });
            updates.push('role = ?');
            params.push(role);
        }
        if (is_active !== undefined) { updates.push('is_active = ?'); params.push(is_active ? 1 : 0); }

        if (updates.length === 0) return res.status(400).json({ success: false, error: 'Nada que actualizar' });

        params.push(targetId);
        await db.query(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params);

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Error al actualizar usuario' });
    }
}

async function deleteUser(req, res) {
    const targetId = parseInt(req.params.id);

    try {
        const [rows] = await db.query('SELECT id, role, is_hidden FROM users WHERE id = ?', [targetId]);
        if (!rows.length) return res.status(404).json({ success: false, error: 'Usuario no encontrado' });

        if (rows[0].is_hidden) return res.status(403).json({ success: false, error: 'No puedes eliminar ese usuario' });
        if (rows[0].role === 'owner' && req.user.role !== 'owner') {
            return res.status(403).json({ success: false, error: 'No puedes eliminar al propietario' });
        }
        if (targetId === req.user.id) return res.status(400).json({ success: false, error: 'No puedes eliminarte a ti mismo' });

        await db.query('DELETE FROM users WHERE id = ?', [targetId]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Error al eliminar usuario' });
    }
}

module.exports = { getUsers, createUser, updateUser, deleteUser };
