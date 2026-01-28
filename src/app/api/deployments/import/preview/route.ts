import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-utils";
import { DockerConnectionManager } from "@/services/docker/connection-manager";

/**
 * GET /api/deployments/import/preview - Discover running projects on all hosts that are not already in the DB.
 * Returns list of hosts and their importable projects so the user can select what to import.
 */
export async function GET(request: NextRequest) {
  try {
    await requireAuth();

    const hosts = await prisma.dockerHost.findMany({
      select: { id: true, name: true, connectionType: true, host: true, port: true, credentials: true },
    });

    const existingDeployments = await prisma.deployment.findMany({
      select: { hostId: true, metadata: true },
    });

    const existingKeys = new Set<string>();
    for (const d of existingDeployments) {
      try {
        const meta = d.metadata ? JSON.parse(d.metadata) : {};
        const pn = meta.projectName;
        if (pn) existingKeys.add(`${d.hostId}|${pn}`);
      } catch {
        // ignore
      }
    }

    const hostResults: Array<{
      id: string;
      name: string;
      projects: Array<{ name: string }>;
      error?: string;
    }> = [];

    for (const host of hosts) {
      try {
        const connector = await DockerConnectionManager.getConnector(
          host.id,
          host.connectionType,
          host.host,
          host.port,
          host.credentials
        );
        const projectNames = await connector.listRunningProjectNames();
        const projects = projectNames
          .filter((name) => !existingKeys.has(`${host.id}|${name}`))
          .map((name) => ({ name }));

        hostResults.push({ id: host.id, name: host.name, projects });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("[import/preview] Host failed:", host.name, err);
        hostResults.push({ id: host.id, name: host.name, projects: [], error: msg });
      }
    }

    return NextResponse.json({
      hosts: hostResults,
      totalHosts: hosts.length,
    });
  } catch (error) {
    console.error("Failed to preview import:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to preview import" },
      { status: 500 }
    );
  }
}
