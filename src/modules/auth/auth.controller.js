const authService = require('./auth.service');

async function login(req, res) {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Username and password required' });
    }
    const result = await authService.login(username, password);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(401).json({ success: false, message: err.message });
  }
}

async function getProfile(req, res) {
  try {
    const user = await authService.getProfile(req.user.id);
    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

async function getUsers(req, res) {
  try {
    const users = await authService.getUsers();
    res.json({ success: true, users });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

async function createUser(req, res) {
  try {
    const user = await authService.createUser(req.body);
    res.status(201).json({ success: true, user });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = { login, getProfile, getUsers, createUser };

