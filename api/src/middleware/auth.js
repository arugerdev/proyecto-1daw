const jwt = require('jsonwebtoken');

function verifyToken(req, res, next) {
    const header = req.headers.authorization;
    if (!header) return res.status(401).json({ success: false, error: 'Token requerido' });

    const token = header.startsWith('Bearer ') ? header.slice(7) : header;

    jwt.verify(token, process.env.SECRET_KEY, (err, decoded) => {
        if (err) return res.status(403).json({ success: false, error: 'Token inválido o expirado' });
        req.user = decoded;
        next();
    });
}

module.exports = { verifyToken };
