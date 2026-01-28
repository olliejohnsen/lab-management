/**
 * Ollama API client for communicating with the Ollama server
 */
export class OllamaClient {
  private baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || process.env.OLLAMA_SERVER_URL || "http://10.10.10.216:11434";
  }

  /**
   * List available models on the Ollama server
   */
  async listModels(): Promise<string[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        method: "GET",
      });

      if (!response.ok) {
        throw new Error(`Failed to list models: ${response.statusText}`);
      }

      const data = await response.json();
      return data.models?.map((model: any) => model.name) || [];
    } catch (error) {
      console.error("Failed to list models:", error);
      throw new Error(`Failed to connect to Ollama server: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  /**
   * Generate a completion from a prompt
   */
  async generateCompletion(
    model: string,
    prompt: string,
    systemPrompt?: string
  ): Promise<string> {
    try {
      const response = await fetch(`${this.baseUrl}/api/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          prompt,
          system: systemPrompt,
          stream: false,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to generate: ${response.statusText}`);
      }

      const data = await response.json();
      return data.response || "";
    } catch (error) {
      console.error("Failed to generate completion:", error);
      throw new Error(`Failed to generate: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  /**
   * Chat with the model (supports conversation history)
   */
  async chat(
    model: string,
    messages: Array<{ role: string; content: string }>
  ): Promise<string> {
    try {
      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages,
          stream: false,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to chat: ${response.statusText}`);
      }

      const data = await response.json();
      return data.message?.content || "";
    } catch (error) {
      console.error("Failed to chat:", error);
      throw new Error(`Failed to chat: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  /**
   * Stream a chat response (for real-time UI updates)
   */
  async *chatStream(
    model: string,
    messages: Array<{ role: string; content: string }>
  ): AsyncGenerator<string, void, unknown> {
    try {
      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages,
          stream: true,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to stream chat: ${response.statusText}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error("No response body");
      }

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n").filter(Boolean);

        for (const line of lines) {
          try {
            const data = JSON.parse(line);
            if (data.message?.content) {
              yield data.message.content;
            }
          } catch (e) {
            // Skip invalid JSON lines
          }
        }
      }
    } catch (error) {
      console.error("Failed to stream chat:", error);
      throw new Error(`Failed to stream: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  /**
   * Test connection to Ollama server
   */
  async testConnection(): Promise<boolean> {
    try {
      const models = await this.listModels();
      return models.length > 0;
    } catch (error) {
      return false;
    }
  }
}
