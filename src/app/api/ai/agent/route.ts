import { NextRequest, NextResponse } from "next/server";
import { AIAgent, AgentMessage } from "@/services/ai/agent-orchestrator";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/ai/agent
 * Chat with the AI agent that can execute actions
 */
export async function POST(request: NextRequest) {
  try {
    const { message, conversationHistory } = await request.json();

    if (!message || typeof message !== "string") {
      return NextResponse.json(
        { error: "Message is required and must be a string" },
        { status: 400 }
      );
    }

    // Create agent instance
    const agent = new AIAgent();

    // Process the query
    const response = await agent.processQuery(
      message,
      conversationHistory || []
    );

    return NextResponse.json({
      ...response,
      conversationHistory: agent.getConversationHistory(),
    });
  } catch (error) {
    console.error("Agent error:", error);
    return NextResponse.json(
      {
        error: "Failed to process agent request",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/ai/agent/tools
 * Get list of available tools
 */
export async function GET() {
  try {
    const { getToolDefinitions } = await import("@/services/ai/agent-tools");
    const tools = getToolDefinitions();

    return NextResponse.json({
      tools,
      count: tools.length,
    });
  } catch (error) {
    console.error("Failed to get tools:", error);
    return NextResponse.json(
      { error: "Failed to get agent tools" },
      { status: 500 }
    );
  }
}
