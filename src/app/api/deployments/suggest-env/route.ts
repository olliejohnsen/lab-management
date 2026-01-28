import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-utils";
import { generateEnvFromCompose } from "@/services/deployment/env-from-compose";

/**
 * POST /api/deployments/suggest-env
 * Returns suggested .env content for a given docker-compose body.
 * Used by the deployment page to show and let the user tune variables.
 */
export async function POST(request: NextRequest) {
  try {
    await requireAuth();

    const body = await request.json();
    const { composeContent } = body;

    if (!composeContent || typeof composeContent !== "string") {
      return NextResponse.json(
        { error: "Missing composeContent" },
        { status: 400 }
      );
    }

    const envContent = generateEnvFromCompose(composeContent);

    return NextResponse.json({ envContent });
  } catch (error) {
    console.error("Failed to suggest env:", error);
    return NextResponse.json(
      { error: "Failed to generate suggested .env" },
      { status: 500 }
    );
  }
}
