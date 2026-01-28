import yaml from "js-yaml";

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Docker Compose file validator
 */
export class ComposeValidator {
  /**
   * Validate a docker-compose file
   */
  static validate(composeContent: string): ValidationResult {
    const result: ValidationResult = {
      valid: true,
      errors: [],
      warnings: [],
    };

    try {
      // Parse YAML
      const compose: any = yaml.load(composeContent);

      if (!compose) {
        result.valid = false;
        result.errors.push("Empty compose file");
        return result;
      }

      // Check for services
      if (!compose.services || Object.keys(compose.services).length === 0) {
        result.valid = false;
        result.errors.push("No services defined");
        return result;
      }

      // Validate each service
      Object.entries(compose.services).forEach(([serviceName, service]: [string, any]) => {
        // Check for image or build
        if (!service.image && !service.build) {
          result.warnings.push(`Service "${serviceName}" has no image or build configuration`);
        }

        // Security warnings
        if (service.privileged === true) {
          result.warnings.push(`Service "${serviceName}" runs in privileged mode - security risk`);
        }

        if (service.network_mode === "host") {
          result.warnings.push(`Service "${serviceName}" uses host network mode - may cause port conflicts`);
        }

        // Check for restart policy
        if (!service.restart) {
          result.warnings.push(`Service "${serviceName}" has no restart policy`);
        }

        // Check for health checks on long-running services
        if (!service.healthcheck && service.image?.includes("postgres")) {
          result.warnings.push(`Service "${serviceName}" (database) should have a health check`);
        }

        // Validate port mappings
        if (service.ports) {
          service.ports.forEach((port: any) => {
            const portStr = String(port);
            if (!portStr.match(/^\d+:\d+$/) && !portStr.match(/^\d+$/)) {
              result.errors.push(`Invalid port mapping "${port}" in service "${serviceName}"`);
              result.valid = false;
            }
          });
        }

        // Check for volumes syntax
        if (service.volumes) {
          service.volumes.forEach((volume: any) => {
            const volumeStr = String(volume);
            // Basic volume syntax check
            if (!volumeStr.includes(":") && !volumeStr.match(/^[a-zA-Z0-9_-]+$/)) {
              result.warnings.push(`Unusual volume syntax "${volume}" in service "${serviceName}"`);
            }
          });
        }
      });

      // Check for named volumes definition
      if (compose.volumes && Object.keys(compose.volumes).length > 0) {
        Object.keys(compose.volumes).forEach((volumeName) => {
          // Check if volume is actually used
          let used = false;
          Object.values(compose.services).forEach((service: any) => {
            if (service.volumes) {
              service.volumes.forEach((vol: string) => {
                if (vol.startsWith(volumeName + ":")) {
                  used = true;
                }
              });
            }
          });
          
          if (!used) {
            result.warnings.push(`Named volume "${volumeName}" is defined but not used`);
          }
        });
      }

    } catch (error) {
      result.valid = false;
      
      if (error instanceof yaml.YAMLException) {
        result.errors.push(`YAML syntax error: ${error.message}`);
      } else {
        result.errors.push(`Validation failed: ${error instanceof Error ? error.message : "Unknown error"}`);
      }
    }

    return result;
  }

  /**
   * Validate and return a formatted summary
   */
  static validateWithSummary(composeContent: string): {
    result: ValidationResult;
    summary: string;
  } {
    const result = this.validate(composeContent);

    let summary = "";

    if (result.valid) {
      summary = "✓ Compose file is valid";
      
      if (result.warnings.length > 0) {
        summary += `\n\n⚠ Warnings:\n${result.warnings.map((w) => `  - ${w}`).join("\n")}`;
      }
    } else {
      summary = "✗ Compose file has errors\n\n";
      summary += `Errors:\n${result.errors.map((e) => `  - ${e}`).join("\n")}`;
      
      if (result.warnings.length > 0) {
        summary += `\n\nWarnings:\n${result.warnings.map((w) => `  - ${w}`).join("\n")}`;
      }
    }

    return { result, summary };
  }
}
