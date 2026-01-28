import { WebSocket, WebSocketServer } from "ws";
import { MetricsService } from "./metrics";
import { DockerMetrics } from "@/types/docker";

/**
 * WebSocket-based real-time metrics streaming service
 */
export class MetricsStreamService {
  private wss: WebSocketServer | null = null;
  private intervalId: NodeJS.Timeout | null = null;
  private pollingInterval: number = 5000; // 5 seconds default
  private clients: Set<WebSocket> = new Set();

  /**
   * Initialize the WebSocket server
   */
  initialize(wss: WebSocketServer): void {
    this.wss = wss;

    this.wss.on("connection", (ws: WebSocket) => {
      console.log("New WebSocket client connected");
      this.clients.add(ws);

      // Send immediate metrics on connection
      this.sendMetricsToClient(ws);

      ws.on("close", () => {
        console.log("WebSocket client disconnected");
        this.clients.delete(ws);
      });

      ws.on("error", (error) => {
        console.error("WebSocket error:", error);
        this.clients.delete(ws);
      });
    });
  }

  /**
   * Start polling and broadcasting metrics
   */
  start(intervalMs: number = 5000): void {
    if (this.intervalId) {
      return; // Already running
    }

    this.pollingInterval = intervalMs;

    this.intervalId = setInterval(async () => {
      await this.broadcastMetrics();
    }, this.pollingInterval);

    console.log(`Metrics streaming started with ${intervalMs}ms interval`);
  }

  /**
   * Stop polling
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log("Metrics streaming stopped");
    }
  }

  /**
   * Broadcast metrics to all connected clients
   */
  private async broadcastMetrics(): Promise<void> {
    try {
      const metricsMap = await MetricsService.collectAllMetrics();

      const payload = {
        type: "metrics",
        timestamp: new Date().toISOString(),
        data: Object.fromEntries(metricsMap),
      };

      const message = JSON.stringify(payload);

      // Send to all connected clients
      this.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(message);
        }
      });
    } catch (error) {
      console.error("Failed to broadcast metrics:", error);
    }
  }

  /**
   * Send current metrics to a specific client
   */
  private async sendMetricsToClient(client: WebSocket): Promise<void> {
    try {
      const metricsMap = await MetricsService.collectAllMetrics();

      const payload = {
        type: "metrics",
        timestamp: new Date().toISOString(),
        data: Object.fromEntries(metricsMap),
      };

      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(payload));
      }
    } catch (error) {
      console.error("Failed to send metrics to client:", error);
    }
  }

  /**
   * Get number of connected clients
   */
  getClientCount(): number {
    return this.clients.size;
  }
}

// Export singleton instance
export const metricsStreamService = new MetricsStreamService();
