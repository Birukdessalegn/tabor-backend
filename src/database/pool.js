const { Pool } = require('pg');
require('dotenv').config();

// Resolve host: avoid IPv6 '::1' which is often not configured in cPanel pg_hba.conf
let host = process.env.DB_HOST || '127.0.0.1';
if (host === 'localhost') {
  host = '127.0.0.1';
}

// Resolve user: in cPanel, user is prefixed (e.g. ambbatxv_tabor) or the main cPanel user (ambbatxv)
let user = process.env.DB_USER || 'ambbatxv';
if (user === 'tabor') {
  user = 'ambbatxv_tabor';
}

const pool = new Pool({
  host,
  port: parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || 'ambbatxv_tabor_db',
  user,
  password: process.env.DB_PASSWORD,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err.message);
});

module.exports = pool;
