import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-utils";
import { MetricsService } from "@/services/docker/metrics";

/**
 * GET /api/hosts/[id]/metrics - Get host metrics history
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id } = await params;

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "100");

    const metrics = await MetricsService.getMetricsHistory(id, limit);

    return NextResponse.json(metrics);
  } catch (error) {
    console.error("Failed to get metrics:", error);
    return NextResponse.json(
      { error: "Failed to get metrics" },
      { status: 500 }
    );
  }
}
