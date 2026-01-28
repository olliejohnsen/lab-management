import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-utils";
import { encryptObject } from "@/services/encryption/crypto";
import { DockerConnectionManager } from "@/services/docker/connection-manager";

/**
 * PUT /api/hosts/[id] - Update host configuration
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await params;

    const body = await request.json();
    const { name, connectionType, host, port, credentials, isActive } = body;

    const updateData: any = {};

    if (name !== undefined) updateData.name = name;
    if (connectionType !== undefined) updateData.connectionType = connectionType;
    if (host !== undefined) updateData.host = host;
    if (port !== undefined) updateData.port = parseInt(port);
    if (isActive !== undefined) updateData.isActive = isActive;
    
    if (credentials !== undefined) {
      updateData.credentials = encryptObject(credentials);
    }

    // Remove old connection if config changed
    if (connectionType || host || port || credentials) {
      await DockerConnectionManager.removeConnector(id);
    }

    const dockerHost = await prisma.dockerHost.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      id: dockerHost.id,
      name: dockerHost.name,
      connectionType: dockerHost.connectionType,
      host: dockerHost.host,
      port: dockerHost.port,
      isActive: dockerHost.isActive,
    });
  } catch (error) {
    console.error("Failed to update host:", error);
    return NextResponse.json(
      { error: "Failed to update host" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/hosts/[id] - Remove host
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await params;

    // Remove connection
    await DockerConnectionManager.removeConnector(id);

    // Delete host (cascade will delete metrics and deployments)
    await prisma.dockerHost.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete host:", error);
    return NextResponse.json(
      { error: "Failed to delete host" },
      { status: 500 }
    );
  }
}
