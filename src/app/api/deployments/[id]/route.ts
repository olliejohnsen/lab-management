import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-utils";
import { DockerConnectionManager } from "@/services/docker/connection-manager";

/**
 * GET /api/deployments/[id] - Get deployment details
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
        composeFile: true,
      },
    });

    if (!deployment) {
      return NextResponse.json(
        { error: "Deployment not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(deployment);
  } catch (error) {
    console.error("Failed to get deployment:", error);
    return NextResponse.json(
      { error: "Failed to get deployment" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/deployments/[id] - Remove deployment
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id } = await params;

    const deployment = await prisma.deployment.findUnique({
      where: { id },
      include: { host: true },
    });

    if (!deployment) {
      return NextResponse.json(
        { error: "Deployment not found" },
        { status: 404 }
      );
    }

    const metadata = JSON.parse(deployment.metadata || "{}");
    const projectName = metadata.projectName;
    const composePath = metadata.composePath;

    if (projectName) {
      try {
        const connector = await DockerConnectionManager.getConnector(
          deployment.host.id,
          deployment.host.connectionType,
          deployment.host.host,
          deployment.host.port,
          deployment.host.credentials
        );

        await connector.removeDeployment(projectName, composePath);
      } catch (error) {
        console.error("Failed to remove deployment from host:", error);
      }
    }

    // Delete deployment record
    await prisma.deployment.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete deployment:", error);
    return NextResponse.json(
      { error: "Failed to delete deployment" },
      { status: 500 }
    );
  }
}
