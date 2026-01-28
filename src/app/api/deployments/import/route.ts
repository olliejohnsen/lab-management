import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-utils";
import { DockerConnectionManager } from "@/services/docker/connection-manager";

const IMPORTED_COMPOSE_NAME = "Imported deployment";
const IMPORTED_COMPOSE_CONTENT = "# Imported from host. Display-only in DEV Manager; do not remove from host via this UI.\n";

/**
 * POST /api/deployments/import - Create deployment records for selected running projects.
 * Body: { selections?: { hostId: string, projectName: string }[] }. If provided, only import these; otherwise discover all and import all new.
 * Imported deployments have metadata.imported = true and cannot be deleted from the UI.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();

    let selections: Array<{ hostId: string; projectName: string }> | undefined;
    try {
      const body = await request.json();
      if (body?.selections && Array.isArray(body.selections)) {
        selections = body.selections.filter(
          (s: unknown) =>
            s && typeof s === "object" && "hostId" in s && "projectName" in s && typeof (s as { hostId: unknown }).hostId === "string" && typeof (s as { projectName: unknown }).projectName === "string"
        ) as Array<{ hostId: string; projectName: string }>;
      }
    } catch {
      // no body or invalid JSON
    }

    const existingDeployments = await prisma.deployment.findMany({
      select: { id: true, hostId: true, metadata: true },
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

    let importedComposeFile = await prisma.composeFile.findFirst({
      where: { name: IMPORTED_COMPOSE_NAME, userId: session.user.id },
    });

    if (!importedComposeFile) {
      importedComposeFile = await prisma.composeFile.create({
        data: {
          name: IMPORTED_COMPOSE_NAME,
          content: IMPORTED_COMPOSE_CONTENT,
          userId: session.user.id,
          generatedBy: "Import",
        },
      });
    }

    let imported = 0;
    const hostResults: { name: string; count: number; error?: string }[] = [];

    if (selections && selections.length > 0) {
      const hostsById = new Map<string, { id: string; name: string; connectionType: string; host: string; port: number; credentials: string }>();
      const hosts = await prisma.dockerHost.findMany({
        select: { id: true, name: true, connectionType: true, host: true, port: true, credentials: true },
      });
      hosts.forEach((h) => hostsById.set(h.id, h));

      const countByHost = new Map<string, number>();
      for (const { hostId, projectName } of selections) {
        const key = `${hostId}|${projectName}`;
        if (existingKeys.has(key)) continue;
        const host = hostsById.get(hostId);
        if (!host) continue;

        await prisma.deployment.create({
          data: {
            composeFileId: importedComposeFile.id,
            hostId,
            status: "running",
            metadata: JSON.stringify({ projectName, imported: true }),
          },
        });
        existingKeys.add(key);
        imported++;
        countByHost.set(hostId, (countByHost.get(hostId) ?? 0) + 1);
      }

      hosts.forEach((h) => {
        hostResults.push({ name: h.name, count: countByHost.get(h.id) ?? 0 });
      });
    } else {
      const hosts = await prisma.dockerHost.findMany({
        select: { id: true, name: true, connectionType: true, host: true, port: true, credentials: true },
      });

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
          let hostImported = 0;

          for (const projectName of projectNames) {
            const key = `${host.id}|${projectName}`;
            if (existingKeys.has(key)) continue;

            await prisma.deployment.create({
              data: {
                composeFileId: importedComposeFile.id,
                hostId: host.id,
                status: "running",
                metadata: JSON.stringify({ projectName, imported: true }),
              },
            });
            existingKeys.add(key);
            hostImported++;
            imported++;
          }

          hostResults.push({ name: host.name, count: hostImported });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error("[import] Host failed:", host.name, err);
          hostResults.push({ name: host.name, count: 0, error: msg });
        }
      }
    }

    return NextResponse.json({
      success: true,
      imported,
      hostResults,
      message: imported === 0
        ? "No new projects found on hosts (all already listed)."
        : `Imported ${imported} deployment(s) from hosts.`,
    });
  } catch (error) {
    console.error("Failed to import deployments:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to import deployments" },
      { status: 500 }
    );
  }
}
