import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ChampionsEngine } from "@/lib/champions-engine";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limitParam = searchParams.get("limit");
    const limit = limitParam ? parseInt(limitParam, 10) : 50;
    const periodType = (searchParams.get("periodType") || "WEEKLY").toUpperCase() as "WEEKLY" | "MONTHLY";
    const startDateParam = searchParams.get("startDate");
    const endDateParam = searchParams.get("endDate");

    const tenant = await prisma.tenant.findUnique({ where: { slug: "mohra-live" } });
    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    const periods = ChampionsEngine.getPresetPeriods();
    const defaultPeriod = periodType === "MONTHLY" ? periods.monthly[0] : periods.weekly[0];

    const startDate = startDateParam ? new Date(startDateParam) : new Date(defaultPeriod.startDate);
    const endDate = endDateParam ? new Date(endDateParam) : new Date(defaultPeriod.endDate);

    const [champions, overview] = await Promise.all([
      ChampionsEngine.computePeriodChampions({
        tenantId: tenant.id,
        periodType,
        startDate,
        endDate,
        limit,
      }),
      ChampionsEngine.getChampionsOverview({
        tenantId: tenant.id,
        startDate,
        endDate,
      }),
    ]);

    return NextResponse.json({
      success: true,
      champions,
      overview,
      periods,
      activePeriod: {
        type: periodType,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        label: defaultPeriod.label,
        sublabel: defaultPeriod.sublabel,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to fetch champions data" },
      { status: 500 }
    );
  }
}
