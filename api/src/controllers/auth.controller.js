const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/database');
const { getPermissions } = require('../utils/permissions');

const SECRET = () => process.env.SECRET_KEY;
const TOKEN_EXPIRY = '7d';

function signToken(payload) {
    return jwt.sign(payload, SECRET(), { expiresIn: TOKEN_EXPIRY });
}

async function login(req, res) {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ success: false, error: 'Usuario y contraseña requeridos' });
    }

    try {
        const [rows] = await db.query(
            'SELECT id, username, password, role, is_active FROM users WHERE username = ? LIMIT 1',
            [username]
        );
        const user = rows[0];

        if (!user || !user.is_active) {
            return res.status(401).json({ success: false, error: 'Credenciales incorrectas' });
        }

        const valid = await bcrypt.compare(password, user.password);
        if (!valid) return res.status(401).json({ success: false, error: 'Credenciales incorrectas' });

        const token = signToken({ id: user.id, username: user.username, role: user.role });

        await db.query(
            'INSERT INTO sessions (user_id, token, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 7 DAY))',
            [user.id, token]
        );

        const permissions = getPermissions(user.role);

        res.json({
            success: true,
            token,
            user: { id: user.id, username: user.username, role: user.role },
            permissions
        });
    } catch (err) {
        console.error('[auth] login error:', err);
        res.status(500).json({ success: false, error: 'Error del servidor' });
    }
}

async function register(req, res) {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ success: false, error: 'Usuario y contraseña requeridos' });
    }
    if (password.length < 6) {
        return res.status(400).json({ success: false, error: 'La contraseña debe tener al menos 6 caracteres' });
    }

    try {
        const [existing] = await db.query('SELECT id FROM users WHERE username = ?', [username]);
        if (existing.length > 0) {
            return res.status(409).json({ success: false, error: 'El nombre de usuario ya existe' });
        }

        const hash = await bcrypt.hash(password, 12);
        const [result] = await db.query(
            'INSERT INTO users (username, password, role) VALUES (?, ?, "viewer")',
            [username, hash]
        );

        const token = signToken({ id: result.insertId, username, role: 'viewer' });
        await db.query(
            'INSERT INTO sessions (user_id, token, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 7 DAY))',
            [result.insertId, token]
        );

        res.status(201).json({
            success: true,
            token,
            user: { id: result.insertId, username, role: 'viewer' },
            permissions: getPermissions('viewer')
        });
    } catch (err) {
        console.error('[auth] register error:', err);
        res.status(500).json({ success: false, error: 'Error del servidor' });
    }
}

async function logout(req, res) {
    const token = req.headers.authorization?.slice(7);
    if (token) {
        await db.query('DELETE FROM sessions WHERE token = ?', [token])
            .catch(err => console.warn('[auth] logout session delete failed:', err.message));
    }
    res.json({ success: true });
}

async function getRole(req, res) {
    try {
        const [rows] = await db.query(
            'SELECT id, username, role, is_active FROM users WHERE id = ? LIMIT 1',
            [req.user.id]
        );
        const user = rows[0];
        if (!user || !user.is_active) {
            return res.status(401).json({ success: false, error: 'Sesión inválida' });
        }
        res.json({
            success: true,
            user: { id: user.id, username: user.username, role: user.role },
            permissions: getPermissions(user.role)
        });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Error del servidor' });
    }
}

module.exports = { login, register, logout, getRole };
