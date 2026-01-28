import { WebSocketServer } from "ws";
import { metricsStreamService } from "@/services/docker/metrics-stream";
import { terminalStreamService } from "@/services/docker/terminal-stream";

let wss: WebSocketServer | null = null;

/**
 * Initialize WebSocket server
 * This should be called when the Next.js server starts
 */
export function initializeWebSocketServer(port: number = 3001): void {
  console.log(`[websocket-server] Attempting to initialize on port ${port}`);
  if (wss) {
    console.log("[websocket-server] WebSocket server already initialized");
    return;
  }

  try {
    wss = new WebSocketServer({ port });
    console.log(`[websocket-server] WebSocket server started on port ${port}`);

    // Initialize metrics streaming
    metricsStreamService.initialize(wss);
    console.log("[websocket-server] Metrics stream service initialized");
    metricsStreamService.start(5000); // Poll every 5 seconds

    // Initialize terminal streaming
    terminalStreamService.initialize(wss);
    console.log("[websocket-server] Terminal stream service initialized");

    // Cleanup old metrics daily
    setInterval(async () => {
      const { MetricsService } = await import("@/services/docker/metrics");
      await MetricsService.cleanupOldMetrics();
    }, 24 * 60 * 60 * 1000); // Once per day
  } catch (err) {
    console.error("[websocket-server] Failed to start WebSocket server:", err);
  }
}

/**
 * Get the WebSocket server instance
 */
export function getWebSocketServer(): WebSocketServer | null {
  return wss;
}

/**
 * Shutdown WebSocket server
 */
export function shutdownWebSocketServer(): void {
  if (wss) {
    metricsStreamService.stop();
    wss.close();
    wss = null;
    console.log("WebSocket server shut down");
  }
}
