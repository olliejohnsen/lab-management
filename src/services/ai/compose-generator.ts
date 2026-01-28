import { OllamaClient } from "./ollama-client";
import { prisma } from "@/lib/prisma";

const SYSTEM_PROMPT = `You are a Docker expert assistant specializing in creating docker-compose.yml files.

When generating docker-compose files:
1. Always use valid YAML syntax
2. Include best practices like:
   - Health checks for services
   - Resource limits (memory, CPU)
   - Restart policies (usually "unless-stopped")
   - Named volumes for data persistence
   - Environment variables for configuration
   - Proper networking setup
3. Use recent stable versions of images
4. Include necessary environment variables
5. Set up volumes for data that should persist
6. Configure appropriate ports
7. Add comments to explain important sections

Return ONLY the docker-compose.yml content without any additional explanation or markdown code blocks.
Start directly with "services:" or "version:" (if using older compose format).`;

/**
 * AI-powered Docker Compose file generator
 */
export class ComposeGenerator {
  private ollamaClient: OllamaClient;

  constructor() {
    this.ollamaClient = new OllamaClient();
  }

  /**
   * Get the configured Ollama model from settings
   */
  private async getModel(): Promise<string> {
    const settings = await prisma.appSettings.findUnique({
      where: { key: "ollama_model" },
    });

    if (settings) {
      try {
        const config = JSON.parse(settings.value);
        return config.model || "llama3.2";
      } catch (error) {
        console.error("Failed to parse Ollama model setting:", error);
      }
    }

    return "llama3.2"; // Default model
  }

  /**
   * Generate a docker-compose file from a natural language prompt
   */
  async generate(prompt: string, userId: string): Promise<string> {
    try {
      const model = await this.getModel();

      // Enhance the prompt with specific instructions
      const enhancedPrompt = `Create a docker-compose.yml file for: ${prompt}

Remember to include:
- Proper service configuration
- Health checks
- Resource limits
- Persistent volumes
- Environment variables
- Restart policies
- Port mappings

Generate only the YAML content, no explanations.`;

      // Generate compose file
      const composeContent = await this.ollamaClient.generateCompletion(
        model,
        enhancedPrompt,
        SYSTEM_PROMPT
      );

      // Clean up the response (remove markdown code blocks if present)
      let cleanedContent = composeContent.trim();
      
      if (cleanedContent.startsWith("```yaml") || cleanedContent.startsWith("```yml")) {
        cleanedContent = cleanedContent.replace(/^```ya?ml\n/, "").replace(/\n```$/, "");
      } else if (cleanedContent.startsWith("```")) {
        cleanedContent = cleanedContent.replace(/^```\n/, "").replace(/\n```$/, "");
      }

      // Store in database
      await prisma.composeFile.create({
        data: {
          name: this.generateName(prompt),
          content: cleanedContent,
          userId,
          generatedBy: "AI",
        },
      });

      return cleanedContent;
    } catch (error) {
      console.error("Failed to generate compose file:", error);
      throw new Error(`Failed to generate compose file: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  /**
   * Generate compose file with streaming support
   */
  async *generateStream(
    prompt: string,
    userId: string
  ): AsyncGenerator<string, string, unknown> {
    try {
      const model = await this.getModel();

      const enhancedPrompt = `Create a docker-compose.yml file for: ${prompt}

Remember to include:
- Proper service configuration
- Health checks
- Resource limits
- Persistent volumes
- Environment variables
- Restart policies
- Port mappings

Generate only the YAML content, no explanations.`;

      const messages = [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: enhancedPrompt },
      ];

      let fullContent = "";

      for await (const chunk of this.ollamaClient.chatStream(model, messages)) {
        fullContent += chunk;
        yield chunk;
      }

      // Clean up and store
      let cleanedContent = fullContent.trim();
      
      if (cleanedContent.startsWith("```yaml") || cleanedContent.startsWith("```yml")) {
        cleanedContent = cleanedContent.replace(/^```ya?ml\n/, "").replace(/\n```$/, "");
      } else if (cleanedContent.startsWith("```")) {
        cleanedContent = cleanedContent.replace(/^```\n/, "").replace(/\n```$/, "");
      }

      // Store in database
      await prisma.composeFile.create({
        data: {
          name: this.generateName(prompt),
          content: cleanedContent,
          userId,
          generatedBy: "AI",
        },
      });

      return cleanedContent;
    } catch (error) {
      console.error("Failed to generate compose file:", error);
      throw new Error(`Failed to generate: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  /**
   * Generate a name for the compose file based on the prompt
   */
  private generateName(prompt: string): string {
    const cleaned = prompt
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .trim()
      .split(/\s+/)
      .slice(0, 5)
      .join("-");

    const timestamp = Date.now();
    return `${cleaned}-${timestamp}`;
  }
}
