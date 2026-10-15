import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ChampionsEngine } from "@/lib/champions-engine";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limitParam = searchParams.get("limit");
    const limit = limitParam ? parseInt(limitParam, 10) : 50;
    const periodType = (searchParams.get("periodType") || "WEEKLY") as "DAILY" | "WEEKLY" | "MONTHLY" | "ALL_TIME";

    const tenant = await prisma.tenant.findUnique({ where: { slug: "mohra-live" } });
    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    const [champions, overview] = await Promise.all([
      ChampionsEngine.computePeriodChampions({
        tenantId: tenant.id,
        periodType,
        limit,
      }),
      ChampionsEngine.getChampionsOverview(tenant.id),
    ]);

    return NextResponse.json({
      success: true,
      champions,
      overview,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to fetch champions data" },
      { status: 500 }
    );
  }
}
