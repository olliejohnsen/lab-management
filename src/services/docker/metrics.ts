import { prisma } from "@/lib/prisma";
import { DockerConnectionManager } from "@/services/docker/connection-manager";
import { DockerMetrics } from "@/types/docker";

/**
 * Service for collecting and storing Docker host metrics
 */
export class MetricsService {
  /**
   * Collect metrics from a specific Docker host
   */
  static async collectHostMetrics(hostId: string): Promise<DockerMetrics | null> {
    try {
      const host = await prisma.dockerHost.findUnique({
        where: { id: hostId },
      });

      if (!host || !host.isActive) {
        return null;
      }

      const connector = await DockerConnectionManager.getConnector(
        host.id,
        host.connectionType,
        host.host,
        host.port,
        host.credentials
      );

      const metrics = await connector.getMetrics();

      // Store metrics in database
      await prisma.hostMetrics.create({
        data: {
          hostId: host.id,
          cpuUsage: metrics.cpuUsage,
          ramUsage: metrics.ramUsage,
          diskUsage: metrics.diskUsage,
          networkPorts: JSON.stringify(metrics.usedPorts),
          timestamp: metrics.timestamp,
        },
      });

      return metrics;
    } catch (error) {
      console.error(`Failed to collect metrics for host ${hostId}:`, error);
      return null;
    }
  }

  /**
   * Collect metrics from all active Docker hosts
   */
  static async collectAllMetrics(): Promise<Map<string, DockerMetrics>> {
    const hosts = await prisma.dockerHost.findMany({
      where: { isActive: true },
    });

    const metricsMap = new Map<string, DockerMetrics>();

    const results = await Promise.allSettled(
      hosts.map(async (host) => {
        const metrics = await this.collectHostMetrics(host.id);
        if (metrics) {
          metricsMap.set(host.id, metrics);
        }
      })
    );

    return metricsMap;
  }

  /**
   * Get latest metrics for a host from database
   */
  static async getLatestMetrics(hostId: string): Promise<DockerMetrics | null> {
    const latest = await prisma.hostMetrics.findFirst({
      where: { hostId },
      orderBy: { timestamp: "desc" },
    });

    if (!latest) {
      return null;
    }

    return {
      cpuUsage: latest.cpuUsage,
      ramUsage: latest.ramUsage,
      diskUsage: latest.diskUsage,
      usedPorts: JSON.parse(latest.networkPorts),
      timestamp: latest.timestamp,
    };
  }

  /**
   * Get latest metrics for all hosts from database (fast, no Docker calls)
   */
  static async getLatestMetricsForAllHosts(): Promise<Record<string, DockerMetrics>> {
    const hosts = await prisma.dockerHost.findMany({
      where: { isActive: true },
      select: { id: true },
    });

    const result: Record<string, DockerMetrics> = {};

    await Promise.all(
      hosts.map(async (host) => {
        const metrics = await this.getLatestMetrics(host.id);
        if (metrics) {
          result[host.id] = metrics;
        }
      })
    );

    return result;
  }

  /**
   * Get metrics history for a host
   */
  static async getMetricsHistory(
    hostId: string,
    limit: number = 100
  ): Promise<DockerMetrics[]> {
    const history = await prisma.hostMetrics.findMany({
      where: { hostId },
      orderBy: { timestamp: "desc" },
      take: limit,
    });

    return history.map((record) => ({
      cpuUsage: record.cpuUsage,
      ramUsage: record.ramUsage,
      diskUsage: record.diskUsage,
      usedPorts: JSON.parse(record.networkPorts),
      timestamp: record.timestamp,
    }));
  }

  /**
   * Clean up old metrics (older than 24 hours)
   */
  static async cleanupOldMetrics(): Promise<void> {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    await prisma.hostMetrics.deleteMany({
      where: {
        timestamp: {
          lt: oneDayAgo,
        },
      },
    });
  }
}
