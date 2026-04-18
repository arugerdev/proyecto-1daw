const { hasPermission } = require('../utils/permissions');

function requirePermission(permission) {
    return (req, res, next) => {
        if (!req.user) return res.status(401).json({ success: false, error: 'No autenticado' });
        if (!hasPermission(req.user.role, permission)) {
            return res.status(403).json({ success: false, error: 'Permisos insuficientes' });
        }
        next();
    };
}

function requireRole(...roles) {
    return (req, res, next) => {
        if (!req.user) return res.status(401).json({ success: false, error: 'No autenticado' });
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ success: false, error: 'Rol insuficiente' });
        }
        next();
    };
}

module.exports = { requirePermission, requireRole };
