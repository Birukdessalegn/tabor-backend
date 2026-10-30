const pool = require('../../database/pool');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

async function login(username, password) {
  const result = await pool.query(
    'SELECT * FROM users WHERE (username = $1 OR email = $1) AND is_active = TRUE',
    [username]
  );

  if (result.rows.length === 0) {
    throw new Error('Invalid credentials');
  }

  const user = result.rows[0];
  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    throw new Error('Invalid credentials');
  }

  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role, full_name: user.full_name },
    process.env.JWT_SECRET || 'tabor_jwt_secret',
    { expiresIn: '12h' }
  );

  return {
    token,
    user: {
      id: user.id,
      username: user.username,
      full_name: user.full_name,
      email: user.email,
      role: user.role,
    },
  };
}

async function getProfile(userId) {
  const result = await pool.query(
    'SELECT id, username, full_name, email, role, created_at FROM users WHERE id = $1',
    [userId]
  );
  return result.rows[0];
}

async function getUsers() {
  const result = await pool.query(
    'SELECT id, username, full_name, email, role, is_active, created_at FROM users ORDER BY full_name'
  );
  return result.rows;
}

async function createUser(data) {
  const { username, email, password, full_name, role } = data;
  const hash = await bcrypt.hash(password, 10);
  const result = await pool.query(
    `INSERT INTO users (username, email, password_hash, full_name, role)
     VALUES ($1, $2, $3, $4, $5) RETURNING id, username, full_name, email, role`,
    [username, email, hash, full_name, role || 'receptionist']
  );
  return result.rows[0];
}

module.exports = { login, getProfile, getUsers, createUser };

