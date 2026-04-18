const router = require('express').Router();
const ctrl = require('../controllers/users.controller');
const { verifyToken } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');

router.get('/', verifyToken, requirePermission('canManageUsers'), ctrl.getUsers);
router.post('/', verifyToken, requirePermission('canManageUsers'), ctrl.createUser);
router.put('/:id', verifyToken, requirePermission('canManageUsers'), ctrl.updateUser);
router.delete('/:id', verifyToken, requirePermission('canManageUsers'), ctrl.deleteUser);

module.exports = router;
