const express = require('express');
const router = express.Router();
const authController = require('./auth.controller');
const { authMiddleware, requireRole } = require('../../middleware/auth');

router.post('/login', authController.login);
router.get('/profile', authMiddleware, authController.getProfile);
router.get('/users', authMiddleware, requireRole('admin', 'supervisor'), authController.getUsers);
router.post('/users', authMiddleware, requireRole('admin'), authController.createUser);

module.exports = router;

