import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { TelegramService } from "@/lib/telegram-service";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const tenant = await prisma.tenant.findUnique({ where: { slug: "mohra-live" } });
    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    const config = await TelegramService.getConfig(tenant.id);

    const [recentLogs, totalSent, totalFailed] = await Promise.all([
      prisma.telegramNotificationLog.findMany({
        where: { tenantId: tenant.id },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
      prisma.telegramNotificationLog.count({
        where: { tenantId: tenant.id, status: "SENT" },
      }),
      prisma.telegramNotificationLog.count({
        where: { tenantId: tenant.id, status: "FAILED" },
      }),
    ]);

    return NextResponse.json({
      success: true,
      config,
      stats: {
        totalSent,
        totalFailed,
      },
      recentLogs,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to fetch Telegram configuration" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const tenant = await prisma.tenant.findUnique({ where: { slug: "mohra-live" } });
    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    const updatedConfig = await TelegramService.updateConfig(tenant.id, body);

    return NextResponse.json({
      success: true,
      config: updatedConfig,
      message: "تم حفظ إعدادات تليقرام بنجاح.",
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to update Telegram configuration" },
      { status: 500 }
    );
  }
}
