import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-utils";
import { MetricsService } from "@/services/docker/metrics";

const METRICS_CACHE_MS = 30_000; // 30 seconds
let metricsCache: { data: Record<string, import("@/types/docker").DockerMetrics>; expires: number } | null = null;

/**
 * GET /api/metrics - Get metrics for all hosts.
 * Collects fresh metrics via SSH/API when cache is stale (so dashboard and suggest-host have data).
 */
export async function GET(request: NextRequest) {
  try {
    await requireAuth();

    const now = Date.now();
    if (metricsCache && metricsCache.expires > now) {
      return NextResponse.json(metricsCache.data);
    }

    const metricsMap = await MetricsService.collectAllMetrics();
    const data = Object.fromEntries(metricsMap);
    metricsCache = { data, expires: now + METRICS_CACHE_MS };

    return NextResponse.json(data);
  } catch (error) {
    console.error("Failed to get metrics:", error);
    const fallback = await MetricsService.getLatestMetricsForAllHosts();
    return NextResponse.json(fallback || {});
  }
}
