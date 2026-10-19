import { prisma } from "./prisma";
import {
  RadarAlertDTO,
  RadarTriggerCategory,
  RadarSeverity,
  WatchlistEntryDTO,
} from "./intelligence-types";

interface ActorPayload {
  platformUserId: string;
  username: string;
  displayName: string;
  avatarUrl?: string | null;
}

interface EvaluationContext {
  tenantId: string;
  liveSessionId?: string | null;
  activeBattleId?: string | null;
  activeBattleOpponents?: string[];
}

export class EnigmaRadarService {
  // In-memory watchlist cache: tenantId -> Map<identifierOrUsername, WatchlistEntry>
  private static watchlistCache = new Map<string, Map<string, WatchlistEntryDTO>>();
  private static watchlistLastLoaded = new Map<string, number>();

  // In-memory cooldown cache: key -> expireTimestampMs
  private static cooldownCache = new Map<string, number>();

  // In-memory recent entrance tracker for handover detection: tenantId -> Array<{ id, username, diamonds, time }>
  private static recentEntrances = new Map<
    string,
    Array<{ platformUserId: string; username: string; totalDiamonds: number; timestamp: number }>
  >();

  /**
   * Initializes or refreshes tenant watchlists into fast memory cache.
   */
  static async refreshWatchlistCache(tenantId: string): Promise<number> {
    try {
      const entries = await prisma.intelligenceWatchlist.findMany({
        where: { tenantId, isActive: true },
      });

      const map = new Map<string, WatchlistEntryDTO>();
      for (const e of entries) {
        const dto: WatchlistEntryDTO = {
          id: e.id,
          platformUserId: e.platformUserId,
          username: e.username,
          displayName: e.displayName,
          reason: e.reason,
          category: e.category,
          severity: (e.severity as RadarSeverity) || "MEDIUM",
          isActive: e.isActive,
          notifyOnEntry: e.notifyOnEntry,
          createdAt: e.createdAt.toISOString(),
        };

        if (e.platformUserId) {
          map.set(e.platformUserId.toLowerCase(), dto);
        }
        if (e.username) {
          map.set(e.username.toLowerCase(), dto);
        }
      }

      this.watchlistCache.set(tenantId, map);
      this.watchlistLastLoaded.set(tenantId, Date.now());
      return entries.length;
    } catch (err: any) {
      console.warn(`[ENIGMA_RADAR] Failed to refresh watchlist cache: ${err?.message}`);
      return 0;
    }
  }

  /**
   * Clears in-memory caches and cooldowns (useful for tests and manual resets).
   */
  static clearCache(tenantId?: string): void {
    if (tenantId) {
      this.watchlistCache.delete(tenantId);
      this.watchlistLastLoaded.delete(tenantId);
      this.recentEntrances.delete(tenantId);
    } else {
      this.watchlistCache.clear();
      this.watchlistLastLoaded.clear();
      this.cooldownCache.clear();
      this.recentEntrances.clear();
    }
  }

  /**
   * Evaluates an observed account entry in real time.
   * Runs completely non-blocking, sub-millisecond memory checks first.
   */
  static async evaluateEntrance(
    actor: ActorPayload,
    context: EvaluationContext
  ): Promise<RadarAlertDTO | null> {
    const { tenantId, liveSessionId, activeBattleId, activeBattleOpponents } = context;
    if (!actor.platformUserId || actor.platformUserId.startsWith("guest_")) {
      return null;
    }

    const normUid = actor.platformUserId.toLowerCase();
    const normUsername = (actor.username || "").toLowerCase();

    // 1. Ensure Watchlist cache is populated
    const cacheAge = Date.now() - (this.watchlistLastLoaded.get(tenantId) || 0);
    if (!this.watchlistCache.has(tenantId) || cacheAge > 60000) {
      await this.refreshWatchlistCache(tenantId);
    }
    const tenantWatchlist = this.watchlistCache.get(tenantId);

    // 2. Fetch or query existing Supporter record in DB
    const existingSupporter = await prisma.supporter.findUnique({
      where: {
        tenantId_platformUserId: {
          tenantId,
          platformUserId: actor.platformUserId,
        },
      },
      select: {
        id: true,
        username: true,
        displayName: true,
        avatarUrl: true,
        totalDiamonds: true,
        lastObservedAt: true,
      },
    });

    let triggerCategory: RadarTriggerCategory | null = null;
    let severity: RadarSeverity = "INFO";
    let summaryText = "";
    const details: Record<string, any> = {
      actor,
      evaluatedAt: new Date().toISOString(),
      timezone: "Asia/Riyadh",
    };

    // TRIGGER CHECK 1: Watchlist Match (Highest Priority)
    const matchedWatchlist =
      tenantWatchlist?.get(normUid) ||
      (normUsername ? tenantWatchlist?.get(normUsername) : undefined);

    if (matchedWatchlist && matchedWatchlist.notifyOnEntry) {
      triggerCategory = "WATCHLIST_MATCH";
      severity = matchedWatchlist.severity || "HIGH";
      summaryText = `🎯 رصد حساب موضوع تحت المراقبة: @${actor.username} — السبب: ${matchedWatchlist.reason}`;
      details.watchlist = matchedWatchlist;
    }

    // TRIGGER CHECK 2: Public Metadata / Alias Change (Stable SecUID / UID)
    if (!triggerCategory && existingSupporter) {
      const usernameChanged =
        actor.username &&
        existingSupporter.username &&
        actor.username.toLowerCase() !== existingSupporter.username.toLowerCase();
      const displayNameChanged =
        actor.displayName &&
        existingSupporter.displayName &&
        actor.displayName !== existingSupporter.displayName;

      if (usernameChanged || displayNameChanged) {
        triggerCategory = "METADATA_CHANGE";
        severity = "NOTICE";
        summaryText = `🔄 رصد تغيير في الهوية العلنية للمعرف الثابت (${actor.platformUserId}): `;
        if (usernameChanged) {
          summaryText += `اليوزر تغير من (@${existingSupporter.username}) إلى (@${actor.username}). `;
        }
        if (displayNameChanged) {
          summaryText += `الاسم تغير من (${existingSupporter.displayName}) إلى (${actor.displayName}).`;
        }

        details.previousMetadata = {
          username: existingSupporter.username,
          displayName: existingSupporter.displayName,
          avatarUrl: existingSupporter.avatarUrl,
        };
        details.newMetadata = {
          username: actor.username,
          displayName: actor.displayName,
          avatarUrl: actor.avatarUrl,
        };

        // Persist alias history record asynchronously
        prisma.intelligenceAliasHistory
          .create({
            data: {
              tenantId,
              supporterId: existingSupporter.id,
              platformUserId: actor.platformUserId,
              previousUsername: existingSupporter.username,
              newUsername: actor.username,
              previousDisplayName: existingSupporter.displayName,
              newDisplayName: actor.displayName,
              previousAvatarUrl: existingSupporter.avatarUrl,
              newAvatarUrl: actor.avatarUrl,
              changeType: usernameChanged ? "USERNAME_CHANGE" : "DISPLAY_NAME_CHANGE",
              source: "LIVE_EVENT",
            },
          })
          .catch((err) => console.warn(`[ENIGMA_RADAR] Alias log notice: ${err?.message}`));
      }
    }

    // TRIGGER CHECK 3: Active PK Opponent Supporter Context
    if (!triggerCategory && activeBattleId && activeBattleOpponents && activeBattleOpponents.length > 0) {
      // Check if this supporter previously scored on opponent teams in past battles
      const opponentBattleScores = await prisma.battleScoreEvent.count({
        where: {
          supporter: { platformUserId: actor.platformUserId, tenantId },
          teamNumber: 2, // Opponent team
        },
      });

      if (opponentBattleScores > 0) {
        triggerCategory = "OPPONENT_SUPPORTER";
        severity = "WARNING";
        summaryText = `⚠️ رصد دخول داعم مسجل في سجلات الخصوم: @${actor.username} بالتزامن مع النزال النشط!`;
        details.opponentScoresCount = opponentBattleScores;
        details.activeBattleId = activeBattleId;
        details.opponents = activeBattleOpponents;
      }
    }

    // TRIGGER CHECK 4: Potential Session Handover (15s - 180s inactivity gap)
    if (!triggerCategory) {
      const entrances = this.recentEntrances.get(tenantId) || [];
      const now = Date.now();
      // Look for a preceding high-value account that went silent 15-180 seconds ago
      const recentCandidate = entrances.find(
        (e) =>
          e.platformUserId !== actor.platformUserId &&
          e.totalDiamonds >= 50000 &&
          now - e.timestamp >= 15000 &&
          now - e.timestamp <= 180000
      );

      if (recentCandidate && (existingSupporter?.totalDiamonds || 0) >= 10000) {
        triggerCategory = "POTENTIAL_HANDOVER";
        severity = "NOTICE";
        summaryText = `⏳ تسلسل زمني متعاقب (Handover Correlation): رصد دخول @${actor.username} بعد توقف @${recentCandidate.username} بفارق ${Math.round((now - recentCandidate.timestamp) / 1000)} ثانية.`;
        details.handover = {
          precedingAccount: recentCandidate,
          intervalSeconds: Math.round((now - recentCandidate.timestamp) / 1000),
          interpretationNote: "ارتباط زمني تعاقبي فقط لا يثبت الملكية الشخصية المشتركة.",
        };
      }
    }

    // TRIGGER CHECK 5: Known Returning High-Impact Supporter
    if (!triggerCategory && existingSupporter && existingSupporter.totalDiamonds >= 50000) {
      triggerCategory = "KNOWN_ACCOUNT_ENTRY";
      severity = existingSupporter.totalDiamonds >= 200000 ? "WARNING" : "INFO";
      summaryText = `💎 عودة داعم رئيسي: @${actor.username} (إجمالي الدعم المسجل: ${existingSupporter.totalDiamonds.toLocaleString()} 💎).`;
      details.totalDiamonds = existingSupporter.totalDiamonds;
    }

    // Record this entrance into recent entrances sliding window
    const currentList = this.recentEntrances.get(tenantId) || [];
    currentList.unshift({
      platformUserId: actor.platformUserId,
      username: actor.username,
      totalDiamonds: existingSupporter?.totalDiamonds || 0,
      timestamp: Date.now(),
    });
    // Keep max 25 items
    if (currentList.length > 25) currentList.pop();
    this.recentEntrances.set(tenantId, currentList);

    if (!triggerCategory) {
      return null;
    }

    // 3. Cooldown & Deduplication Verification (Default 30 minutes)
    const cooldownKey = `${tenantId}_${actor.platformUserId}_${triggerCategory}`;
    const cooldownUntil = this.cooldownCache.get(cooldownKey) || 0;
    if (Date.now() < cooldownUntil) {
      // Cooldown active, suppress repeated notification
      return null;
    }

    // Set cooldown for 30 minutes
    const cooldownDurationMs = 30 * 60 * 1000;
    this.cooldownCache.set(cooldownKey, Date.now() + cooldownDurationMs);

    // 4. Persist alert to database
    try {
      const createdAlert = await prisma.intelligenceRadarAlert.create({
        data: {
          tenantId,
          liveSessionId: liveSessionId || null,
          supporterId: existingSupporter?.id || null,
          platformUserId: actor.platformUserId,
          username: actor.username,
          displayName: actor.displayName,
          triggerCategory,
          severity,
          summaryText,
          detailsJson: JSON.stringify(details),
          reviewStatus: "NEW",
        },
      });

      const alertDTO: RadarAlertDTO = {
        id: createdAlert.id,
        liveSessionId: createdAlert.liveSessionId,
        platformUserId: createdAlert.platformUserId,
        username: createdAlert.username,
        displayName: createdAlert.displayName,
        triggerCategory: createdAlert.triggerCategory as RadarTriggerCategory,
        severity: createdAlert.severity as RadarSeverity,
        summaryText: createdAlert.summaryText,
        details,
        reviewStatus: "NEW",
        telegramSent: false,
        createdAt: createdAlert.createdAt.toISOString(),
      };

      // 5. Trigger Telegram Alert asynchronously if configured
      this.dispatchTelegramRadarAlert(tenantId, alertDTO).catch(() => {});

      return alertDTO;
    } catch (err: any) {
      console.warn(`[ENIGMA_RADAR] Failed to persist radar alert: ${err?.message}`);
      return null;
    }
  }

  /**
   * Dispatches radar notification to Telegram if enabled in settings
   */
  private static async dispatchTelegramRadarAlert(
    tenantId: string,
    alert: RadarAlertDTO
  ): Promise<void> {
    try {
      const settings = await prisma.intelligenceSettings.findUnique({
        where: { tenantId },
      });

      if (settings && !settings.telegramRadarAlerts) {
        return;
      }

      const { TelegramService } = await import("./telegram-service");
      await TelegramService.sendRadarAlert(tenantId, alert);
    } catch (err: any) {
      console.warn(`[ENIGMA_RADAR] Telegram radar dispatch notice: ${err?.message}`);
    }
  }

  /**
   * Fetches latest radar alerts with optional filtering
   */
  static async getRecentAlerts(params: {
    tenantId: string;
    limit?: number;
    triggerCategory?: RadarTriggerCategory;
    reviewStatus?: string;
  }): Promise<RadarAlertDTO[]> {
    const { tenantId, limit = 50, triggerCategory, reviewStatus } = params;

    const alerts = await prisma.intelligenceRadarAlert.findMany({
      where: {
        tenantId,
        ...(triggerCategory ? { triggerCategory } : {}),
        ...(reviewStatus ? { reviewStatus } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return alerts.map((a) => {
      let details = {};
      try {
        details = JSON.parse(a.detailsJson);
      } catch {}

      return {
        id: a.id,
        liveSessionId: a.liveSessionId,
        platformUserId: a.platformUserId,
        username: a.username,
        displayName: a.displayName,
        triggerCategory: a.triggerCategory as RadarTriggerCategory,
        severity: a.severity as RadarSeverity,
        summaryText: a.summaryText,
        details,
        reviewStatus: a.reviewStatus as any,
        telegramSent: a.telegramSent,
        createdAt: a.createdAt.toISOString(),
      };
    });
  }
}
