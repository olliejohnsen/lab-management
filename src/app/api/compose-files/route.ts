import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-utils";

/**
 * GET /api/compose-files - List saved compose files
 */
export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth();

    const files = await prisma.composeFile.findMany({
      where: {
        userId: session.user.id,
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        generatedBy: true,
        createdAt: true,
      },
    });

    return NextResponse.json(files);
  } catch (error) {
    console.error("Failed to list compose files:", error);
    return NextResponse.json(
      { error: "Failed to list compose files" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/compose-files - Create a new compose file
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();
    const body = await request.json();
    const { name, content, generatedBy } = body;

    if (!name || !content) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const file = await prisma.composeFile.create({
      data: {
        name,
        content,
        userId: session.user.id,
        generatedBy: generatedBy === "Template" ? "Template" : "Manual",
      },
    });

    return NextResponse.json(file, { status: 201 });
  } catch (error) {
    console.error("Failed to create compose file:", error);
    return NextResponse.json(
      { error: "Failed to create compose file" },
      { status: 500 }
    );
  }
}
