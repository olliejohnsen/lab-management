import { WebSocket, WebSocketServer } from "ws";
import { prisma } from "@/lib/prisma";
import { DockerConnectionManager } from "@/services/docker/connection-manager";
import { DockerSSHConnector } from "@/services/docker/ssh-connector";
import { NodeSSH } from "node-ssh";
import { decryptObject } from "@/services/encryption/crypto";
import { DockerHostCredentials } from "@/types/docker";

/**
 * Service for handling interactive terminal sessions via SSH
 */
export class TerminalStreamService {
  private sessions: Map<WebSocket, { shell: any, ssh: NodeSSH }> = new Map();

  initialize(wss: WebSocketServer): void {
    console.log("[terminal-stream] Initializing terminal stream service");
    wss.on("connection", (ws: WebSocket) => {
      console.log("[terminal-stream] New WebSocket connection established");
      
      ws.on("message", async (message: string) => {
        try {
          const payload = JSON.parse(message);
          console.log("[terminal-stream] Received message:", payload.type, payload.hostId || "");
          
          if (payload.type === "terminal_init") {
            await this.handleInit(ws, payload.hostId);
          } else if (payload.type === "terminal_input") {
            this.handleInput(ws, payload.data);
          } else if (payload.type === "terminal_resize") {
            this.handleResize(ws, payload.cols, payload.rows);
          }
        } catch (err) {
          console.error("[terminal-stream] message error:", err);
        }
      });

      ws.on("close", (code, reason) => {
        console.log(`[terminal-stream] WebSocket connection closed. Code: ${code}, Reason: ${reason}`);
        this.cleanupSession(ws);
      });

      ws.on("error", (err) => {
        console.error("[terminal-stream] WebSocket error:", err);
      });
    });
  }

  private async handleInit(ws: WebSocket, hostId: string): Promise<void> {
    console.log(`[terminal-stream] Initializing terminal for host: ${hostId}`);
    try {
      // Cleanup existing session if any
      this.cleanupSession(ws);

      const host = await prisma.dockerHost.findUnique({
        where: { id: hostId },
      });

      if (!host) {
        console.error(`[terminal-stream] Host not found: ${hostId}`);
        ws.send(JSON.stringify({ type: "terminal_error", message: "Host not found" }));
        return;
      }

      if (host.connectionType !== "SSH") {
        console.error(`[terminal-stream] Host ${hostId} is not an SSH host: ${host.connectionType}`);
        ws.send(JSON.stringify({ type: "terminal_error", message: "Terminal only supported for SSH hosts" }));
        return;
      }

      console.log(`[terminal-stream] Connecting to ${host.name} (${host.host}:${host.port})`);

      // Create a DEDICATED SSH connection for this terminal session
      const credentials = decryptObject<DockerHostCredentials>(host.credentials);
      const ssh = new NodeSSH();

      const config: any = {
        host: host.host,
        port: host.port,
        username: credentials.username,
        keepaliveInterval: 10000,
        keepaliveCountMax: 3,
        readyTimeout: 20000, // 20s timeout
      };

      if (credentials.privateKey) {
        config.privateKey = credentials.privateKey;
      } else if (credentials.password) {
        config.password = credentials.password;
      }

      await ssh.connect(config);
      console.log(`[terminal-stream] SSH connected to host ${hostId}`);

      const connection = (ssh as any).connection;
      if (connection) {
        connection.on('error', (err: any) => {
          console.error(`[terminal-stream] SSH connection error for host ${hostId}:`, err);
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "terminal_error", message: `SSH Connection Error: ${err.message}` }));
          }
        });

        connection.on('end', () => {
          console.log(`[terminal-stream] SSH connection ended for host ${hostId}`);
        });
      }

      // Create interactive shell
      console.log(`[terminal-stream] Requesting shell for host ${hostId}`);
      const shell = await ssh.requestShell({
        term: 'xterm-256color',
      });
      console.log(`[terminal-stream] Shell requested successfully for host ${hostId}`);

      shell.on('data', (data: Buffer) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            type: "terminal_data",
            data: data.toString('utf-8')
          }));
        }
      });

      shell.on('error', (err: any) => {
        console.error(`[terminal-stream] shell error for host ${hostId}:`, err);
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "terminal_error", message: err.message }));
        }
      });

      shell.on('close', () => {
        console.log(`[terminal-stream] shell closed for host ${hostId}`);
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "terminal_closed" }));
        }
        this.cleanupSession(ws);
      });

      this.sessions.set(ws, { shell, ssh });
      
      console.log(`[terminal-stream] terminal ready for host ${hostId}`);
      
      // Send a newline to trigger prompt
      shell.write('\n');
      
      // Small delay to ensure stream is ready
      setTimeout(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "terminal_ready" }));
        }
      }, 100);

    } catch (err) {
      console.error(`[terminal-stream] init failed for host ${hostId}:`, err);
      ws.send(JSON.stringify({ 
        type: "terminal_error", 
        message: err instanceof Error ? err.message : "Failed to initialize terminal" 
      }));
    }
  }

  private handleInput(ws: WebSocket, data: string): void {
    const session = this.sessions.get(ws);
    if (session?.shell) {
      session.shell.write(data);
    }
  }

  private handleResize(ws: WebSocket, cols: number, rows: number): void {
    const session = this.sessions.get(ws);
    if (session?.shell && typeof session.shell.setWindow === 'function') {
      session.shell.setWindow(rows, cols, 0, 0);
    }
  }

  private cleanupSession(ws: WebSocket): void {
    const session = this.sessions.get(ws);
    if (session) {
      if (session.shell) session.shell.end();
      if (session.ssh) session.ssh.dispose();
      this.sessions.delete(ws);
    }
  }
}

export const terminalStreamService = new TerminalStreamService();
