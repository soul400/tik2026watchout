import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const tenant = await prisma.tenant.findUnique({
      where: { slug: "mohra-live" },
    });
    if (!tenant) return NextResponse.json({ battle: null });

    // Look for currently in-progress battle or the most recent battle from active session
    const activeBattle = await prisma.battle.findFirst({
      where: {
        tenantId: tenant.id,
        status: "IN_PROGRESS",
      },
      include: {
        participants: true,
      },
      orderBy: { startedAt: "desc" },
    });

    if (activeBattle) {
      return NextResponse.json({ battle: activeBattle });
    }

    // If no battle in progress, check if there was a recent battle in the last 15 minutes
    const recentBattle = await prisma.battle.findFirst({
      where: {
        tenantId: tenant.id,
      },
      include: {
        participants: true,
      },
      orderBy: { startedAt: "desc" },
    });

    // Only return recent if ended less than 10 minutes ago
    if (recentBattle && recentBattle.endedAt) {
      const diffMs = Date.now() - new Date(recentBattle.endedAt).getTime();
      if (diffMs < 10 * 60 * 1000) {
        return NextResponse.json({ battle: recentBattle });
      }
    }

    return NextResponse.json({ battle: null });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message }, { status: 500 });
  }
}
