import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-utils";
import { ComposeValidator } from "@/services/ai/compose-validator";

/**
 * POST /api/ai/validate - Validate docker-compose file
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

    const { result, summary } = ComposeValidator.validateWithSummary(
      composeContent
    );

    return NextResponse.json({
      result,
      summary,
    });
  } catch (error) {
    console.error("Failed to validate compose:", error);
    return NextResponse.json(
      { error: "Failed to validate" },
      { status: 500 }
    );
  }
}
