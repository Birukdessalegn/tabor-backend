const service = require('./room-reservations.service');

async function getRooms(req, res) {
  try {
    const rooms = await service.getRooms(req.query);
    res.json({ success: true, rooms });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

async function getAvailableRooms(req, res) {
  try {
    const { check_in, check_out } = req.query;
    if (!check_in || !check_out) {
      return res.status(400).json({ success: false, message: 'check_in and check_out dates required' });
    }
    const rooms = await service.getAvailableRooms(check_in, check_out);
    res.json({ success: true, rooms });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

async function getRoomTypes(req, res) {
  try {
    const roomTypes = await service.getRoomTypes();
    res.json({ success: true, roomTypes });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

async function getReservations(req, res) {
  try {
    const reservations = await service.getReservations(req.query);
    res.json({ success: true, reservations });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

async function getReservationById(req, res) {
  try {
    const reservation = await service.getReservationById(req.params.id);
    if (!reservation) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, reservation });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

async function createReservation(req, res) {
  try {
    const result = await service.createReservation(req.body, req.user.id);
    res.status(201).json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

async function updateReservationStatus(req, res) {
  try {
    const { status } = req.body;
    if (!status) return res.status(400).json({ success: false, message: 'Status required' });
    await service.updateReservationStatus(req.params.id, status, req.user.id);
    res.json({ success: true, message: `Reservation status updated to ${status}` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

async function amendReservationPrice(req, res) {
  try {
    const { new_rate_per_night, reason } = req.body;
    if (!new_rate_per_night || !reason) {
      return res.status(400).json({ success: false, message: 'New rate and reason required' });
    }
    const result = await service.amendReservationPrice(
      req.params.id, new_rate_per_night, reason, req.user.id
    );
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

async function recordPayment(req, res) {
  try {
    const result = await service.recordPayment(req.params.id, req.body, req.user.id);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

async function getCustomers(req, res) {
  try {
    const customers = await service.getCustomers(req.query.search);
    res.json({ success: true, customers });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

async function getDashboardStats(req, res) {
  try {
    const stats = await service.getDashboardStats();
    res.json({ success: true, stats });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = {
  getRooms,
  getAvailableRooms,
  getRoomTypes,
  getReservations,
  getReservationById,
  createReservation,
  updateReservationStatus,
  amendReservationPrice,
  recordPayment,
  getCustomers,
  getDashboardStats,
};

