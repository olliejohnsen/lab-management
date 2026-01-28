import { OllamaClient } from "./ollama-client";
import { prisma } from "@/lib/prisma";

const SYSTEM_PROMPT = `You are a Docker expert. Given a GitHub repo's root file list and the contents of key config files, you generate:
1. A Dockerfile that builds and runs the application (correct runtime: Node, Python, Go, Rust, etc.).
2. A docker-compose.yml that builds from the Dockerfile and runs the app with sensible ports, env, and restart policy.

Rules:
- Dockerfile: use multi-stage builds when helpful; expose the app port; set WORKDIR and copy only what's needed.
- docker-compose: one service that builds with context . and Dockerfile; map a host port (e.g. 8080:8080); restart: unless-stopped; use env_file or environment as needed.
- Return ONLY two markdown code blocks in this exact order, no other text:
  First block: \`\`\`dockerfile
  ...Dockerfile content...
  \`\`\`
  Second block: \`\`\`yaml
  ...docker-compose.yml content...
  \`\`\``;

const MAX_FILE_SIZE = 8000;
const KEY_FILES = [
  "package.json",
  "requirements.txt",
  "pyproject.toml",
  "go.mod",
  "Cargo.toml",
  "pom.xml",
  "build.gradle",
  "README.md",
  "main.py",
  "app.py",
  "index.js",
  "main.js",
  "main.go",
];

/**
 * Parse AI response into Dockerfile and docker-compose content.
 * Expects markdown code blocks: ```dockerfile ... ``` and ```yaml ... ``` or ```yml ... ```.
 */
function parseDockerAndCompose(response: string): { dockerfileContent: string; composeContent: string } {
  let dockerfileContent = "";
  let composeContent = "";

  const dockerfileMatch = response.match(/```dockerfile\n?([\s\S]*?)```/i);
  if (dockerfileMatch) {
    dockerfileContent = dockerfileMatch[1].trim();
  }

  const yamlMatch = response.match(/```ya?ml\n?([\s\S]*?)```/i);
  if (yamlMatch) {
    composeContent = yamlMatch[1].trim();
  }

  if (!dockerfileContent && !composeContent) {
    const blocks = response.match(/```(\w+)?\n?([\s\S]*?)```/g);
    if (blocks) {
      blocks.forEach((block) => {
        const inner = block.replace(/^```\w*\n?/, "").replace(/\n?```$/, "").trim();
        if (inner.toUpperCase().startsWith("FROM ") && !dockerfileContent) {
          dockerfileContent = inner;
        } else if (inner.includes("services:") && !composeContent) {
          composeContent = inner;
        }
      });
    }
  }

  return { dockerfileContent, composeContent };
}

export type RepoDockerContext = {
  repoName: string;
  fileList: string[];
  fileContents: Record<string, string>;
};

export class RepoDockerGenerator {
  private ollamaClient: OllamaClient;

  constructor() {
    this.ollamaClient = new OllamaClient();
  }

  private async getModel(): Promise<string> {
    const settings = await prisma.appSettings.findUnique({
      where: { key: "ollama_model" },
    });
    if (settings) {
      try {
        const config = JSON.parse(settings.value);
        return config.model || "llama3.2";
      } catch {
        // ignore
      }
    }
    return "llama3.2";
  }

  /**
   * Generate only docker-compose.yml that builds from an existing Dockerfile in the repo.
   */
  async generateComposeFromDockerfile(dockerfileContent: string): Promise<string> {
    const model = await this.getModel();
    const system = `You are a Docker expert. Given a Dockerfile, return ONLY a docker-compose.yml that builds from it (build: ., Dockerfile in repo root). One service, map port e.g. 8080:8080, restart: unless-stopped. Return only the YAML in a \`\`\`yaml ... \`\`\` block.`;
    const prompt = `Dockerfile:\n${dockerfileContent.slice(0, 4000)}\n\nGenerate docker-compose.yml that builds from this Dockerfile. One code block only.`;
    const response = await this.ollamaClient.generateCompletion(model, prompt, system);
    const yamlMatch = response.match(/```ya?ml\n?([\s\S]*?)```/i);
    return yamlMatch ? yamlMatch[1].trim() : response.trim();
  }

  /**
   * Generate Dockerfile and docker-compose.yml from repo context (file list + key file contents).
   */
  async generateForRepo(context: RepoDockerContext): Promise<{
    dockerfileContent: string;
    composeContent: string;
  }> {
    const model = await this.getModel();

    const filesSummary = context.fileList.slice(0, 50).join(", ");
    const contentsParts: string[] = [];
    for (const [name, content] of Object.entries(context.fileContents)) {
      if (content.length > MAX_FILE_SIZE) {
        contentsParts.push(`\n--- ${name} (truncated) ---\n${content.slice(0, MAX_FILE_SIZE)}\n...`);
      } else {
        contentsParts.push(`\n--- ${name} ---\n${content}`);
      }
    }

    const prompt = `Repo: ${context.repoName}

Root files/folders: ${filesSummary}
${contentsParts.join("\n")}

Generate a Dockerfile and docker-compose.yml to containerize and run this application. Return only the two code blocks (dockerfile first, then yaml).`;

    const response = await this.ollamaClient.generateCompletion(
      model,
      prompt,
      SYSTEM_PROMPT
    );

    const { dockerfileContent, composeContent } = parseDockerAndCompose(response);

    if (!dockerfileContent && !composeContent) {
      throw new Error("AI did not return valid Dockerfile or docker-compose content.");
    }

    return {
      dockerfileContent: dockerfileContent || `# Fallback: add your Dockerfile\nFROM alpine\nCMD ["echo", "No Dockerfile generated"]`,
      composeContent: composeContent || `services:\n  app:\n    build: .\n    ports:\n      - "8080:8080"`,
    };
  }
}
