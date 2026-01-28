import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { userId, currentPassword, newPassword } = body;

    // Find user: by id first, then by email (handles stale session after re-seed or missing id in JWT)
    let user = userId
      ? await prisma.user.findUnique({ where: { id: userId } })
      : null;

    if (!user && session.user.email) {
      user = await prisma.user.findUnique({
        where: { email: session.user.email },
      });
    }

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Verify the user is changing their own password or is an admin
    if (session.user.id && userId !== session.user.id && !session.user.isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Verify current password
    const passwordValid = await bcrypt.compare(currentPassword, user.passwordHash);

    if (!passwordValid) {
      return NextResponse.json(
        { error: "Current password is incorrect" },
        { status: 400 }
      );
    }

    // Hash new password
    const newPasswordHash = await bcrypt.hash(newPassword, 10);

    // Update password and clear mustChangePassword flag
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: newPasswordHash,
        mustChangePassword: false,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error changing password:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
