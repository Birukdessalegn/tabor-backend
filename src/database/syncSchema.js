const pool = require("./pool");

let isSyncing = false;
let isSynced = false;

async function syncFullSchema() {
  if (isSynced) return { success: true, message: "Schema already verified and synced." };
  if (isSyncing) return { success: true, message: "Schema sync in progress." };

  isSyncing = true;
  console.log("Starting individual Tabor database column synchronization...");

  const statements = [
    // Core tables
    "CREATE TABLE IF NOT EXISTS users (id SERIAL PRIMARY KEY, username VARCHAR(100) UNIQUE NOT NULL, email VARCHAR(255) UNIQUE NOT NULL, password_hash VARCHAR(255) NOT NULL, full_name VARCHAR(255) NOT NULL, role VARCHAR(50) NOT NULL DEFAULT 'admin', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)",
    "CREATE TABLE IF NOT EXISTS customers (id SERIAL PRIMARY KEY, full_name VARCHAR(255) NOT NULL, phone VARCHAR(50), email VARCHAR(255), id_type VARCHAR(50), id_number VARCHAR(100), nationality VARCHAR(100), address TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)",
    "CREATE TABLE IF NOT EXISTS room_types (id SERIAL PRIMARY KEY, name VARCHAR(100) NOT NULL, base_rate NUMERIC(12,2) NOT NULL DEFAULT 0.00, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)",
    "CREATE TABLE IF NOT EXISTS rooms (id SERIAL PRIMARY KEY, room_number VARCHAR(30) UNIQUE NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)",
    "CREATE TABLE IF NOT EXISTS room_reservations (id SERIAL PRIMARY KEY, reservation_code VARCHAR(50) UNIQUE NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)",
    "CREATE TABLE IF NOT EXISTS room_payments (id SERIAL PRIMARY KEY, amount NUMERIC(12,2) NOT NULL DEFAULT 0.00, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)",

    // room_types columns
    "ALTER TABLE room_types ADD COLUMN IF NOT EXISTS name VARCHAR(100)",
    "ALTER TABLE room_types ADD COLUMN IF NOT EXISTS base_rate NUMERIC(12,2) DEFAULT 0.00",
    "ALTER TABLE room_types ADD COLUMN IF NOT EXISTS capacity INTEGER DEFAULT 2",
    "ALTER TABLE room_types ADD COLUMN IF NOT EXISTS max_occupancy INTEGER DEFAULT 2",
    "ALTER TABLE room_types ADD COLUMN IF NOT EXISTS description TEXT",
    "ALTER TABLE room_types ADD COLUMN IF NOT EXISTS amenities TEXT",
    "ALTER TABLE room_types ADD COLUMN IF NOT EXISTS image_url TEXT",

    // rooms columns
    "ALTER TABLE rooms ADD COLUMN IF NOT EXISTS room_number VARCHAR(30)",
    "ALTER TABLE rooms ADD COLUMN IF NOT EXISTS room_type_id INTEGER",
    "ALTER TABLE rooms ADD COLUMN IF NOT EXISTS floor INTEGER DEFAULT 1",
    "ALTER TABLE rooms ADD COLUMN IF NOT EXISTS status VARCHAR(30) DEFAULT 'available'",
    "ALTER TABLE rooms ADD COLUMN IF NOT EXISTS notes TEXT",
    "ALTER TABLE rooms ADD COLUMN IF NOT EXISTS description TEXT",

    // room_reservations columns
    "ALTER TABLE room_reservations ADD COLUMN IF NOT EXISTS reservation_code VARCHAR(50)",
    "ALTER TABLE room_reservations ADD COLUMN IF NOT EXISTS room_id INTEGER",
    "ALTER TABLE room_reservations ADD COLUMN IF NOT EXISTS customer_id INTEGER",
    "ALTER TABLE room_reservations ADD COLUMN IF NOT EXISTS guest_name VARCHAR(150)",
    "ALTER TABLE room_reservations ADD COLUMN IF NOT EXISTS guest_phone VARCHAR(50)",
    "ALTER TABLE room_reservations ADD COLUMN IF NOT EXISTS guest_email VARCHAR(150)",
    "ALTER TABLE room_reservations ADD COLUMN IF NOT EXISTS guest_id_number VARCHAR(100)",
    "ALTER TABLE room_reservations ADD COLUMN IF NOT EXISTS id_image_url TEXT",
    "ALTER TABLE room_reservations ADD COLUMN IF NOT EXISTS id_image_front_url TEXT",
    "ALTER TABLE room_reservations ADD COLUMN IF NOT EXISTS id_image_back_url TEXT",
    "ALTER TABLE room_reservations ADD COLUMN IF NOT EXISTS check_in_date DATE",
    "ALTER TABLE room_reservations ADD COLUMN IF NOT EXISTS check_out_date DATE",
    "ALTER TABLE room_reservations ADD COLUMN IF NOT EXISTS actual_check_in TIMESTAMP",
    "ALTER TABLE room_reservations ADD COLUMN IF NOT EXISTS actual_check_in_at TIMESTAMP",
    "ALTER TABLE room_reservations ADD COLUMN IF NOT EXISTS actual_check_out TIMESTAMP",
    "ALTER TABLE room_reservations ADD COLUMN IF NOT EXISTS actual_check_out_at TIMESTAMP",
    "ALTER TABLE room_reservations ADD COLUMN IF NOT EXISTS nights INTEGER DEFAULT 1",
    "ALTER TABLE room_reservations ADD COLUMN IF NOT EXISTS total_nights INTEGER DEFAULT 1",
    "ALTER TABLE room_reservations ADD COLUMN IF NOT EXISTS rate_per_night NUMERIC(12,2) DEFAULT 0.00",
    "ALTER TABLE room_reservations ADD COLUMN IF NOT EXISTS original_rate_per_night NUMERIC(12,2) DEFAULT 0.00",
    "ALTER TABLE room_reservations ADD COLUMN IF NOT EXISTS total_amount NUMERIC(12,2) DEFAULT 0.00",
    "ALTER TABLE room_reservations ADD COLUMN IF NOT EXISTS paid_amount NUMERIC(12,2) DEFAULT 0.00",
    "ALTER TABLE room_reservations ADD COLUMN IF NOT EXISTS adults INTEGER DEFAULT 1",
    "ALTER TABLE room_reservations ADD COLUMN IF NOT EXISTS children INTEGER DEFAULT 0",
    "ALTER TABLE room_reservations ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'confirmed'",
    "ALTER TABLE room_reservations ADD COLUMN IF NOT EXISTS payment_status VARCHAR(50) DEFAULT 'unpaid'",
    "ALTER TABLE room_reservations ADD COLUMN IF NOT EXISTS special_requests TEXT",
    "ALTER TABLE room_reservations ADD COLUMN IF NOT EXISTS notes TEXT",
    "ALTER TABLE room_reservations ADD COLUMN IF NOT EXISTS price_amendment_reason TEXT",
    "ALTER TABLE room_reservations ADD COLUMN IF NOT EXISTS price_amended_by INTEGER",
    "ALTER TABLE room_reservations ADD COLUMN IF NOT EXISTS price_amended_at TIMESTAMP",
    "ALTER TABLE room_reservations ADD COLUMN IF NOT EXISTS transaction_reference VARCHAR(100)",
    "ALTER TABLE room_reservations ADD COLUMN IF NOT EXISTS receipt_image TEXT",
    "ALTER TABLE room_reservations ADD COLUMN IF NOT EXISTS vip_customer_id INTEGER",
    "ALTER TABLE room_reservations ADD COLUMN IF NOT EXISTS created_by INTEGER",

    // room_payments columns
    "ALTER TABLE room_payments ADD COLUMN IF NOT EXISTS reservation_id INTEGER",
    "ALTER TABLE room_payments ADD COLUMN IF NOT EXISTS amount NUMERIC(12,2) DEFAULT 0.00",
    "ALTER TABLE room_payments ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50) DEFAULT 'cash'",
    "ALTER TABLE room_payments ADD COLUMN IF NOT EXISTS payment_type VARCHAR(50) DEFAULT 'payment'",
    "ALTER TABLE room_payments ADD COLUMN IF NOT EXISTS transaction_reference VARCHAR(100)",
    "ALTER TABLE room_payments ADD COLUMN IF NOT EXISTS reference_number VARCHAR(100)",
    "ALTER TABLE room_payments ADD COLUMN IF NOT EXISTS notes TEXT",
    "ALTER TABLE room_payments ADD COLUMN IF NOT EXISTS receipt_image TEXT",
    "ALTER TABLE room_payments ADD COLUMN IF NOT EXISTS image_url TEXT",
  ];

  const results = [];
  for (const sql of statements) {
    try {
      await pool.query(sql);
      results.push({ sql: sql.slice(0, 45), ok: true });
    } catch (err) {
      results.push({ sql: sql.slice(0, 45), ok: false, error: err.message });
    }
  }

  // Ensure default admin user
  try {
    const userCount = await pool.query("SELECT COUNT(*) FROM users");
    if (parseInt(userCount.rows[0].count) === 0) {
      const bcrypt = require("bcryptjs");
      const hash = await bcrypt.hash("admin123", 10);
      await pool.query(
        "INSERT INTO users (username, email, password_hash, full_name, role) VALUES ('admin', 'admin@tabor.com', $1, 'Tabor Admin', 'admin')",
        [hash]
      );
    }
  } catch (e) {
    // Already exists
  }

  isSynced = true;
  isSyncing = false;
  console.log("Tabor schema sync completed successfully.");
  return { success: true, processed: results.length, details: results };
}

module.exports = { syncFullSchema };
