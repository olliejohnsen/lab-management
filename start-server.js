/**
 * Production server wrapper that adds WebSocket support to Next.js standalone
 */

// Start the Next.js standalone server in the background
const { spawn } = require('child_process');

// Start Next.js server
console.log('Starting Next.js server...');
const nextServer = spawn('node', ['server.js'], {
  env: { ...process.env },
  stdio: 'inherit'
});

nextServer.on('error', (err) => {
  console.error('Failed to start Next.js server:', err);
  process.exit(1);
});

// Wait a moment for Next.js to start, then initialize WebSocket
setTimeout(() => {
  try {
    console.log('[websocket-server] Starting initialization...');
    const { initializeWebSocketServer } = require("./src/lib/websocket-server");
    const wsPort = parseInt(process.env.WS_PORT || "3001", 10);
    initializeWebSocketServer(wsPort);
    console.log(`> WebSocket server ready on port ${wsPort}`);
  } catch (error) {
    console.error("Failed to initialize WebSocket server:", error);
  }
}, 2000);

// Handle cleanup
process.on('SIGTERM', () => {
  nextServer.kill();
  process.exit(0);
});

process.on('SIGINT', () => {
  nextServer.kill();
  process.exit(0);
});
