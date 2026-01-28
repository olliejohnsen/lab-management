import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-utils";
import { MetricsService } from "@/services/docker/metrics";
import { PlacementAnalyzer } from "@/services/placement/analyzer";

/**
 * POST /api/deployments/suggest-host - Get placement recommendation
 * Collects fresh metrics from all hosts (via SSH/API) first so scoring has data.
 */
export async function POST(request: NextRequest) {
  try {
    await requireAuth();

    const body = await request.json();
    const { composeContent } = body;

    if (!composeContent) {
      return NextResponse.json(
        { error: "Missing composeContent" },
        { status: 400 }
      );
    }

    await MetricsService.collectAllMetrics();

    const recommendation = await PlacementAnalyzer.analyzeAndRecommend(
      composeContent
    );

    if (!recommendation) {
      return NextResponse.json(
        { error: "No suitable hosts found. Add Docker hosts in Settings and ensure metrics are being collected (e.g. open Dashboard first)." },
        { status: 404 }
      );
    }

    return NextResponse.json(recommendation);
  } catch (error) {
    console.error("Failed to suggest host:", error);
    return NextResponse.json(
      { error: "Failed to suggest host" },
      { status: 500 }
    );
  }
}
