import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-utils";
import { DockerConnectionManager } from "@/services/docker/connection-manager";

/**
 * POST /api/hosts/[id]/test - Test host connection
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await params;

    const host = await prisma.dockerHost.findUnique({
      where: { id },
    });

    if (!host) {
      return NextResponse.json({ error: "Host not found" }, { status: 404 });
    }

    try {
      const connector = await DockerConnectionManager.getConnector(
        host.id,
        host.connectionType,
        host.host,
        host.port,
        host.credentials
      );

      const success = await connector.testConnection();

      return NextResponse.json({
        success,
        message: success ? "Connection successful" : "Connection failed",
      });
    } catch (error) {
      return NextResponse.json({
        success: false,
        message: error instanceof Error ? error.message : "Connection failed",
      });
    }
  } catch (error) {
    console.error("Failed to test connection:", error);
    return NextResponse.json(
      { error: "Failed to test connection" },
      { status: 500 }
    );
  }
}
