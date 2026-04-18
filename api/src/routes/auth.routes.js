const router = require('express').Router();
const { login, register, logout, getRole } = require('../controllers/auth.controller');
const { verifyToken } = require('../middleware/auth');

router.post('/login', login);
router.post('/register', register);
router.post('/logout', verifyToken, logout);
router.get('/me', verifyToken, getRole);

module.exports = router;
