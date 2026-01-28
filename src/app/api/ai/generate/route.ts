import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-utils";
import { ComposeGenerator } from "@/services/ai/compose-generator";

/**
 * POST /api/ai/generate - Generate docker-compose from prompt
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();

    const body = await request.json();
    const { prompt } = body;

    if (!prompt) {
      return NextResponse.json(
        { error: "Missing prompt" },
        { status: 400 }
      );
    }

    const generator = new ComposeGenerator();
    const composeContent = await generator.generate(prompt, session.user.id);

    return NextResponse.json({
      composeContent,
    });
  } catch (error) {
    console.error("Failed to generate compose:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate" },
      { status: 500 }
    );
  }
}
