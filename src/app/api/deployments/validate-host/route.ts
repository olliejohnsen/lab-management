import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-utils";
import { MetricsService } from "@/services/docker/metrics";
import { PortRewriter } from "@/services/placement/port-rewriter";

/**
 * POST /api/deployments/validate-host
 * Validates the selected host's port availability for the compose file.
 * If any required ports are in use, returns a modified compose file with free ports
 * so the user can see and deploy with the updated ports.
 */
export async function POST(request: NextRequest) {
  try {
    await requireAuth();

    const body = await request.json();
    const { hostId, composeContent } = body;

    if (!hostId || !composeContent) {
      return NextResponse.json(
        { error: "Missing hostId or composeContent" },
        { status: 400 }
      );
    }

    // Get fresh metrics for the host (includes available ports)
    let metrics = await MetricsService.collectHostMetrics(hostId);
    if (!metrics) {
      metrics = await MetricsService.getLatestMetrics(hostId);
    }
    if (!metrics) {
      return NextResponse.json(
        {
          valid: false,
          error: "Could not get host port information. Ensure the host is reachable and metrics are being collected.",
        },
        { status: 400 }
      );
    }

    const result = PortRewriter.validateAndRewrite(
      composeContent,
      metrics.usedPorts
    );

    return NextResponse.json({
      valid: result.valid,
      modifiedComposeContent: result.modifiedComposeContent,
      portChanges: result.portChanges,
      errors: result.errors,
      message:
        result.portChanges.length > 0
          ? `Port conflicts resolved: ${result.portChanges.map((c) => `${c.from} → ${c.to}`).join(", ")}. Compose file updated.`
          : result.errors.length > 0
            ? result.errors.join(" ")
            : "All required ports are available on this host.",
    });
  } catch (error) {
    console.error("Failed to validate host:", error);
    return NextResponse.json(
      { error: "Failed to validate host" },
      { status: 500 }
    );
  }
}
