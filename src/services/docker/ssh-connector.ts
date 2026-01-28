import { NodeSSH } from "node-ssh";
import { BaseDockerConnector } from "@/services/docker/base-connector";
import { DockerMetrics, DockerContainer, DeploymentResult, DockerHostCredentials, HomeProject } from "@/types/docker";
import { writeFile, unlink, mkdir } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { existsSync } from "fs";

/**
 * Docker SSH connector using node-ssh
 */
export class DockerSSHConnector extends BaseDockerConnector {
  private ssh: NodeSSH | null = null;
  private credentials: DockerHostCredentials;

  constructor(host: string, port: number, credentials: DockerHostCredentials) {
    super(host, port);
    this.credentials = credentials;
  }

  public getRawSSH(): NodeSSH | null {
    return this.ssh;
  }

  async connect(): Promise<void> {
    try {
      this.ssh = new NodeSSH();

      const config: any = {
        host: this.host,
        port: this.port,
        username: this.credentials.username,
      };

      if (this.credentials.privateKey) {
        config.privateKey = this.credentials.privateKey;
      } else if (this.credentials.password) {
        config.password = this.credentials.password;
      }

      await this.ssh.connect(config);
    } catch (error) {
      throw new Error(`Failed to connect via SSH: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  async disconnect(): Promise<void> {
    if (this.ssh) {
      this.ssh.dispose();
      this.ssh = null;
    }
  }

  /**
   * Escape a string for safe use inside single-quoted bash -c '...'
   */
  private static escapeForBashSingleQuotes(s: string): string {
    return s.replace(/'/g, "'\\''");
  }

  /**
   * Check if a file exists on the host (no sudo).
   */
  private async fileExistsOnHost(remotePath: string): Promise<boolean> {
    try {
      const out = await this.executeCommand(`test -f ${remotePath} && echo 1 || echo 0`, false);
      return out.trim() === "1";
    } catch {
      return false;
    }
  }

  /**
   * Run a command. Uses sudo with the configured password when credentials have a password
   * (for hosts where the user must sudo to run docker).
   */
  public async executeCommand(command: string, useSudo: boolean = false): Promise<string> {
    if (!this.ssh) {
      throw new Error("Not connected to SSH host");
    }

    let toRun: string;
    if (useSudo && this.credentials.password) {
      const escapedPass = DockerSSHConnector.escapeForBashSingleQuotes(this.credentials.password);
      const escapedCmd = DockerSSHConnector.escapeForBashSingleQuotes(command);
      toRun = `printf '%s\\n' '${escapedPass}' | sudo -S su -c '${escapedCmd}'`;
    } else {
      toRun = command;
    }

    try {
      const result = await this.ssh.execCommand(toRun);

      if (result.code !== 0) {
        console.error("[ssh-connector] command failed code=%s stderr=%s stdout=%s", result.code, result.stderr, result.stdout);
        throw new Error(`Command failed: ${result.stderr || result.stdout}`);
      }

      return result.stdout;
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      console.error("[ssh-connector] executeCommand error:", msg);
      throw new Error(`Failed to execute command: ${msg}`);
    }
  }

  async getMetrics(): Promise<DockerMetrics> {
    if (!this.ssh) {
      throw new Error("Not connected to SSH host");
    }

    let cpuUsage = 0;
    let ramUsage = 0;
    let diskUsage = 0;
    let usedPorts: number[] = [];

    try {
      const cpuOutput = await this.executeCommand(
        "top -bn1 2>/dev/null | grep 'Cpu(s)' | sed 's/.*, *\\([0-9.]*\\)%* id.*/\\1/' | awk '{print 100 - $1}'"
      );
      cpuUsage = parseFloat(cpuOutput.trim()) || 0;
    } catch (e) {
      try {
        const load = await this.executeCommand(
          "cat /proc/loadavg 2>/dev/null | awk '{print $1*25}'"
        );
        cpuUsage = Math.min(100, parseFloat(load.trim()) || 0);
      } catch (e2) {
        cpuUsage = 0;
      }
    }

    try {
      const ramOutput = await this.executeCommand(
        "free 2>/dev/null | grep Mem | awk '{print ($3/$2) * 100.0}'"
      );
      ramUsage = parseFloat(ramOutput.trim()) || 0;
    } catch (e) {
      ramUsage = 0;
    }

    try {
      const diskOutput = await this.executeCommand(
        "df / 2>/dev/null | tail -1 | awk '{print $5}' | sed 's/%//'"
      );
      diskUsage = parseFloat(diskOutput.trim()) || 0;
    } catch (e) {
      diskUsage = 0;
    }

    try {
      // Use ss to get ALL listening ports (tcp and udp)
      const portsOutput = await this.executeCommand(
        "ss -tuln | awk '{print $5}' | grep -oE '[0-9]+$' | sort -u",
        true
      );
      usedPorts = portsOutput
        .trim()
        .split("\n")
        .filter(Boolean)
        .map((p) => parseInt(p, 10));
    } catch (e) {
      // Fallback to docker ps if ss is not available
      try {
        const usedPortsOutput = await this.executeCommand(
          "docker ps --format '{{.Ports}}' 2>/dev/null | grep -oE '[0-9]+->' | grep -oE '[0-9]+' | sort -u",
          true
        );
        usedPorts = usedPortsOutput
          .trim()
          .split("\n")
          .filter(Boolean)
          .map((p) => parseInt(p, 10));
      } catch (e2) {
        usedPorts = [];
      }
    }

    return {
      cpuUsage,
      ramUsage,
      diskUsage,
      usedPorts,
      timestamp: new Date(),
    };
  }

  async listContainers(): Promise<DockerContainer[]> {
    if (!this.ssh) {
      throw new Error("Not connected to SSH host");
    }

    try {
      // Use double-quoted format so it survives sudo -c single-quote wrapping without escaping issues
      const output = await this.executeCommand(
        'docker ps -a --format "{{.ID}}|{{.Names}}|{{.Status}}|{{.Image}}|{{.Ports}}"',
        true
      );

      const lines = output.trim().split("\n").filter(Boolean);

      return lines.map((line) => {
        const parts = line.split("|");
        const [id, name, status, image, portsStr] = parts;
        const ports = (portsStr || "")
          .match(/\d+(?=->)/g)
          ?.map((p) => parseInt(p, 10)) || [];

        return {
          id,
          name: (name || "").replace(/^\//, ""),
          status,
          image,
          ports,
          project: undefined,
        };
      });
    } catch (error) {
      throw new Error(`Failed to list containers: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  private getRemoteProjectPath(projectName: string): { remoteDir: string; remotePath: string } {
    const user = this.credentials.username || "administrator";
    const remoteDir = `/home/${user}/${projectName}`;
    const remotePath = `${remoteDir}/docker-compose.yml`;
    return { remoteDir, remotePath };
  }

  async deploy(composeContent: string, projectName: string, envContent?: string): Promise<DeploymentResult> {
    if (!this.ssh) {
      throw new Error("Not connected to SSH host");
    }

    try {
      const { remoteDir, remotePath } = this.getRemoteProjectPath(projectName);
      const remoteEnvPath = `${remoteDir}/.env`;

      await this.executeCommand(`mkdir -p ${remoteDir}`, false);

      // Write compose content to local temp file and upload
      const localTempPath = join(tmpdir(), `compose-${projectName}-${Date.now()}.yml`);
      await writeFile(localTempPath, composeContent);
      await this.ssh.putFile(localTempPath, remotePath);
      await unlink(localTempPath);

      // Create .env on host only if it doesn't exist (use provided content)
      let envFileExists = await this.fileExistsOnHost(remoteEnvPath);
      if (!envFileExists && envContent && envContent.trim()) {
        const localEnvPath = join(tmpdir(), `compose-${projectName}-${Date.now()}.env`);
        await writeFile(localEnvPath, envContent);
        await this.ssh.putFile(localEnvPath, remoteEnvPath);
        await unlink(localEnvPath);
        envFileExists = true;
      }

      const envFileArg = envFileExists ? `--env-file ${remoteEnvPath} ` : "";
      await this.executeCommand(
        `docker compose ${envFileArg}-f ${remotePath} -p ${projectName} up -d`,
        true
      );

      return {
        success: true,
        message: `Deployed project ${projectName} successfully`,
      };
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : "Unknown error";
      console.error("[ssh-connector] deploy failed:", errMsg);
      if (error instanceof Error && error.stack) {
        console.error("[ssh-connector] stack:", error.stack);
      }
      return {
        success: false,
        message: "Failed to deploy",
        error: errMsg,
      };
    }
  }

  /**
   * Deploy by cloning a public GitHub repo on the host, then running docker compose.
   * Optional injectFiles (e.g. AI-generated Dockerfile/docker-compose.yml) are written into the cloned dir after clone.
   */
  async deployFromGitHub(
    cloneUrl: string,
    projectName: string,
    composePath: string,
    branch: string | undefined,
    envContent?: string,
    injectFiles?: Record<string, string>
  ): Promise<DeploymentResult> {
    if (!this.ssh) {
      throw new Error("Not connected to SSH host");
    }

    try {
      const { remoteDir } = this.getRemoteProjectPath(projectName);
      const remoteEnvPath = `${remoteDir}/.env`;
      const remoteComposePath = `${remoteDir}/${composePath.replace(/^\/+/, "")}`;

      await this.executeCommand(`rm -rf ${remoteDir}`, false);
      await this.executeCommand(`mkdir -p ${remoteDir}`, false);

      const branchArg = branch ? ` -b ${DockerSSHConnector.escapeForBashSingleQuotes(branch)}` : "";
      const escapedCloneUrl = DockerSSHConnector.escapeForBashSingleQuotes(cloneUrl);
      const cloneCmd = `git clone${branchArg} ${escapedCloneUrl} ${remoteDir}`;
      await this.executeCommand(cloneCmd, false);

      if (injectFiles && Object.keys(injectFiles).length > 0) {
        for (const [filename, content] of Object.entries(injectFiles)) {
          if (!content || !filename || filename.includes("..") || filename.includes("/")) continue;
          const localPath = join(tmpdir(), `inject-${projectName}-${filename}-${Date.now()}`);
          await writeFile(localPath, content);
          await this.ssh.putFile(localPath, `${remoteDir}/${filename}`);
          await unlink(localPath);
        }
      }

      // Create .env on host only if it doesn't exist (repo may already have one)
      let envFileExists = await this.fileExistsOnHost(remoteEnvPath);
      if (!envFileExists) {
        const envToWrite = (envContent && envContent.trim()) ? envContent.trim() : "# Generated for docker-compose\n";
        const localEnvPath = join(tmpdir(), `compose-${projectName}-${Date.now()}.env`);
        await writeFile(localEnvPath, envToWrite);
        await this.ssh.putFile(localEnvPath, remoteEnvPath);
        await unlink(localEnvPath);
        envFileExists = true;
      }

      const envFileArg = envFileExists ? `--env-file ${remoteEnvPath} ` : "";
      const escapedComposePath = remoteComposePath.replace(/'/g, "'\\''");
      await this.executeCommand(
        `docker compose ${envFileArg}-f '${escapedComposePath}' -p ${projectName} up -d --build`,
        true
      );

      return {
        success: true,
        message: `Deployed project ${projectName} from GitHub successfully`,
      };
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : "Unknown error";
      console.error("[ssh-connector] deployFromGitHub failed:", errMsg);
      if (error instanceof Error && error.stack) {
        console.error("[ssh-connector] stack:", error.stack);
      }
      return {
        success: false,
        message: "Failed to deploy from GitHub",
        error: errMsg,
      };
    }
  }

  async stopDeployment(projectName: string, composePath?: string): Promise<DeploymentResult> {
    if (!this.ssh) {
      throw new Error("Not connected to SSH host");
    }

    try {
      const { remoteDir, remotePath } = this.getRemoteProjectPath(projectName);
      const composeFile = composePath ? `${remoteDir}/${composePath.replace(/^\/+/, "")}` : remotePath;
      const escaped = composeFile.replace(/'/g, "'\\''");
      await this.executeCommand(
        `docker compose -f '${escaped}' -p ${projectName} stop`,
        true
      );

      return {
        success: true,
        message: `Stopped project ${projectName}`,
      };
    } catch (error) {
      return {
        success: false,
        message: "Failed to stop deployment",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  async removeDeployment(projectName: string, composePath?: string): Promise<DeploymentResult> {
    if (!this.ssh) {
      throw new Error("Not connected to SSH host");
    }

    try {
      const { remoteDir, remotePath } = this.getRemoteProjectPath(projectName);
      const composeFile = composePath ? `${remoteDir}/${composePath.replace(/^\/+/, "")}` : remotePath;
      const escaped = composeFile.replace(/'/g, "'\\''");
      await this.executeCommand(
        `docker compose -f '${escaped}' -p ${projectName} down -v`,
        true
      );
      await this.executeCommand(`rm -rf ${remoteDir}`, false);

      return {
        success: true,
        message: `Removed project ${projectName}`,
      };
    } catch (error) {
      return {
        success: false,
        message: "Failed to remove deployment",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  async restartDeployment(projectName: string, composePath?: string): Promise<DeploymentResult> {
    if (!this.ssh) {
      throw new Error("Not connected to SSH host");
    }

    try {
      const { remoteDir, remotePath } = this.getRemoteProjectPath(projectName);
      const composeFile = composePath ? `${remoteDir}/${composePath.replace(/^\/+/, "")}` : remotePath;
      const escaped = composeFile.replace(/'/g, "'\\''");
      await this.executeCommand(
        `docker compose -f '${escaped}' -p ${projectName} restart`,
        true
      );

      return {
        success: true,
        message: `Restarted project ${projectName}`,
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
    if (!this.ssh) {
      throw new Error("Not connected to SSH host");
    }
    try {
      const escaped = DockerSSHConnector.escapeForBashSingleQuotes(containerId);
      await this.executeCommand(`docker restart '${escaped}'`, true);
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
    if (!this.ssh) {
      throw new Error("Not connected to SSH host");
    }
    try {
      const escaped = DockerSSHConnector.escapeForBashSingleQuotes(containerId);
      await this.executeCommand(`docker stop '${escaped}'`, true);
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
    if (!this.ssh) {
      throw new Error("Not connected to SSH host");
    }
    try {
      const escaped = DockerSSHConnector.escapeForBashSingleQuotes(containerId);
      await this.executeCommand(`docker kill '${escaped}'`, true);
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
    if (!this.ssh) {
      throw new Error("Not connected to SSH host");
    }
    try {
      const escaped = DockerSSHConnector.escapeForBashSingleQuotes(containerId);
      const vFlag = options?.removeVolumes ? " -v" : "";
      await this.executeCommand(`docker rm -f${vFlag} '${escaped}'`, true);
      return { success: true, message: "Container removed" };
    } catch (error) {
      return {
        success: false,
        message: "Failed to remove container",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  async getProjectPorts(projectName: string): Promise<number[]> {
    if (!this.ssh) {
      throw new Error("Not connected to SSH host");
    }
    const escaped = DockerSSHConnector.escapeForBashSingleQuotes(projectName);
    try {
      const output = await this.executeCommand(
        `docker ps --filter 'label=com.docker.compose.project=${escaped}' --format "{{.Ports}}"`,
        true
      );
      const lines = output.trim().split("\n").filter(Boolean);
      const ports = new Set<number>();
      for (const line of lines) {
        const matches = line.match(/\d+(?=->)/g);
        if (matches) {
          matches.forEach((p) => ports.add(parseInt(p, 10)));
        }
      }
      return Array.from(ports).sort((a, b) => a - b);
    } catch {
      return [];
    }
  }

  async listRunningProjectNames(): Promise<string[]> {
    if (!this.ssh) {
      throw new Error("Not connected to SSH host");
    }
    try {
      const output = await this.executeCommand(
        "docker ps --format \"{{.Label \\\"com.docker.compose.project\\\"}}\"",
        true
      );
      const names = output
        .trim()
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);
      return Array.from(new Set(names));
    } catch {
      return [];
    }
  }

  async listProjectsInHome(): Promise<HomeProject[]> {
    if (!this.ssh) {
      throw new Error("Not connected to SSH host");
    }
    const user = this.credentials.username || "administrator";
    const homeDir = `/home/${user}`;

    try {
      const output = await this.executeCommand(
        `for d in ${homeDir}/*/; do [ -f "\${d}docker-compose.yml" ] && basename "\${d}"; done`,
        false
      );
      const names = output.trim().split("\n").filter(Boolean);
      return names.map((name) => ({
        name,
        path: `${homeDir}/${name}`,
      }));
    } catch {
      return [];
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      if (!this.ssh) {
        await this.connect();
      }
      await this.executeCommand("echo test", false);
      return true;
    } catch (error) {
      return false;
    }
  }
}
