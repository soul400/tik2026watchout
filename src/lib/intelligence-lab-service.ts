import { prisma } from "./prisma";
import {
  CommandCenterOverviewDTO,
  AccountIdentityDTO,
  AliasHistoryItemDTO,
  WatchlistEntryDTO,
  RadarAlertDTO,
  InvestigationCaseDTO,
  IntelligenceSettingsDTO,
  VerdictStatus,
} from "./intelligence-types";
import { EnigmaRadarService } from "./enigma-radar-service";
import { AntiSnipePredictorService } from "./anti-snipe-predictor-service";
import { EnigmaEngine } from "./enigma-engine";
import { EvidencePolicyEngine } from "./evidence-policy";

export class IntelligenceLabService {
  /**
   * Generates the real-time Command Center telemetry overview
   */
  static async getCommandCenterOverview(tenantId: string): Promise<CommandCenterOverviewDTO> {
    // 1. Live Stream Status
    const activeSession = await prisma.liveSession.findFirst({
      where: { tenantId, status: "LIVE" },
      orderBy: { startedAt: "desc" },
    });

    const streamer = await prisma.streamerAccount.findFirst({
      where: { tenantId },
      select: { username: true, displayName: true },
    });

    // 2. Active Battle & Tactical Anti-Snipe State
    const activeBattle = await prisma.battle.findFirst({
      where: { tenantId, status: "IN_PROGRESS" },
      include: {
        participants: true,
      },
    });

    let battleData = null;
    if (activeBattle) {
      const oppUsernames = activeBattle.participants
        .filter((p) => p.teamNumber === 2)
        .map((p) => p.username);

      const prediction = await AntiSnipePredictorService.evaluateBattleRisk(tenantId, {
        battleId: activeBattle.id,
        battleType: activeBattle.battleType as any,
        team1Score: activeBattle.team1Score,
        team2Score: activeBattle.team2Score,
        opponentUsernames: oppUsernames,
        timeRemainingSeconds: 45,
      });

      battleData = {
        isActive: true,
        battleId: activeBattle.id,
        battleType: activeBattle.battleType,
        team1Score: activeBattle.team1Score,
        team2Score: activeBattle.team2Score,
        scoreDifference: activeBattle.team1Score - activeBattle.team2Score,
        timeRemainingSeconds: 45,
        threatLevel: prediction.threatLevel,
        snipeRiskScore: prediction.snipeRiskScore,
      };
    }

    // 3. Counts & Metrics
    const [
      monitoredSupportersCount,
      activeWatchlistCount,
      enigmaReviewsPendingCount,
      enigmaReviewsConfirmedCount,
      verifiedAliasChangesCount,
      recentAlerts,
      pendingCases,
      lastHealthLog,
    ] = await Promise.all([
      prisma.supporter.count({ where: { tenantId } }),
      prisma.intelligenceWatchlist.count({ where: { tenantId, isActive: true } }),
      prisma.enigmaReview.count({ where: { tenantId, status: "PENDING" } }),
      prisma.enigmaReview.count({ where: { tenantId, status: "CONFIRMED" } }),
      prisma.intelligenceAliasHistory.count({ where: { tenantId } }),
      EnigmaRadarService.getRecentAlerts({ tenantId, limit: 10 }),
      prisma.intelligenceInvestigationCase.findMany({
        where: { tenantId },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
      prisma.streamHealthLog.findFirst({
        where: { tenantId },
        orderBy: { timestamp: "desc" },
      }),
    ]);

    const criticalThreatsCount = recentAlerts.filter(
      (a) => a.severity === "CRITICAL" || a.severity === "WARNING"
    ).length;

    const dataFreshnessSeconds = lastHealthLog?.lastEventAt
      ? Math.max(0, Math.round((Date.now() - new Date(lastHealthLog.lastEventAt).getTime()) / 1000))
      : 5;

    return {
      liveStatus: {
        isConnected: activeSession !== null,
        streamer: streamer ? `@${streamer.username}` : "@mohra.2000",
        activeSessionId: activeSession?.id || null,
        peakViewers: activeSession?.peakViewers || 0,
        totalDiamonds: activeSession?.totalDiamonds || 0,
        dataConfidence: activeSession?.dataConfidence || "VERIFIED",
      },
      activeBattle: battleData,
      metrics: {
        monitoredSupportersCount,
        activeWatchlistCount,
        enigmaReviewsPendingCount,
        enigmaReviewsConfirmedCount,
        verifiedAliasChangesCount,
        recentRadarAlertsCount: recentAlerts.length,
        criticalThreatsCount,
      },
      recentRadarAlerts: recentAlerts,
      pendingReviewCases: pendingCases.map((c) => ({
        id: c.id,
        caseNumber: c.caseNumber,
        title: c.title,
        primaryPlatformUserId: c.primaryPlatformUserId,
        secondaryPlatformUserId: c.secondaryPlatformUserId,
        verdictStatus: c.verdictStatus as VerdictStatus,
        similarityScore: c.similarityScore,
        evidenceSummary: c.evidenceSummary,
        evidenceDetails: JSON.parse(c.evidenceDetailsJson || "{}"),
        assignedTo: c.assignedTo,
        notes: c.notes,
        createdAt: c.createdAt.toISOString(),
        updatedAt: c.updatedAt.toISOString(),
      })),
      dataFreshnessSeconds,
      lastAnalysisTimestamp: new Date().toISOString(),
    };
  }

  /**
   * Search for supporters by username, display name, or platformUserId
   */
  static async searchAccounts(tenantId: string, query: string, limit = 100): Promise<AccountIdentityDTO[]> {
    const q = (query || "").trim();
    const supporters = await prisma.supporter.findMany({
      where: {
        tenantId,
        ...(q
          ? {
              OR: [
                { username: { contains: q } },
                { displayName: { contains: q } },
                { platformUserId: { contains: q } },
              ],
            }
          : {}),
      },
      orderBy: { totalDiamonds: "desc" },
      take: limit,
    });

    return supporters.map((s) => ({
      id: s.id,
      platformUserId: s.platformUserId,
      username: s.username,
      displayName: s.displayName,
      avatarUrl: s.avatarUrl,
      totalDiamonds: s.totalDiamonds,
      totalLikes: s.totalLikes,
      totalComments: s.totalComments,
      category: s.category,
      firstObservedAt: s.firstObservedAt.toISOString(),
      lastObservedAt: s.lastObservedAt.toISOString(),
      dataConfidence: s.dataConfidence,
      isEnigmaMaskObserved: s.username.toLowerCase().startsWith("enigma"),
    }));
  }

  /**
   * Retrieves full chronological alias and identity transformation history
   */
  static async getAliasHistory(params: {
    tenantId: string;
    platformUserId?: string;
    limit?: number;
  }): Promise<AliasHistoryItemDTO[]> {
    const { tenantId, platformUserId, limit = 50 } = params;

    const histories = await prisma.intelligenceAliasHistory.findMany({
      where: {
        tenantId,
        ...(platformUserId ? { platformUserId } : {}),
      },
      orderBy: { observedAt: "desc" },
      take: limit,
    });

    return histories.map((h) => ({
      id: h.id,
      platformUserId: h.platformUserId,
      previousUsername: h.previousUsername,
      newUsername: h.newUsername,
      previousDisplayName: h.previousDisplayName,
      newDisplayName: h.newDisplayName,
      previousAvatarUrl: h.previousAvatarUrl,
      newAvatarUrl: h.newAvatarUrl,
      changeType: h.changeType,
      source: h.source,
      observedAt: h.observedAt.toISOString(),
    }));
  }

  /**
   * Watchlist operations
   */
  static async getWatchlist(tenantId: string): Promise<WatchlistEntryDTO[]> {
    const entries = await prisma.intelligenceWatchlist.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
    });

    return entries.map((e) => ({
      id: e.id,
      platformUserId: e.platformUserId,
      username: e.username,
      displayName: e.displayName,
      reason: e.reason,
      category: e.category,
      severity: e.severity as any,
      isActive: e.isActive,
      notifyOnEntry: e.notifyOnEntry,
      createdAt: e.createdAt.toISOString(),
    }));
  }

  static async addToWatchlist(
    tenantId: string,
    data: {
      username: string;
      displayName?: string;
      platformUserId?: string;
      reason: string;
      category?: string;
      severity?: string;
    }
  ): Promise<WatchlistEntryDTO> {
    const created = await prisma.intelligenceWatchlist.create({
      data: {
        tenantId,
        username: data.username.replace("@", "").trim(),
        displayName: data.displayName || null,
        platformUserId: data.platformUserId || null,
        reason: data.reason,
        category: data.category || "SUSPECTED_ALT",
        severity: data.severity || "MEDIUM",
        isActive: true,
        notifyOnEntry: true,
      },
    });

    await EnigmaRadarService.refreshWatchlistCache(tenantId);

    return {
      id: created.id,
      platformUserId: created.platformUserId,
      username: created.username,
      displayName: created.displayName,
      reason: created.reason,
      category: created.category,
      severity: created.severity as any,
      isActive: created.isActive,
      notifyOnEntry: created.notifyOnEntry,
      createdAt: created.createdAt.toISOString(),
    };
  }

  static async removeFromWatchlist(tenantId: string, id: string): Promise<boolean> {
    await prisma.intelligenceWatchlist.deleteMany({
      where: { id, tenantId },
    });
    await EnigmaRadarService.refreshWatchlistCache(tenantId);
    return true;
  }

  /**
   * Investigation Cases operations
   */
  static async getInvestigationCases(tenantId: string): Promise<InvestigationCaseDTO[]> {
    const cases = await prisma.intelligenceInvestigationCase.findMany({
      where: { tenantId },
      orderBy: { updatedAt: "desc" },
    });

    return cases.map((c) => ({
      id: c.id,
      caseNumber: c.caseNumber,
      title: c.title,
      primaryPlatformUserId: c.primaryPlatformUserId,
      secondaryPlatformUserId: c.secondaryPlatformUserId,
      verdictStatus: c.verdictStatus as VerdictStatus,
      similarityScore: c.similarityScore,
      evidenceSummary: c.evidenceSummary,
      evidenceDetails: JSON.parse(c.evidenceDetailsJson || "{}"),
      assignedTo: c.assignedTo,
      notes: c.notes,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
    }));
  }

  static async updateCaseStatus(
    tenantId: string,
    caseId: string,
    verdictStatus: VerdictStatus,
    notes?: string,
    reviewedBy?: string
  ): Promise<boolean> {
    const existingCase = await prisma.intelligenceInvestigationCase.findFirst({
      where: { id: caseId, tenantId },
    });
    if (!existingCase) return false;

    let details: Record<string, any> = {};
    try {
      details = JSON.parse(existingCase.evidenceDetailsJson || "{}");
    } catch {}

    const now = new Date();
    details.isManuallyReviewed = true;
    details.reviewedBy = reviewedBy || existingCase.assignedTo || "operator";
    details.reviewedAt = now.toISOString();
    details.manualVerdict = verdictStatus;
    details.reviewProvenance = "MANUAL_OPERATOR_REVIEW";
    if (notes) {
      details.operatorNotes = notes;
    }

    await prisma.intelligenceInvestigationCase.update({
      where: { id: existingCase.id },
      data: {
        verdictStatus,
        assignedTo: reviewedBy || existingCase.assignedTo || "operator",
        notes: notes ? `${notes} (مراجعة يدوية: ${now.toLocaleDateString("ar-SA")})` : existingCase.notes,
        evidenceDetailsJson: JSON.stringify(details),
        updatedAt: now,
      },
    });
    return true;
  }

  /**
   * Settings operations
   */
  static async getSettings(tenantId: string): Promise<IntelligenceSettingsDTO> {
    let settings = await prisma.intelligenceSettings.findUnique({
      where: { tenantId },
    });

    if (!settings) {
      settings = await prisma.intelligenceSettings.create({
        data: {
          tenantId,
          radarEnabled: true,
          telegramRadarAlerts: true,
          notifyWatchlistEntries: true,
          notifyMetadataChanges: true,
          notifyOpponentSupporters: true,
          cooldownMinutes: 30,
          minTacticalRiskAlert: 65,
          minBehavioralSimilarityAlert: 75,
          autoSyncEnigmaOnConnect: true,
        },
      });
    }

    return {
      radarEnabled: settings.radarEnabled,
      telegramRadarAlerts: settings.telegramRadarAlerts,
      notifyWatchlistEntries: settings.notifyWatchlistEntries,
      notifyMetadataChanges: settings.notifyMetadataChanges,
      notifyOpponentSupporters: settings.notifyOpponentSupporters,
      cooldownMinutes: settings.cooldownMinutes,
      minTacticalRiskAlert: settings.minTacticalRiskAlert,
      minBehavioralSimilarityAlert: settings.minBehavioralSimilarityAlert,
      autoSyncEnigmaOnConnect: settings.autoSyncEnigmaOnConnect,
    };
  }

  static async updateSettings(
    tenantId: string,
    newSettings: Partial<IntelligenceSettingsDTO>
  ): Promise<IntelligenceSettingsDTO> {
    const updated = await prisma.intelligenceSettings.upsert({
      where: { tenantId },
      update: {
        ...(newSettings.radarEnabled !== undefined ? { radarEnabled: newSettings.radarEnabled } : {}),
        ...(newSettings.telegramRadarAlerts !== undefined ? { telegramRadarAlerts: newSettings.telegramRadarAlerts } : {}),
        ...(newSettings.notifyWatchlistEntries !== undefined ? { notifyWatchlistEntries: newSettings.notifyWatchlistEntries } : {}),
        ...(newSettings.notifyMetadataChanges !== undefined ? { notifyMetadataChanges: newSettings.notifyMetadataChanges } : {}),
        ...(newSettings.notifyOpponentSupporters !== undefined ? { notifyOpponentSupporters: newSettings.notifyOpponentSupporters } : {}),
        ...(newSettings.cooldownMinutes !== undefined ? { cooldownMinutes: newSettings.cooldownMinutes } : {}),
        ...(newSettings.minTacticalRiskAlert !== undefined ? { minTacticalRiskAlert: newSettings.minTacticalRiskAlert } : {}),
        ...(newSettings.minBehavioralSimilarityAlert !== undefined ? { minBehavioralSimilarityAlert: newSettings.minBehavioralSimilarityAlert } : {}),
        ...(newSettings.autoSyncEnigmaOnConnect !== undefined ? { autoSyncEnigmaOnConnect: newSettings.autoSyncEnigmaOnConnect } : {}),
      },
      create: {
        tenantId,
        radarEnabled: newSettings.radarEnabled ?? true,
        telegramRadarAlerts: newSettings.telegramRadarAlerts ?? true,
        notifyWatchlistEntries: newSettings.notifyWatchlistEntries ?? true,
        notifyMetadataChanges: newSettings.notifyMetadataChanges ?? true,
        notifyOpponentSupporters: newSettings.notifyOpponentSupporters ?? true,
        cooldownMinutes: newSettings.cooldownMinutes ?? 30,
        minTacticalRiskAlert: newSettings.minTacticalRiskAlert ?? 65,
        minBehavioralSimilarityAlert: newSettings.minBehavioralSimilarityAlert ?? 75,
        autoSyncEnigmaOnConnect: newSettings.autoSyncEnigmaOnConnect ?? true,
      },
    });

    return {
      radarEnabled: updated.radarEnabled,
      telegramRadarAlerts: updated.telegramRadarAlerts,
      notifyWatchlistEntries: updated.notifyWatchlistEntries,
      notifyMetadataChanges: updated.notifyMetadataChanges,
      notifyOpponentSupporters: updated.notifyOpponentSupporters,
      cooldownMinutes: updated.cooldownMinutes,
      minTacticalRiskAlert: updated.minTacticalRiskAlert,
      minBehavioralSimilarityAlert: updated.minBehavioralSimilarityAlert,
      autoSyncEnigmaOnConnect: updated.autoSyncEnigmaOnConnect,
    };
  }

  /**
   * Synchronizes existing platform records into the Intelligence Lab:
   * 1. 26 Enigma unmasked accounts -> Watchlist & Investigation Cases & Alias Mutations
   * 2. Top supporters (+10,000 diamonds) -> Watchlist with VIP honor roll classification
   */
  static async syncHistoricalIntelligenceData(tenantId: string): Promise<{
    syncedEnigmaCount: number;
    syncedVipCount: number;
    syncedAliasesCount: number;
    syncedCasesCount: number;
  }> {
    let syncedEnigmaCount = 0;
    let syncedVipCount = 0;
    let syncedAliasesCount = 0;
    let syncedCasesCount = 0;

    // 1. Ensure Enigma reviews exist or sync them
    let reviews = await EnigmaEngine.getEnigmaReviews(tenantId);
    if (reviews.length === 0) {
      await EnigmaEngine.analyzeAndSyncEnigmaReviews(tenantId);
      reviews = await EnigmaEngine.getEnigmaReviews(tenantId);
    }

    // 2. Sync Enigma Accounts (26 accounts) into Watchlist, AliasHistory & Investigation Cases
    for (const r of reviews) {
      const ev = r.evidence;
      if (!ev) continue;

      const pUid = ev.platformUserId;
      const realUser = ev.realUsername || "unknown";
      const realDisplay = ev.realDisplayName || realUser;
      const enigmaUser = ev.enigmaUsername || "Enigma";
      const enigmaDisplay = ev.enigmaDisplayName || enigmaUser;
      const combinedDiamonds = ev.totalCombinedDiamonds || ev.diamondsWithEnigma || 0;

      // Severity calculation based on strategic diamond weight
      const severity =
        combinedDiamonds >= 500000
          ? "CRITICAL"
          : combinedDiamonds >= 50000
          ? "HIGH"
          : "MEDIUM";

      // A. Upsert into IntelligenceWatchlist
      const existingWatch = await prisma.intelligenceWatchlist.findFirst({
        where: {
          tenantId,
          OR: [
            { platformUserId: pUid },
            { username: realUser },
          ],
        },
      });

      const reasonText = `حساب مقنع (${enigmaDisplay}) - كشف SecUID قطعي بدعم ${combinedDiamonds.toLocaleString()} ماسة`;

      if (!existingWatch) {
        await prisma.intelligenceWatchlist.create({
          data: {
            tenantId,
            platformUserId: pUid,
            username: realUser,
            displayName: realDisplay,
            reason: reasonText,
            category: "ENIGMA_ORIGIN",
            severity,
            isActive: true,
            notifyOnEntry: true,
          },
        });
        syncedEnigmaCount++;
      } else {
        await prisma.intelligenceWatchlist.update({
          where: { id: existingWatch.id },
          data: {
            platformUserId: pUid,
            displayName: realDisplay,
            category: "ENIGMA_ORIGIN",
            severity,
            reason: reasonText,
          },
        });
        syncedEnigmaCount++;
      }

      // B. Create Alias History Record for Enigma Mask Disclosure
      const existingAlias = await prisma.intelligenceAliasHistory.findFirst({
        where: {
          tenantId,
          platformUserId: pUid,
          previousUsername: enigmaUser,
        },
      });

      if (!existingAlias) {
        await prisma.intelligenceAliasHistory.create({
          data: {
            tenantId,
            platformUserId: pUid,
            previousUsername: enigmaUser,
            newUsername: realUser,
            previousDisplayName: enigmaDisplay,
            newDisplayName: realDisplay,
            changeType: "ENIGMA_MASK_ACTIVATION",
            source: "HISTORICAL_SYNC",
            observedAt: r.reviewedAt || new Date(),
          },
        });
        syncedAliasesCount++;
      }

      // C. Create Investigation Case for Enigma unmasking
      const caseNumber = `CASE-ENIGMA-${pUid}`;
      const existingCase = await prisma.intelligenceInvestigationCase.findFirst({
        where: {
          tenantId,
          OR: [
            { caseNumber },
            { primaryPlatformUserId: pUid },
          ],
        },
      });

      const isVerifiedUid = ev.classification === "IDENTIFIER_MATCH" && Boolean(pUid);
      const isSparse = (ev.enigmaEventsCount || 0) < 3 && combinedDiamonds === 0;

      let verdictStatus: VerdictStatus = "NEEDS_REVIEW";
      let similarityScore: number | null = null;
      let caseTitle = `استطلاع قناع أنيقما: ${enigmaDisplay}`;
      let evidenceSummary = `حساب مقنع نشط برصيد دعم ${combinedDiamonds.toLocaleString()} ماسة. يتطلب مراجعة استطلاعية لتحديد الحساب الحقيقي المرتبط.`;

      if (isSparse) {
        verdictStatus = "UNRESOLVED";
        similarityScore = null;
        caseTitle = `سجل غير مكتمل: ${enigmaDisplay}`;
        evidenceSummary = `بيانات تاريخية غير كافية: رصيد الدعم 0 ماسة وعدد الأحداث يقل عن الحد الأدنى المعتمد.`;
      } else if (isVerifiedUid) {
        verdictStatus = "VERIFIED_IDENTIFIER_MATCH";
        similarityScore = 100;
        caseTitle = `كشف قناع أنيقما: ${enigmaDisplay} ➔ @${realUser}`;
        evidenceSummary = `تطابق قطعي مثبت رقمياً للمعرف الثابت (SecUID: ${pUid}) بين قناع ${enigmaDisplay} والحساب المعتمد @${realUser} بإجمالي دعم ${combinedDiamonds.toLocaleString()} ماسة.`;
      }

      if (existingCase) {
        let details: Record<string, any> = {};
        try {
          details = JSON.parse(existingCase.evidenceDetailsJson || "{}");
        } catch {}

        const isManual =
          details.isManuallyReviewed === true ||
          details.reviewProvenance === "MANUAL_OPERATOR_REVIEW" ||
          existingCase.assignedTo != null ||
          (Boolean(existingCase.notes) &&
            !existingCase.notes?.startsWith("تم التحديث بواسطة") &&
            !existingCase.notes?.startsWith("تم التوثيق بواسطة") &&
            !existingCase.notes?.startsWith("تمت المزامنة الآلية"));

        if (isManual) {
          // STRICT MANUAL PRESERVATION: do not overwrite human verdicts, scores, title, or notes!
          // BUT refresh technical telemetry metrics inside evidenceDetailsJson so data doesn't go stale
          await prisma.intelligenceInvestigationCase.update({
            where: { id: existingCase.id },
            data: {
              evidenceDetailsJson: JSON.stringify({
                ...details,
                totalCombinedDiamonds: combinedDiamonds,
                diamondsWithEnigma: ev.diamondsWithEnigma,
                diamondsPublic: ev.diamondsPublic,
                enigmaEventsCount: ev.enigmaEventsCount,
                topGifts: ev.topGifts || [],
                evidencePoints: ev.evidencePoints || [],
                telemetryLastRefreshedAt: new Date().toISOString(),
              }),
            },
          });
          syncedCasesCount++;
          continue;
        }

        await prisma.intelligenceInvestigationCase.update({
          where: { id: existingCase.id },
          data: {
            caseNumber,
            title: caseTitle,
            verdictStatus,
            similarityScore,
            evidenceSummary,
            evidenceDetailsJson: JSON.stringify({
              ...details,
              enigmaUsername: enigmaUser,
              enigmaDisplayName: enigmaDisplay,
              realUsername: realUser,
              realDisplayName: realDisplay,
              totalCombinedDiamonds: combinedDiamonds,
              diamondsWithEnigma: ev.diamondsWithEnigma,
              diamondsPublic: ev.diamondsPublic,
              enigmaEventsCount: ev.enigmaEventsCount,
              topGifts: ev.topGifts || [],
              evidencePoints: ev.evidencePoints || [],
              isManuallyReviewed: false,
              reviewProvenance: "AUTOMATED_ANALYSIS",
            }),
            notes: existingCase.notes || "تمت المزامنة الآلية من محرك تحليل الأنيقما بالمنظومة (Analysis Engine 2.0)",
          },
        });
        syncedCasesCount++;
      } else {
        await prisma.intelligenceInvestigationCase.create({
          data: {
            tenantId,
            caseNumber,
            title: caseTitle,
            primaryPlatformUserId: pUid,
            verdictStatus,
            similarityScore,
            evidenceSummary,
            evidenceDetailsJson: JSON.stringify({
              enigmaUsername: enigmaUser,
              enigmaDisplayName: enigmaDisplay,
              realUsername: realUser,
              realDisplayName: realDisplay,
              totalCombinedDiamonds: combinedDiamonds,
              diamondsWithEnigma: ev.diamondsWithEnigma,
              diamondsPublic: ev.diamondsPublic,
              enigmaEventsCount: ev.enigmaEventsCount,
              topGifts: ev.topGifts || [],
              evidencePoints: ev.evidencePoints || [],
              isManuallyReviewed: false,
              reviewProvenance: "AUTOMATED_ANALYSIS",
            }),
            notes: "تمت المزامنة الآلية من محرك تحليل الأنيقما بالمنظومة (Analysis Engine 2.0)",
          },
        });
        syncedCasesCount++;
      }
    }

    // 3. Sync Top Supporters (> 10,000 diamonds - 55 accounts) into Watchlist
    const vipSupporters = await prisma.supporter.findMany({
      where: {
        tenantId,
        totalDiamonds: { gte: 10000 },
      },
      orderBy: { totalDiamonds: "desc" },
    });

    for (const supp of vipSupporters) {
      const existingWatch = await prisma.intelligenceWatchlist.findFirst({
        where: {
          tenantId,
          OR: [
            { platformUserId: supp.platformUserId },
            { username: supp.username },
          ],
        },
      });

      const vipSeverity =
        supp.totalDiamonds >= 1000000
          ? "CRITICAL"
          : supp.totalDiamonds >= 100000
          ? "HIGH"
          : "MEDIUM";

      if (!existingWatch) {
        await prisma.intelligenceWatchlist.create({
          data: {
            tenantId,
            platformUserId: supp.platformUserId,
            username: supp.username,
            displayName: supp.displayName,
            reason: `من كبار داعمي البث (لوحة الشرف +10K ماسة) - إجمالي الدعم المسجل: ${supp.totalDiamonds.toLocaleString()} ماسة 💎`,
            category: "VIP_HONOR_ROLL",
            severity: vipSeverity,
            isActive: true,
            notifyOnEntry: true,
          },
        });
        syncedVipCount++;
      } else {
        // If already in watchlist as ENIGMA, preserve ENIGMA_ORIGIN but enrich notes
        if (existingWatch.category === "ENIGMA_ORIGIN") {
          await prisma.intelligenceWatchlist.update({
            where: { id: existingWatch.id },
            data: {
              reason: `${existingWatch.reason} | لوحة الشرف: ${supp.totalDiamonds.toLocaleString()} ماسة 💎`,
            },
          });
        }
      }
    }

    // 4. Refresh in-memory radar cache
    await EnigmaRadarService.refreshWatchlistCache(tenantId);

    return {
      syncedEnigmaCount,
      syncedVipCount,
      syncedAliasesCount,
      syncedCasesCount,
    };
  }

  /**
   * Deeply analyzes all 26 Enigma accounts and related high-value supporters using real historical database records.
   * Computes exact event counts, session coverage, data sufficiency, and creates or updates investigation cases.
   */
  static async analyzeHistoricalEnigmaAccounts(tenantId: string): Promise<{
    totalAudited: number;
    sufficientDataCount: number;
    insufficientDataCount: number;
    verifiedUidCount: number;
    casesCreatedOrUpdated: number;
    results: Array<{
      platformUserId: string;
      realUsername: string;
      enigmaDisplayName: string;
      diamondsTotal: number;
      rawEventsCount: number;
      battleScoresCount: number;
      totalEventsAnalyzed: number;
      distinctSessionsCount: number;
      dataSufficiency: "SUFFICIENT" | "INSUFFICIENT_DATA";
      verdictStatus: VerdictStatus;
      caseNumber: string;
    }>;
  }> {
    let reviews = await EnigmaEngine.getEnigmaReviews(tenantId);
    if (reviews.length === 0) {
      await EnigmaEngine.analyzeAndSyncEnigmaReviews(tenantId);
      reviews = await EnigmaEngine.getEnigmaReviews(tenantId);
    }

    const results: Array<{
      platformUserId: string;
      realUsername: string;
      enigmaDisplayName: string;
      diamondsTotal: number;
      rawEventsCount: number;
      battleScoresCount: number;
      totalEventsAnalyzed: number;
      distinctSessionsCount: number;
      dataSufficiency: "SUFFICIENT" | "INSUFFICIENT_DATA";
      verdictStatus: VerdictStatus;
      caseNumber: string;
    }> = [];

    let sufficientDataCount = 0;
    let insufficientDataCount = 0;
    let verifiedUidCount = 0;
    let casesCreatedOrUpdated = 0;

    for (const r of reviews) {
      const ev = r.evidence;
      if (!ev) continue;

      const pUid = ev.platformUserId;
      const realUser = ev.realUsername || "unknown";
      const realDisplay = ev.realDisplayName || realUser;
      const enigmaUser = ev.enigmaUsername || "Enigma";
      const enigmaDisplay = ev.enigmaDisplayName || enigmaUser;
      const diamondsTotal = ev.totalCombinedDiamonds || ev.diamondsWithEnigma || 0;

      // 1. Fetch raw events by indexed platformUserId (fallback to deduplicationKey)
      let rawEvents = await prisma.rawEvent.findMany({
        where: {
          liveSession: { tenantId },
          platformUserId: pUid,
        },
        select: {
          id: true,
          liveSessionId: true,
          eventType: true,
          sourceTimestamp: true,
        },
        orderBy: { sourceTimestamp: "asc" },
        take: 1000,
      });

      if (rawEvents.length === 0) {
        rawEvents = await prisma.rawEvent.findMany({
          where: {
            liveSession: { tenantId },
            deduplicationKey: { contains: `_${pUid}_` },
          },
          select: {
            id: true,
            liveSessionId: true,
            eventType: true,
            sourceTimestamp: true,
          },
          orderBy: { sourceTimestamp: "asc" },
          take: 1000,
        });
      }

      // 2. Fetch supporter
      const supp = await prisma.supporter.findFirst({
        where: {
          tenantId,
          OR: [{ platformUserId: pUid }, { username: realUser }],
        },
      });

      // 3. Fetch battle scores
      const battleScores = supp
        ? await prisma.battleScoreEvent.findMany({
            where: { supporterId: supp.id },
            select: { id: true, points: true, timestamp: true },
          })
        : [];

      const sessionIds = new Set<string>();
      rawEvents.forEach((e) => sessionIds.add(e.liveSessionId));
      const distinctSessionsCount = sessionIds.size;

      const rawEventsCount = rawEvents.length;
      const battleScoresCount = battleScores.length;
      const recordedEnigmaEvents = ev.enigmaEventsCount || 0;
      const totalEventsAnalyzed = Math.max(rawEventsCount + battleScoresCount, recordedEnigmaEvents);

      const allTimestamps = [
        ...rawEvents.map((e) => new Date(e.sourceTimestamp).getTime()),
        ...battleScores.map((b) => new Date(b.timestamp).getTime()),
      ].filter((t) => !isNaN(t));

      const firstObserved = allTimestamps.length > 0 ? new Date(Math.min(...allTimestamps)) : supp?.firstObservedAt || null;
      const lastObserved = allTimestamps.length > 0 ? new Date(Math.max(...allTimestamps)) : supp?.lastObservedAt || null;

      const sufficiency = EvidencePolicyEngine.evaluateSingleAccountSufficiency(
        totalEventsAnalyzed,
        distinctSessionsCount,
        diamondsTotal
      );
      const dataSufficiency = sufficiency.status;
      const isVerifiedUid = ev.classification === "IDENTIFIER_MATCH" && Boolean(pUid);

      let verdictStatus: VerdictStatus;
      let similarityScore: number | null;
      let evidenceSummary: string;
      let caseTitle: string;

      if (!sufficiency.isSufficient) {
        insufficientDataCount++;
        verdictStatus = "UNRESOLVED";
        similarityScore = null;
        caseTitle = `سجل غير مكتمل: ${enigmaDisplay}`;
        evidenceSummary = `بيانات تاريخية غير كافية: ${sufficiency.reason}`;
      } else if (isVerifiedUid) {
        sufficientDataCount++;
        verifiedUidCount++;
        verdictStatus = "VERIFIED_IDENTIFIER_MATCH";
        similarityScore = 100;
        caseTitle = `تحليل جنائي قطعي: ${enigmaDisplay} ➔ @${realUser}`;
        evidenceSummary = `تطابق قطعي مثبت رقمياً للمعرف الثابت (SecUID: ${pUid}) بين قناع ${enigmaDisplay} والحساب المعتمد @${realUser} عبر ${totalEventsAnalyzed} حدثاً مرصوداً و ${distinctSessionsCount} جلسة بث، بدعم إجمالي ${diamondsTotal.toLocaleString()} ماسة.`;
      } else {
        sufficientDataCount++;
        verdictStatus = "NEEDS_REVIEW";
        similarityScore = null;
        caseTitle = `استطلاع جنائي لقناع أنيقما: ${enigmaDisplay}`;
        evidenceSummary = `حساب مقنع نشط برصيد دعم ${diamondsTotal.toLocaleString()} ماسة عبر ${totalEventsAnalyzed} حدثاً في ${distinctSessionsCount} جلسة بث. لم يتم ربطه قطعياً بحساب علني حتى الآن ويتطلب مراجعة استطلاعية ومقارنة جنائية مع المرشحين.`;
      }

      // Collision-resistant deterministic case identifier
      const canonicalCaseNumber = `CASE-ENIGMA-${pUid}`;

      // Check existing case to preserve manual investigations
      const existingCase = await prisma.intelligenceInvestigationCase.findFirst({
        where: {
          tenantId,
          OR: [
            { caseNumber: canonicalCaseNumber },
            { primaryPlatformUserId: pUid },
          ],
        },
      });

      let existingDetails: Record<string, any> = {};
      if (existingCase?.evidenceDetailsJson) {
        try {
          existingDetails = JSON.parse(existingCase.evidenceDetailsJson);
        } catch {}
      }

      const isManual =
        existingCase != null &&
        (existingDetails.isManuallyReviewed === true ||
          existingDetails.reviewProvenance === "MANUAL_OPERATOR_REVIEW" ||
          existingCase.assignedTo != null ||
          (Boolean(existingCase.notes) &&
            !existingCase.notes?.startsWith("تم التحديث بواسطة") &&
            !existingCase.notes?.startsWith("تم التوثيق بواسطة") &&
            !existingCase.notes?.startsWith("تمت المزامنة الآلية")));

      if (isManual && existingCase) {
        // Preserve manual reviewer's verdict, title, and score
        verdictStatus = existingCase.verdictStatus as VerdictStatus;
        similarityScore = existingCase.similarityScore;
        caseTitle = existingCase.title;
      }

      const mergedDetails = isManual
        ? {
            ...existingDetails,
            platformUserId: pUid,
            realUsername: realUser,
            realDisplayName: realDisplay,
            enigmaUsername: enigmaUser,
            enigmaDisplayName: enigmaDisplay,
            diamondsTotal,
            diamondsWithEnigma: ev.diamondsWithEnigma,
            diamondsPublic: ev.diamondsPublic,
            rawEventsCount,
            battleScoresCount,
            totalEventsAnalyzed,
            distinctSessionsCount,
            firstObservedAt: firstObserved?.toISOString() || null,
            lastObservedAt: lastObserved?.toISOString() || null,
            topGifts: ev.topGifts || [],
            evidencePoints: ev.evidencePoints || [],
            dataSufficiency,
            limitations: sufficiency.dataLimitations,
            isManuallyPreserved: true,
            telemetryLastRefreshedAt: new Date().toISOString(),
          }
        : {
            platformUserId: pUid,
            realUsername: realUser,
            realDisplayName: realDisplay,
            enigmaUsername: enigmaUser,
            enigmaDisplayName: enigmaDisplay,
            diamondsTotal,
            diamondsWithEnigma: ev.diamondsWithEnigma,
            diamondsPublic: ev.diamondsPublic,
            rawEventsCount,
            battleScoresCount,
            totalEventsAnalyzed,
            distinctSessionsCount,
            firstObservedAt: firstObserved?.toISOString() || null,
            lastObservedAt: lastObserved?.toISOString() || null,
            topGifts: ev.topGifts || [],
            evidencePoints: ev.evidencePoints || [],
            dataSufficiency,
            limitations: sufficiency.dataLimitations,
            isManuallyPreserved: false,
          };

      const casePayload = {
        title: caseTitle,
        primaryPlatformUserId: pUid,
        verdictStatus,
        similarityScore,
        evidenceSummary: isManual && existingCase?.evidenceSummary ? existingCase.evidenceSummary : evidenceSummary,
        evidenceDetailsJson: JSON.stringify(mergedDetails),
      };

      if (existingCase) {
        await prisma.intelligenceInvestigationCase.update({
          where: { id: existingCase.id },
          data: {
            caseNumber: canonicalCaseNumber,
            ...casePayload,
            ...(isManual ? {} : { notes: `تم التحديث بواسطة محرك التحليل الجنائي التاريخي (Analysis Engine 2.0)` }),
          },
        });
      } else {
        await prisma.intelligenceInvestigationCase.create({
          data: {
            tenantId,
            caseNumber: canonicalCaseNumber,
            ...casePayload,
            notes: `تم التوثيق بواسطة محرك التحليل الجنائي التاريخي (Analysis Engine 2.0)`,
          },
        });
      }
      casesCreatedOrUpdated++;

      results.push({
        platformUserId: pUid,
        realUsername: realUser,
        enigmaDisplayName: enigmaDisplay,
        diamondsTotal,
        rawEventsCount,
        battleScoresCount,
        totalEventsAnalyzed,
        distinctSessionsCount,
        dataSufficiency,
        verdictStatus,
        caseNumber: canonicalCaseNumber,
      });
    }

    return {
      totalAudited: reviews.length,
      sufficientDataCount,
      insufficientDataCount,
      verifiedUidCount,
      casesCreatedOrUpdated,
      results,
    };
  }
}

