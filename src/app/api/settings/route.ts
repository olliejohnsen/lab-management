import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireAdmin } from "@/lib/auth-utils";

/**
 * GET /api/settings - Get all settings
 */
export async function GET(request: NextRequest) {
  try {
    await requireAuth();

    const settings = await prisma.appSettings.findMany();

    const settingsObj: Record<string, any> = {};
    settings.forEach((setting) => {
      try {
        settingsObj[setting.key] = JSON.parse(setting.value);
      } catch (error) {
        settingsObj[setting.key] = setting.value;
      }
    });

    return NextResponse.json(settingsObj);
  } catch (error) {
    console.error("Failed to get settings:", error);
    return NextResponse.json(
      { error: "Failed to get settings" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/settings - Update settings
 */
export async function PUT(request: NextRequest) {
  try {
    await requireAdmin();

    const body = await request.json();
    const { key, value } = body;

    if (!key) {
      return NextResponse.json(
        { error: "Missing key" },
        { status: 400 }
      );
    }

    const valueStr = typeof value === "string" ? value : JSON.stringify(value);

    const setting = await prisma.appSettings.upsert({
      where: { key },
      update: { value: valueStr },
      create: { key, value: valueStr },
    });

    return NextResponse.json(setting);
  } catch (error) {
    console.error("Failed to update settings:", error);
    return NextResponse.json(
      { error: "Failed to update settings" },
      { status: 500 }
    );
  }
}
