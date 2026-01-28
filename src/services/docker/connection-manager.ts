import { BaseDockerConnector } from "@/services/docker/base-connector";
import { DockerAPIConnector } from "@/services/docker/api-connector";
import { DockerSSHConnector } from "@/services/docker/ssh-connector";
import { DockerHostCredentials } from "@/types/docker";
import { decryptObject } from "@/services/encryption/crypto";

/**
 * Factory for creating Docker connectors based on connection type
 */
export class DockerConnectionManager {
  private static connections: Map<string, BaseDockerConnector> = new Map();

  /**
   * Get or create a connector for a Docker host
   */
  static async getConnector(
    hostId: string,
    connectionType: string,
    host: string,
    port: number,
    encryptedCredentials: string
  ): Promise<BaseDockerConnector> {
    // Check if connection already exists
    if (this.connections.has(hostId)) {
      return this.connections.get(hostId)!;
    }

    let credentials: DockerHostCredentials;
    try {
      credentials = decryptObject<DockerHostCredentials>(encryptedCredentials);
    } catch (err) {
      console.error("[connection-manager] decrypt credentials failed:", err instanceof Error ? err.message : err);
      throw err;
    }

    let connector: BaseDockerConnector;

    if (connectionType === "API") {
      connector = new DockerAPIConnector(host, port, credentials);
    } else if (connectionType === "SSH") {
      connector = new DockerSSHConnector(host, port, credentials);
    } else {
      throw new Error(`Unsupported connection type: ${connectionType}`);
    }

    try {
      await connector.connect();
    } catch (err) {
      console.error("[connection-manager] connect failed host=%s type=%s:", host, connectionType, err instanceof Error ? err.message : err);
      throw err;
    }

    this.connections.set(hostId, connector);

    return connector;
  }

  /**
   * Remove a connector from the pool
   */
  static async removeConnector(hostId: string): Promise<void> {
    const connector = this.connections.get(hostId);
    
    if (connector) {
      await connector.disconnect();
      this.connections.delete(hostId);
    }
  }

  /**
   * Test a connection without caching it
   */
  static async testConnection(
    connectionType: string,
    host: string,
    port: number,
    credentials: DockerHostCredentials
  ): Promise<boolean> {
    let connector: BaseDockerConnector;

    if (connectionType === "API") {
      connector = new DockerAPIConnector(host, port, credentials);
    } else if (connectionType === "SSH") {
      connector = new DockerSSHConnector(host, port, credentials);
    } else {
      return false;
    }

    try {
      const result = await connector.testConnection();
      await connector.disconnect();
      return result;
    } catch (error) {
      return false;
    }
  }

  /**
   * Close all connections
   */
  static async closeAll(): Promise<void> {
    const promises = Array.from(this.connections.keys()).map((hostId) =>
      this.removeConnector(hostId)
    );
    await Promise.all(promises);
  }
}
