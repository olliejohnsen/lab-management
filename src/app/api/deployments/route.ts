import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-utils";
import { DockerConnectionManager } from "@/services/docker/connection-manager";
import { generateEnvFromCompose } from "@/services/deployment/env-from-compose";
import { RequirementsParser } from "@/services/placement/requirements-parser";
import { MetricsService } from "@/services/docker/metrics";
import { PortRewriter } from "@/services/placement/port-rewriter";

/**
 * GET /api/deployments - List all deployments
 */
export async function GET(request: NextRequest) {
  try {
    await requireAuth();

    const deployments = await prisma.deployment.findMany({
      include: {
        host: {
          select: {
            id: true,
            name: true,
            host: true,
          },
        },
        composeFile: {
          select: {
            id: true,
            name: true,
            generatedBy: true,
          },
        },
      },
      orderBy: { deployedAt: "desc" },
    });

    return NextResponse.json(deployments);
  } catch (error) {
    console.error("Failed to list deployments:", error);
    return NextResponse.json(
      { error: "Failed to list deployments" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/deployments - Deploy docker-compose file or from GitHub (git clone on host)
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();

    const body = await request.json();
    const {
      composeFileId,
      hostId,
      composeContent: initialComposeContent,
      projectName,
      envContent: userEnvContent,
      deployFromGitHub,
      cloneUrl,
      composePath,
      branch,
      injectFiles,
    } = body;

    let composeContent = initialComposeContent;

    const isGitHubDeploy = deployFromGitHub && cloneUrl && projectName && hostId;

    if (isGitHubDeploy) {
      // Deploy from GitHub: git clone on host then docker compose
      if (!composePath) {
        return NextResponse.json(
          { error: "Missing composePath for deploy from GitHub" },
          { status: 400 }
        );
      }

      const host = await prisma.dockerHost.findUnique({
        where: { id: hostId },
      });
      if (!host) {
        return NextResponse.json({ error: "Host not found" }, { status: 404 });
      }

      // FINAL SAFETY CHECK: Validate ports one last time before deployment
      let portCheckResult: any = null;
      try {
        const metrics = await MetricsService.collectHostMetrics(hostId);
        if (metrics && typeof composeContent === "string" && composeContent.trim()) {
          const portCheck = PortRewriter.validateAndRewrite(composeContent, metrics.usedPorts);
          if (portCheck.modifiedComposeContent) {
            console.log(`[deploy-github] Port conflict detected on ${host.name}. Auto-remapped:`, 
              portCheck.portChanges.map(c => `${c.from}->${c.to}`).join(", "));
            composeContent = portCheck.modifiedComposeContent;
            portCheckResult = portCheck;
          }
        }
      } catch (err) {
        console.warn("[deploy-github] Final port safety check failed, proceeding with original compose:", err);
      }

      const connector = await DockerConnectionManager.getConnector(
        host.id,
        host.connectionType,
        host.host,
        host.port,
        host.credentials
      );

      // Always create .env on host: use user-provided or generate from compose so the file exists
      const envContent =
        typeof userEnvContent === "string" && userEnvContent.trim()
          ? userEnvContent.trim()
          : (typeof composeContent === "string" && composeContent.trim()
              ? generateEnvFromCompose(composeContent)
              : "# Generated for docker-compose\n");

      type ConnectorWithGitHub = { deployFromGitHub?: (cloneUrl: string, projectName: string, composePath: string, branch?: string, envContent?: string, injectFiles?: Record<string, string>) => Promise<{ success: boolean; message: string; error?: string }> };
      const conn = connector as ConnectorWithGitHub;
      if (typeof conn.deployFromGitHub !== "function") {
        return NextResponse.json(
          { error: "Deploy from GitHub is only supported for SSH hosts" },
          { status: 400 }
        );
      }

      const injectFilesObj =
        injectFiles && typeof injectFiles === "object" && !Array.isArray(injectFiles)
          ? injectFiles as Record<string, string>
          : undefined;

      console.log("[deploy] Deploying from GitHub to host", host.name, "project", projectName);
      const result = await conn.deployFromGitHub(
        cloneUrl,
        projectName,
        composePath,
        branch || undefined,
        envContent,
        injectFilesObj
      );

      if (!result.success) {
        console.error("[deploy] Deployment failed:", result.message, result.error);
        return NextResponse.json(
          { error: result.error || result.message || "Deployment failed" },
          { status: 500 }
        );
      }

      // Create ComposeFile record for history (use composeContent if provided, else placeholder)
      const composeFile = await prisma.composeFile.create({
        data: {
          name: `${projectName}-from-github`,
          content: typeof composeContent === "string" && composeContent.trim()
            ? composeContent
            : `# Deployed from ${cloneUrl} (${composePath})`,
          userId: session.user.id,
          generatedBy: "GitHub",
        },
      });

      const composeForPort = injectFilesObj?.["docker-compose.yml"] ?? typeof composeContent === "string" ? composeContent : "";
    const primaryPort = composeForPort
      ? RequirementsParser.parse(composeForPort).requiredPorts[0]
      : undefined;
    const metadataObj: Record<string, unknown> = { projectName, cloneUrl, composePath, branch };
    if (primaryPort != null) metadataObj.primaryPort = primaryPort;

    const deployment = await prisma.deployment.create({
        data: {
          composeFileId: composeFile.id,
          hostId,
          status: "running",
          metadata: JSON.stringify(metadataObj),
        },
      });

      console.log("[deploy] Success, deployment id:", deployment.id);
      return NextResponse.json({ ...deployment, result, autoPortFixes: portCheckResult?.portChanges || [] });
    }

    // Normal deploy: upload compose content
    if (!composeFileId || !hostId || !composeContent || !projectName) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const host = await prisma.dockerHost.findUnique({
      where: { id: hostId },
    });

    if (!host) {
      return NextResponse.json({ error: "Host not found" }, { status: 404 });
    }

    // FINAL SAFETY CHECK: Validate ports one last time before deployment
    let portCheckResult: any = null;
    try {
      const metrics = await MetricsService.collectHostMetrics(hostId);
      if (metrics) {
        const portCheck = PortRewriter.validateAndRewrite(composeContent, metrics.usedPorts);
        if (portCheck.modifiedComposeContent) {
          console.log(`[deploy] Port conflict detected on ${host.name}. Auto-remapped:`, 
            portCheck.portChanges.map(c => `${c.from}->${c.to}`).join(", "));
          composeContent = portCheck.modifiedComposeContent;
          portCheckResult = portCheck;
        }
      }
    } catch (err) {
      console.warn("[deploy] Final port safety check failed, proceeding with original compose:", err);
    }

    const connector = await DockerConnectionManager.getConnector(
      host.id,
      host.connectionType,
      host.host,
      host.port,
      host.credentials
    );

    const envContent =
      typeof userEnvContent === "string" && userEnvContent.trim()
        ? userEnvContent.trim()
        : generateEnvFromCompose(composeContent);

    console.log("[deploy] Deploying to host", host.name, "project", projectName);
    const result = await connector.deploy(composeContent, projectName, envContent);

    if (!result.success) {
      console.error("[deploy] Deployment failed:", result.message, result.error);
      return NextResponse.json(
        { error: result.error || result.message || "Deployment failed" },
        { status: 500 }
      );
    }

    const primaryPort = RequirementsParser.parse(composeContent).requiredPorts[0];
    const metadataObj: Record<string, unknown> = { projectName };
    if (primaryPort != null) metadataObj.primaryPort = primaryPort;

    const deployment = await prisma.deployment.create({
      data: {
        composeFileId,
        hostId,
        status: "running",
        metadata: JSON.stringify(metadataObj),
      },
    });

    console.log("[deploy] Success, deployment id:", deployment.id);
    return NextResponse.json({
      ...deployment,
      result,
      autoPortFixes: portCheckResult?.portChanges || [],
    });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error("[deploy] Error:", err.message);
    console.error("[deploy] Stack:", err.stack);
    return NextResponse.json(
      { error: err.message || "Failed to deploy" },
      { status: 500 }
    );
  }
}
