function errorHandler(err, req, res, next) {
    console.error(`[ERROR] ${req.method} ${req.path}:`, err.message);

    if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ success: false, error: 'Archivo demasiado grande' });
    }

    const status = err.status || err.statusCode || 500;
    const message = err.expose ? err.message : 'Error interno del servidor';

    res.status(status).json({ success: false, error: message });
}

function notFound(req, res) {
    res.status(404).json({ success: false, error: `Ruta no encontrada: ${req.method} ${req.path}` });
}

module.exports = { errorHandler, notFound };
