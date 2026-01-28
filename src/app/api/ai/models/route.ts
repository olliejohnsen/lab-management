import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-utils";
import { OllamaClient } from "@/services/ai/ollama-client";

/**
 * GET /api/ai/models - List available Ollama models
 */
export async function GET(request: NextRequest) {
  try {
    await requireAuth();

    const client = new OllamaClient();
    const models = await client.listModels();

    return NextResponse.json({ models });
  } catch (error) {
    console.error("Failed to list models:", error);
    return NextResponse.json(
      { error: "Failed to list models" },
      { status: 500 }
    );
  }
}
