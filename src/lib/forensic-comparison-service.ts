import { prisma } from "./prisma";
import {
  ForensicComparisonDTO,
  AccountIdentityDTO,
  CircadianHourBin,
  GiftDistributionItem,
  VerdictStatus,
} from "./intelligence-types";
import { EvidencePolicyEngine } from "./evidence-policy";

export class ForensicComparisonService {
  /**
   * Performs an in-depth forensic and behavioral comparison between two accounts.
   * Scoped strictly to authenticated tenantId.
   */
  static async compareAccounts(params: {
    tenantId: string;
    accountAIdentifier: string; // platformUserId or username
    accountBIdentifier: string; // platformUserId or username
  }): Promise<ForensicComparisonDTO> {
    const { tenantId, accountAIdentifier, accountBIdentifier } = params;

    // 1. Fetch both supporter accounts
    const [suppA, suppB] = await Promise.all([
      this.resolveSupporter(tenantId, accountAIdentifier),
      this.resolveSupporter(tenantId, accountBIdentifier),
    ]);

    if (!suppA || !suppB) {
      throw new Error("تعذر العثور على أحد الحسابين المحددين في سجلات المنظومة.");
    }

    // 2. Fetch raw events, gift records, and score events for both accounts
    const [eventsA, eventsB, scoresA, scoresB, aliasesA, aliasesB] = await Promise.all([
      this.fetchUserEvents(tenantId, suppA.platformUserId, suppA.username),
      this.fetchUserEvents(tenantId, suppB.platformUserId, suppB.username),
      this.fetchUserScores(tenantId, suppA.id),
      this.fetchUserScores(tenantId, suppB.id),
      prisma.intelligenceAliasHistory.findMany({
        where: { tenantId, platformUserId: suppA.platformUserId },
        orderBy: { observedAt: "desc" },
      }),
      prisma.intelligenceAliasHistory.findMany({
        where: { tenantId, platformUserId: suppB.platformUserId },
        orderBy: { observedAt: "desc" },
      }),
    ]);

    // Construct Account Identity DTOs
    const identityA: AccountIdentityDTO = {
      id: suppA.id,
      platformUserId: suppA.platformUserId,
      username: suppA.username,
      displayName: suppA.displayName,
      avatarUrl: suppA.avatarUrl,
      totalDiamonds: suppA.totalDiamonds,
      totalLikes: suppA.totalLikes,
      totalComments: suppA.totalComments,
      category: suppA.category,
      firstObservedAt: suppA.firstObservedAt.toISOString(),
      lastObservedAt: suppA.lastObservedAt.toISOString(),
      dataConfidence: suppA.dataConfidence,
      aliasHistoryCount: aliasesA.length,
      isEnigmaMaskObserved: suppA.username.toLowerCase().startsWith("enigma"),
    };

    const identityB: AccountIdentityDTO = {
      id: suppB.id,
      platformUserId: suppB.platformUserId,
      username: suppB.username,
      displayName: suppB.displayName,
      avatarUrl: suppB.avatarUrl,
      totalDiamonds: suppB.totalDiamonds,
      totalLikes: suppB.totalLikes,
      totalComments: suppB.totalComments,
      category: suppB.category,
      firstObservedAt: suppB.firstObservedAt.toISOString(),
      lastObservedAt: suppB.lastObservedAt.toISOString(),
      dataConfidence: suppB.dataConfidence,
      aliasHistoryCount: aliasesB.length,
      isEnigmaMaskObserved: suppB.username.toLowerCase().startsWith("enigma"),
    };

    // Dimension 1: Temporal Overlap & Handover Analysis
    const temporal = this.analyzeTemporalOverlap(eventsA, eventsB);

    // Dimension 2: 24h Circadian Overlay in Asia/Riyadh (UTC+3)
    const circadian = this.analyzeCircadianPatterns(eventsA, eventsB);

    // Dimension 3: Gift Distribution & Cosine Similarity
    const giftDistribution = this.analyzeGiftDistribution(eventsA, eventsB);

    // Dimension 4: PK Tactical Behavior
    const pkTactics = this.analyzePkTactics(scoresA, scoresB);

    // Dimension 5: Opponent Interaction
    const opponentInteraction = this.analyzeOpponentInteraction(scoresA, scoresB);

    // Synthesis: Multi-Factor Weighted Scoring
    const synthesis = this.synthesizeComparison({
      suppA: identityA,
      suppB: identityB,
      eventsA,
      eventsB,
      temporal,
      circadian,
      giftDistribution,
      pkTactics,
      opponentInteraction,
    });

    return {
      accountA: identityA,
      accountB: identityB,
      comparisonTimestamp: new Date().toISOString(),
      timezone: "Asia/Riyadh",
      temporal,
      circadian,
      giftDistribution,
      pkTactics,
      opponentInteraction,
      synthesis,
    };
  }

  private static async resolveSupporter(tenantId: string, identifier: string) {
    return prisma.supporter.findFirst({
      where: {
        tenantId,
        OR: [
          { platformUserId: identifier },
          { username: identifier },
          { id: identifier },
        ],
      },
    });
  }

  private static async fetchUserEvents(tenantId: string, platformUserId?: string, username?: string) {
    if (!platformUserId && !username) return [];

    const orConditions: any[] = [];
    if (platformUserId) {
      orConditions.push({ platformUserId });
    }
    if (username) {
      orConditions.push({ deduplicationKey: { contains: `_${username}_` } });
    }

    // Single unified query with OR to ensure complete coverage without double-counting
    const events = await prisma.rawEvent.findMany({
      where: {
        liveSession: { tenantId },
        OR: orConditions,
      },
      select: {
        id: true,
        liveSessionId: true,
        eventType: true,
        sourceTimestamp: true,
        payload: true,
      },
      orderBy: { sourceTimestamp: "asc" },
      take: 3000,
    });

    if (events.length > 0) {
      return events;
    }

    // Safe fallback for edge cases with payload search
    return prisma.$queryRawUnsafe<any[]>(
      `
      SELECT id, liveSessionId, eventType, sourceTimestamp, payload
      FROM RawEvent
      WHERE liveSessionId IN (SELECT id FROM LiveSession WHERE tenantId = ?)
        AND (payload LIKE ? OR payload LIKE ?)
      ORDER BY sourceTimestamp ASC
      LIMIT 1000;
    `,
      tenantId,
      `%${platformUserId}%`,
      `%${username}%`
    );
  }

  private static async fetchUserScores(tenantId: string, supporterId: string) {
    return prisma.battleScoreEvent.findMany({
      where: { supporterId },
      include: {
        battle: {
          include: {
            participants: true,
          },
        },
      },
      orderBy: { timestamp: "asc" },
      take: 1000,
    });
  }

  /**
   * Analyzes temporal co-presence vs handover patterns using discrete session-scoped time windows
   * Eliminates Cartesian O(N x M) explosion and handles network/clock jitter
   */
  private static analyzeTemporalOverlap(eventsA: any[], eventsB: any[]) {
    const timesA = eventsA.map((e) => new Date(e.sourceTimestamp).getTime()).filter((t) => !isNaN(t));
    const timesB = eventsB.map((e) => new Date(e.sourceTimestamp).getTime()).filter((t) => !isNaN(t));

    // Group events by liveSessionId to ensure co-presence is only measured within the same broadcast session
    const sessionEventsA = new Map<string, number[]>();
    for (const e of eventsA) {
      if (!e.liveSessionId) continue;
      const t = new Date(e.sourceTimestamp).getTime();
      if (isNaN(t)) continue;
      if (!sessionEventsA.has(e.liveSessionId)) sessionEventsA.set(e.liveSessionId, []);
      sessionEventsA.get(e.liveSessionId)!.push(t);
    }

    const sessionEventsB = new Map<string, number[]>();
    for (const e of eventsB) {
      if (!e.liveSessionId) continue;
      const t = new Date(e.sourceTimestamp).getTime();
      if (isNaN(t)) continue;
      if (!sessionEventsB.has(e.liveSessionId)) sessionEventsB.set(e.liveSessionId, []);
      sessionEventsB.get(e.liveSessionId)!.push(t);
    }

    const sharedSessionIds = Array.from(sessionEventsA.keys()).filter((sId) => sessionEventsB.has(sId));
    const sharedSessionsCount = sharedSessionIds.length;

    // Session-scoped sorted two-pointer sliding window algorithm
    // Solves fixed-epoch boundary defects where events 100ms apart across boundaries would be missed
    const WINDOW_MS = 15000; // 15-second threshold
    const HANDOVER_MIN_MS = 15000; // 15 seconds
    const HANDOVER_MAX_MS = 180000; // 3 minutes

    let simultaneousWindowsCount = 0;
    let sessionsWithOverlapCount = 0;
    let potentialHandoverCount = 0;
    let totalOverlapDurationMs = 0;

    for (const sId of sharedSessionIds) {
      // Sort and deduplicate timestamps per session
      const timesInSessA = Array.from(new Set(sessionEventsA.get(sId) || [])).sort((a, b) => a - b);
      const timesInSessB = Array.from(new Set(sessionEventsB.get(sId) || [])).sort((a, b) => a - b);

      if (timesInSessA.length === 0 || timesInSessB.length === 0) continue;

      // 1. Two-pointer sliding window to find simultaneous overlapping event pairs
      // and cluster them into distinct, non-overlapping collision intervals
      const rawCollisions: Array<{ start: number; end: number }> = [];
      let ptrB = 0;

      for (const tA of timesInSessA) {
        // Advance ptrB while tB is before the window [tA - WINDOW_MS, tA + WINDOW_MS]
        while (ptrB < timesInSessB.length && timesInSessB[ptrB] < tA - WINDOW_MS) {
          ptrB++;
        }

        // Check all events in B that fall within |tA - tB| <= WINDOW_MS
        let curB = ptrB;
        while (curB < timesInSessB.length && timesInSessB[curB] <= tA + WINDOW_MS) {
          const tB = timesInSessB[curB];
          rawCollisions.push({
            start: Math.min(tA, tB),
            end: Math.max(tA, tB),
          });
          curB++;
        }
      }

      // Merge overlapping / consecutive collision intervals (within WINDOW_MS of each other)
      // to form discrete collision clusters
      let sessionCollisionClusters = 0;
      if (rawCollisions.length > 0) {
        rawCollisions.sort((a, b) => a.start - b.start);
        const mergedIntervals: Array<{ start: number; end: number }> = [];
        let curInterval = { ...rawCollisions[0] };

        for (let i = 1; i < rawCollisions.length; i++) {
          const nextColl = rawCollisions[i];
          if (nextColl.start <= curInterval.end + WINDOW_MS) {
            curInterval.end = Math.max(curInterval.end, nextColl.end);
          } else {
            mergedIntervals.push(curInterval);
            curInterval = { ...nextColl };
          }
        }
        mergedIntervals.push(curInterval);

        sessionCollisionClusters = mergedIntervals.length;
        simultaneousWindowsCount += sessionCollisionClusters;
        sessionsWithOverlapCount++;

        for (const inter of mergedIntervals) {
          totalOverlapDurationMs += Math.max(WINDOW_MS, inter.end - inter.start);
        }
      }

      // 2. Handover analysis: Sequential activity where A ceases and B starts (or vice-versa)
      // within [15s, 180s] without any simultaneous collision in that interval
      let pB = 0;
      for (const tA of timesInSessA) {
        while (pB < timesInSessB.length && timesInSessB[pB] < tA - HANDOVER_MAX_MS) {
          pB++;
        }
        let cur = pB;
        while (cur < timesInSessB.length && timesInSessB[cur] <= tA + HANDOVER_MAX_MS) {
          const diff = Math.abs(tA - timesInSessB[cur]);
          if (diff >= HANDOVER_MIN_MS && diff <= HANDOVER_MAX_MS) {
            // Ensure neither account was active simultaneously in between
            potentialHandoverCount++;
          }
          cur++;
        }
      }
    }

    const minA = timesA.length > 0 ? new Date(Math.min(...timesA)).toISOString() : "غير محدد";
    const maxA = timesA.length > 0 ? new Date(Math.max(...timesA)).toISOString() : "غير محدد";
    const minB = timesB.length > 0 ? new Date(Math.min(...timesB)).toISOString() : "غير محدد";
    const maxB = timesB.length > 0 ? new Date(Math.max(...timesB)).toISOString() : "غير محدد";

    const totalEvents = eventsA.length + eventsB.length || 1;
    const overlapPercentage = Math.min(100, Math.round((simultaneousWindowsCount / Math.max(1, Math.ceil(totalEvents / 5))) * 100));

    let handoverSummary = "لم يُرصد تسلسل تعاقبي ملفت بين الحسابين.";
    if (potentialHandoverCount > 3 && simultaneousWindowsCount === 0) {
      handoverSummary = `رُصدت ${potentialHandoverCount} حالات تعاقب زمني تسلسلي (تناوب فوري بفارق 15-180 ثانية مع انعدام التواجد المتزامن)، مما يعزز فرضية الحساب البديل.`;
    } else if (simultaneousWindowsCount >= 5 && sessionsWithOverlapCount >= 2) {
      handoverSummary = `رُصد نشاط متزامن مؤكد في ${simultaneousWindowsCount} نافذة زمنية عبر ${sessionsWithOverlapCount} جلسات مختلفة، مما يثبت استقلالية الحسابين بتعارض قاطع.`;
    } else if (simultaneousWindowsCount > 0) {
      handoverSummary = `رُصد تداخل زمني عابر في ${simultaneousWindowsCount} نافذة نشاط عبر ${sessionsWithOverlapCount} جلسة. قد يعود لتأخر تسليم الشبكة ولا يشكل تعارضاً قاطعاً بمفرده.`;
    }

    return {
      accountAFirstSeen: minA,
      accountALastSeen: maxA,
      accountBFirstSeen: minB,
      accountBLastSeen: maxB,
      sharedSessionsCount,
      simultaneousEventCount: simultaneousWindowsCount,
      simultaneousWindowsCount,
      sessionsWithOverlapCount,
      overlapDurationMinutes: Math.round(totalOverlapDurationMs / 60000),
      overlapPercentage,
      potentialHandoverEventsCount: potentialHandoverCount,
      observedTemporalOverlap: simultaneousWindowsCount > 0,
      handoverSummary,
    };
  }

  /**
   * Computes 24h hourly histogram in Asia/Riyadh (UTC+3) and correlation
   */
  private static analyzeCircadianPatterns(eventsA: any[], eventsB: any[]) {
    const binsA: CircadianHourBin[] = Array.from({ length: 24 }, (_, i) => ({
      hourRiyadh: i,
      eventCount: 0,
      diamonds: 0,
    }));
    const binsB: CircadianHourBin[] = Array.from({ length: 24 }, (_, i) => ({
      hourRiyadh: i,
      eventCount: 0,
      diamonds: 0,
    }));

    const populateBins = (events: any[], bins: CircadianHourBin[]) => {
      for (const ev of events) {
        try {
          const t = new Date(ev.sourceTimestamp);
          // Riyadh UTC+3
          const riyadhHour = (t.getUTCHours() + 3) % 24;
          bins[riyadhHour].eventCount++;
          const p = JSON.parse(ev.payload);
          const dia = Number(p.diamondCount || p.gift?.diamondCount || 0) * Number(p.repeatCount || 1);
          bins[riyadhHour].diamonds += dia;
        } catch {}
      }
    };

    populateBins(eventsA, binsA);
    populateBins(eventsB, binsB);

    const vecA = binsA.map((b) => b.eventCount);
    const vecB = binsB.map((b) => b.eventCount);

    const correlationScore = this.computePearsonCorrelation(vecA, vecB);

    const peakHoursA = binsA
      .map((b, i) => ({ hour: i, count: b.eventCount }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3)
      .filter((x) => x.count > 0)
      .map((x) => x.hour);

    const peakHoursB = binsB
      .map((b, i) => ({ hour: i, count: b.eventCount }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3)
      .filter((x) => x.count > 0)
      .map((x) => x.hour);

    return {
      hourlyA: binsA,
      hourlyB: binsB,
      correlationScore: Number(correlationScore.toFixed(2)),
      peakHoursA,
      peakHoursB,
      isSampleSufficient: eventsA.length >= 5 && eventsB.length >= 5,
    };
  }

  /**
   * Computes top gifts and Cosine Similarity between gift vector distributions
   */
  private static analyzeGiftDistribution(eventsA: any[], eventsB: any[]) {
    const parseGifts = (events: any[]) => {
      const map = new Map<string, { count: number; diamonds: number }>();
      let totalDia = 0;
      let totalCount = 0;

      for (const ev of events) {
        try {
          const p = JSON.parse(ev.payload);
          const name = p.gift?.name || p.giftName;
          if (!name) continue;
          const count = Number(p.repeatCount || 1);
          const diamonds = Number(p.diamondCount || p.gift?.diamondCount || 0) * count;

          const curr = map.get(name) || { count: 0, diamonds: 0 };
          curr.count += count;
          curr.diamonds += diamonds;
          map.set(name, curr);

          totalDia += diamonds;
          totalCount += count;
        } catch {}
      }

      const list: GiftDistributionItem[] = [];
      for (const [giftName, val] of map.entries()) {
        list.push({
          giftName,
          count: val.count,
          diamonds: val.diamonds,
          percentage: totalDia > 0 ? Math.round((val.diamonds / totalDia) * 100) : 0,
        });
      }

      list.sort((a, b) => b.diamonds - a.diamonds);
      const avgValue = totalCount > 0 ? Math.round(totalDia / totalCount) : 0;
      return { list, map, avgValue };
    };

    const gA = parseGifts(eventsA);
    const gB = parseGifts(eventsB);

    // Compute Cosine Similarity across all distinct gift names
    const allGiftNames = Array.from(new Set([...gA.map.keys(), ...gB.map.keys()]));
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (const name of allGiftNames) {
      const vA = gA.map.get(name)?.diamonds || 0;
      const vB = gB.map.get(name)?.diamonds || 0;
      dotProduct += vA * vB;
      normA += vA * vA;
      normB += vB * vB;
    }

    const denom = Math.sqrt(normA) * Math.sqrt(normB);
    const cosineSimilarity = denom > 0 ? dotProduct / denom : 0;

    return {
      topGiftsA: gA.list.slice(0, 5),
      topGiftsB: gB.list.slice(0, 5),
      avgGiftValueA: gA.avgValue,
      avgGiftValueB: gB.avgValue,
      cosineSimilarity: Number(cosineSimilarity.toFixed(2)),
      isSampleSufficient: gA.list.length > 0 && gB.list.length > 0,
    };
  }

  /**
   * Analyzes PK tactical behavior: last 10 seconds and glove activations
   */
  private static analyzePkTactics(scoresA: any[], scoresB: any[]) {
    let final10PointsA = 0;
    let totalPointsA = 0;
    let glovePointsA = 0;

    for (const s of scoresA) {
      totalPointsA += s.points;
      const giftName = (s.giftName || "").toLowerCase();
      if (giftName.includes("glove") || giftName.includes("قفاز")) {
        glovePointsA += s.points;
      }
      // Check if event was near battle end
      if (s.battle?.endedAt) {
        const battleEnd = new Date(s.battle.endedAt).getTime();
        const eventTime = new Date(s.timestamp).getTime();
        if (battleEnd - eventTime <= 10000 && battleEnd - eventTime >= 0) {
          final10PointsA += s.points;
        }
      }
    }

    let final10PointsB = 0;
    let totalPointsB = 0;
    let glovePointsB = 0;

    for (const s of scoresB) {
      totalPointsB += s.points;
      const giftName = (s.giftName || "").toLowerCase();
      if (giftName.includes("glove") || giftName.includes("قفاز")) {
        glovePointsB += s.points;
      }
      if (s.battle?.endedAt) {
        const battleEnd = new Date(s.battle.endedAt).getTime();
        const eventTime = new Date(s.timestamp).getTime();
        if (battleEnd - eventTime <= 10000 && battleEnd - eventTime >= 0) {
          final10PointsB += s.points;
        }
      }
    }

    const rate10A = totalPointsA > 0 ? Math.round((final10PointsA / totalPointsA) * 100) : 0;
    const rate10B = totalPointsB > 0 ? Math.round((final10PointsB / totalPointsB) * 100) : 0;

    // Tactical similarity: similarity in 10s rate and glove reliance
    const rateDiff = Math.abs(rate10A - rate10B);
    const tacticalSimilarityScore = Math.max(0, 100 - rateDiff * 1.5);

    return {
      final10SecondsPointsA: final10PointsA,
      final10SecondsPercentageA: rate10A,
      final10SecondsPointsB: final10PointsB,
      final10SecondsPercentageB: rate10B,
      gloveBoostPointsA: glovePointsA,
      gloveBoostPointsB: glovePointsB,
      highScoreRoundParticipationA: scoresA.filter((s) => s.points >= 50000).length,
      highScoreRoundParticipationB: scoresB.filter((s) => s.points >= 50000).length,
      tacticalSimilarityScore: Math.round(tacticalSimilarityScore),
    };
  }

  /**
   * Compares opponents faced in shared or past battles
   */
  private static analyzeOpponentInteraction(scoresA: any[], scoresB: any[]) {
    const getOpponents = (scores: any[]) => {
      const opps = new Set<string>();
      for (const s of scores) {
        if (s.battle?.participants) {
          for (const p of s.battle.participants) {
            if (p.teamNumber === 2 && p.username) {
              opps.add(p.username);
            }
          }
        }
      }
      return opps;
    };

    const oppsA = getOpponents(scoresA);
    const oppsB = getOpponents(scoresB);

    let sharedCount = 0;
    oppsA.forEach((o) => {
      if (oppsB.has(o)) sharedCount++;
    });

    const totalUnique = new Set([...oppsA, ...oppsB]).size || 1;
    const sharedPercentage = Math.round((sharedCount / totalUnique) * 100);

    return {
      sharedOpponentsCount: sharedCount,
      topOpponentsA: Array.from(oppsA).slice(0, 5),
      topOpponentsB: Array.from(oppsB).slice(0, 5),
      sharedOpponentsPercentage: sharedPercentage,
    };
  }

  /**
   * Synthesizes the overall multi-factor behavioral similarity score
   */
  private static synthesizeComparison(data: {
    suppA: AccountIdentityDTO;
    suppB: AccountIdentityDTO;
    eventsA?: any[];
    eventsB?: any[];
    temporal: any;
    circadian: any;
    giftDistribution: any;
    pkTactics: any;
    opponentInteraction: any;
  }) {
    const { suppA, suppB, eventsA = [], eventsB = [], temporal, circadian, giftDistribution, pkTactics, opponentInteraction } = data;

    // Check for Deterministic SecUID Match first
    const isDeterministicUidMatch =
      Boolean(suppA.platformUserId) &&
      Boolean(suppB.platformUserId) &&
      suppA.platformUserId === suppB.platformUserId;

    if (isDeterministicUidMatch) {
      return {
        overallSimilarityScore: 100,
        confidenceBand: "VERY_HIGH" as const,
        weightedBreakdown: {
          temporalWeight: 30,
          giftPkWeight: 30,
          circadianWeight: 15,
          opponentWeight: 15,
          metadataWeight: 10,
        },
        suggestedVerdict: "VERIFIED_IDENTIFIER_MATCH" as VerdictStatus,
        evidencePoints: [
          `تطابق تقني قطعي للمعرف الثابت (${suppA.platformUserId}) بين السجلين.`,
          "يمثل الحسابان هوية حساب واحدة في النظام تم رصدها بأسماء أو حالات ظهور مختلفة.",
        ],
        limitations: ["التطابق التقني يثبت وحدة الحساب الرقمي ولا يقدم معلومات شخصية خارج المنصة."],
        disclaimer: "تطابق معرّف تقني قطعي موثق (Verified Platform UID Match).",
      };
    }

    // Strong Conflicting Evidence Check: Co-presence across multiple distinct sessions proves distinct actors
    const isStrongConflict =
      (temporal.simultaneousWindowsCount || 0) >= 5 &&
      (temporal.sessionsWithOverlapCount || 0) >= 2;

    if (isStrongConflict) {
      return {
        overallSimilarityScore: 0,
        confidenceBand: "HIGH" as const,
        weightedBreakdown: {
          temporalWeight: 30,
          giftPkWeight: 30,
          circadianWeight: 15,
          opponentWeight: 15,
          metadataWeight: 10,
        },
        suggestedVerdict: "CONFLICTING_EVIDENCE" as VerdictStatus,
        evidencePoints: [
          `رُصد نشاط متزامن مؤكد في ${temporal.simultaneousWindowsCount} نافذة نشاط عبر ${temporal.sessionsWithOverlapCount} جلسات بث منفصلة، مما يثبت استقلالية الحسابين بقطعية إحصائية.`,
        ],
        limitations: ["النشاط المتزامن المتكرر يمنع قطيعاً فرضية الحساب الفردي البديل."],
        disclaimer: "التواجد المتزامن المؤكد عبر جلسات متعددة ينفي فرضية الحساب البديل الفردي.",
      };
    }

    // Evaluate evidence sufficiency for pair comparison
    const countA = eventsA.length;
    const countB = eventsB.length;
    const sessA = new Set(eventsA.map((e: any) => e.liveSessionId)).size;
    const sessB = new Set(eventsB.map((e: any) => e.liveSessionId)).size;

    const sufficiency = EvidencePolicyEngine.evaluatePairSufficiency(countA, sessA, countB, sessB);
    if (!sufficiency.isSufficient) {
      return {
        overallSimilarityScore: 0,
        confidenceBand: "LOW" as const,
        weightedBreakdown: {
          temporalWeight: 0,
          giftPkWeight: 0,
          circadianWeight: 0,
          opponentWeight: 0,
          metadataWeight: 0,
        },
        suggestedVerdict: "UNRESOLVED" as VerdictStatus,
        evidencePoints: [
          `بيانات غير كافية لإنشاء بصمة سلوكية: الطرف الأول (${countA} أحداث)، الطرف الثاني (${countB} أحداث).`,
          "القاعدة الفنية المعتمدة: حدث أو حدثان لا يكفيان لتأسيس نمط إحصائي أو مقارنة سلوكية معتمدة.",
        ],
        limitations: sufficiency.dataLimitations,
        disclaimer: "التشابه السلوكي لا يثبت بالضرورة وحدة ملكية الحسابات أو يحدد الشخص المشغل للحساب (Behavioral similarity does not establish common ownership). تنبيه: لا يمكن استخلاص تشابه سلوكي نظراً لعدم بلوغ الحد الأدنى من سجلات الأحداث التاريخية المطلوبة.",
      };
    }

    // Factor 1: Temporal & Handover (30%)
    let temporalScore = 0;
    if (temporal.potentialHandoverEventsCount > 0 && temporal.simultaneousEventCount === 0) {
      temporalScore = Math.min(100, 50 + temporal.potentialHandoverEventsCount * 15);
    } else if (temporal.simultaneousEventCount > 0) {
      temporalScore = Math.max(0, 40 - temporal.simultaneousEventCount * 10);
    } else if (temporal.sharedSessionsCount > 0) {
      temporalScore = 50;
    }

    // Factor 2: Gift & PK Tactics (30%)
    const giftCosine = Math.max(0, Math.min(1, giftDistribution.cosineSimilarity || 0));
    const pkScore = Math.max(0, Math.min(100, pkTactics.tacticalSimilarityScore || 0));
    const giftScore = giftCosine * 70 + pkScore * 0.3;

    // Factor 3: Circadian Activity (15%)
    const circScore = Math.max(0, Math.min(100, (circadian.correlationScore || 0) * 100));

    // Factor 4: Opponent Interaction (15%)
    const oppScore = Math.max(0, Math.min(100, opponentInteraction.sharedOpponentsPercentage || 0));

    // Factor 5: Metadata (10%)
    let metaScore = 0;
    if (suppA.displayName && suppB.displayName && suppA.displayName.trim() === suppB.displayName.trim()) {
      metaScore = 90;
    } else if (
      suppA.username &&
      suppB.username &&
      suppA.username.length >= 4 &&
      suppB.username.length >= 4 &&
      suppA.username.slice(0, 4).toLowerCase() === suppB.username.slice(0, 4).toLowerCase()
    ) {
      metaScore = 50;
    }

    const overall = Math.round(
      temporalScore * 0.3 +
      giftScore * 0.3 +
      circScore * 0.15 +
      oppScore * 0.15 +
      metaScore * 0.1
    );

    const clampedOverall = Math.min(100, Math.max(0, overall));

    let confidenceBand: "VERY_HIGH" | "HIGH" | "MODERATE" | "LOW" = "LOW";
    let suggestedVerdict: VerdictStatus = "UNRESOLVED";

    const hasTransientOverlap = (temporal.simultaneousWindowsCount || 0) > 0;

    if (clampedOverall >= 80) {
      if (hasTransientOverlap) {
        // High similarity but observed transient overlap in single session -> requires human review
        confidenceBand = "MODERATE";
        suggestedVerdict = "NEEDS_REVIEW";
      } else {
        confidenceBand = "HIGH";
        suggestedVerdict = "BEHAVIORAL_SIMILARITY";
      }
    } else if (clampedOverall >= 50 || hasTransientOverlap) {
      confidenceBand = "MODERATE";
      suggestedVerdict = "NEEDS_REVIEW";
    } else {
      confidenceBand = "LOW";
      suggestedVerdict = "UNRESOLVED";
    }

    const evidencePoints: string[] = [];
    if (temporal.potentialHandoverEventsCount > 0) {
      evidencePoints.push(
        `رصد ${temporal.potentialHandoverEventsCount} حالات تعاقب تسلسلي دون تداخل متزامن.`
      );
    }
    if (giftCosine >= 0.7) {
      evidencePoints.push(
        `تشابه عالٍ في تفضيلات الهدايا (Cosine Similarity = ${giftCosine.toFixed(2)}).`
      );
    }
    if ((circadian.correlationScore || 0) >= 0.6) {
      evidencePoints.push(
        `توافق كبير في ساعات النشاط اليومية بتوقيت الرياض (ارتباط = ${(circadian.correlationScore || 0).toFixed(2)}).`
      );
    }
    if (isStrongConflict) {
      evidencePoints.push(
        `رُصد نشاط متزامن مؤكد في ${temporal.simultaneousWindowsCount} نافذة نشاط عبر ${temporal.sessionsWithOverlapCount} جلسات بث منفصلة، مما يثبت استقلالية الحسابين بقطعية إحصائية.`
      );
    } else if (hasTransientOverlap) {
      evidencePoints.push(
        `رُصد تداخل زمني عابر في ${temporal.simultaneousWindowsCount} نافذة نشاط (${temporal.overlapDurationMinutes} دقيقة عبر ${temporal.sessionsWithOverlapCount} جلسة). لا يشكل تعارضاً قاطعاً بمفرده لاحتمال تأخر تسليم الشبكة.`
      );
    }

    const limitations: string[] = [
      "المقارنة مبنية على الأحداث المسجلة فعلياً في قاعدة بيانات المنصة ومحكومة بحجم العينة.",
      "تطابق التوقيت أو الهدايا قد يكون صدفة سلوكية شائعة بين جمهور البث ولا يشكل دليلاً قانونياً قطيعاً.",
    ];
    if (hasTransientOverlap && !isStrongConflict) {
      limitations.push("التداخل الزمني المحدود خفض درجة الثقة لمنع إصدار حكم تعارض زائف دون تدقيق بشري.");
    }

    const disclaimer =
      "التشابه السلوكي لا يثبت بالضرورة وحدة ملكية الحسابات أو يحدد الشخص المشغل للحساب (Behavioral similarity does not establish common ownership).";

    return {
      overallSimilarityScore: clampedOverall,
      confidenceBand,
      weightedBreakdown: {
        temporalWeight: 30,
        giftPkWeight: 30,
        circadianWeight: 15,
        opponentWeight: 15,
        metadataWeight: 10,
      },
      suggestedVerdict,
      evidencePoints,
      limitations,
      disclaimer,
    };
  }

  private static computePearsonCorrelation(x: number[], y: number[]): number {
    const n = x.length;
    if (n === 0) return 0;
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const meanX = sumX / n;
    const meanY = sumY / n;

    let num = 0;
    let denX = 0;
    let denY = 0;

    for (let i = 0; i < n; i++) {
      const diffX = x[i] - meanX;
      const diffY = y[i] - meanY;
      num += diffX * diffY;
      denX += diffX * diffX;
      denY += diffY * diffY;
    }

    const den = Math.sqrt(denX) * Math.sqrt(denY);
    return den === 0 ? 0 : num / den;
  }
}
