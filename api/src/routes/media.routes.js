const router = require('express').Router();
const upload = require('../config/multer');
const ctrl = require('../controllers/media.controller');
const { verifyToken } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');

router.get('/', verifyToken, ctrl.getMedia);
router.get('/:id', verifyToken, ctrl.getMediaById);
// /stream for browser <video>/<audio>/<img> (inline, Range-enabled).
// /download for forced attachment — requires canDownload permission.
router.get('/:id/stream',      verifyToken, ctrl.streamMedia);
router.get('/:id/download',    verifyToken, requirePermission('canDownload'), ctrl.downloadMedia);
router.get('/:id/thumbnail',   verifyToken, ctrl.getThumbnailHandler);
router.get('/:id/textpreview', verifyToken, ctrl.getTextPreview);

router.post('/upload', verifyToken, requirePermission('canUpload'), upload.single('file'), ctrl.uploadMedia);
router.post('/register', verifyToken, requirePermission('canUpload'), ctrl.registerExternalMedia);
router.post('/analyze-csv', verifyToken, requirePermission('canImportCSV'), upload.single('file'), ctrl.analyzeCSVHandler);
router.post('/import-csv', verifyToken, requirePermission('canImportCSV'), upload.single('file'), ctrl.importCSV);

router.put('/:id', verifyToken, requirePermission('canEdit'), ctrl.updateMedia);
router.delete('/:id', verifyToken, requirePermission('canDelete'), ctrl.deleteMedia);

module.exports = router;
