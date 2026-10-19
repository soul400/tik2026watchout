import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AntiSnipePredictorService } from "@/lib/anti-snipe-predictor-service";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    let tenantId = searchParams.get("tenantId");

    if (!tenantId) {
      const defaultTenant = await prisma.tenant.findUnique({
        where: { slug: "mohra-live" },
      });
      tenantId = defaultTenant?.id || null;
    }

    if (!tenantId) {
      return NextResponse.json({ ok: false, error: "Tenant is required" }, { status: 400 });
    }

    const activeBattle = await prisma.battle.findFirst({
      where: { tenantId, status: "IN_PROGRESS" },
      include: { participants: true },
    });

    if (!activeBattle) {
      // Fallback: evaluate the most recent completed battle as baseline context
      const lastBattle = await prisma.battle.findFirst({
        where: { tenantId, status: "COMPLETED" },
        orderBy: { endedAt: "desc" },
        include: { participants: true },
      });

      if (!lastBattle) {
        return NextResponse.json({
          ok: true,
          data: {
            isActive: false,
            message: "لا توجد جولات نشطة أو موثقة حالياً",
          },
        });
      }

      const opps = lastBattle.participants.filter((p) => p.teamNumber === 2).map((p) => p.username);
      const prediction = await AntiSnipePredictorService.evaluateBattleRisk(tenantId, {
        battleId: lastBattle.id,
        battleType: lastBattle.battleType as any,
        team1Score: lastBattle.team1Score,
        team2Score: lastBattle.team2Score,
        opponentUsernames: opps,
        timeRemainingSeconds: 0,
      });

      return NextResponse.json({
        ok: true,
        data: {
          isActive: false,
          lastBattleSummary: lastBattle,
          prediction,
        },
      });
    }

    const opps = activeBattle.participants.filter((p) => p.teamNumber === 2).map((p) => p.username);
    const prediction = await AntiSnipePredictorService.evaluateBattleRisk(tenantId, {
      battleId: activeBattle.id,
      battleType: activeBattle.battleType as any,
      team1Score: activeBattle.team1Score,
      team2Score: activeBattle.team2Score,
      opponentUsernames: opps,
      timeRemainingSeconds: 45,
    });

    return NextResponse.json({
      ok: true,
      data: {
        isActive: true,
        battle: activeBattle,
        prediction,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
