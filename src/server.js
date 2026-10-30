const app = require('./app');
const { initializeDatabase } = require('./database/init');

// In cPanel Phusion Passenger, process.env.PORT is managed by Passenger.
const PORT = process.env.PORT || 5001;

function start() {
  if (isNaN(PORT)) {
    // Passenger socket path
    app.listen(PORT, () => {
      console.log(`Tabor Hotel Backend running on Passenger socket: ${PORT}`);
    });
  } else {
    // Standard TCP port
    app.listen(Number(PORT), '0.0.0.0', () => {
      console.log(`Tabor Hotel Backend running on port ${PORT}`);
    });
  }

  // Attempt database initialization in background without crashing the whole process
  initializeDatabase()
    .then(() => {
      console.log('✅ Tabor database connected and initialized.');
    })
    .catch((err) => {
      console.warn('⚠️ Database initialization warning:', err.message);
    });
}

start();
