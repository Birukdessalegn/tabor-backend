const pool = require('./pool');
const fs = require('fs');
const path = require('path');

async function initializeDatabase() {
  const client = await pool.connect();
  try {
    console.log('Initializing Tabor database...');

    // Read and execute schema
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    await client.query(schema);
    console.log('Schema applied successfully.');

    // Seed default admin user if no users exist
    const userCheck = await client.query('SELECT COUNT(*) FROM users');
    if (parseInt(userCheck.rows[0].count) === 0) {
      const bcrypt = require('bcryptjs');
      const hash = await bcrypt.hash('admin123', 10);
      await client.query(`
        INSERT INTO users (username, email, password_hash, full_name, role)
        VALUES ($1, $2, $3, $4, $5)
      `, ['admin', 'admin@tabor.com', hash, 'Tabor Admin', 'admin']);
      console.log('Default admin user created: admin / admin123');
    }

    // Seed room types if none exist
    const rtCheck = await client.query('SELECT COUNT(*) FROM room_types');
    if (parseInt(rtCheck.rows[0].count) === 0) {
      await client.query(`
        INSERT INTO room_types (name, description, base_rate, max_occupancy) VALUES
        ('Standard Single', 'Single bed standard room', 1200.00, 1),
        ('Standard Double', 'Double bed standard room', 1800.00, 2),
        ('Deluxe King', 'King size bed deluxe room', 2500.00, 2),
        ('Suite', 'Luxury suite with living area', 4500.00, 4),
        ('Family Room', 'Spacious room for families', 3200.00, 5)
      `);
      console.log('Default room types seeded.');
    }

    // Seed rooms if none exist
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
    console.error('Database initialization error:', err);
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { initializeDatabase };

