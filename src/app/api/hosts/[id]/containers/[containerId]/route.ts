import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-utils";
import { DockerConnectionManager } from "@/services/docker/connection-manager";

/**
 * DELETE /api/hosts/[id]/containers/[containerId] - Remove a container
 * Query: removeVolumes=true to remove associated anonymous volumes
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; containerId: string }> }
) {
  try {
    await requireAuth();
    const { id: hostId, containerId } = await params;
    const removeVolumes = request.nextUrl.searchParams.get("removeVolumes") === "true";

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

    const result = await connector.removeContainer(containerId, {
      removeVolumes,
    });
    if (!result.success) {
      return NextResponse.json(
        { error: result.error ?? result.message },
        { status: 400 }
      );
    }
    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to remove container:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to remove container" },
      { status: 500 }
    );
  }
}
