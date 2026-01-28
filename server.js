/**
 * Custom server to run Next.js with WebSocket support
 */
const { createServer } = require("http");
const { parse } = require("url");
const path = require("path");

const dev = process.env.NODE_ENV !== "production";
const hostname = "0.0.0.0";
const port = parseInt(process.env.PORT || "3000", 10);

if (dev) {
  // Development mode
  const next = require("next");
  const app = next({ dev, hostname, port });
  const handle = app.getRequestHandler();

  app.prepare().then(() => {
    startServer(handle);
  });
} else {
  // Production mode - use Next.js standalone server
  const NextServer = require('next/dist/server/next-server').default;
  const config = require('./.next/required-server-files.json').config;
  
  const nextServer = new NextServer({
    hostname,
    port,
    dir: __dirname,
    dev: false,
    conf: config
  });
  
  const handle = nextServer.getRequestHandler();
  nextServer.prepare().then(() => {
    startServer(handle);
  });
}

function startServer(handle) {
  const server = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url || "", true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error("Error occurred handling", req.url, err);
      res.statusCode = 500;
      res.end("Internal server error");
    }
  });

  server.listen(port, hostname, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
    console.log(`> Environment: ${process.env.NODE_ENV || 'development'}`);
    
    // Initialize WebSocket server
    try {
      console.log(`[websocket-server] Starting initialization...`);
      const { initializeWebSocketServer } = require("./src/lib/websocket-server");
      const wsPort = parseInt(process.env.WS_PORT || "3001", 10);
      initializeWebSocketServer(wsPort);
      console.log(`> WebSocket server ready on port ${wsPort}`);
    } catch (error) {
      console.error("Failed to initialize WebSocket server:", error);
    }
  });
}
