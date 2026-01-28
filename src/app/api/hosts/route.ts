import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireAdmin } from "@/lib/auth-utils";
import { encryptObject } from "@/services/encryption/crypto";
import { DockerConnectionManager } from "@/services/docker/connection-manager";

/**
 * GET /api/hosts - List all Docker hosts
 */
export async function GET(request: NextRequest) {
  try {
    await requireAuth();

    const hosts = await prisma.dockerHost.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        connectionType: true,
        host: true,
        port: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        // Don't return credentials
      },
    });

    return NextResponse.json(hosts);
  } catch (error) {
    console.error("Failed to list hosts:", error);
    return NextResponse.json(
      { error: "Failed to list hosts" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/hosts - Add new Docker host
 */
export async function POST(request: NextRequest) {
  try {
    await requireAdmin();

    const body = await request.json();
    const { name, connectionType, host, port, credentials } = body;

    // Validate required fields
    if (!name || !connectionType || !host || !port || !credentials) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Encrypt credentials
    const encryptedCredentials = encryptObject(credentials);

    // Create host
    const dockerHost = await prisma.dockerHost.create({
      data: {
        name,
        connectionType,
        host,
        port: parseInt(port),
        credentials: encryptedCredentials,
        isActive: true,
      },
    });

    return NextResponse.json(
      {
        id: dockerHost.id,
        name: dockerHost.name,
        connectionType: dockerHost.connectionType,
        host: dockerHost.host,
        port: dockerHost.port,
        isActive: dockerHost.isActive,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Failed to create host:", error);
    return NextResponse.json(
      { error: "Failed to create host" },
      { status: 500 }
    );
  }
}
