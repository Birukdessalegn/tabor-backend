const pool = require('../../database/pool');

// Generate unique reservation code
function generateReservationCode() {
  const prefix = 'TAB';
  const year = new Date().getFullYear();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}-${year}-${random}`;
}

// Get all rooms with type info and availability
async function getRooms(filters = {}) {
  let query = `
    SELECT
      r.id,
      r.room_number,
      r.floor,
      r.status,
      r.description,
      rt.id AS room_type_id,
      rt.name AS room_type_name,
      rt.base_rate,
      rt.max_occupancy,
      rt.amenities
    FROM rooms r
    LEFT JOIN room_types rt ON r.room_type_id = rt.id
  `;
  const params = [];
  const conditions = [];

  if (filters.status) {
    params.push(filters.status);
    conditions.push(`r.status = $${params.length}`);
  }

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }

  query += ' ORDER BY r.floor, r.room_number';
  const result = await pool.query(query, params);
  return result.rows;
}

// Get available rooms for a date range
async function getAvailableRooms(checkIn, checkOut) {
  const result = await pool.query(`
    SELECT
      r.id,
      r.room_number,
      r.floor,
      r.status,
      rt.id AS room_type_id,
      rt.name AS room_type_name,
      rt.base_rate,
      rt.max_occupancy,
      rt.amenities
    FROM rooms r
    LEFT JOIN room_types rt ON r.room_type_id = rt.id
    WHERE r.status = 'available'
      AND r.id NOT IN (
        SELECT room_id FROM room_reservations
        WHERE status NOT IN ('cancelled', 'checked_out', 'no_show')
          AND check_in_date < $2
          AND check_out_date > $1
      )
    ORDER BY r.floor, r.room_number
  `, [checkIn, checkOut]);
  return result.rows;
}

// Get room types
async function getRoomTypes() {
  const result = await pool.query(
    'SELECT * FROM room_types ORDER BY base_rate'
  );
  return result.rows;
}

// Get all reservations with full details
async function getReservations(filters = {}) {
  let query = `
    SELECT
      rr.id,
      rr.reservation_code,
      rr.check_in_date,
      rr.check_out_date,
      rr.actual_check_in,
      rr.actual_check_out,
      rr.nights,
      rr.rate_per_night,
      rr.original_rate_per_night,
      rr.total_amount,
      rr.amended_total,
      rr.amendment_reason,
      rr.amended_at,
      rr.status,
      rr.payment_status,
      rr.special_requests,
      rr.notes,
      rr.created_at,
      r.room_number,
      r.floor,
      rt.name AS room_type_name,
      rt.base_rate,
      c.id AS customer_id,
      c.full_name AS customer_name,
      c.phone AS customer_phone,
      c.email AS customer_email,
      c.id_type,
      c.id_number,
      c.nationality,
      u.full_name AS created_by_name,
      au.full_name AS amended_by_name,
      COALESCE(SUM(rp.amount), 0) AS total_paid
    FROM room_reservations rr
    LEFT JOIN rooms r ON rr.room_id = r.id
    LEFT JOIN room_types rt ON r.room_type_id = rt.id
    LEFT JOIN customers c ON rr.customer_id = c.id
    LEFT JOIN users u ON rr.created_by = u.id
    LEFT JOIN users au ON rr.amended_by = au.id
    LEFT JOIN room_payments rp ON rp.reservation_id = rr.id
  `;

  const params = [];
  const conditions = [];

  if (filters.status) {
    params.push(filters.status);
    conditions.push(`rr.status = $${params.length}`);
  }
  if (filters.date) {
    params.push(filters.date);
    conditions.push(`(rr.check_in_date = $${params.length} OR rr.check_out_date = $${params.length})`);
  }
  if (filters.search) {
    params.push(`%${filters.search}%`);
    conditions.push(`(c.full_name ILIKE $${params.length} OR rr.reservation_code ILIKE $${params.length} OR r.room_number ILIKE $${params.length})`);
  }

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }

  query += ' GROUP BY rr.id, r.room_number, r.floor, rt.name, rt.base_rate, c.id, c.full_name, c.phone, c.email, c.id_type, c.id_number, c.nationality, u.full_name, au.full_name';
  query += ' ORDER BY rr.created_at DESC';

  const result = await pool.query(query, params);
  return result.rows;
}

// Get single reservation
async function getReservationById(id) {
  const result = await pool.query(`
    SELECT
      rr.*,
      r.room_number,
      r.floor,
      rt.name AS room_type_name,
      rt.base_rate,
      c.full_name AS customer_name,
      c.phone AS customer_phone,
      c.email AS customer_email,
      c.id_type,
      c.id_number,
      c.nationality,
      u.full_name AS created_by_name,
      COALESCE(
        json_agg(
          json_build_object(
            'id', rp.id,
            'amount', rp.amount,
            'payment_method', rp.payment_method,
            'payment_date', rp.payment_date,
            'reference_number', rp.reference_number,
            'notes', rp.notes
          )
        ) FILTER (WHERE rp.id IS NOT NULL),
        '[]'
      ) AS payments
    FROM room_reservations rr
    LEFT JOIN rooms r ON rr.room_id = r.id
    LEFT JOIN room_types rt ON r.room_type_id = rt.id
    LEFT JOIN customers c ON rr.customer_id = c.id
    LEFT JOIN users u ON rr.created_by = u.id
    LEFT JOIN room_payments rp ON rp.reservation_id = rr.id
    WHERE rr.id = $1
    GROUP BY rr.id, r.room_number, r.floor, rt.name, rt.base_rate,
             c.full_name, c.phone, c.email, c.id_type, c.id_number, c.nationality, u.full_name
  `, [id]);
  return result.rows[0];
}

// Create reservation with customer upsert
async function createReservation(data, userId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Upsert customer
    let customerId = data.customer_id;
    if (!customerId) {
      const existing = await client.query(
        'SELECT id FROM customers WHERE phone = $1 OR (full_name = $2 AND phone = $3) LIMIT 1',
        [data.customer_phone, data.customer_name, data.customer_phone]
      );
      if (existing.rows.length > 0) {
        customerId = existing.rows[0].id;
      } else {
        const newCustomer = await client.query(
          `INSERT INTO customers (full_name, phone, email, id_type, id_number, nationality)
           VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
          [data.customer_name, data.customer_phone, data.customer_email || null,
           data.id_type || null, data.id_number || null, data.nationality || null]
        );
        customerId = newCustomer.rows[0].id;
      }
    }

    const checkIn = new Date(data.check_in_date);
    const checkOut = new Date(data.check_out_date);
    const nights = Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24));
    const ratePerNight = parseFloat(data.rate_per_night);
    const totalAmount = nights * ratePerNight;
    const reservationCode = generateReservationCode();

    const result = await client.query(`
      INSERT INTO room_reservations (
        reservation_code, room_id, customer_id, check_in_date, check_out_date,
        nights, rate_per_night, original_rate_per_night, total_amount,
        status, payment_status, special_requests, notes, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $7, $8, $9, $10, $11, $12, $13)
      RETURNING id
    `, [
      reservationCode, data.room_id, customerId,
      data.check_in_date, data.check_out_date,
      nights, ratePerNight, totalAmount,
      data.status || 'confirmed', data.payment_status || 'unpaid',
      data.special_requests || null, data.notes || null, userId
    ]);

    const reservationId = result.rows[0].id;

    // Update room status to reserved
    await client.query(
      `UPDATE rooms SET status = 'reserved', updated_at = NOW() WHERE id = $1`,
      [data.room_id]
    );

    await client.query('COMMIT');
    return { reservation_id: reservationId, reservation_code: reservationCode };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// Update reservation status (check-in, check-out, cancel)
async function updateReservationStatus(id, status, userId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const res = await client.query('SELECT * FROM room_reservations WHERE id = $1', [id]);
    if (!res.rows.length) throw new Error('Reservation not found');
    const reservation = res.rows[0];

    const updates = { status };
    let setClause = 'status = $1, updated_at = NOW()';
    const params = [status];

    if (status === 'checked_in') {
      setClause += ', actual_check_in = NOW()';
    } else if (status === 'checked_out') {
      setClause += ', actual_check_out = NOW()';
    }

    params.push(id);
    await client.query(
      `UPDATE room_reservations SET ${setClause} WHERE id = $${params.length}`,
      params
    );

    // Update room status accordingly
    let roomStatus = 'reserved';
    if (status === 'checked_in') roomStatus = 'occupied';
    if (status === 'checked_out' || status === 'cancelled' || status === 'no_show') roomStatus = 'available';

    await client.query(
      `UPDATE rooms SET status = $1, updated_at = NOW() WHERE id = $2`,
      [roomStatus, reservation.room_id]
    );

    await client.query('COMMIT');
    return { success: true };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// Amend reservation price
async function amendReservationPrice(id, newRatePerNight, reason, userId) {
  const res = await pool.query(`
    SELECT rr.*, r.room_number, rt.name AS room_type_name
    FROM room_reservations rr
    JOIN rooms r ON rr.room_id = r.id
    LEFT JOIN room_types rt ON r.room_type_id = rt.id
    WHERE rr.id = $1
  `, [id]);

  if (!res.rows.length) throw new Error('Reservation not found');
  const reservation = res.rows[0];
  const nights = reservation.nights;
  const newTotal = parseFloat(newRatePerNight) * nights;

  await pool.query(`
    UPDATE room_reservations SET
      rate_per_night = $1,
      amended_total = $2,
      amendment_reason = $3,
      amended_by = $4,
      amended_at = NOW(),
      updated_at = NOW()
    WHERE id = $5
  `, [newRatePerNight, newTotal, reason, userId, id]);

  return {
    original_rate: reservation.original_rate_per_night || reservation.rate_per_night,
    new_rate: newRatePerNight,
    nights,
    new_total: newTotal,
  };
}

// Record a payment for a reservation
async function recordPayment(reservationId, paymentData, userId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(`
      INSERT INTO room_payments (reservation_id, amount, payment_method, reference_number, notes, received_by)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [
      reservationId,
      paymentData.amount,
      paymentData.payment_method,
      paymentData.reference_number || null,
      paymentData.notes || null,
      userId
    ]);

    // Recalculate payment status
    const totals = await client.query(`
      SELECT rr.amended_total, rr.total_amount, COALESCE(SUM(rp.amount), 0) AS paid
      FROM room_reservations rr
      LEFT JOIN room_payments rp ON rp.reservation_id = rr.id
      WHERE rr.id = $1
      GROUP BY rr.id, rr.amended_total, rr.total_amount
    `, [reservationId]);

    const row = totals.rows[0];
    const totalDue = row.amended_total || row.total_amount;
    const paid = parseFloat(row.paid);
    let paymentStatus = 'unpaid';
    if (paid >= totalDue) paymentStatus = 'paid';
    else if (paid > 0) paymentStatus = 'partial';

    await client.query(
      'UPDATE room_reservations SET payment_status = $1, updated_at = NOW() WHERE id = $2',
      [paymentStatus, reservationId]
    );

    await client.query('COMMIT');
    return { success: true, payment_status: paymentStatus };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// Get customers
async function getCustomers(search) {
  let query = 'SELECT * FROM customers';
  const params = [];
  if (search) {
    params.push(`%${search}%`);
    query += ` WHERE full_name ILIKE $1 OR phone ILIKE $1 OR id_number ILIKE $1`;
  }
  query += ' ORDER BY full_name LIMIT 50';
  const result = await pool.query(query, params);
  return result.rows;
}

// Dashboard stats
async function getDashboardStats() {
  const [rooms, reservations, todayCheckIns, todayCheckOuts, revenue] = await Promise.all([
    pool.query('SELECT status, COUNT(*) AS count FROM rooms GROUP BY status'),
    pool.query('SELECT status, COUNT(*) AS count FROM room_reservations GROUP BY status'),
    pool.query(`
      SELECT COUNT(*) AS count FROM room_reservations
      WHERE check_in_date = CURRENT_DATE AND status IN ('confirmed', 'checked_in')
    `),
    pool.query(`
      SELECT COUNT(*) AS count FROM room_reservations
      WHERE check_out_date = CURRENT_DATE AND status = 'checked_in'
    `),
    pool.query(`
      SELECT COALESCE(SUM(amount), 0) AS total FROM room_payments
      WHERE DATE(payment_date) = CURRENT_DATE
    `),
  ]);

  const roomStats = {};
  rooms.rows.forEach(r => { roomStats[r.status] = parseInt(r.count); });

  const resStats = {};
  reservations.rows.forEach(r => { resStats[r.status] = parseInt(r.count); });

  return {
    rooms: roomStats,
    reservations: resStats,
    today_check_ins: parseInt(todayCheckIns.rows[0]?.count || 0),
    today_check_outs: parseInt(todayCheckOuts.rows[0]?.count || 0),
    today_revenue: parseFloat(revenue.rows[0]?.total || 0),
  };
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

