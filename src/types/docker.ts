export interface DockerMetrics {
  cpuUsage: number;
  ramUsage: number;
  diskUsage: number;
  usedPorts: number[];
  timestamp: Date;
}

export interface DockerHostCredentials {
  // For SSH
  username?: string;
  password?: string;
  privateKey?: string;
  // For API
  ca?: string;
  cert?: string;
  key?: string;
}

export interface DockerContainer {
  id: string;
  name: string;
  status: string;
  image: string;
  ports: number[];
  /** Compose project name if part of a compose stack */
  project?: string;
}

export interface HomeProject {
  name: string;
  path: string;
}

export interface DeploymentResult {
  success: boolean;
  message: string;
  containerId?: string;
  error?: string;
}
