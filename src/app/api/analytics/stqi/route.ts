import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { STQIEngine } from "@/lib/stqi-engine";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const dayOfWeek = searchParams.get("dayOfWeek") !== null ? Number(searchParams.get("dayOfWeek")) : -1;

    const tenant = await prisma.tenant.findUnique({ where: { slug: "mohra-live" } });
    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    let hourlyData = await prisma.hourlyAnalytics.findMany({
      where: {
        tenantId: tenant.id,
        dayOfWeek,
      },
      orderBy: { riyadhHour: "asc" },
    });

    // If table is empty, auto-sync once
    if (hourlyData.length === 0 && dayOfWeek === -1) {
      await STQIEngine.syncHourlyAnalytics(tenant.id);
      hourlyData = await prisma.hourlyAnalytics.findMany({
        where: {
          tenantId: tenant.id,
          dayOfWeek: -1,
        },
        orderBy: { riyadhHour: "asc" },
      });
    }

    const bestWindow = await STQIEngine.getBestStreamWindow(tenant.id);

    return NextResponse.json({
      success: true,
      dayOfWeek,
      hourlyData,
      bestWindow,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to fetch STQI analytics" },
      { status: 500 }
    );
  }
}

export async function POST() {
  try {
    const tenant = await prisma.tenant.findUnique({ where: { slug: "mohra-live" } });
    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    const syncedCount = await STQIEngine.syncHourlyAnalytics(tenant.id);
    const bestWindow = await STQIEngine.getBestStreamWindow(tenant.id);

    return NextResponse.json({
      success: true,
      syncedCount,
      bestWindow,
      message: `تم تحديث ${syncedCount} سجلاً زمنياً بنجاح.`,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to recalculate STQI" },
      { status: 500 }
    );
  }
}
