import yaml from "js-yaml";

export interface ResourceRequirements {
  cpuLimit?: number; // CPU cores
  memoryLimit?: number; // MB
  requiredPorts: number[];
  volumesCount: number;
  estimatedDiskSpace: number; // MB
}

/**
 * Parse docker-compose file to extract resource requirements
 */
export class RequirementsParser {
  /**
   * Parse docker-compose content and extract resource requirements
   */
  static parse(composeContent: string): ResourceRequirements {
    try {
      const compose: any = yaml.load(composeContent);

      const requirements: ResourceRequirements = {
        requiredPorts: [],
        volumesCount: 0,
        estimatedDiskSpace: 1000, // Default 1GB
      };

      // Parse services
      if (compose.services) {
        Object.values(compose.services).forEach((service: any) => {
          // Extract ports
          if (service.ports) {
            service.ports.forEach((portMapping: string | number) => {
              const portStr = String(portMapping);
              const match = portStr.match(/^(\d+):/);
              if (match) {
                requirements.requiredPorts.push(parseInt(match[1], 10));
              }
            });
          }

          // Extract resource limits
          if (service.deploy?.resources?.limits) {
            const limits = service.deploy.resources.limits;
            
            if (limits.cpus) {
              const cpus = parseFloat(limits.cpus);
              requirements.cpuLimit = (requirements.cpuLimit || 0) + cpus;
            }
            
            if (limits.memory) {
              const memory = this.parseMemory(limits.memory);
              requirements.memoryLimit = (requirements.memoryLimit || 0) + memory;
            }
          }

          // Count volumes
          if (service.volumes) {
            requirements.volumesCount += service.volumes.length;
            // Estimate 500MB per volume
            requirements.estimatedDiskSpace += service.volumes.length * 500;
          }
        });
      }

      return requirements;
    } catch (error) {
      console.error("Failed to parse compose file:", error);
      // Return minimal requirements on error
      return {
        requiredPorts: [],
        volumesCount: 0,
        estimatedDiskSpace: 1000,
      };
    }
  }

  /**
   * Parse memory string (e.g., "512M", "2G") to MB
   */
  private static parseMemory(memoryStr: string): number {
    const match = memoryStr.match(/^(\d+(?:\.\d+)?)(M|G|K)?$/i);
    
    if (!match) {
      return 0;
    }

    const value = parseFloat(match[1]);
    const unit = match[2]?.toUpperCase();

    switch (unit) {
      case "K":
        return value / 1024;
      case "M":
        return value;
      case "G":
        return value * 1024;
      default:
        return value / (1024 * 1024); // Assume bytes
    }
  }
}
