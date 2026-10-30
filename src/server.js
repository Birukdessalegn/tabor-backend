const app = require('./app');
const { initializeDatabase } = require('./database/init');

const PORT = process.env.PORT || 5001;

async function start() {
  try {
    await initializeDatabase();
    app.listen(PORT, () => {
      console.log(`Tabor Hotel Backend running on port ${PORT}`);
      console.log(`Health: http://localhost:${PORT}/api/health`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

start();

