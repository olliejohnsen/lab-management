import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-utils";
import { DockerConnectionManager } from "@/services/docker/connection-manager";

/**
 * DELETE /api/hosts/[id]/projects/[projectName] - Remove a project (docker compose down -v and delete folder)
 * Body: { composePath?: string }
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; projectName: string }> }
) {
  try {
    await requireAuth();
    const { id: hostId, projectName } = await params;
    const url = new URL(request.url);
    const composePath =
      url.searchParams.get("composePath") ??
      (await request.json().catch(() => ({}))).composePath;

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

    const result = await connector.removeDeployment(projectName, composePath);
    if (!result.success) {
      return NextResponse.json(
        { error: result.error ?? result.message },
        { status: 400 }
      );
    }
    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to remove project:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to remove project" },
      { status: 500 }
    );
  }
}
