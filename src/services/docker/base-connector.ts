import { DockerMetrics, DockerContainer, DeploymentResult, HomeProject } from "@/types/docker";

/**
 * Abstract base class for Docker host connectors
 */
export abstract class BaseDockerConnector {
  protected host: string;
  protected port: number;

  constructor(host: string, port: number) {
    this.host = host;
    this.port = port;
  }

  /**
   * Establish connection to Docker host
   */
  abstract connect(): Promise<void>;

  /**
   * Disconnect from Docker host
   */
  abstract disconnect(): Promise<void>;

  /**
   * Execute a command on the Docker host
   */
  abstract executeCommand(command: string): Promise<string>;

  /**
   * Get metrics from the Docker host
   */
  abstract getMetrics(): Promise<DockerMetrics>;

  /**
   * List all containers
   */
  abstract listContainers(): Promise<DockerContainer[]>;

  /**
   * Deploy a docker-compose file.
   * Optional envContent is written as .env next to compose so variables are set.
   */
  abstract deploy(composeContent: string, projectName: string, envContent?: string): Promise<DeploymentResult>;

  /**
   * Stop a deployment. composePath is optional (for GitHub deploys with compose in subdir).
   */
  abstract stopDeployment(projectName: string, composePath?: string): Promise<DeploymentResult>;

  /**
   * Remove a deployment. composePath is optional (for GitHub deploys with compose in subdir).
   */
  abstract removeDeployment(projectName: string, composePath?: string): Promise<DeploymentResult>;

  /**
   * Restart a deployment (docker compose restart).
   */
  abstract restartDeployment(projectName: string, composePath?: string): Promise<DeploymentResult>;

  /**
   * Restart a single container by id.
   */
  abstract restartContainer(containerId: string): Promise<DeploymentResult>;

  /**
   * Stop a single container by id.
   */
  abstract stopContainer(containerId: string): Promise<DeploymentResult>;

  /**
   * Kill a single container by id (SIGKILL).
   */
  abstract killContainer(containerId: string): Promise<DeploymentResult>;

  /**
   * Remove a single container. Optionally remove associated volumes.
   */
  abstract removeContainer(containerId: string, options?: { removeVolumes?: boolean }): Promise<DeploymentResult>;

  /**
   * List project directories in home (e.g. ~/projectName with docker-compose.yml). SSH only; API returns [].
   */
  abstract listProjectsInHome(): Promise<HomeProject[]>;

  /**
   * List compose project names that have at least one running container on this host.
   * Used by import to only include actually running stacks.
   */
  abstract listRunningProjectNames(): Promise<string[]>;

  /**
   * Get the host ports actually in use by a compose project on this host (from running containers).
   * Returns empty array if project not found or no published ports.
   */
  abstract getProjectPorts(projectName: string): Promise<number[]>;

  /**
   * Test connection health
   */
  abstract testConnection(): Promise<boolean>;
}
