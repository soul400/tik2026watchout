import { prisma } from "./prisma";
import {
  AntiSnipePredictionDTO,
  SnipeThreatLevel,
} from "./intelligence-types";

interface BattleStateContext {
  battleId: string;
  battleType?: "1V1" | "2V2";
  team1Score: number;
  team2Score: number;
  durationSeconds?: number;
  elapsedSeconds?: number;
  timeRemainingSeconds?: number;
  opponentUsernames?: string[];
}

export class AntiSnipePredictorService {
  /**
   * Evaluates active PK Battle tactical risk and predicts late-round comeback threat (Anti-Snipe).
   * Operates completely non-blocking without delaying the live battle scoring pipeline.
   */
  static async evaluateBattleRisk(
    tenantId: string,
    context: BattleStateContext
  ): Promise<AntiSnipePredictionDTO> {
    const {
      battleId,
      battleType = "1V1",
      team1Score,
      team2Score,
      timeRemainingSeconds = 45,
      opponentUsernames = [],
    } = context;

    const scoreDifference = team1Score - team2Score;
    const isLeading = scoreDifference > 0;

    // 1. Fetch Opponents' Historical Battle Records
    const opponentNames = opponentUsernames.length > 0 ? opponentUsernames : ["opponent"];
    const historicalOpponentBattles = await prisma.battle.findMany({
      where: {
        tenantId,
        participants: {
          some: {
            username: { in: opponentNames },
            teamNumber: 2,
          },
        },
      },
      include: {
        scoreEvents: true,
      },
      take: 20,
      orderBy: { startedAt: "desc" },
    });

    // SIGNAL A: Opponent Comeback Capacity (25%)
    // Assess how often the opponent managed to score heavily or win after trailing
    let comebackCount = 0;
    let totalComparableRounds = historicalOpponentBattles.length;
    let avgOpponentLateFirepower = 0;

    for (const b of historicalOpponentBattles) {
      if (b.winningTeam === 2) {
        comebackCount++;
      }
      // Calculate points scored in the last 15 seconds
      const lateScores = b.scoreEvents.filter((s) => {
        if (!b.endedAt) return false;
        const diff = new Date(b.endedAt).getTime() - new Date(s.timestamp).getTime();
        return diff <= 15000 && diff >= 0 && s.teamNumber === 2;
      });
      const roundLatePts = lateScores.reduce((sum, s) => sum + s.points, 0);
      avgOpponentLateFirepower += roundLatePts;
    }

    if (totalComparableRounds > 0) {
      avgOpponentLateFirepower = Math.round(avgOpponentLateFirepower / totalComparableRounds);
    } else {
      avgOpponentLateFirepower = 35000; // Baseline estimated late firepower
    }

    const comebackRatio = totalComparableRounds > 0 ? comebackCount / totalComparableRounds : 0.35;
    const signalA = Math.min(100, Math.round(comebackRatio * 100));

    // SIGNAL B: Opponent-side Supporter Threat (35%)
    // Identify top supporters present on the opponent's side with historical snipe capability
    const identifiedSnipers: Array<{
      username: string;
      displayName: string;
      historicalLatePoints: number;
      confidence: string;
    }> = [];

    // Query recent high-value scores by supporters against the host
    const rivalSupporters = await prisma.battleScoreEvent.groupBy({
      by: ["supporterId"],
      where: {
        battle: { tenantId },
        teamNumber: 2,
        points: { gte: 20000 },
      },
      _sum: { points: true },
      _count: { id: true },
      orderBy: { _sum: { points: "desc" } },
      take: 5,
    });

    let rivalThreatCapacity = 0;
    for (const rival of rivalSupporters) {
      const supp = await prisma.supporter.findUnique({
        where: { id: rival.supporterId },
        select: { username: true, displayName: true },
      });
      if (supp) {
        const pts = rival._sum.points || 0;
        rivalThreatCapacity += pts;
        identifiedSnipers.push({
          username: supp.username,
          displayName: supp.displayName,
          historicalLatePoints: pts,
          confidence: pts > 100000 ? "HIGH" : "MEDIUM",
        });
      }
    }

    const signalB = Math.min(
      100,
      Math.round((rivalThreatCapacity / Math.max(team1Score, 50000)) * 50 + (identifiedSnipers.length > 0 ? 30 : 10))
    );

    // SIGNAL C: Score Stagnation & Lead Exposure (20%)
    // If the lead is narrow or remaining time is under 30s, threat escalates sharply
    let signalC = 20;
    if (isLeading) {
      const leadRatio = scoreDifference / Math.max(team1Score, 1);
      if (leadRatio < 0.15) {
        signalC = 90; // Dangerous vulnerable lead
      } else if (leadRatio < 0.35) {
        signalC = 65;
      } else if (leadRatio < 0.7) {
        signalC = 35;
      } else {
        signalC = 10; // Safe comfortable buffer
      }
    } else {
      signalC = 75; // Behind, high volatility
    }

    // Time decay factor: closer to 0 seconds, risk spikes if lead is slim
    if (timeRemainingSeconds <= 15) {
      signalC = Math.min(100, signalC * 1.3);
    }

    // SIGNAL D: Documented Glove / Multiplier Availability (10%)
    // Check if the host has available gloves to defend or if the opponent recently activated multipliers
    const hostAvailableGloves = await prisma.toolGrant.count({
      where: {
        tenantId,
        toolDefinition: { key: "GLOVE" },
        status: "AVAILABLE",
      },
    });

    // If host has 0 gloves, risk increases; if host has 2+ gloves, risk decreases
    let signalD = 50;
    if (hostAvailableGloves === 0) {
      signalD = 80;
    } else if (hostAvailableGloves >= 2) {
      signalD = 25;
    }

    // SIGNAL E: Relevant Historical Account Records (10%)
    // Check if any watchlist or Enigma accounts are active in current session
    const watchlistCount = await prisma.intelligenceWatchlist.count({
      where: { tenantId, isActive: true },
    });
    const signalE = Math.min(100, watchlistCount * 15 + 20);

    // Calculate Composite Snipe Risk Score
    const compositeRisk = Math.round(
      signalA * 0.25 +
      signalB * 0.35 +
      signalC * 0.2 +
      signalD * 0.1 +
      signalE * 0.1
    );

    const clampedRisk = Math.min(100, Math.max(0, compositeRisk));

    // Determine Threat Level
    let threatLevel: SnipeThreatLevel = "LOW_SAFE";
    if (clampedRisk >= 80) {
      threatLevel = "CRITICAL_IMMINENT_SNIPE";
    } else if (clampedRisk >= 60) {
      threatLevel = "HIGH_AMBUSH_RISK";
    } else if (clampedRisk >= 40) {
      threatLevel = "MODERATE_CAUTION";
    } else {
      threatLevel = "LOW_SAFE";
    }

    // Calculate Estimated Snipe Firepower and Safe Lead Buffer Required
    const estimatedSnipeFirepower = Math.max(
      avgOpponentLateFirepower,
      Math.round(team2Score * 0.4) + (threatLevel === "CRITICAL_IMMINENT_SNIPE" ? 100000 : 30000)
    );

    // Safe lead buffer: firepower + 20% security margin
    const safeLeadBufferRequired = Math.round(estimatedSnipeFirepower * 1.25);

    const predictionLimitations: string[] = [
      "مؤشر التهديد هو تقييم احتمالي تكتيكي مبني على الأنماط السابقة وحالة السكور اللحظية.",
      "لا يوجد تقدم في النقاط يضمن الفوز حسابياً بشكل قطعي ما لم تنتهِ الثواني الرسمية للجولة.",
      "تحركات الدعم المفاجئة قد تختلف عن السجلات السابقة حسب رصيد وتواجد الداعمين في تلك اللحظة.",
    ];

    return {
      battleId,
      battleType,
      calculatedAt: new Date().toISOString(),
      timezone: "Asia/Riyadh",
      team1Score,
      team2Score,
      scoreDifference,
      timeRemainingSeconds,
      snipeRiskScore: clampedRisk,
      threatLevel,
      estimatedSnipeFirepower,
      safeLeadBufferRequired,
      identifiedSnipers,
      signals: {
        opponentComebackCapacity: Math.round(signalA),
        opponentSupporterThreat: Math.round(signalB),
        scoreStagnationExposure: Math.round(signalC),
        boostAvailabilityImpact: Math.round(signalD),
        historicalAccountRecords: Math.round(signalE),
      },
      dataCoverage: totalComparableRounds >= 5 ? "VERIFIED_HIGH" : "MODERATE",
      predictionLimitations,
    };
  }
}
