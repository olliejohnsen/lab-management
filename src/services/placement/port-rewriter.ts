import yaml from "js-yaml";

export interface PortChange {
  serviceName: string;
  from: number; // host port that was in use
  to: number;   // new host port assigned
  containerPort: string; // e.g. "80"
}

export interface PortValidationResult {
  valid: boolean;
  modifiedComposeContent: string | null;
  portChanges: PortChange[];
  errors: string[];
}

/**
 * Validates compose file ports against host's available ports and rewrites
 * the compose file to use free ports when conflicts are found.
 */
export class PortRewriter {
  /**
   * Validate and optionally rewrite compose content so all host ports
   * are NOT in the usedPorts list. Returns modified YAML and list of changes.
   */
  static validateAndRewrite(
    composeContent: string,
    usedPorts: number[]
  ): PortValidationResult {
    const portChanges: PortChange[] = [];
    const errors: string[] = [];

    try {
      const compose: any = yaml.load(composeContent);
      if (!compose?.services) {
        return {
          valid: true,
          modifiedComposeContent: null,
          portChanges: [],
          errors: [],
        };
      }

      const usedSet = new Set(usedPorts);
      const usedByUs = new Set<number>(); // ports we're assigning in this compose

      let modified = false;

      for (const [serviceName, service] of Object.entries(compose.services) as [string, any][]) {
        if (!service.ports || !Array.isArray(service.ports)) continue;

        const newPorts: (string | number)[] = [];

        for (const portMapping of service.ports) {
          const portStr = String(portMapping);
          const match = portStr.match(/^(\d+):(.+)$/);
          if (!match) {
            newPorts.push(portMapping);
            continue;
          }

          const hostPort = parseInt(match[1], 10);
          const containerPort = match[2];

          const isAvailable = !usedSet.has(hostPort) && !usedByUs.has(hostPort);

          if (isAvailable) {
            newPorts.push(portMapping);
            usedByUs.add(hostPort);
            continue;
          }

          const freePort = this.pickNextFreePort(usedSet, usedByUs);
          if (freePort === null) {
            errors.push(
              `No free port for service "${serviceName}" (wanted ${hostPort}:${containerPort}). Host has no more available ports.`
            );
            newPorts.push(portMapping);
            continue;
          }

          usedByUs.add(freePort);
          newPorts.push(`${freePort}:${containerPort}`);
          portChanges.push({
            serviceName,
            from: hostPort,
            to: freePort,
            containerPort,
          });
          modified = true;
        }

        service.ports = newPorts;
      }

      const modifiedComposeContent = modified
        ? yaml.dump(compose, { lineWidth: -1, noRefs: true })
        : null;

      return {
        valid: errors.length === 0,
        modifiedComposeContent,
        portChanges,
        errors,
      };
    } catch (error) {
      return {
        valid: false,
        modifiedComposeContent: null,
        portChanges: [],
        errors: [error instanceof Error ? error.message : "Failed to parse compose file"],
      };
    }
  }

  private static pickNextFreePort(
    usedSet: Set<number>,
    usedByUs: Set<number>
  ): number | null {
    // Search for a free port in common ranges
    const ranges = [
      { start: 8000, end: 8999 },
      { start: 3000, end: 3999 },
      { start: 5000, end: 5999 },
      { start: 9000, end: 9999 },
    ];

    for (const range of ranges) {
      for (let p = range.start; p <= range.end; p++) {
        if (!usedSet.has(p) && !usedByUs.has(p)) return p;
      }
    }
    return null;
  }
}
