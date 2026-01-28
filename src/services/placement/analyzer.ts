import { prisma } from "@/lib/prisma";
import { MetricsService } from "@/services/docker/metrics";
import { RequirementsParser, ResourceRequirements } from "./requirements-parser";
import { DockerMetrics } from "@/types/docker";

export interface PlacementWeights {
  cpu: number;
  ram: number;
  disk: number;
  network: number;
}

export interface HostScore {
  hostId: string;
  hostName: string;
  score: number;
  reasons: string[];
  metrics: DockerMetrics;
}

export interface PlacementRecommendation {
  recommendedHost: HostScore;
  alternativeHosts: HostScore[];
}

/**
 * Smart placement algorithm for Docker deployments
 */
export class PlacementAnalyzer {
  /**
   * Get placement weights from database or use defaults
   */
  private static async getWeights(): Promise<PlacementWeights> {
    const settings = await prisma.appSettings.findUnique({
      where: { key: "placement_weights" },
    });

    if (settings) {
      try {
        return JSON.parse(settings.value);
      } catch (error) {
        console.error("Failed to parse placement weights:", error);
      }
    }

    // Default weights
    return {
      cpu: 30,
      ram: 30,
      disk: 20,
      network: 20,
    };
  }

  /**
   * Analyze and recommend host for deployment
   */
  static async analyzeAndRecommend(
    composeContent: string
  ): Promise<PlacementRecommendation | null> {
    try {
      // Parse requirements from compose file
      const requirements = RequirementsParser.parse(composeContent);

      // Get all active hosts
      const hosts = await prisma.dockerHost.findMany({
        where: { isActive: true },
      });

      if (hosts.length === 0) {
        return null;
      }

      // Get weights
      const weights = await this.getWeights();

      // Score each host
      const scores: HostScore[] = [];

      for (const host of hosts) {
        const metrics = await MetricsService.getLatestMetrics(host.id);

        if (!metrics) {
          continue; // Skip hosts without metrics
        }

        const score = this.calculateScore(requirements, metrics, weights);
        const reasons = this.generateReasons(requirements, metrics);

        scores.push({
          hostId: host.id,
          hostName: host.name,
          score,
          reasons,
          metrics,
        });
      }

      // Sort by score (highest first)
      scores.sort((a, b) => b.score - a.score);

      if (scores.length === 0) {
        return null;
      }

      return {
        recommendedHost: scores[0],
        alternativeHosts: scores.slice(1, 4), // Top 3 alternatives
      };
    } catch (error) {
      console.error("Failed to analyze placement:", error);
      return null;
    }
  }

  /**
   * Calculate score for a host based on requirements and metrics
   */
  private static calculateScore(
    requirements: ResourceRequirements,
    metrics: DockerMetrics,
    weights: PlacementWeights
  ): number {
    // Normalize weights to 100
    const totalWeight = weights.cpu + weights.ram + weights.disk + weights.network;
    const normWeights = {
      cpu: (weights.cpu / totalWeight) * 100,
      ram: (weights.ram / totalWeight) * 100,
      disk: (weights.disk / totalWeight) * 100,
      network: (weights.network / totalWeight) * 100,
    };

    // Calculate component scores (0-100, higher is better)
    
    // CPU score: inverse of usage (lower usage = better)
    const cpuScore = 100 - metrics.cpuUsage;

    // RAM score: inverse of usage
    const ramScore = 100 - metrics.ramUsage;

    // Disk score: inverse of usage
    const diskScore = 100 - metrics.diskUsage;

    // Network score: based on available ports
    let networkScore = 0;
    if (requirements.requiredPorts.length > 0) {
      const availableRequired = requirements.requiredPorts.filter((port) =>
        !metrics.usedPorts.includes(port)
      );
      networkScore = (availableRequired.length / requirements.requiredPorts.length) * 100;
    } else {
      // If no specific ports required, score based on total used ports (lower is better)
      networkScore = Math.max(0, 100 - (metrics.usedPorts.length * 2));
    }

    // Apply penalties for insufficient resources
    let penalty = 0;

    // Penalize if required ports are not available
    if (requirements.requiredPorts.length > 0) {
      const unavailablePorts = requirements.requiredPorts.filter(
        (port) => metrics.usedPorts.includes(port)
      );
      if (unavailablePorts.length > 0) {
        penalty += 100; // Total penalty for port conflicts
      }
    }

    // Penalize if CPU/RAM usage is too high (>80%)
    if (metrics.cpuUsage > 80) {
      penalty += 20;
    }
    if (metrics.ramUsage > 80) {
      penalty += 20;
    }
    if (metrics.diskUsage > 80) {
      penalty += 20;
    }

    // Calculate weighted score
    const weightedScore =
      (cpuScore * normWeights.cpu +
        ramScore * normWeights.ram +
        diskScore * normWeights.disk +
        networkScore * normWeights.network) /
      100;

    // Apply penalty
    const finalScore = Math.max(0, weightedScore - penalty);

    return Math.round(finalScore * 100) / 100;
  }

  /**
   * Generate human-readable reasons for placement decision
   */
  private static generateReasons(
    requirements: ResourceRequirements,
    metrics: DockerMetrics
  ): string[] {
    const reasons: string[] = [];

    // CPU
    if (metrics.cpuUsage < 50) {
      reasons.push(`Low CPU usage (${metrics.cpuUsage.toFixed(1)}%)`);
    } else if (metrics.cpuUsage > 80) {
      reasons.push(`High CPU usage (${metrics.cpuUsage.toFixed(1)}%)`);
    }

    // RAM
    if (metrics.ramUsage < 50) {
      reasons.push(`Plenty of RAM available (${(100 - metrics.ramUsage).toFixed(1)}% free)`);
    } else if (metrics.ramUsage > 80) {
      reasons.push(`Limited RAM available (${(100 - metrics.ramUsage).toFixed(1)}% free)`);
    }

    // Disk
    if (metrics.diskUsage < 50) {
      reasons.push(`Good disk space (${(100 - metrics.diskUsage).toFixed(1)}% free)`);
    } else if (metrics.diskUsage > 80) {
      reasons.push(`Limited disk space (${(100 - metrics.diskUsage).toFixed(1)}% free)`);
    }

    // Ports
    if (requirements.requiredPorts.length > 0) {
      const unavailable = requirements.requiredPorts.filter((port) =>
        metrics.usedPorts.includes(port)
      );
      
      if (unavailable.length === 0) {
        reasons.push(`All required ports available`);
      } else {
        reasons.push(`Port conflicts: ${unavailable.join(", ")}`);
      }
    } else {
      reasons.push(`${metrics.usedPorts.length} ports currently in use`);
    }

    return reasons;
  }
}
