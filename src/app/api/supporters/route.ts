import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const tenant = await prisma.tenant.findUnique({
      where: { slug: "mohra-live" },
    });
    if (!tenant) return NextResponse.json({ supporters: [], totalDiamonds: 0, totalPresenceHours: 0 });

    // Fetch ONLY supporters with > 10,000 diamonds (Financial Tier)
    const supportersBySupport = await prisma.supporter.findMany({
      where: {
        tenantId: tenant.id,
        totalDiamonds: { gt: 10000 },
      },
      orderBy: { totalDiamonds: "desc" },
    });

    const supportersWithPresence = supportersBySupport.map((s) => {
      const presenceMinutes = Math.max(
        15,
        Math.round((new Date(s.lastObservedAt).getTime() - new Date(s.firstObservedAt).getTime()) / (1000 * 60))
      );
      const presenceHours = (presenceMinutes / 60).toFixed(1);

      return {
        ...s,
        firstObservedAt: s.firstObservedAt.toISOString(),
        lastObservedAt: s.lastObservedAt.toISOString(),
        presenceMinutes,
        presenceHours,
      };
    });

    const supportersByPresence = [...supportersWithPresence].sort(
      (a, b) => b.presenceMinutes - a.presenceMinutes
    );

    const totalDiamonds = supportersBySupport.reduce((acc, s) => acc + s.totalDiamonds, 0);
    const totalPresenceHours = supportersWithPresence.reduce(
      (acc, s) => acc + parseFloat(s.presenceHours),
      0
    );

    return NextResponse.json({
      supportersBySupport: supportersWithPresence,
      supportersByPresence,
      totalDiamonds,
      totalPresenceHours,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message }, { status: 500 });
  }
}
