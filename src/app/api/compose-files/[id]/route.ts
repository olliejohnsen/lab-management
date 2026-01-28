import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-utils";

/**
 * GET /api/compose-files/[id] - Get compose file details
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth();
    const { id } = await params;

    const file = await prisma.composeFile.findUnique({
      where: { id },
    });

    if (!file) {
      return NextResponse.json(
        { error: "Compose file not found" },
        { status: 404 }
      );
    }

    // Only allow users to access their own files
    if (file.userId !== session.user.id && !session.user.isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json(file);
  } catch (error) {
    console.error("Failed to get compose file:", error);
    return NextResponse.json(
      { error: "Failed to get compose file" },
      { status: 500 }
    );
  }
}
