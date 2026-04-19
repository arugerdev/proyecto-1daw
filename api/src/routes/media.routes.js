const router = require('express').Router();
const upload = require('../config/multer');
const ctrl = require('../controllers/media.controller');
const { verifyToken } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');

router.get('/', verifyToken, ctrl.getMedia);
router.get('/:id', verifyToken, ctrl.getMediaById);
// /stream and /download use the same handler; /stream for browser <video> elements,
// /download for forced attachment downloads.
router.get('/:id/stream',   verifyToken, ctrl.streamMedia);
router.get('/:id/download', verifyToken, ctrl.downloadMedia);
router.get('/:id/thumbnail', verifyToken, ctrl.getThumbnailHandler);

router.post('/upload', verifyToken, requirePermission('canUpload'), upload.single('file'), ctrl.uploadMedia);
router.post('/register', verifyToken, requirePermission('canUpload'), ctrl.registerExternalMedia);
router.post('/import-csv', verifyToken, requirePermission('canImportCSV'), upload.single('file'), ctrl.importCSV);

router.put('/:id', verifyToken, requirePermission('canEdit'), ctrl.updateMedia);
router.delete('/:id', verifyToken, requirePermission('canDelete'), ctrl.deleteMedia);

module.exports = router;
