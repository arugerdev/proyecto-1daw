const router = require('express').Router();
const ctrl = require('../controllers/locations.controller');
const { verifyToken } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');

router.get('/', verifyToken, ctrl.getLocations);
router.get('/browse', verifyToken, requirePermission('canAccessAdmin'), ctrl.browseFilesystem);
router.post('/', verifyToken, requirePermission('canManageCategories'), ctrl.createLocation);
router.put('/:id', verifyToken, requirePermission('canManageCategories'), ctrl.updateLocation);
router.delete('/:id', verifyToken, requirePermission('canDelete'), ctrl.deleteLocation);

module.exports = router;
