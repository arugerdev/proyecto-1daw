const jwt = require('jsonwebtoken');

function verifyToken(req, res, next) {
    // Accept token from Authorization header OR ?token= query param.
    // The query param is needed for browser-native requests (<video src>, <img src>,
    // Range requests) that cannot include custom Authorization headers.
    const header = req.headers.authorization;
    const queryToken = req.query.token;

    let token;
    if (header?.startsWith('Bearer ')) {
        token = header.slice(7);
    } else if (header) {
        token = header;
    } else if (queryToken) {
        token = queryToken;
    } else {
        return res.status(401).json({ success: false, error: 'Token requerido' });
    }

    jwt.verify(token, process.env.SECRET_KEY, (err, decoded) => {
        if (err) return res.status(403).json({ success: false, error: 'Token inválido o expirado' });
        req.user = decoded;
        next();
    });
}

module.exports = { verifyToken };
