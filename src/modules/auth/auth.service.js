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
  if (!username || !password || !full_name) {
    throw new Error('Username, password, and full name are required');
  }

  // Check if username or email already exists
  const existing = await pool.query(
    'SELECT id FROM users WHERE LOWER(username) = LOWER($1) OR (email IS NOT NULL AND LOWER(email) = LOWER($2))',
    [username, email || '']
  );
  if (existing.rows.length > 0) {
    throw new Error('A user with that username or email already exists');
  }

  const hash = await bcrypt.hash(password, 10);
  const values = [username.trim(), email ? email.trim() : null, hash, full_name.trim(), role || 'receptionist'];

  try {
    const result = await pool.query(
      `INSERT INTO users (username, email, password_hash, full_name, role, is_active)
       VALUES ($1, $2, $3, $4, $5, TRUE) 
       RETURNING id, username, full_name, email, role, is_active, created_at`,
      values
    );
    return result.rows[0];
  } catch (err) {
    if (err.message.includes('sequence') || err.code === '42501') {
      const fallbackResult = await pool.query(
        `INSERT INTO users (id, username, email, password_hash, full_name, role, is_active)
         VALUES ((SELECT COALESCE(MAX(id), 0) + 1 FROM users), $1, $2, $3, $4, $5, TRUE) 
         RETURNING id, username, full_name, email, role, is_active, created_at`,
        values
      );
      return fallbackResult.rows[0];
    }
    throw err;
  }
}

async function updateUser(id, data) {
  const { full_name, email, role, is_active } = data;
  const result = await pool.query(
    `UPDATE users 
     SET full_name = COALESCE($1, full_name),
         email = COALESCE($2, email),
         role = COALESCE($3, role),
         is_active = COALESCE($4, is_active),
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $5
     RETURNING id, username, full_name, email, role, is_active, created_at`,
    [
      full_name ? full_name.trim() : null,
      email !== undefined ? (email ? email.trim() : null) : null,
      role || null,
      is_active !== undefined ? is_active : null,
      id
    ]
  );
  if (result.rows.length === 0) {
    throw new Error('User not found');
  }
  return result.rows[0];
}

async function resetUserPassword(id, newPassword) {
  if (!newPassword || newPassword.length < 4) {
    throw new Error('Password must be at least 4 characters long');
  }
  const hash = await bcrypt.hash(newPassword, 10);
  const result = await pool.query(
    `UPDATE users 
     SET password_hash = $1, updated_at = CURRENT_TIMESTAMP 
     WHERE id = $2 
     RETURNING id, username, full_name`,
    [hash, id]
  );
  if (result.rows.length === 0) {
    throw new Error('User not found');
  }
  return result.rows[0];
}

async function deleteUser(id, currentUserId) {
  if (parseInt(id, 10) === parseInt(currentUserId, 10)) {
    throw new Error('You cannot delete your own active administrator account');
  }

  const result = await pool.query('DELETE FROM users WHERE id = $1 RETURNING id, username', [id]);
  if (result.rows.length === 0) {
    throw new Error('User not found');
  }
  return result.rows[0];
}

module.exports = { login, getProfile, getUsers, createUser, updateUser, resetUserPassword, deleteUser };

