import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-utils";
import { DockerConnectionManager } from "@/services/docker/connection-manager";

/**
 * GET /api/hosts/[id]/projects - List project directories in home (e.g. ~/projectName with docker-compose.yml)
 * SSH hosts only; API hosts return [].
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id: hostId } = await params;

    const host = await prisma.dockerHost.findUnique({
      where: { id: hostId },
    });

    if (!host) {
      return NextResponse.json({ error: "Host not found" }, { status: 404 });
    }

    const connector = await DockerConnectionManager.getConnector(
      host.id,
      host.connectionType,
      host.host,
      host.port,
      host.credentials
    );

    const projects = await connector.listProjectsInHome();
    return NextResponse.json(projects);
  } catch (error) {
    console.error("Failed to list projects:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to list projects" },
      { status: 500 }
    );
  }
}
