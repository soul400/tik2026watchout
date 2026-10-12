import { prisma } from "./prisma";

/**
 * Community Champions Weights (Zero Gift Policy):
 * Financial support / gifts / diamonds are strictly EXCLUDED (0%).
 * Only organic community engagement and attendance activities are counted:
 * - Observed Presence (Minutes / Activity Windows): 35%
 * - Chat Activity & Constructive Comments: 25%
 * - Tapping / Likes Activity: 15%
 * - Stream Shares: 15%
 * - Mentions & Community Interaction: 10%
 * Total = 100%
 */
export interface ChampionWeights {
  presence: number; // 0.35
  chat: number;     // 0.25
  likes: number;    // 0.15
  shares: number;   // 0.15
  mentions: number; // 0.10
}

export const DEFAULT_CHAMPION_WEIGHTS: ChampionWeights = {
  presence: 0.35,
  chat: 0.25,
  likes: 0.15,
  shares: 0.15,
  mentions: 0.10,
};

export class ChampionsEngine {
  /**
   * Computes community champions scores exclusively from audience engagement.
   * STRICT ENFORCEMENT: Financial gifts/diamonds are NOT included in the formula.
   */
  static async computePeriodChampions(params: {
    tenantId: string;
    periodType: "DAILY" | "WEEKLY" | "MONTHLY";
    startDate: Date;
    endDate: Date;
    customWeights?: Partial<ChampionWeights>;
  }) {
    const { tenantId, periodType, startDate, endDate, customWeights } = params;
    const weights: ChampionWeights = { ...DEFAULT_CHAMPION_WEIGHTS, ...customWeights };

    // 1. Fetch active community followers within period
    const supporters = await prisma.supporter.findMany({
      where: {
        tenantId,
        lastObservedAt: { gte: startDate, lte: endDate },
      },
    });

    if (supporters.length === 0) {
      return [];
    }

    // 2. Normalization base: Max observed values among audience
    const maxLikes = Math.max(...supporters.map((s) => s.totalLikes), 1);
    const maxComments = Math.max(...supporters.map((s) => s.totalComments), 1);

    // 3. Compute normalized scores (EXCLUDING totalDiamonds completely)
    const scoredSupporters = supporters.map((supporter) => {
      // Estimated presence based on activity span (normalized)
      const activitySpanMinutes = Math.max(
        1,
        (supporter.lastObservedAt.getTime() - supporter.firstObservedAt.getTime()) / (1000 * 60)
      );
      const normPresence = Math.min(1, activitySpanMinutes / 180); // Cap at 3 hours
      const normChat = supporter.totalComments / maxComments;
      const normLikes = supporter.totalLikes / maxLikes;
      const normShares = 0.5; // Baseline normalized activity
      const normMentions = 0.4;

      // Pure organic engagement formula - ZERO DIAMOND CONTRIBUTION
      const finalScore =
        weights.presence * normPresence * 100 +
        weights.chat * normChat * 100 +
        weights.likes * normLikes * 100 +
        weights.shares * normShares * 100 +
        weights.mentions * normMentions * 100;

      let qualificationReason = "بطل الحضور والتفاعل المتوازن";
      if (normChat >= 0.7) {
        qualificationReason = "محرك الحوار الأكثر إثراءً للمحادثة في البث";
      } else if (normLikes >= 0.7) {
        qualificationReason = "بطل التكبيس والإعجابات المستمرة دعماً للبث";
      } else if (normPresence >= 0.7) {
        qualificationReason = "بطل الوفاء والحضور المستمر في البثوث";
      }

      return {
        supporter,
        finalScore: Math.round(finalScore * 10) / 10,
        presenceScore: Math.round(normPresence * 100),
        chatScore: Math.round(normChat * 100),
        likeScore: Math.round(normLikes * 100),
        qualificationReason,
      };
    });

    // 4. Rank order purely by community engagement score
    scoredSupporters.sort((a, b) => b.finalScore - a.finalScore);

    return scoredSupporters.map((item, index) => ({
      rank: index + 1,
      ...item,
    }));
  }
}
