import { prisma } from "./prisma";

export interface LiveSessionSupporterItem {
  rank: number;
  platformUserId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  sessionDiamonds: number;
  sessionGiftsCount: number;
  latestGiftName: string | null;
  latestGiftTime: string;
  category: string;
  isVip: boolean;
  diamondsRatio: number; // 0 - 100 percentage
}

export interface LiveStreamSupportersData {
  isLive: boolean;
  sessionId: string | null;
  sessionStartedAt: string | null;
  sessionEndedAt: string | null;
  totalSessionDiamonds: number;
  totalSessionGifts: number;
  uniqueSupportersCount: number;
  topSupporters: LiveSessionSupporterItem[];
}

// In-memory cache to guarantee sub-millisecond responses on high-frequency UI polls
interface CacheEntry {
  timestamp: number;
  data: LiveStreamSupportersData;
}
let supportersCache: { [tenantId: string]: CacheEntry } = {};

export class LiveStreamSupportersService {
  /**
   * Retrieves the live supporters who contributed in the CURRENT live stream session.
   * Auto-resets and renews with every new live stream.
   */
  static async getCurrentLiveSupporters(
    tenantId: string,
    limit: number = 50,
    forceFresh: boolean = false
  ): Promise<LiveStreamSupportersData> {
    const now = Date.now();
    const cached = supportersCache[tenantId];

    // 2-second in-memory cache for ultra-fast response
    if (!forceFresh && cached && now - cached.timestamp < 2000) {
      return cached.data;
    }

    // 1. Fetch active LIVE session, or fallback to the most recent session
    let session = await prisma.liveSession.findFirst({
      where: { tenantId, status: "LIVE" },
      orderBy: { startedAt: "desc" },
    });

    const isLive = !!session;

    if (!session) {
      // If no active live session, fetch the most recent ended session to display last stream results
      session = await prisma.liveSession.findFirst({
        where: { tenantId },
        orderBy: { startedAt: "desc" },
      });
    }

    if (!session) {
      const emptyResult: LiveStreamSupportersData = {
        isLive: false,
        sessionId: null,
        sessionStartedAt: null,
        sessionEndedAt: null,
        totalSessionDiamonds: 0,
        totalSessionGifts: 0,
        uniqueSupportersCount: 0,
        topSupporters: [],
      };
      supportersCache[tenantId] = { timestamp: now, data: emptyResult };
      return emptyResult;
    }

    // 2. Fetch all raw GIFT events recorded specifically for THIS live session
    const giftEvents = await prisma.rawEvent.findMany({
      where: {
        liveSessionId: session.id,
        eventType: "GIFT",
      },
      select: {
        payload: true,
        sourceTimestamp: true,
      },
      orderBy: { sourceTimestamp: "asc" },
    });

    // 3. Aggregate gifts per supporter
    const supporterMap = new Map<
      string,
      {
        platformUserId: string;
        username: string;
        displayName: string;
        avatarUrl: string | null;
        sessionDiamonds: number;
        sessionGiftsCount: number;
        latestGiftName: string | null;
        latestGiftTime: Date;
      }
    >();

    let totalDiamondsCalculated = 0;
    let totalGiftsCalculated = 0;

    for (const event of giftEvents) {
      try {
        const payload = JSON.parse(event.payload);
        const user = payload.user || payload;

        const platformUserId = String(
          user.userId ||
          user.userIdStr ||
          user.id ||
          payload.userId ||
          payload.sender_id ||
          user.secUid ||
          ""
        ).trim();

        if (!platformUserId) continue;

        const username = String(
          user.displayId ||
          user.uniqueId ||
          payload.uniqueId ||
          user.username ||
          `user_${platformUserId.slice(-6)}`
        ).trim();

        const displayName = String(
          user.nickName ||
          user.nickname ||
          payload.nickname ||
          username
        ).trim();

        const avatarUrl =
          user.avatarThumb?.urlList?.[0] ||
          user.avatarThumb?.urls?.[0] ||
          user.avatarUrl ||
          null;

        const repeatCount = Number(payload.repeatCount || 1);
        const diamondCount = Number(payload.diamondCount || payload.gift?.diamondCount || 0);
        const diamonds = diamondCount * repeatCount;
        const giftName = String(payload.gift?.name || payload.giftName || "هدية").trim();
        const eventTime = new Date(event.sourceTimestamp);

        totalDiamondsCalculated += diamonds;
        totalGiftsCalculated += repeatCount;

        if (!supporterMap.has(platformUserId)) {
          supporterMap.set(platformUserId, {
            platformUserId,
            username,
            displayName,
            avatarUrl,
            sessionDiamonds: 0,
            sessionGiftsCount: 0,
            latestGiftName: giftName,
            latestGiftTime: eventTime,
          });
        }

        const entry = supporterMap.get(platformUserId)!;
        entry.sessionDiamonds += diamonds;
        entry.sessionGiftsCount += repeatCount;
        entry.latestGiftName = giftName;
        entry.latestGiftTime = eventTime;
        if (avatarUrl && !entry.avatarUrl) {
          entry.avatarUrl = avatarUrl;
        }
        if (displayName && displayName !== username) {
          entry.displayName = displayName;
        }
      } catch {
        // Continue processing other events
      }
    }

    // 4. Also fetch known supporter profiles from DB to enrich categories and clean avatars
    const userIds = Array.from(supporterMap.keys());
    const dbSupporters = await prisma.supporter.findMany({
      where: {
        tenantId,
        platformUserId: { in: userIds },
      },
      select: {
        platformUserId: true,
        displayName: true,
        username: true,
        avatarUrl: true,
        category: true,
        totalDiamonds: true,
      },
    });

    const dbSupporterMap = new Map(dbSupporters.map((s) => [s.platformUserId, s]));

    // 5. Build and sort leaderboard by sessionDiamonds descending
    const sortedRaw = Array.from(supporterMap.values()).sort(
      (a, b) => b.sessionDiamonds - a.sessionDiamonds
    );

    const totalDiamonds = Math.max(session.totalDiamonds, totalDiamondsCalculated);

    const topSupporters: LiveSessionSupporterItem[] = sortedRaw
      .slice(0, limit)
      .map((item, index) => {
        const dbProfile = dbSupporterMap.get(item.platformUserId);
        const isVip = item.sessionDiamonds >= 5000 || (dbProfile?.totalDiamonds || 0) >= 10000;
        const ratio = totalDiamonds > 0 ? (item.sessionDiamonds / totalDiamonds) * 100 : 0;

        let category = "داعم البث";
        if (item.sessionDiamonds >= 20000) {
          category = "حوت الجلسة 🐋";
        } else if (item.sessionDiamonds >= 5000) {
          category = "داعم VIP 👑";
        } else if (item.sessionDiamonds >= 1000) {
          category = "داعم متميز 💎";
        } else if (item.sessionGiftsCount >= 10) {
          category = "داعم مكثف ⚡";
        }

        return {
          rank: index + 1,
          platformUserId: item.platformUserId,
          username: dbProfile?.username || item.username,
          displayName: dbProfile?.displayName || item.displayName,
          avatarUrl: dbProfile?.avatarUrl || item.avatarUrl,
          sessionDiamonds: item.sessionDiamonds,
          sessionGiftsCount: item.sessionGiftsCount,
          latestGiftName: item.latestGiftName,
          latestGiftTime: item.latestGiftTime.toISOString(),
          category,
          isVip,
          diamondsRatio: Math.round(ratio * 10) / 10,
        };
      });

    const result: LiveStreamSupportersData = {
      isLive,
      sessionId: session.id,
      sessionStartedAt: session.startedAt.toISOString(),
      sessionEndedAt: session.endedAt ? session.endedAt.toISOString() : null,
      totalSessionDiamonds: totalDiamonds,
      totalSessionGifts: totalGiftsCalculated,
      uniqueSupportersCount: supporterMap.size,
      topSupporters,
    };

    supportersCache[tenantId] = { timestamp: now, data: result };
    return result;
  }
}
