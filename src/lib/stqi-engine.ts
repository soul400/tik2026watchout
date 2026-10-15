import { prisma } from "./prisma";

export interface HourlyCalculationResult {
  riyadhHour: number;
  dayOfWeek: number;
  sampleSessions: number;
  avgDiamonds: number;
  avgLikes: number;
  avgComments: number;
  avgViewers: number;
  consistencyScore: number;
  stqiScore: number;
  confidenceState: "VERIFIED" | "PARTIAL" | "INSUFFICIENT_DATA";
}

export interface BestStreamWindow {
  hour: number;
  formattedHourArabic: string;
  stqiScore: number;
  consistencyPercent: number;
  sampleSessions: number;
  confidenceState: "VERIFIED" | "PARTIAL" | "INSUFFICIENT_DATA";
  avgDiamonds: number;
  avgComments: number;
  avgLikes: number;
  summaryArabic: string;
}

export class STQIEngine {
  /**
   * Formats a 0-23 hour into clean 12-hour Arabic representation
   * e.g., 20 -> "8:00 مساءً — 9:00 مساءً"
   */
  static formatHourWindow(hour: number): string {
    const nextHour = (hour + 1) % 24;
    const formatH = (h: number) => {
      if (h === 0) return "12:00 منتصف الليل";
      if (h === 12) return "12:00 ظهراً";
      if (h < 12) return `${h}:00 صباحاً`;
      return `${h - 12}:00 مساءً`;
    };
    return `${formatH(hour)} — ${formatH(nextHour)}`;
  }

  /**
   * Calculates hourly STQI metrics from live sessions for a given tenant.
   * DayOfWeek = -1 means aggregated across all days.
   * DayOfWeek = 0..6 means specific day of week (0=Sunday, 6=Saturday).
   */
  static async computeHourlyMetrics(tenantId: string): Promise<HourlyCalculationResult[]> {
    const sessions = await prisma.liveSession.findMany({
      where: {
        tenantId,
        OR: [
          { totalDiamonds: { gt: 0 } },
          { totalLikes: { gt: 0 } },
          { totalComments: { gt: 0 } },
        ],
      },
      orderBy: { startedAt: "asc" },
    });

    if (sessions.length === 0) {
      return [];
    }

    interface SessionContribution {
      sessionId: string;
      diamonds: number;
      likes: number;
      comments: number;
      viewers: number;
    }

    // Map: key `${riyadhHour}_${dayOfWeek}` -> array of contributions
    // We compute both:
    // 1. All-days aggregated: key `${riyadhHour}_-1`
    // 2. Specific day-of-week: key `${riyadhHour}_${dayOfWeek}`
    const bucketMap = new Map<string, SessionContribution[]>();

    const getOrCreateBucket = (hour: number, dow: number) => {
      const key = `${hour}_${dow}`;
      if (!bucketMap.has(key)) {
        bucketMap.set(key, []);
      }
      return bucketMap.get(key)!;
    };

    for (const s of sessions) {
      const started = new Date(s.startedAt);
      const ended = s.endedAt ? new Date(s.endedAt) : new Date(started.getTime() + 60 * 60 * 1000);
      const durationMin = Math.max(1, Math.round((ended.getTime() - started.getTime()) / 60000));
      
      const diamondRatePerHour = (s.totalDiamonds / durationMin) * 60;
      const likeRatePerHour = (s.totalLikes / durationMin) * 60;
      const commentRatePerHour = (s.totalComments / durationMin) * 60;
      const viewerRate = s.peakViewers || 0;

      const startMs = started.getTime();
      const endMs = ended.getTime();

      // Find all (riyadhHour, dayOfWeek) windows touched by this session
      const touchedBuckets = new Set<string>();

      for (let t = startMs; t <= endMs; t += 10 * 60 * 1000) {
        const d = new Date(t);
        // Asia/Riyadh is UTC+3
        const riyadhDate = new Date(d.getTime() + 3 * 3600 * 1000);
        const riyadhHour = riyadhDate.getUTCHours();
        const riyadhDow = riyadhDate.getUTCDay();

        // All days aggregate bucket (-1)
        touchedBuckets.add(`${riyadhHour}_-1`);
        // Specific day-of-week bucket
        touchedBuckets.add(`${riyadhHour}_${riyadhDow}`);
      }

      for (const bucketKey of touchedBuckets) {
        const [hStr, dowStr] = bucketKey.split("_");
        const list = getOrCreateBucket(Number(hStr), Number(dowStr));
        list.push({
          sessionId: s.id,
          diamonds: diamondRatePerHour,
          likes: likeRatePerHour,
          comments: commentRatePerHour,
          viewers: viewerRate,
        });
      }
    }

    // Determine max values across all aggregated buckets for normalization
    let maxAvgDiamonds = 1;
    let maxAvgComments = 1;
    let maxAvgLikes = 1;

    // First pass: Calculate averages
    const rawAverages: Array<{
      hour: number;
      dow: number;
      count: number;
      avgDiamonds: number;
      avgLikes: number;
      avgComments: number;
      avgViewers: number;
      consistency: number;
    }> = [];

    bucketMap.forEach((list, key) => {
      const [hStr, dowStr] = key.split("_");
      const hour = Number(hStr);
      const dow = Number(dowStr);
      const count = list.length;
      if (count === 0) return;

      const avgDiamonds = list.reduce((a, b) => a + b.diamonds, 0) / count;
      const avgLikes = list.reduce((a, b) => a + b.likes, 0) / count;
      const avgComments = list.reduce((a, b) => a + b.comments, 0) / count;
      const avgViewers = list.reduce((a, b) => a + b.viewers, 0) / count;

      // Consistency: inverse of coefficient of variation
      let consistency = 0.5;
      if (count > 1) {
        const diamondVariance =
          list.reduce((acc, x) => acc + Math.pow(x.diamonds - avgDiamonds, 2), 0) / count;
        const diamondStdDev = Math.sqrt(diamondVariance);
        const cv = diamondStdDev / (avgDiamonds + 1);
        consistency = Math.max(0.15, Math.min(0.95, 1 / (1 + cv * 0.5)));
      }

      if (dow === -1) {
        if (avgDiamonds > maxAvgDiamonds) maxAvgDiamonds = avgDiamonds;
        if (avgComments > maxAvgComments) maxAvgComments = avgComments;
        if (avgLikes > maxAvgLikes) maxAvgLikes = avgLikes;
      }

      rawAverages.push({
        hour,
        dow,
        count,
        avgDiamonds,
        avgLikes,
        avgComments,
        avgViewers,
        consistency,
      });
    });

    // Second pass: Compute composite STQI Score (0 - 100)
    const results: HourlyCalculationResult[] = rawAverages.map((item) => {
      const sDiamonds = Math.min(100, (item.avgDiamonds / maxAvgDiamonds) * 100);
      const sChat = Math.min(100, (item.avgComments / maxAvgComments) * 100);
      const sLikes = Math.min(100, (item.avgLikes / maxAvgLikes) * 100);
      const sEngagement = sChat * 0.7 + sLikes * 0.3;
      const sConsistency = item.consistency * 100;
      const sReliability = Math.min(100, (item.count / 5) * 100);

      // Composite weights: 35% Financial Support, 25% Engagement, 25% Consistency, 15% Sample Reliability
      const stqiRaw =
        0.35 * sDiamonds +
        0.25 * sEngagement +
        0.25 * sConsistency +
        0.15 * sReliability;
      const stqiScore = Math.round(stqiRaw * 10) / 10;

      let confidenceState: "VERIFIED" | "PARTIAL" | "INSUFFICIENT_DATA" = "INSUFFICIENT_DATA";
      if (item.count >= 6) {
        confidenceState = "VERIFIED";
      } else if (item.count >= 3) {
        confidenceState = "PARTIAL";
      }

      return {
        riyadhHour: item.hour,
        dayOfWeek: item.dow,
        sampleSessions: item.count,
        avgDiamonds: Math.round(item.avgDiamonds),
        avgLikes: Math.round(item.avgLikes),
        avgComments: Math.round(item.avgComments),
        avgViewers: Math.round(item.avgViewers),
        consistencyScore: Math.round(item.consistency * 100) / 100,
        stqiScore,
        confidenceState,
      };
    });

    return results;
  }

  /**
   * Syncs computed hourly analytics to Prisma database for persistence.
   */
  static async syncHourlyAnalytics(tenantId: string): Promise<number> {
    const metrics = await this.computeHourlyMetrics(tenantId);
    if (metrics.length === 0) return 0;

    let updatedCount = 0;
    for (const m of metrics) {
      await prisma.hourlyAnalytics.upsert({
        where: {
          tenantId_riyadhHour_dayOfWeek: {
            tenantId,
            riyadhHour: m.riyadhHour,
            dayOfWeek: m.dayOfWeek,
          },
        },
        create: {
          tenantId,
          riyadhHour: m.riyadhHour,
          dayOfWeek: m.dayOfWeek,
          sampleSessions: m.sampleSessions,
          avgDiamonds: m.avgDiamonds,
          avgLikes: m.avgLikes,
          avgComments: m.avgComments,
          avgViewers: m.avgViewers,
          stqiScore: m.stqiScore,
          consistencyScore: m.consistencyScore,
          confidenceState: m.confidenceState,
        },
        update: {
          sampleSessions: m.sampleSessions,
          avgDiamonds: m.avgDiamonds,
          avgLikes: m.avgLikes,
          avgComments: m.avgComments,
          avgViewers: m.avgViewers,
          stqiScore: m.stqiScore,
          consistencyScore: m.consistencyScore,
          confidenceState: m.confidenceState,
        },
      });
      updatedCount++;
    }

    return updatedCount;
  }

  /**
   * Returns the best stream time window dynamically computed from real data.
   */
  static async getBestStreamWindow(tenantId: string): Promise<BestStreamWindow | null> {
    // Look at all-days aggregated analytics (dayOfWeek = -1)
    const records = await prisma.hourlyAnalytics.findMany({
      where: { tenantId, dayOfWeek: -1 },
      orderBy: { stqiScore: "desc" },
    });

    if (records.length === 0) {
      return null;
    }

    // Pick top record
    const best = records[0];
    const formattedHour = this.formatHourWindow(best.riyadhHour);
    const consistencyPercent = Math.round(best.consistencyScore * 100);

    const summary = `سجلت هذه الفترة أعلى مؤشر جودة للبث (${best.stqiScore}) مع استمرارية تفاعل بلغت ${consistencyPercent}% عبر ${best.sampleSessions} جلسة حقيقية مرصودة.`;

    return {
      hour: best.riyadhHour,
      formattedHourArabic: formattedHour,
      stqiScore: best.stqiScore,
      consistencyPercent,
      sampleSessions: best.sampleSessions,
      confidenceState: best.confidenceState as any,
      avgDiamonds: best.avgDiamonds,
      avgComments: best.avgComments,
      avgLikes: best.avgLikes,
      summaryArabic: summary,
    };
  }
}
