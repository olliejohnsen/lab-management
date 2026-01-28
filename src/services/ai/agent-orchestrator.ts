/**
 * AI Agent Orchestrator - Manages the agent's reasoning and tool execution
 */

import { OllamaClient } from "./ollama-client";
import { getAgentTools, executeTool, getToolDefinitions } from "./agent-tools";

export interface AgentMessage {
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  toolCalls?: ToolCall[];
  toolResults?: ToolResult[];
  thinking?: string;
}

export interface ToolCall {
  id: string;
  tool: string;
  parameters: any;
}

export interface ToolResult {
  id: string;
  tool: string;
  success: boolean;
  result?: any;
  error?: string;
}

export interface AgentStep {
  type: "thinking" | "tool_call" | "response";
  content: string;
  toolCall?: ToolCall;
  toolResult?: ToolResult;
  timestamp: number;
}

export interface AgentResponse {
  message: string;
  steps: AgentStep[];
  toolsUsed: string[];
  conversationComplete: boolean;
}

export class AIAgent {
  private ollama: OllamaClient;
  private conversationHistory: AgentMessage[] = [];
  private maxIterations = 10;

  constructor(ollamaUrl?: string) {
    this.ollama = new OllamaClient(ollamaUrl);
  }

  /**
   * Process a user query with the AI agent
   */
  async processQuery(
    userQuery: string,
    conversationHistory: AgentMessage[] = []
  ): Promise<AgentResponse> {
    this.conversationHistory = conversationHistory;
    
    // Add user message
    this.conversationHistory.push({
      role: "user",
      content: userQuery,
    });

    const steps: AgentStep[] = [];
    const toolsUsed: string[] = [];
    let iterations = 0;

    // Agent loop: think -> act -> observe -> repeat until done
    while (iterations < this.maxIterations) {
      iterations++;

      // Get agent's next action
      const agentAction = await this.getNextAction();

      // If the agent wants to use a tool
      if (agentAction.type === "tool_call" && agentAction.toolCall) {
        steps.push({
          type: "tool_call",
          content: `Using tool: ${agentAction.toolCall.tool}`,
          toolCall: agentAction.toolCall,
          timestamp: Date.now(),
        });

        // Execute the tool
        const toolResult = await executeTool(
          agentAction.toolCall.tool,
          agentAction.toolCall.parameters
        );

        steps.push({
          type: "tool_call",
          content: `Tool result: ${toolResult.success ? "Success" : "Failed"}`,
          toolResult: {
            id: agentAction.toolCall.id,
            tool: agentAction.toolCall.tool,
            ...toolResult,
          },
          timestamp: Date.now(),
        });

        toolsUsed.push(agentAction.toolCall.tool);

        // Add tool result to conversation
        this.conversationHistory.push({
          role: "tool",
          content: JSON.stringify(toolResult),
          toolResults: [
            {
              id: agentAction.toolCall.id,
              tool: agentAction.toolCall.tool,
              ...toolResult,
            },
          ],
        });

        continue;
      }

      // If the agent has a final response
      if (agentAction.type === "response") {
        steps.push({
          type: "response",
          content: agentAction.content,
          timestamp: Date.now(),
        });

        this.conversationHistory.push({
          role: "assistant",
          content: agentAction.content,
        });

        return {
          message: agentAction.content,
          steps,
          toolsUsed,
          conversationComplete: true,
        };
      }

      // If we're just thinking
      if (agentAction.type === "thinking") {
        steps.push({
          type: "thinking",
          content: agentAction.content,
          timestamp: Date.now(),
        });
      }
    }

    // Max iterations reached
    return {
      message: "I've reached my thinking limit. Please try rephrasing your request or breaking it into smaller steps.",
      steps,
      toolsUsed,
      conversationComplete: true,
    };
  }

  /**
   * Determine the agent's next action
   */
  private async getNextAction(): Promise<{
    type: "thinking" | "tool_call" | "response";
    content: string;
    toolCall?: ToolCall;
  }> {
    const tools = getAgentTools();
    const systemPrompt = this.buildSystemPrompt();
    
    // Build the prompt for the agent
    const messages = [
      { role: "system", content: systemPrompt },
      ...this.conversationHistory.map((msg) => ({
        role: msg.role === "tool" ? "system" : msg.role,
        content: msg.role === "tool" ? `Tool result: ${msg.content}` : msg.content,
      })),
    ];

    // Get model to analyze and decide next action
    const response = await this.ollama.chat("llama3.2", messages);

    // Parse the response to determine action
    const parsed = this.parseAgentResponse(response);

    return parsed;
  }

  /**
   * Build the system prompt for the agent
   */
  private buildSystemPrompt(): string {
    const tools = getAgentTools();
    const toolDescriptions = tools
      .map(
        (tool) =>
          `- ${tool.name}: ${tool.description}\n  Parameters: ${JSON.stringify(tool.parameters.properties, null, 2)}`
      )
      .join("\n\n");

    return `You are an AI agent for DEV Management, a Docker infrastructure management system. Your role is to help users manage their Docker hosts, deployments, and containers.

**YOUR CAPABILITIES:**
You have access to the following tools that you can use to perform actions:

${toolDescriptions}

**HOW TO RESPOND:**
You MUST respond in one of these formats:

1. TO USE A TOOL:
\`\`\`tool
{
  "tool": "tool_name",
  "parameters": { "param1": "value1" }
}
\`\`\`

2. TO PROVIDE A FINAL ANSWER:
\`\`\`response
Your detailed response to the user goes here.
\`\`\`

3. TO THINK OUT LOUD (before deciding on an action):
\`\`\`thinking
Your reasoning about what to do next...
\`\`\`

**IMPORTANT RULES:**
- Always think step-by-step before taking action
- Use tools to gather information before making recommendations
- Be concise but helpful in your responses
- If you need more information, ask clarifying questions
- When you have all the information needed, provide a clear final response
- You can use multiple tools in sequence to accomplish complex tasks
- Always explain what you're doing and why

**EXAMPLES:**

User: "What hosts do I have?"
Agent:
\`\`\`tool
{"tool": "list_hosts", "parameters": {}}
\`\`\`

User: "Deploy PostgreSQL to my best server"
Agent:
\`\`\`thinking
I need to: 1) Find the best host, 2) Generate a PostgreSQL compose file, 3) Deploy it
\`\`\`
Then:
\`\`\`tool
{"tool": "list_hosts", "parameters": {}}
\`\`\`

Now help the user with their request!`;
  }

  /**
   * Parse the agent's response to extract action
   */
  private parseAgentResponse(response: string): {
    type: "thinking" | "tool_call" | "response";
    content: string;
    toolCall?: ToolCall;
  } {
    // Check for tool call
    const toolMatch = response.match(/```tool\s*\n([\s\S]*?)```/);
    if (toolMatch) {
      try {
        const toolCall = JSON.parse(toolMatch[1].trim());
        return {
          type: "tool_call",
          content: "",
          toolCall: {
            id: `tool_${Date.now()}`,
            tool: toolCall.tool,
            parameters: toolCall.parameters || {},
          },
        };
      } catch (e) {
        console.error("Failed to parse tool call:", e);
      }
    }

    // Check for response
    const responseMatch = response.match(/```response\s*\n([\s\S]*?)```/);
    if (responseMatch) {
      return {
        type: "response",
        content: responseMatch[1].trim(),
      };
    }

    // Check for thinking
    const thinkingMatch = response.match(/```thinking\s*\n([\s\S]*?)```/);
    if (thinkingMatch) {
      return {
        type: "thinking",
        content: thinkingMatch[1].trim(),
      };
    }

    // Default: treat as response
    return {
      type: "response",
      content: response.trim(),
    };
  }

  /**
   * Get the current conversation history
   */
  getConversationHistory(): AgentMessage[] {
    return this.conversationHistory;
  }

  /**
   * Reset the conversation
   */
  resetConversation(): void {
    this.conversationHistory = [];
  }
}
