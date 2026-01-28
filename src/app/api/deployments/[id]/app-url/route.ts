import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-utils";
import { DockerConnectionManager } from "@/services/docker/connection-manager";
import { RequirementsParser } from "@/services/placement/requirements-parser";

/**
 * GET /api/deployments/[id]/app-url - Get the app URL for a deployment (host + actual deployed port)
 * Queries the host to get the real port from running containers; falls back to metadata/compose if host unreachable.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id } = await params;

    const deployment = await prisma.deployment.findUnique({
      where: { id },
      include: {
        host: true,
        composeFile: { select: { content: true } },
      },
    });

    if (!deployment) {
      return NextResponse.json(
        { error: "Deployment not found" },
        { status: 404 }
      );
    }

    const hostAddr = deployment.host?.host;
    if (!hostAddr) {
      return NextResponse.json(
        { error: "Host address not available" },
        { status: 400 }
      );
    }

    let port: number | undefined;

    const meta = (() => {
      try {
        return deployment.metadata ? JSON.parse(deployment.metadata) : {};
      } catch {
        return {};
      }
    })();

    const projectName = meta.projectName;

    // Prefer: query the host for actual ports used by this project's containers
    if (projectName) {
      try {
        const connector = await DockerConnectionManager.getConnector(
          deployment.host!.id,
          deployment.host!.connectionType,
          deployment.host!.host,
          deployment.host!.port,
          deployment.host!.credentials
        );
        const hostPorts = await connector.getProjectPorts(projectName);
        if (hostPorts.length > 0) {
          port = hostPorts[0];
        }
      } catch (err) {
        console.error("[app-url] Host check failed:", err);
      }
    }

    // Fallback: metadata.primaryPort
    if (port == null && typeof meta.primaryPort === "number" && meta.primaryPort > 0) {
      port = meta.primaryPort;
    }

    // Fallback: parse compose file
    if (port == null && deployment.composeFile?.content) {
      const ports = RequirementsParser.parse(deployment.composeFile.content).requiredPorts;
      if (ports.length > 0) {
        port = ports[0];
      }
    }

    if (port == null || port <= 0) {
      return NextResponse.json(
        { error: "Could not determine app port from deployment or host" },
        { status: 400 }
      );
    }

    const protocol = port === 443 ? "https" : "http";
    const url = `${protocol}://${hostAddr}:${port}`;

    return NextResponse.json({ url, port });
  } catch (error) {
    console.error("Failed to get app URL:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get app URL" },
      { status: 500 }
    );
  }
}
