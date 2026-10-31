const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const pool = require('./database/pool');
const authRoutes = require('./modules/auth/auth.routes');
const roomsRoutes = require('./modules/rooms/rooms.routes');
const reservationRoutes = require('./modules/room-reservations/room-reservations.routes');

const app = express();

// CORS configuration
const allowedOrigins = [
  "https://tabor.ambbatech.com",
  "http://tabor.ambbatech.com",
  "https://taborapi.ambbatech.com",
  "http://taborapi.ambbatech.com",
  "http://localhost:3000",
  "http://localhost:3001",
  "http://localhost:5173",
];

const isAllowedOrigin = (origin) => {
  if (!origin) return true;
  if (allowedOrigins.includes(origin)) return true;
  if (origin.endsWith("ambbatech.com")) return true;
  if (origin.includes("localhost") || origin.includes("127.0.0.1")) return true;
  return false;
};

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (isAllowedOrigin(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin || "*");
    res.setHeader("Access-Control-Allow-Credentials", "true");
  }
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, PATCH, DELETE, OPTIONS"
  );
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-Requested-With, Accept, Origin"
  );

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }
  next();
});

const corsOptions = {
  origin: (origin, callback) => {
    if (isAllowedOrigin(origin)) {
      return callback(null, true);
    }
    return callback(null, false);
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept", "Origin"],
  optionsSuccessStatus: 200,
};

app.use(cors(corsOptions));

// Body Parsers & Static Files (Large limit for camera ID captures)
app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ limit: "25mb", extended: true }));
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ success: true, system: 'Tabor Hotel', version: '1.0.0', timestamp: new Date().toISOString() });
});

// Database diagnostics endpoint
app.get('/api/test-db', async (req, res) => {
  try {
    const result = await pool.query('SELECT current_user, current_database(), version()');
    const tablesResult = await pool.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' ORDER BY table_name
    `);
    res.json({
      success: true,
      status: 'Connected to PostgreSQL successfully',
      current_user: result.rows[0].current_user,
      database: result.rows[0].current_database,
      tables: tablesResult.rows.map(r => r.table_name),
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      status: 'Database connection failed',
      error: err.message,
      code: err.code,
    });
  }
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/rooms', roomsRoutes);
app.use('/api/room-reservations', reservationRoutes);
app.use('/api/reservations', reservationRoutes); // backward-compat

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ success: false, message: err.message || 'Internal server error' });
});

module.exports = app;
