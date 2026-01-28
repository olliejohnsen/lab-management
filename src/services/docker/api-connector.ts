import Docker from "dockerode";
import { BaseDockerConnector } from "@/services/docker/base-connector";
import { DockerMetrics, DockerContainer, DeploymentResult, DockerHostCredentials, HomeProject } from "@/types/docker";
import { writeFile, unlink } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";

/**
 * Docker API connector using dockerode
 */
export class DockerAPIConnector extends BaseDockerConnector {
  private docker: Docker | null = null;
  private credentials: DockerHostCredentials;

  constructor(host: string, port: number, credentials: DockerHostCredentials) {
    super(host, port);
    this.credentials = credentials;
  }

  async connect(): Promise<void> {
    try {
      const options: Docker.DockerOptions = {
        host: this.host,
        port: this.port,
        protocol: "http",
      };

      // Use HTTPS when TLS certs are provided
      if (this.credentials.ca && this.credentials.cert && this.credentials.key) {
        options.protocol = "https";
        options.ca = this.credentials.ca;
        options.cert = this.credentials.cert;
        options.key = this.credentials.key;
      }

      this.docker = new Docker(options);

      // Test connection
      await this.docker.ping();
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      if (msg.includes("Expected HTTP") || msg.includes("Parse Error")) {
        throw new Error(
          `Docker API connection failed: the server at ${this.host}:${this.port} did not respond with HTTP. ` +
            "Check that (1) the Docker daemon is configured to listen on TCP (e.g. port 2375 for HTTP or 2376 for HTTPS), " +
            "and (2) you did not use the SSH port (22). For remote hosts without TCP API, use connection type SSH instead."
        );
      }
      throw new Error(`Failed to connect to Docker API: ${msg}`);
    }
  }

  async disconnect(): Promise<void> {
    this.docker = null;
  }

  async executeCommand(command: string): Promise<string> {
    throw new Error("Direct command execution not supported via Docker API");
  }

  async getMetrics(): Promise<DockerMetrics> {
    if (!this.docker) {
      throw new Error("Not connected to Docker host");
    }

    try {
      const info = await this.docker.info();
      const df = await this.docker.df();

      // Calculate CPU usage (simplified)
      const cpuUsage = 0; // Docker API doesn't provide system-wide CPU easily

      // Calculate RAM usage
      const totalRam = info.MemTotal;
      const usedRam = totalRam - (info.MemTotal - info.MemTotal);
      const ramUsage = (usedRam / totalRam) * 100;

      // Calculate disk usage from df
      let diskUsage = 0;
      if (df.LayersSize && df.LayersSize > 0) {
        diskUsage = 50; // Placeholder - would need more info from host
      }

      // Get used ports from containers
      const containers = await this.docker.listContainers();
      const usedPorts: number[] = [];

      containers.forEach((container) => {
        if (container.Ports) {
          container.Ports.forEach((port) => {
            if (port.PublicPort) {
              usedPorts.push(port.PublicPort);
            }
          });
        }
      });

      return {
        cpuUsage,
        ramUsage: isNaN(ramUsage) ? 0 : ramUsage,
        diskUsage,
        usedPorts: Array.from(new Set(usedPorts)),
        timestamp: new Date(),
      };
    } catch (error) {
      throw new Error(`Failed to get metrics: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  async listContainers(): Promise<DockerContainer[]> {
    if (!this.docker) {
      throw new Error("Not connected to Docker host");
    }

    try {
      const containers = await this.docker.listContainers({ all: true });

      return containers.map((container) => ({
        id: container.Id,
        name: container.Names?.[0]?.replace("/", "") || "unknown",
        status: container.State,
        image: container.Image,
        ports: (container.Ports?.map((p) => p.PublicPort).filter(Boolean) as number[]) || [],
        project: container.Labels?.["com.docker.compose.project"],
      }));
    } catch (error) {
      throw new Error(`Failed to list containers: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  async deploy(composeContent: string, projectName: string, _envContent?: string): Promise<DeploymentResult> {
    // Docker API doesn't support docker-compose directly
    // This would need to parse the compose file and create containers manually
    // For now, return not supported
    return {
      success: false,
      message: "Compose deployment via API not yet implemented - use SSH connector",
      error: "Not implemented",
    };
  }

  async stopDeployment(projectName: string, _composePath?: string): Promise<DeploymentResult> {
    if (!this.docker) {
      throw new Error("Not connected to Docker host");
    }

    try {
      const containers = await this.docker.listContainers({
        all: true,
        filters: { label: [`com.docker.compose.project=${projectName}`] },
      });

      for (const containerInfo of containers) {
        const container = this.docker.getContainer(containerInfo.Id);
        await container.stop();
      }

      return {
        success: true,
        message: `Stopped ${containers.length} containers for project ${projectName}`,
      };
    } catch (error) {
      return {
        success: false,
        message: "Failed to stop deployment",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  async removeDeployment(projectName: string, _composePath?: string): Promise<DeploymentResult> {
    if (!this.docker) {
      throw new Error("Not connected to Docker host");
    }

    try {
      const containers = await this.docker.listContainers({
        all: true,
        filters: { label: [`com.docker.compose.project=${projectName}`] },
      });

      for (const containerInfo of containers) {
        const container = this.docker.getContainer(containerInfo.Id);
        await container.remove({ force: true });
      }

      return {
        success: true,
        message: `Removed ${containers.length} containers for project ${projectName}`,
      };
    } catch (error) {
      return {
        success: false,
        message: "Failed to remove deployment",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  async restartDeployment(projectName: string, _composePath?: string): Promise<DeploymentResult> {
    if (!this.docker) {
      throw new Error("Not connected to Docker host");
    }
    try {
      const containers = await this.docker.listContainers({
        all: true,
        filters: { label: [`com.docker.compose.project=${projectName}`] },
      });
      for (const containerInfo of containers) {
        const container = this.docker.getContainer(containerInfo.Id);
        await container.restart();
      }
      return {
        success: true,
        message: `Restarted ${containers.length} containers for project ${projectName}`,
      };
    } catch (error) {
      return {
        success: false,
        message: "Failed to restart deployment",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  async restartContainer(containerId: string): Promise<DeploymentResult> {
    if (!this.docker) {
      throw new Error("Not connected to Docker host");
    }
    try {
      const container = this.docker.getContainer(containerId);
      await container.restart();
      return { success: true, message: "Container restarted" };
    } catch (error) {
      return {
        success: false,
        message: "Failed to restart container",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  async stopContainer(containerId: string): Promise<DeploymentResult> {
    if (!this.docker) {
      throw new Error("Not connected to Docker host");
    }
    try {
      const container = this.docker.getContainer(containerId);
      await container.stop();
      return { success: true, message: "Container stopped" };
    } catch (error) {
      return {
        success: false,
        message: "Failed to stop container",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  async killContainer(containerId: string): Promise<DeploymentResult> {
    if (!this.docker) {
      throw new Error("Not connected to Docker host");
    }
    try {
      const container = this.docker.getContainer(containerId);
      await container.kill();
      return { success: true, message: "Container killed" };
    } catch (error) {
      return {
        success: false,
        message: "Failed to kill container",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  async removeContainer(containerId: string, options?: { removeVolumes?: boolean }): Promise<DeploymentResult> {
    if (!this.docker) {
      throw new Error("Not connected to Docker host");
    }
    try {
      const container = this.docker.getContainer(containerId);
      await container.remove({ force: true, v: options?.removeVolumes ?? false });
      return { success: true, message: "Container removed" };
    } catch (error) {
      return {
        success: false,
        message: "Failed to remove container",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  async listRunningProjectNames(): Promise<string[]> {
    if (!this.docker) {
      throw new Error("Not connected to Docker host");
    }
    try {
      const containers = await this.docker.listContainers({ all: false });
      const projectNames = new Set<string>();
      for (const c of containers) {
        const project = c.Labels?.["com.docker.compose.project"];
        if (project) projectNames.add(project);
      }
      return Array.from(projectNames);
    } catch {
      return [];
    }
  }

  async listProjectsInHome(): Promise<HomeProject[]> {
    if (!this.docker) {
      throw new Error("Not connected to Docker host");
    }
    try {
      const containers = await this.docker.listContainers({ all: true });
      const projectNames = new Set<string>();
      for (const c of containers) {
        const project = c.Labels?.["com.docker.compose.project"];
        if (project) projectNames.add(project);
      }
      return Array.from(projectNames).map((name) => ({ name, path: name }));
    } catch {
      return [];
    }
  }

  async getProjectPorts(projectName: string): Promise<number[]> {
    if (!this.docker) {
      throw new Error("Not connected to Docker host");
    }
    try {
      const containers = await this.docker.listContainers({
        all: false,
        filters: { label: [`com.docker.compose.project=${projectName}`] },
      });
      const ports = new Set<number>();
      for (const c of containers) {
        if (c.Ports) {
          for (const p of c.Ports) {
            if (p.PublicPort) ports.add(p.PublicPort);
          }
        }
      }
      return Array.from(ports).sort((a, b) => a - b);
    } catch {
      return [];
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      if (!this.docker) {
        await this.connect();
      }
      await this.docker!.ping();
      return true;
    } catch (error) {
      return false;
    }
  }
}
