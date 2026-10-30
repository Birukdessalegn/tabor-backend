const express = require('express');
const router = express.Router();
const ctrl = require('./room-reservations.controller');
const { authMiddleware } = require('../../middleware/auth');

// All routes require authentication
router.use(authMiddleware);

// Dashboard stats
router.get('/stats', ctrl.getDashboardStats);

// Rooms
router.get('/rooms', ctrl.getRooms);
router.get('/rooms/available', ctrl.getAvailableRooms);
router.get('/room-types', ctrl.getRoomTypes);

// Customers
router.get('/customers', ctrl.getCustomers);

// Reservations
router.get('/', ctrl.getReservations);
router.post('/', ctrl.createReservation);
router.get('/:id', ctrl.getReservationById);
router.patch('/:id/status', ctrl.updateReservationStatus);
router.patch('/:id/amend-price', ctrl.amendReservationPrice);
router.post('/:id/payments', ctrl.recordPayment);

module.exports = router;

