import { prisma } from "./prisma";

export interface SupporterPresenceOptions {
  tenantId: string;
  minDiamonds?: number; // default 100,000
  supporterId?: string; // optional single supporter filter
  inactivityGapMinutes?: number; // default 25
  startDate?: Date;
  endDate?: Date;
}

export interface ObservedSession {
  sessionId: string;
  liveSessionId: string;
  startedAt: Date;
  endedAt: Date;
  durationMinutes: number;
  eventCount: number;
  eventTypes: string[];
  isMultiEvent: boolean;
  quality: "COMPLETE" | "PARTIAL" | "SINGLE_EVENT";
  firstActivityType: string;
  lastActivityType: string;
}

export interface HourlyPresenceBucket {
  hour: number; // 0..23 in Asia/Riyadh
  hourLabel: string;
  eventCount: number;
  sessionStartsCount: number;
  percentage: number;
}

export interface WeekdayPresenceBucket {
  day: number; // 0..6 (0=Sunday, 6=Saturday)
  dayName: string;
  eventCount: number;
  sessionStartsCount: number;
  percentage: number;
}

export type EvidenceQualityState =
  | "INSUFFICIENT_DATA"
  | "INITIAL_PATTERN"
  | "RECURRENT_PATTERN"
  | "STABLE_PATTERN";

export interface SupporterPresenceAnalysis {
  supporter: {
    id: string;
    platformUserId: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
    totalDiamonds: number;
    firstObservedAt: Date;
    lastObservedAt: Date;
    category: string;
  };
  totalEventsCount: number;
  distinctBroadcastsCount: number;
  distinctSessionsCount: number;
  multiEventSessionsCount: number;
  sessionDuration: {
    avgMinutes: number | null;
    medianMinutes: number | null;
    minMinutes: number | null;
    maxMinutes: number | null;
    distribution: {
      under15m: number;
      from15to45m: number;
      from45to90m: number;
      over90m: number;
    };
  };
  peakHours: number[];
  peakHourFormatted: string;
  peakWeekdays: number[];
  peakWeekdayFormatted: string;
  firstObservedFormatted: string;
  lastObservedFormatted: string;
  lastObservedEvent: {
    eventType: string;
    timestamp: Date;
    liveSessionId: string;
  } | null;
  hourlyDistribution: HourlyPresenceBucket[];
  weekdayDistribution: WeekdayPresenceBucket[];
  evidenceQuality: EvidenceQualityState;
  evidenceQualityLabel: string;
  presenceStability: string;
  operationalInsight: string;
  sessionsList: ObservedSession[];
}

const ARABIC_WEEKDAYS = [
  "الأحد",
  "الاثنين",
  "الثلاثاء",
  "الأربعاء",
  "الخميس",
  "الجمعة",
  "السبت",
];

// In-memory cache for fast sub-second report retrieval
interface PresenceCacheEntry {
  timestamp: number;
  data: SupporterPresenceAnalysis[];
}

const presenceReportCache = new Map<string, PresenceCacheEntry>();
const CACHE_TTL_MS = 60 * 1000; // 60 seconds

export class SupporterPresenceEngine {
  /**
   * Clears the presence cache (e.g. for testing or fresh reload).
   */
  static clearCache(): void {
    presenceReportCache.clear();
  }

  /**
   * Converts a given Date to Asia/Riyadh hour (0..23) and day of week (0..6, Sunday=0).
   */
  static getRiyadhHourAndDay(date: Date): { hour: number; dayOfWeek: number; formattedRiyadh: string } {
    // We format using Intl.DateTimeFormat in Asia/Riyadh timezone
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Riyadh",
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      weekday: "narrow",
    });

    const parts = formatter.formatToParts(date);
    const partMap: Record<string, string> = {};
    for (const p of parts) {
      partMap[p.type] = p.value;
    }

    const hour = parseInt(partMap.hour || "0", 10) % 24;

    // Determine day of week in Asia/Riyadh
    const dateInRiyadhStr = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Riyadh",
    }).format(date); // YYYY-MM-DD
    const [y, m, d] = dateInRiyadhStr.split("-").map(Number);
    // Construct local midnight to get getDay()
    const riyadhDateObj = new Date(y, m - 1, d);
    const dayOfWeek = riyadhDateObj.getDay(); // 0 is Sunday

    const formattedRiyadh = new Intl.DateTimeFormat("ar-SA", {
      timeZone: "Asia/Riyadh",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    }).format(date);

    return { hour, dayOfWeek, formattedRiyadh };
  }

  /**
   * Formats an hour integer (0..23) into an Arabic 12-hour or range string in Asia/Riyadh.
   */
  static formatHourBucket(hour: number): string {
    const startHour12 = hour % 12 === 0 ? 12 : hour % 12;
    const endHour = (hour + 1) % 24;
    const endHour12 = endHour % 12 === 0 ? 12 : endHour % 12;
    const startPeriod = hour < 12 ? "ص" : "م";
    const endPeriod = endHour < 12 ? "ص" : "م";
    return `${startHour12}:00 ${startPeriod} - ${endHour12}:00 ${endPeriod}`;
  }

  /**
   * Reconstructs candidate observation sessions for a list of raw chronological events.
   * Enforces:
   * 1. Sessions NEVER cross different broadcast IDs (liveSessionId).
   * 2. Inactivity gap (e.g. 25 minutes) splits consecutive events in the same broadcast.
   * 3. Do not invent departure times; single events have duration 0.
   */
  static reconstructSessions(
    events: Array<{
      id: string;
      liveSessionId: string;
      eventType: string;
      sourceTimestamp: Date;
    }>,
    inactivityGapMinutes: number = 25
  ): ObservedSession[] {
    if (!events || events.length === 0) return [];

    const inactivityGapMs = inactivityGapMinutes * 60 * 1000;
    const sessions: ObservedSession[] = [];

    // Group events strictly by liveSessionId
    const eventsByBroadcast = new Map<string, typeof events>();
    for (const ev of events) {
      if (!eventsByBroadcast.has(ev.liveSessionId)) {
        eventsByBroadcast.set(ev.liveSessionId, []);
      }
      eventsByBroadcast.get(ev.liveSessionId)!.push(ev);
    }

    // Process each broadcast separately
    let sessionCounter = 1;
    for (const [liveSessionId, bEvents] of eventsByBroadcast.entries()) {
      // Sort chronologically
      bEvents.sort((a, b) => a.sourceTimestamp.getTime() - b.sourceTimestamp.getTime());

      let currentSessionEvents: typeof events = [bEvents[0]];

      for (let i = 1; i < bEvents.length; i++) {
        const prev = bEvents[i - 1];
        const curr = bEvents[i];
        const timeDiff = curr.sourceTimestamp.getTime() - prev.sourceTimestamp.getTime();

        if (timeDiff > inactivityGapMs) {
          // Finalize current session
          sessions.push(this.createSessionObject(sessionCounter++, liveSessionId, currentSessionEvents));
          currentSessionEvents = [curr];
        } else {
          currentSessionEvents.push(curr);
        }
      }

      if (currentSessionEvents.length > 0) {
        sessions.push(this.createSessionObject(sessionCounter++, liveSessionId, currentSessionEvents));
      }
    }

    // Sort all sessions by startedAt ascending
    return sessions.sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime());
  }

  private static createSessionObject(
    index: number,
    liveSessionId: string,
    events: Array<{ id: string; eventType: string; sourceTimestamp: Date }>
  ): ObservedSession {
    const startedAt = events[0].sourceTimestamp;
    const endedAt = events[events.length - 1].sourceTimestamp;
    const durationMinutes = Math.round((endedAt.getTime() - startedAt.getTime()) / 60000);
    const eventTypes = Array.from(new Set(events.map((e) => e.eventType)));
    const isMultiEvent = events.length > 1;

    return {
      sessionId: `SES-${liveSessionId.slice(-6)}-${index}`,
      liveSessionId,
      startedAt,
      endedAt,
      durationMinutes,
      eventCount: events.length,
      eventTypes,
      isMultiEvent,
      quality: isMultiEvent ? "COMPLETE" : "SINGLE_EVENT",
      firstActivityType: events[0].eventType,
      lastActivityType: events[events.length - 1].eventType,
    };
  }

  /**
   * Analyzes presence pattern for a single supporter given their events.
   */
  static analyzeSupporterPresence(
    supporter: {
      id: string;
      platformUserId: string;
      username: string;
      displayName: string;
      avatarUrl: string | null;
      totalDiamonds: number;
      firstObservedAt: Date;
      lastObservedAt: Date;
      category: string;
    },
    rawEvents: Array<{
      id: string;
      liveSessionId: string;
      eventType: string;
      sourceTimestamp: Date;
    }>,
    inactivityGapMinutes: number = 25
  ): SupporterPresenceAnalysis {
    // 1. Reconstruct sessions
    const sessionsList = this.reconstructSessions(rawEvents, inactivityGapMinutes);

    // 2. Distinct broadcasts
    const broadcastSet = new Set<string>();
    rawEvents.forEach((e) => broadcastSet.add(e.liveSessionId));
    const distinctBroadcastsCount = broadcastSet.size;
    const distinctSessionsCount = sessionsList.length;

    // 3. Multi-event sessions duration analysis
    const multiEventSessions = sessionsList.filter((s) => s.isMultiEvent && s.durationMinutes > 0);
    const multiEventSessionsCount = multiEventSessions.length;

    let avgMinutes: number | null = null;
    let medianMinutes: number | null = null;
    let minMinutes: number | null = null;
    let maxMinutes: number | null = null;

    const distribution = {
      under15m: 0,
      from15to45m: 0,
      from45to90m: 0,
      over90m: 0,
    };

    if (multiEventSessions.length > 0) {
      const durations = multiEventSessions.map((s) => s.durationMinutes).sort((a, b) => a - b);
      const totalDur = durations.reduce((sum, d) => sum + d, 0);
      avgMinutes = Math.round(totalDur / durations.length);
      minMinutes = durations[0];
      maxMinutes = durations[durations.length - 1];

      const mid = Math.floor(durations.length / 2);
      medianMinutes =
        durations.length % 2 !== 0
          ? durations[mid]
          : Math.round((durations[mid - 1] + durations[mid]) / 2);

      for (const d of durations) {
        if (d < 15) distribution.under15m++;
        else if (d <= 45) distribution.from15to45m++;
        else if (d <= 90) distribution.from45to90m++;
        else distribution.over90m++;
      }
    }

    // 4. Hourly distribution (0..23 in Asia/Riyadh)
    const hourlyCounts = new Array(24).fill(0);
    const hourlySessionStarts = new Array(24).fill(0);

    for (const ev of rawEvents) {
      const { hour } = this.getRiyadhHourAndDay(ev.sourceTimestamp);
      hourlyCounts[hour]++;
    }

    for (const ses of sessionsList) {
      const { hour } = this.getRiyadhHourAndDay(ses.startedAt);
      hourlySessionStarts[hour]++;
    }

    const totalRawCount = rawEvents.length;
    const hourlyDistribution: HourlyPresenceBucket[] = [];
    for (let h = 0; h < 24; h++) {
      const count = hourlyCounts[h];
      hourlyDistribution.push({
        hour: h,
        hourLabel: this.formatHourBucket(h),
        eventCount: count,
        sessionStartsCount: hourlySessionStarts[h],
        percentage: totalRawCount > 0 ? Math.round((count / totalRawCount) * 100) : 0,
      });
    }

    // Find top peak hours
    const sortedHours = [...hourlyDistribution]
      .filter((b) => b.eventCount > 0)
      .sort((a, b) => b.eventCount - a.eventCount);

    const peakHours: number[] = [];
    if (sortedHours.length > 0) {
      peakHours.push(sortedHours[0].hour);
      if (sortedHours.length > 1 && sortedHours[1].eventCount >= sortedHours[0].eventCount * 0.6) {
        peakHours.push(sortedHours[1].hour);
      }
    }

    let peakHourFormatted = "بيانات غير كافية";
    if (peakHours.length > 0) {
      peakHourFormatted = peakHours.map((h) => this.formatHourBucket(h)).join(" ، ");
    }

    // 5. Weekday distribution (0..6, 0=Sunday)
    const weekdayCounts = new Array(7).fill(0);
    const weekdaySessionStarts = new Array(7).fill(0);

    for (const ev of rawEvents) {
      const { dayOfWeek } = this.getRiyadhHourAndDay(ev.sourceTimestamp);
      weekdayCounts[dayOfWeek]++;
    }

    for (const ses of sessionsList) {
      const { dayOfWeek } = this.getRiyadhHourAndDay(ses.startedAt);
      weekdaySessionStarts[dayOfWeek]++;
    }

    const weekdayDistribution: WeekdayPresenceBucket[] = [];
    for (let d = 0; d < 7; d++) {
      const count = weekdayCounts[d];
      weekdayDistribution.push({
        day: d,
        dayName: ARABIC_WEEKDAYS[d],
        eventCount: count,
        sessionStartsCount: weekdaySessionStarts[d],
        percentage: totalRawCount > 0 ? Math.round((count / totalRawCount) * 100) : 0,
      });
    }

    // Top peak weekdays
    const sortedWeekdays = [...weekdayDistribution]
      .filter((w) => w.eventCount > 0)
      .sort((a, b) => b.eventCount - a.eventCount);

    const peakWeekdays: number[] = [];
    if (sortedWeekdays.length > 0) {
      peakWeekdays.push(sortedWeekdays[0].day);
      if (sortedWeekdays.length > 1 && sortedWeekdays[1].eventCount >= sortedWeekdays[0].eventCount * 0.7) {
        peakWeekdays.push(sortedWeekdays[1].day);
      }
    }

    let peakWeekdayFormatted = "بيانات غير كافية";
    if (peakWeekdays.length > 0) {
      peakWeekdayFormatted = peakWeekdays.map((d) => ARABIC_WEEKDAYS[d]).join(" ، ");
    }

    // 6. Timestamps formatting
    const firstObservedFormatted = this.getRiyadhHourAndDay(supporter.firstObservedAt).formattedRiyadh;
    const lastObservedFormatted = this.getRiyadhHourAndDay(supporter.lastObservedAt).formattedRiyadh;

    const lastObservedEvent =
      rawEvents.length > 0
        ? {
            eventType: rawEvents[rawEvents.length - 1].eventType,
            timestamp: rawEvents[rawEvents.length - 1].sourceTimestamp,
            liveSessionId: rawEvents[rawEvents.length - 1].liveSessionId,
          }
        : null;

    // 7. Evidence Quality Classification
    let evidenceQuality: EvidenceQualityState = "INSUFFICIENT_DATA";
    let evidenceQualityLabel = "بيانات غير كافية";
    let presenceStability = "غير مستقر / قيد الرصد";

    if (totalRawCount < 3 || distinctSessionsCount < 2) {
      evidenceQuality = "INSUFFICIENT_DATA";
      evidenceQualityLabel = "بيانات غير كافية";
      presenceStability = "سجل الأنشطة غير كافٍ لاستخراج نمط إحصائي موثوق";
    } else if (distinctSessionsCount < 5 || distinctBroadcastsCount < 3) {
      evidenceQuality = "INITIAL_PATTERN";
      evidenceQualityLabel = "نمط أولي";
      presenceStability = "نمط حضور أولي قيد التبلور مع تكرار جلسات محدود";
    } else if (distinctSessionsCount < 12 || multiEventSessionsCount < 5) {
      evidenceQuality = "RECURRENT_PATTERN";
      evidenceQualityLabel = "نمط متكرر";
      presenceStability = "نمط حضور متكرر بنوافذ نشاط متسقة إحصائياً";
    } else {
      evidenceQuality = "STABLE_PATTERN";
      evidenceQualityLabel = "نمط مستقر نسبيًا";
      presenceStability = "نمط راسخ وثابت عبر البثوث المتعددة بدقة عالية";
    }

    // 8. Honest Operational Insight in Arabic
    let operationalInsight = "";
    if (evidenceQuality === "INSUFFICIENT_DATA") {
      operationalInsight = `الداعم لديه إجمالي ${totalRawCount} حدث مرصود فقط عبر ${distinctBroadcastsCount} بث. لا يمكن الجزم بنافذة زمنية مؤكدة لتواجده حالياً دون تجميع عينات إضافية.`;
    } else {
      const avgDurationText =
        avgMinutes !== null ? `بمتوسط نافذة تفاعل تقارب ${avgMinutes} دقيقة` : "كنقاط حضور سريعة ومتقطعة";
      operationalInsight = `يتركز تواجد الداعم بصورة رئيسية خلال فترات (${peakHourFormatted}) خصوصاً يوم ${peakWeekdayFormatted}، ${avgDurationText} عبر ${distinctBroadcastsCount} جلسة بث مختلفة.`;
    }

    return {
      supporter,
      totalEventsCount: totalRawCount,
      distinctBroadcastsCount,
      distinctSessionsCount,
      multiEventSessionsCount,
      sessionDuration: {
        avgMinutes,
        medianMinutes,
        minMinutes,
        maxMinutes,
        distribution,
      },
      peakHours,
      peakHourFormatted,
      peakWeekdays,
      peakWeekdayFormatted,
      firstObservedFormatted,
      lastObservedFormatted,
      lastObservedEvent,
      hourlyDistribution,
      weekdayDistribution,
      evidenceQuality,
      evidenceQualityLabel,
      presenceStability,
      operationalInsight,
      sessionsList,
    };
  }

  /**
   * Retrieves and computes presence pattern analyses for all eligible supporters.
   */
  static async getPresencePatternsReport(
    options: SupporterPresenceOptions,
    forceFresh: boolean = false
  ): Promise<SupporterPresenceAnalysis[]> {
    const {
      tenantId,
      minDiamonds = 100000,
      supporterId,
      inactivityGapMinutes = 25,
      startDate,
      endDate,
    } = options;

    const cacheKey = `${tenantId}_${minDiamonds}_${supporterId || "ALL"}_${inactivityGapMinutes}_${startDate?.getTime() || 0}_${endDate?.getTime() || 0}`;
    const cached = presenceReportCache.get(cacheKey);
    const now = Date.now();

    if (!forceFresh && cached && now - cached.timestamp < CACHE_TTL_MS) {
      return cached.data;
    }

    // 1. Fetch eligible supporters by authoritative metric: totalDiamonds
    const supporterWhere: any = {
      tenantId,
      totalDiamonds: { gte: minDiamonds },
    };

    if (supporterId) {
      supporterWhere.id = supporterId;
    }

    const supporters = await prisma.supporter.findMany({
      where: supporterWhere,
      orderBy: { totalDiamonds: "desc" },
    });

    if (supporters.length === 0) {
      return [];
    }

    // 2. Fetch events per supporter efficiently using deduplicationKey index concurrently
    const dateFilter: any = {};
    if (startDate) dateFilter.gte = startDate;
    if (endDate) dateFilter.lte = endDate;

    // Process supporters in chunks of 5 to avoid SQLite connection pool congestion
    const chunkSize = 5;
    const analyses: SupporterPresenceAnalysis[] = [];

    for (let i = 0; i < supporters.length; i += chunkSize) {
      const chunk = supporters.slice(i, i + chunkSize);
      const chunkResults = await Promise.all(
        chunk.map(async (supporter) => {
          const rawEventWhere: any = {
            deduplicationKey: { contains: `_${supporter.platformUserId}_` },
          };

          if (Object.keys(dateFilter).length > 0) {
            rawEventWhere.sourceTimestamp = dateFilter;
          }

          const events = await prisma.rawEvent.findMany({
            where: rawEventWhere,
            select: {
              id: true,
              liveSessionId: true,
              eventType: true,
              sourceTimestamp: true,
            },
            orderBy: { sourceTimestamp: "asc" },
          });

          return this.analyzeSupporterPresence(
            supporter,
            events,
            inactivityGapMinutes
          );
        })
      );
      analyses.push(...chunkResults);
    }

    // Cache computed results
    presenceReportCache.set(cacheKey, { timestamp: now, data: analyses });

    return analyses;
  }
}
