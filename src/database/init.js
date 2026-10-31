const pool = require('./pool');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

async function initializeDatabase() {
  const client = await pool.connect();
  try {
    console.log('Initializing Tabor database schema & migrations...');

    // Run safe migrations first so table alterations always succeed
    const migrations = [
      "ALTER TABLE rooms ADD COLUMN IF NOT EXISTS notes TEXT",
      "ALTER TABLE rooms ADD COLUMN IF NOT EXISTS description TEXT",
      "ALTER TABLE room_types ADD COLUMN IF NOT EXISTS capacity INTEGER DEFAULT 2",
      "ALTER TABLE room_types ADD COLUMN IF NOT EXISTS max_occupancy INTEGER DEFAULT 2",
      "ALTER TABLE room_types ADD COLUMN IF NOT EXISTS image_url TEXT",
      "ALTER TABLE room_reservations ADD COLUMN IF NOT EXISTS guest_name VARCHAR(150)",
      "ALTER TABLE room_reservations ADD COLUMN IF NOT EXISTS guest_phone VARCHAR(50)",
      "ALTER TABLE room_reservations ADD COLUMN IF NOT EXISTS guest_email VARCHAR(150)",
      "ALTER TABLE room_reservations ADD COLUMN IF NOT EXISTS guest_id_number VARCHAR(100)",
      "ALTER TABLE room_reservations ADD COLUMN IF NOT EXISTS id_image_url TEXT",
      "ALTER TABLE room_reservations ADD COLUMN IF NOT EXISTS id_image_front_url TEXT",
      "ALTER TABLE room_reservations ADD COLUMN IF NOT EXISTS id_image_back_url TEXT",
      "ALTER TABLE room_reservations ADD COLUMN IF NOT EXISTS actual_check_in_at TIMESTAMP",
      "ALTER TABLE room_reservations ADD COLUMN IF NOT EXISTS actual_check_out_at TIMESTAMP",
      "ALTER TABLE room_reservations ADD COLUMN IF NOT EXISTS total_nights INTEGER DEFAULT 1",
      "ALTER TABLE room_reservations ADD COLUMN IF NOT EXISTS paid_amount NUMERIC(12,2) DEFAULT 0",
      "ALTER TABLE room_reservations ADD COLUMN IF NOT EXISTS adults INTEGER DEFAULT 1",
      "ALTER TABLE room_reservations ADD COLUMN IF NOT EXISTS children INTEGER DEFAULT 0",
      "ALTER TABLE room_reservations ADD COLUMN IF NOT EXISTS price_amendment_reason TEXT",
      "ALTER TABLE room_reservations ADD COLUMN IF NOT EXISTS price_amended_by INTEGER",
      "ALTER TABLE room_reservations ADD COLUMN IF NOT EXISTS price_amended_at TIMESTAMP",
      "ALTER TABLE room_reservations ADD COLUMN IF NOT EXISTS vip_customer_id INTEGER",
      "ALTER TABLE room_reservations ADD COLUMN IF NOT EXISTS transaction_reference VARCHAR(100)",
      "ALTER TABLE room_reservations ADD COLUMN IF NOT EXISTS receipt_image TEXT",
      "ALTER TABLE room_payments ADD COLUMN IF NOT EXISTS transaction_reference VARCHAR(100)",
      "ALTER TABLE room_payments ADD COLUMN IF NOT EXISTS receipt_image TEXT",
      "UPDATE rooms SET notes = description WHERE notes IS NULL AND description IS NOT NULL",
      "UPDATE rooms SET description = notes WHERE description IS NULL AND notes IS NOT NULL",
    ];

    for (const sql of migrations) {
      try {
        await client.query(sql);
      } catch (e) {
        // Ignored if table doesn't exist yet before schema.sql runs
      }
    }

    // Read and execute base schema
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    try {
      await client.query(schema);
    } catch (e) {
      console.warn('Base schema notice:', e.message);
    }

    // Re-run migrations in case tables were just created by schema.sql
    for (const sql of migrations) {
      try {
        await client.query(sql);
      } catch (e) {
        // Table or column already adjusted
      }
    }

    // Ensure rooms status check constraint allows 'cleaning'
    try {
      await client.query(`
        ALTER TABLE rooms DROP CONSTRAINT IF EXISTS rooms_status_check;
        ALTER TABLE rooms ADD CONSTRAINT rooms_status_check 
          CHECK (status IN ('available', 'occupied', 'maintenance', 'reserved', 'cleaning'));
      `);
    } catch (e) {
      // Constraint might already exist
    }

    // Seed default admin user
    const userCheck = await client.query('SELECT COUNT(*) FROM users');
    if (parseInt(userCheck.rows[0].count) === 0) {
      const hash = await bcrypt.hash('admin123', 10);
      await client.query(`
        INSERT INTO users (username, email, password_hash, full_name, role)
        VALUES ($1, $2, $3, $4, $5)
      `, ['admin', 'admin@tabor.com', hash, 'Tabor Admin', 'admin']);
      console.log('Default admin user created: admin / admin123');
    }

    // Seed default room types
    const rtCheck = await client.query('SELECT COUNT(*) FROM room_types');
    if (parseInt(rtCheck.rows[0].count) === 0) {
      await client.query(`
        INSERT INTO room_types (name, description, base_rate, max_occupancy, capacity) VALUES
        ('Standard Single', 'Single bed standard room', 1200.00, 1, 1),
        ('Standard Double', 'Double bed standard room', 1800.00, 2, 2),
        ('Deluxe King', 'King size bed deluxe room', 2500.00, 2, 2),
        ('Suite', 'Luxury suite with living area', 4500.00, 4, 4),
        ('Family Room', 'Spacious room for families', 3200.00, 5, 5)
      `);
      console.log('Default room types seeded.');
    }

    // Seed default rooms
    const roomCheck = await client.query('SELECT COUNT(*) FROM rooms');
    if (parseInt(roomCheck.rows[0].count) === 0) {
      await client.query(`
        INSERT INTO rooms (room_number, floor, room_type_id, status) VALUES
        ('101', 1, 1, 'available'),
        ('102', 1, 2, 'available'),
        ('103', 1, 2, 'available'),
        ('104', 1, 1, 'available'),
        ('201', 2, 3, 'available'),
        ('202', 2, 3, 'available'),
        ('203', 2, 2, 'available'),
        ('204', 2, 4, 'available'),
        ('301', 3, 4, 'available'),
        ('302', 3, 5, 'available')
      `);
      console.log('Default rooms seeded.');
    }

    console.log('Tabor database initialization complete.');
  } catch (err) {
    console.error('Database initialization warning:', err.message);
  } finally {
    client.release();
  }
}

module.exports = { initializeDatabase };
