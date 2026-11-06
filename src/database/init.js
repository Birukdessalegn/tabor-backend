const pool = require('./pool');
const bcrypt = require('bcryptjs');

let isInitializing = false;
let isInitialized = false;

async function initializeDatabase() {
  if (isInitialized) {
    return { success: true, message: 'Tabor database is already initialized.' };
  }
  if (isInitializing) {
    return { success: true, message: 'Initialization is already in progress.' };
  }

  isInitializing = true;
  console.log('🚀 Starting complete Tabor Hotel database initialization...');

  try {
    // =========================================================================
    // 1. CREATE ALL 6 CORE TABLES DIRECTLY (IF NOT EXISTS)
    // =========================================================================
    const tableDefinitions = [
      // 1. Users table (Admin, Receptionist, Supervisor, Manager)
      `CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(100) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        full_name VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL DEFAULT 'receptionist',
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,

      // 2. Customers table (Guest profiles)
      `CREATE TABLE IF NOT EXISTS customers (
        id SERIAL PRIMARY KEY,
        full_name VARCHAR(255) NOT NULL,
        phone VARCHAR(50),
        email VARCHAR(255),
        id_type VARCHAR(50),
        id_number VARCHAR(100),
        nationality VARCHAR(100),
        address TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,

      // 3. Room Types table (Categories, pricing, occupancy)
      `CREATE TABLE IF NOT EXISTS room_types (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        description TEXT,
        base_rate NUMERIC(12,2) NOT NULL DEFAULT 0.00,
        capacity INTEGER NOT NULL DEFAULT 2,
        max_occupancy INTEGER NOT NULL DEFAULT 2,
        amenities TEXT,
        image_url TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,

      // 4. Rooms table (Individual hotel rooms & status)
      `CREATE TABLE IF NOT EXISTS rooms (
        id SERIAL PRIMARY KEY,
        room_number VARCHAR(30) UNIQUE NOT NULL,
        floor INTEGER DEFAULT 1,
        room_type_id INTEGER REFERENCES room_types(id) ON DELETE RESTRICT,
        status VARCHAR(30) NOT NULL DEFAULT 'available',
        notes TEXT,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,

      // 5. Room Reservations table (Bookings, guest details, photo ID urls, stays)
      `CREATE TABLE IF NOT EXISTS room_reservations (
        id SERIAL PRIMARY KEY,
        reservation_code VARCHAR(50) UNIQUE NOT NULL,
        room_id INTEGER REFERENCES rooms(id) ON DELETE RESTRICT,
        customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
        guest_name VARCHAR(150),
        guest_phone VARCHAR(50),
        guest_email VARCHAR(150),
        guest_id_number VARCHAR(100),
        id_image_url TEXT,
        id_image_front_url TEXT,
        id_image_back_url TEXT,
        check_in_date DATE NOT NULL,
        check_out_date DATE NOT NULL,
        actual_check_in TIMESTAMP,
        actual_check_in_at TIMESTAMP,
        actual_check_out TIMESTAMP,
        actual_check_out_at TIMESTAMP,
        nights INTEGER DEFAULT 1,
        total_nights INTEGER DEFAULT 1,
        rate_per_night NUMERIC(12,2) NOT NULL DEFAULT 0.00,
        original_rate_per_night NUMERIC(12,2),
        total_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
        paid_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
        adults INTEGER DEFAULT 1,
        children INTEGER DEFAULT 0,
        status VARCHAR(50) NOT NULL DEFAULT 'confirmed',
        payment_status VARCHAR(50) NOT NULL DEFAULT 'unpaid',
        special_requests TEXT,
        notes TEXT,
        price_amendment_reason TEXT,
        price_amended_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        price_amended_at TIMESTAMP,
        transaction_reference VARCHAR(100),
        receipt_image TEXT,
        vip_customer_id INTEGER,
        created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,

      // 6. Room Payments table (Payment records, receipts)
      `CREATE TABLE IF NOT EXISTS room_payments (
        id SERIAL PRIMARY KEY,
        reservation_id INTEGER REFERENCES room_reservations(id) ON DELETE CASCADE,
        amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
        payment_method VARCHAR(50) NOT NULL DEFAULT 'cash',
        payment_type VARCHAR(50) NOT NULL DEFAULT 'payment',
        payment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        transaction_reference VARCHAR(100),
        reference_number VARCHAR(100),
        notes TEXT,
        receipt_image TEXT,
        image_url TEXT,
        received_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`
    ];

    for (const sql of tableDefinitions) {
      try {
        await pool.query(sql);
      } catch (err) {
        console.warn('Table definition notice:', err.message);
      }
    }

    // =========================================================================
    // 2. CREATE PERFORMANCE INDEXES
    // =========================================================================
    const indexDefinitions = [
      'CREATE INDEX IF NOT EXISTS idx_rooms_status ON rooms(status)',
      'CREATE INDEX IF NOT EXISTS idx_rooms_type ON rooms(room_type_id)',
      'CREATE INDEX IF NOT EXISTS idx_room_res_code ON room_reservations(reservation_code)',
      'CREATE INDEX IF NOT EXISTS idx_room_res_room ON room_reservations(room_id)',
      'CREATE INDEX IF NOT EXISTS idx_room_res_status ON room_reservations(status)',
      'CREATE INDEX IF NOT EXISTS idx_room_res_dates ON room_reservations(check_in_date, check_out_date)',
      'CREATE INDEX IF NOT EXISTS idx_room_payments_res ON room_payments(reservation_id)'
    ];

    for (const sql of indexDefinitions) {
      try {
        await pool.query(sql);
      } catch (e) {}
    }

    // Attempt to grant full sequence and table permissions to database user
    try {
      await pool.query('GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO ambbatxv_tabor');
      await pool.query('GRANT ALL ON ALL TABLES IN SCHEMA public TO ambbatxv_tabor');
    } catch (e) {}

    // =========================================================================
    // 3. ENSURE ALL SPECIFIC COLUMNS (SAFETY MIGRATIONS)
    // =========================================================================
    const columnMigrations = [
      // room_types
      "ALTER TABLE room_types ADD COLUMN IF NOT EXISTS name VARCHAR(100)",
      "ALTER TABLE room_types ADD COLUMN IF NOT EXISTS base_rate NUMERIC(12,2) DEFAULT 0.00",
      "ALTER TABLE room_types ADD COLUMN IF NOT EXISTS capacity INTEGER DEFAULT 2",
      "ALTER TABLE room_types ADD COLUMN IF NOT EXISTS max_occupancy INTEGER DEFAULT 2",
      "ALTER TABLE room_types ADD COLUMN IF NOT EXISTS description TEXT",
      "ALTER TABLE room_types ADD COLUMN IF NOT EXISTS amenities TEXT",
      "ALTER TABLE room_types ADD COLUMN IF NOT EXISTS image_url TEXT",

      // rooms
      "ALTER TABLE rooms ADD COLUMN IF NOT EXISTS room_number VARCHAR(30)",
      "ALTER TABLE rooms ADD COLUMN IF NOT EXISTS room_type_id INTEGER REFERENCES room_types(id)",
      "ALTER TABLE rooms ADD COLUMN IF NOT EXISTS floor INTEGER DEFAULT 1",
      "ALTER TABLE rooms ADD COLUMN IF NOT EXISTS status VARCHAR(30) DEFAULT 'available'",
      "ALTER TABLE rooms ADD COLUMN IF NOT EXISTS notes TEXT",
      "ALTER TABLE rooms ADD COLUMN IF NOT EXISTS description TEXT",

      // room_reservations
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

      // room_payments
      "ALTER TABLE room_payments ADD COLUMN IF NOT EXISTS amount NUMERIC(12,2) DEFAULT 0.00",
      "ALTER TABLE room_payments ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50) DEFAULT 'cash'",
      "ALTER TABLE room_payments ADD COLUMN IF NOT EXISTS payment_type VARCHAR(50) DEFAULT 'payment'",
      "ALTER TABLE room_payments ADD COLUMN IF NOT EXISTS transaction_reference VARCHAR(100)",
      "ALTER TABLE room_payments ADD COLUMN IF NOT EXISTS reference_number VARCHAR(100)",
      "ALTER TABLE room_payments ADD COLUMN IF NOT EXISTS notes TEXT",
      "ALTER TABLE room_payments ADD COLUMN IF NOT EXISTS receipt_image TEXT",
      "ALTER TABLE room_payments ADD COLUMN IF NOT EXISTS image_url TEXT",
    ];

    for (const sql of columnMigrations) {
      try {
        await pool.query(sql);
      } catch (colErr) {}
    }

    // Keep column aliases synced
    try {
      await pool.query(`
        UPDATE rooms SET notes = description WHERE notes IS NULL AND description IS NOT NULL;
        UPDATE rooms SET description = notes WHERE description IS NULL AND notes IS NOT NULL;
        UPDATE room_types SET capacity = max_occupancy WHERE capacity IS NULL AND max_occupancy IS NOT NULL;
        UPDATE room_types SET max_occupancy = capacity WHERE max_occupancy IS NULL AND capacity IS NOT NULL;
        UPDATE room_reservations SET total_nights = nights WHERE total_nights IS NULL AND nights IS NOT NULL;
        UPDATE room_reservations SET nights = total_nights WHERE nights IS NULL AND total_nights IS NOT NULL;
      `);
    } catch (e) {}

    // =========================================================================
    // 4. SEED DEFAULT ADMIN USERS ('tabores' and 'admin')
    // =========================================================================
    const userCheck = await pool.query("SELECT username FROM users WHERE username IN ('tabores', 'admin')");
    const existingUsernames = userCheck.rows.map(r => r.username);

    // Seed 'tabores'
    if (!existingUsernames.includes('tabores')) {
      const taboresHash = await bcrypt.hash('tabor@pass', 10);
      await pool.query(`
        INSERT INTO users (username, email, password_hash, full_name, role)
        VALUES ('tabores', 'tabores@tabor.com', $1, 'Tabor Manager', 'admin')
        ON CONFLICT (username) DO NOTHING
      `, [taboresHash]);
      console.log("Admin user 'tabores' created.");
    }

    // Seed 'admin'
    if (!existingUsernames.includes('admin')) {
      const adminHash = await bcrypt.hash('admin123', 10);
      await pool.query(`
        INSERT INTO users (username, email, password_hash, full_name, role)
        VALUES ('admin', 'admin@tabor.com', $1, 'Tabor Admin', 'admin')
        ON CONFLICT (username) DO NOTHING
      `, [adminHash]);
      console.log("Admin user 'admin' created.");
    }

    // =========================================================================
    // 5. SEED DEFAULT ROOM TYPES
    // =========================================================================
    const rtCheck = await pool.query('SELECT COUNT(*) FROM room_types');
    if (parseInt(rtCheck.rows[0].count) === 0) {
      await pool.query(`
        INSERT INTO room_types (name, description, base_rate, max_occupancy, capacity, amenities) VALUES
        ('Standard Single', 'Single bed standard room with private bathroom', 1200.00, 1, 1, 'Wi-Fi, TV, Hot Shower'),
        ('Standard Double', 'Double bed standard room with work desk', 1800.00, 2, 2, 'Wi-Fi, TV, AC, Hot Shower'),
        ('Deluxe King', 'King size bed deluxe room with balcony view', 2500.00, 2, 2, 'Wi-Fi, Smart TV, AC, Mini Bar'),
        ('Suite', 'Luxury hotel suite with separate living area', 4500.00, 4, 4, 'Wi-Fi, Smart TV, AC, Balcony, Mini Bar'),
        ('Family Room', 'Spacious connected room for families', 3200.00, 5, 5, 'Wi-Fi, 2 TVs, AC, Refrigerator')
      `);
      console.log('Default room types seeded.');
    }

    // =========================================================================
    // 6. SEED DEFAULT ROOMS
    // =========================================================================
    const roomCheck = await pool.query('SELECT COUNT(*) FROM rooms');
    if (parseInt(roomCheck.rows[0].count) === 0) {
      const types = await pool.query('SELECT id, name FROM room_types ORDER BY id ASC');
      const typeMap = {};
      types.rows.forEach(t => { typeMap[t.name] = t.id; });

      const t1 = typeMap['Standard Single'] || types.rows[0]?.id;
      const t2 = typeMap['Standard Double'] || types.rows[1]?.id || t1;
      const t3 = typeMap['Deluxe King'] || types.rows[2]?.id || t1;
      const t4 = typeMap['Suite'] || types.rows[3]?.id || t1;
      const t5 = typeMap['Family Room'] || types.rows[4]?.id || t1;

      await pool.query(`
        INSERT INTO rooms (room_number, floor, room_type_id, status) VALUES
        ('101', 1, ${t1}, 'available'),
        ('102', 1, ${t2}, 'available'),
        ('103', 1, ${t2}, 'available'),
        ('104', 1, ${t1}, 'available'),
        ('201', 2, ${t3}, 'available'),
        ('202', 2, ${t3}, 'available'),
        ('203', 2, ${t2}, 'available'),
        ('204', 2, ${t4}, 'available'),
        ('301', 3, ${t4}, 'available'),
        ('302', 3, ${t5}, 'available')
        ON CONFLICT (room_number) DO NOTHING
      `);
      console.log('Default rooms seeded.');
    }

    isInitialized = true;
    isInitializing = false;
    console.log('✅ Tabor Hotel database initialization complete. All tables created.');
    return {
      success: true,
      message: 'All 6 database tables created, columns verified, and defaults seeded.'
    };
  } catch (err) {
    isInitializing = false;
    console.error('❌ Database initialization error:', err.message);
    throw err;
  }
}

module.exports = { initializeDatabase };
