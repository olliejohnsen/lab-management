import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-utils";
import { DockerConnectionManager } from "@/services/docker/connection-manager";

/**
 * POST /api/hosts/[id]/projects/[projectName]/stop - Stop a project (docker compose stop)
 * Body: { composePath?: string }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; projectName: string }> }
) {
  try {
    await requireAuth();
    const { id: hostId, projectName } = await params;
    const body = await request.json().catch(() => ({}));
    const composePath = body.composePath as string | undefined;

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

    const result = await connector.stopDeployment(projectName, composePath);
    if (!result.success) {
      return NextResponse.json(
        { error: result.error ?? result.message },
        { status: 400 }
      );
    }
    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to stop project:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to stop project" },
      { status: 500 }
    );
  }
}
