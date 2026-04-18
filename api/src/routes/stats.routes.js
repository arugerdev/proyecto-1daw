const router = require('express').Router();
const multer = require('multer');
const fs     = require('fs');
const path   = require('path');

const { getStats }    = require('../controllers/stats.controller');
const { verifyToken } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');
const {
    checkForUpdates, listPackages, applyPackage, downloadPackage,
    getStatus, getCurrentVersion, NODE_ENV
} = require('../services/update.service');

// Multer: save uploaded packages directly to updates/
const API_DIR      = path.resolve(__dirname, '../..');
const PROJECT_ROOT = path.resolve(API_DIR, '..');
const UPDATES_DIR  = path.join(PROJECT_ROOT, 'updates');

const pkgUpload = multer({
    storage: multer.diskStorage({
        destination: (req, file, cb) => {
            fs.mkdirSync(UPDATES_DIR, { recursive: true });
            cb(null, UPDATES_DIR);
        },
        filename: (req, file, cb) => cb(null, file.originalname)
    }),
    fileFilter: (req, file, cb) => {
        if (file.originalname.endsWith('.zip')) cb(null, true);
        else cb(new Error('Solo se permiten archivos .zip'));
    },
    limits: { fileSize: 2 * 1024 * 1024 * 1024 } // 2 GB for release packages
});

// ── Stats & version ────────────────────────────────────────────────────────
router.get('/stats', verifyToken, getStats);

router.get('/version', (req, res) => {
    res.json({ success: true, version: getCurrentVersion(), environment: NODE_ENV });
});

// ── Updates ────────────────────────────────────────────────────────────────
const guard = [verifyToken, requirePermission('canPerformUpdates')];

router.get('/update/status', ...guard, async (req, res) => {
    try { res.json({ success: true, ...(await getStatus()) }); }
    catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

router.get('/update/check', ...guard, async (req, res) => {
    try { res.json({ success: true, ...(await checkForUpdates()) }); }
    catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

router.get('/update/packages', ...guard, async (req, res) => {
    try {
        const packages = await listPackages();
        res.json({ success: true, currentVersion: getCurrentVersion(), packages });
    } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

router.post('/update/upload', ...guard, pkgUpload.single('package'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ success: false, error: 'No se recibió ningún paquete' });
        const packages = await listPackages();
        res.json({ success: true, filename: req.file.originalname, packages });
    } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

router.post('/update/download', ...guard, async (req, res) => {
    try {
        const { url, filename } = req.body;
        if (!url || !filename) return res.status(400).json({ success: false, error: 'url y filename son requeridos' });
        res.json({ success: true, message: 'Descarga iniciada en segundo plano' });
        downloadPackage(url, filename).catch(err => console.error('[update] download error:', err));
    } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

router.post('/update/apply', ...guard, async (req, res) => {
    try {
        const { filename } = req.body;
        if (!filename) return res.status(400).json({ success: false, error: 'filename es requerido' });
        res.json({ success: true, message: 'Actualización iniciada en segundo plano' });
        applyPackage(filename).catch(err => console.error('[update] apply error:', err));
    } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

module.exports = router;
