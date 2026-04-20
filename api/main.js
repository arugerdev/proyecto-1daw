require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const authRoutes      = require('./src/routes/auth.routes');
const mediaRoutes     = require('./src/routes/media.routes');
const usersRoutes     = require('./src/routes/users.routes');
const locationsRoutes = require('./src/routes/locations.routes');
const categoriesRoutes= require('./src/routes/categories.routes');
const statsRoutes     = require('./src/routes/stats.routes');
const { errorHandler, notFound } = require('./src/middleware/error');

const app = express();

app.use(cors({
    origin: (origin, cb) => cb(null, origin || '*'),
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    // Range must be in allowedHeaders so browsers can send partial-content requests
    // (needed for <video> / <audio> cross-origin streaming).
    allowedHeaders: ['Content-Type', 'Authorization', 'Range'],
    // Expose response headers that browsers need to honour Range / streaming.
    exposedHeaders: ['Accept-Ranges', 'Content-Range', 'Content-Length', 'Content-Disposition'],
    credentials: true
}));
app.options(/.*/, cors());

// Body parsers (multipart/file uploads are handled separately by multer)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use('/api/auth',      authRoutes);
app.use('/api/media',     mediaRoutes);
app.use('/api/users',     usersRoutes);
app.use('/api/locations', locationsRoutes);
app.use('/api',           categoriesRoutes);
app.use('/api',           statsRoutes);

app.get('/health', (req, res) => res.json({ status: 'ok', uptime: process.uptime() }));

// ── Serve Angular frontend (production build) ────────────────────────────────
// The built app lives one level up from api/, in front/dist/front/browser/
const frontDist = path.join(__dirname, '..', 'front', 'dist', 'front', 'browser');
if (fs.existsSync(frontDist)) {
    app.use(express.static(frontDist));
    // SPA fallback: any non-API route returns index.html so Angular routing works
    app.get(/^(?!\/api).*/, (req, res) => {
        res.sendFile(path.join(frontDist, 'index.html'));
    });
    console.log(`[API] Serving Angular frontend from ${frontDist}`);
}

app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () =>
    console.log(`[API] Running on port ${PORT} (${process.env.NODE_ENV || 'production'})`)
);

// Allow very long-running uploads (up to 12 hours for 50GB files on slow networks)
const UPLOAD_TIMEOUT = 12 * 60 * 60 * 1000;
server.timeout = UPLOAD_TIMEOUT;
server.keepAliveTimeout = UPLOAD_TIMEOUT;
server.headersTimeout   = UPLOAD_TIMEOUT + 5000;

module.exports = app;
