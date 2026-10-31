const jwt = require('jsonwebtoken');

function authMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, message: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'tabor_jwt_secret');
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }
    // Admin always has access
    if (req.user.role === 'admin' || roles.length === 0 || roles.includes(req.user.role)) {
      return next();
    }
    return res.status(403).json({ success: false, message: 'Insufficient permissions' });
  };
}

module.exports = {
  authMiddleware,
  requireRole,
  authenticate: authMiddleware,
  authorize: requireRole,
};
