const express = require('express');
const router = express.Router();
const authController = require('./auth.controller');
const { authMiddleware, requireRole } = require('../../middleware/auth');

router.post('/login', authController.login);
router.get('/profile', authMiddleware, authController.getProfile);
router.get('/users', authMiddleware, requireRole('admin', 'supervisor', 'manager'), authController.getUsers);
router.post('/users', authMiddleware, requireRole('admin', 'manager'), authController.createUser);
router.put('/users/:id', authMiddleware, requireRole('admin', 'manager'), authController.updateUser);
router.put('/users/:id/password', authMiddleware, requireRole('admin', 'manager'), authController.resetPassword);
router.delete('/users/:id', authMiddleware, requireRole('admin'), authController.deleteUser);

module.exports = router;

