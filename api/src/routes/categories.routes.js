const router = require('express').Router();
const ctrl = require('../controllers/categories.controller');
const { verifyToken } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');

router.get('/categories', verifyToken, ctrl.getCategories);
router.post('/categories', verifyToken, requirePermission('canManageCategories'), ctrl.createCategory);
router.put('/categories/:id', verifyToken, requirePermission('canManageCategories'), ctrl.updateCategory);
router.delete('/categories/:id', verifyToken, requirePermission('canManageCategories'), ctrl.deleteCategory);

router.get('/tags', verifyToken, ctrl.getTags);
router.post('/tags', verifyToken, requirePermission('canManageCategories'), ctrl.createTag);
router.delete('/tags/:id', verifyToken, requirePermission('canManageCategories'), ctrl.deleteTag);

module.exports = router;
