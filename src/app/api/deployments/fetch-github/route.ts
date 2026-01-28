import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-utils";
import { RepoDockerGenerator } from "@/services/ai/repo-docker-generator";

/**
 * Parse a GitHub URL into owner, repo, branch, path.
 */
function parseGitHubUrl(url: string): { owner: string; repo: string; branch: string; path: string } | null {
  const trimmed = url.trim().replace(/\/+$/, "");
  const rawMatch = trimmed.match(
    /^https?:\/\/raw\.githubusercontent\.com\/([^/]+)\/([^/]+)\/([^/]+)\/(.*)$/i
  );
  if (rawMatch) {
    return { owner: rawMatch[1], repo: rawMatch[2], branch: rawMatch[3], path: rawMatch[4] };
  }
  const blobMatch = trimmed.match(
    /^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/blob\/([^/]+)\/(.*)$/i
  );
  if (blobMatch) {
    return { owner: blobMatch[1], repo: blobMatch[2], branch: blobMatch[3], path: blobMatch[4] };
  }
  const repoMatch = trimmed.match(/^https?:\/\/github\.com\/([^/]+)\/([^/]+)$/i);
  if (repoMatch) {
    return { owner: repoMatch[1], repo: repoMatch[2], branch: "", path: "docker-compose.yml" };
  }
  return null;
}

function toRawUrl(owner: string, repo: string, branch: string, path: string): string {
  return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}`;
}

function toCloneUrl(owner: string, repo: string): string {
  return `https://github.com/${owner}/${repo}.git`;
}

function isDockerCompose(content: string): boolean {
  const trimmed = content.trim();
  return trimmed.includes("services:") || /^\s*services\s*:/m.test(trimmed);
}

function isDockerfile(content: string): boolean {
  return /^\s*FROM\s+/m.test(content.trim());
}

const KEY_FILES = [
  "package.json",
  "requirements.txt",
  "pyproject.toml",
  "go.mod",
  "Cargo.toml",
  "pom.xml",
  "README.md",
  "main.py",
  "app.py",
  "index.js",
  "main.js",
  "main.go",
];
const MAX_FILE_SIZE = 12000;

async function discoverRepo(
  owner: string,
  repo: string,
  branch: string
): Promise<{ fileList: string[]; fileContents: Record<string, string> }> {
  const listRes = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/contents?ref=${branch}`,
    { headers: { "User-Agent": "dev-management", Accept: "application/vnd.github.v3+json" } }
  );
  if (!listRes.ok) {
    return { fileList: [], fileContents: {} };
  }
  const list: Array<{ name: string }> = await listRes.json();
  const fileList = list.map((e) => e.name);
  const fileContents: Record<string, string> = {};
  const toFetch = KEY_FILES.filter((f) => fileList.includes(f));
  for (const name of toFetch) {
    try {
      const fileRes = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/contents/${name}?ref=${branch}`,
        { headers: { "User-Agent": "dev-management", Accept: "application/vnd.github.v3.raw" } }
      );
      if (fileRes.ok) {
        const text = await fileRes.text();
        fileContents[name] = text.length > MAX_FILE_SIZE ? text.slice(0, MAX_FILE_SIZE) : text;
      }
    } catch {
      // skip
    }
  }
  return { fileList, fileContents };
}

type FetchResult = {
  composeContent: string;
  fileName?: string;
  branch?: string;
  cloneUrl?: string;
  composePath?: string;
  generated?: boolean;
  dockerfileContent?: string;
};

async function doFetchGithub(
  url: string,
  onProgress?: (message: string) => void
): Promise<FetchResult> {
  const progress = (msg: string) => {
    onProgress?.(msg);
  };

  const parsed = parseGitHubUrl(url);
  if (!parsed) {
    throw new Error("Invalid GitHub URL. Use a repo (github.com/owner/repo), a file (github.com/owner/repo/blob/branch/path), or raw URL.");
  }

  let branch = parsed.branch;
  let path = parsed.path;

  if (!branch) {
    progress("Checking repository…");
    const repoRes = await fetch(
      `https://api.github.com/repos/${parsed.owner}/${parsed.repo}`,
      { headers: { "User-Agent": "dev-management" } }
    );
    if (!repoRes.ok) {
      if (repoRes.status === 404) {
        throw new Error("Repository not found or not public.");
      }
      throw new Error("Failed to get repository info");
    }
    const repoData = await repoRes.json();
    branch = repoData.default_branch || "main";

    progress("Looking for docker-compose…");
    const tryPaths = ["docker-compose.yml", "docker-compose.yaml"];
    for (const p of tryPaths) {
      const rawUrl = toRawUrl(parsed.owner, parsed.repo, branch, p);
      const fileRes = await fetch(rawUrl, { headers: { "User-Agent": "dev-management" } });
      if (fileRes.ok) {
        const composeContent = await fileRes.text();
        if (!isDockerCompose(composeContent)) {
          throw new Error(`File ${p} does not look like a docker-compose file (missing 'services:').`);
        }
        return {
          composeContent,
          fileName: p,
          branch,
          cloneUrl: toCloneUrl(parsed.owner, parsed.repo),
          composePath: p,
        };
      }
    }

    progress("Looking for Dockerfile…");
    const dockerfilePaths = ["Dockerfile", "docker/Dockerfile"];
    let dockerfileContent: string | null = null;
    for (const p of dockerfilePaths) {
      const rawUrl = toRawUrl(parsed.owner, parsed.repo, branch, p);
      const fileRes = await fetch(rawUrl, { headers: { "User-Agent": "dev-management" } });
      if (fileRes.ok) {
        const text = await fileRes.text();
        if (isDockerfile(text)) {
          dockerfileContent = text;
          break;
        }
      }
    }

    const repoName = `${parsed.owner}/${parsed.repo}`;
    const cloneUrl = toCloneUrl(parsed.owner, parsed.repo);

    if (dockerfileContent) {
      progress("Generating docker-compose from Dockerfile (AI)…");
      try {
        const generator = new RepoDockerGenerator();
        const generatedCompose = await generator.generateComposeFromDockerfile(dockerfileContent);
        if (generatedCompose && isDockerCompose(generatedCompose)) {
          return {
            composeContent: generatedCompose,
            fileName: "docker-compose.yml",
            branch,
            cloneUrl,
            composePath: "docker-compose.yml",
            generated: true,
            dockerfileContent,
          };
        }
      } catch (e) {
        console.error("AI compose from Dockerfile failed:", e);
      }
      const fallbackCompose = `services:\n  app:\n    build: .\n    ports:\n      - "8080:8080"\n    restart: unless-stopped\n`;
      return {
        composeContent: fallbackCompose,
        fileName: "docker-compose.yml",
        branch,
        cloneUrl,
        composePath: "docker-compose.yml",
        generated: true,
        dockerfileContent,
      };
    }

    progress("Discovering repo files…");
    const { fileList, fileContents } = await discoverRepo(parsed.owner, parsed.repo, branch);
    if (Object.keys(fileContents).length === 0 && fileList.length === 0) {
      throw new Error("Could not read repo contents. No docker-compose, Dockerfile, or detectable app files.");
    }

    progress("Generating Dockerfile and docker-compose (AI)…");
    try {
      const generator = new RepoDockerGenerator();
      const { dockerfileContent: genDockerfile, composeContent: genCompose } =
        await generator.generateForRepo({
          repoName,
          fileList,
          fileContents,
        });
      if (genCompose && isDockerCompose(genCompose)) {
        return {
          composeContent: genCompose,
          dockerfileContent: genDockerfile,
          fileName: "docker-compose.yml",
          branch,
          cloneUrl,
          composePath: "docker-compose.yml",
          generated: true,
        };
      }
    } catch (e) {
      console.error("AI Dockerfile + compose generation failed:", e);
      throw new Error("Repo has no docker-compose or Dockerfile, and AI generation failed. Try adding a Dockerfile or docker-compose.yml to the repo.");
    }

    throw new Error("No docker-compose or Dockerfile found; could not generate.");
  }

  progress("Fetching file…");
  const rawUrl = toRawUrl(parsed.owner, parsed.repo, branch, path);
  const fileRes = await fetch(rawUrl, { headers: { "User-Agent": "dev-management" } });
  if (!fileRes.ok) {
    if (fileRes.status === 404) {
      throw new Error(`File not found: ${path} on branch ${branch}`);
    }
    throw new Error("Failed to fetch file from GitHub");
  }
  const composeContent = await fileRes.text();
  const fileName = path.split("/").pop() || "docker-compose.yml";
  if (!isDockerCompose(composeContent)) {
    throw new Error("File does not look like a docker-compose file (missing 'services:').");
  }
  return {
    composeContent,
    fileName,
    branch,
    cloneUrl: toCloneUrl(parsed.owner, parsed.repo),
    composePath: path,
  };
}

/**
 * POST /api/deployments/fetch-github
 * Body: { url: string, stream?: boolean }
 * When stream is true, returns NDJSON stream: { type: 'progress', message } then { type: 'done', ...result } or { type: 'error', error }.
 */
export async function POST(request: NextRequest) {
  try {
    await requireAuth();

    const body = await request.json();
    const { url, stream: wantStream } = body;

    if (!url || typeof url !== "string") {
      return NextResponse.json(
        { error: "Missing url" },
        { status: 400 }
      );
    }

    if (wantStream) {
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          const send = (obj: object) => {
            controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
          };
          try {
            const result = await doFetchGithub(url, (message) => {
              send({ type: "progress", message });
            });
            send({ type: "done", ...result });
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            send({ type: "error", error: message });
          }
          controller.close();
        },
      });
      return new Response(stream, {
        headers: {
          "Content-Type": "application/x-ndjson",
          "Cache-Control": "no-store",
        },
      });
    }

    const result = await doFetchGithub(url);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to fetch from GitHub:", error);
    return NextResponse.json(
      { error: "Failed to fetch from GitHub" },
      { status: 500 }
    );
  }
}
