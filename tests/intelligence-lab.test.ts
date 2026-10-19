import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "../src/lib/prisma";
import { EnigmaRadarService } from "../src/lib/enigma-radar-service";
import { ForensicComparisonService } from "../src/lib/forensic-comparison-service";
import { AntiSnipePredictorService } from "../src/lib/anti-snipe-predictor-service";
import { IntelligenceLabService } from "../src/lib/intelligence-lab-service";
import { ReportsService } from "../src/lib/reports-service";
import { HistoricalBackfillService } from "../src/lib/historical-backfill-service";

describe("LivePulse Intelligence Lab — Unit & Integration Test Suite", () => {
  const TENANT_A = "test-tenant-intel-a";
  const TENANT_B = "test-tenant-intel-b";

  beforeEach(async () => {
    // Setup test tenants
    await prisma.tenant.upsert({
      where: { id: TENANT_A },
      update: {},
      create: {
        id: TENANT_A,
        name: "Intelligence Lab Tenant A",
        slug: "intel-lab-a",
      },
    });

    await prisma.tenant.upsert({
      where: { id: TENANT_B },
      update: {},
      create: {
        id: TENANT_B,
        name: "Intelligence Lab Tenant B",
        slug: "intel-lab-b",
      },
    });

    // Clean up all test tenant data in correct dependency order
    await prisma.intelligenceRadarAlert.deleteMany({
      where: { tenantId: { in: [TENANT_A, TENANT_B] } },
    });
    await prisma.intelligenceWatchlist.deleteMany({
      where: { tenantId: { in: [TENANT_A, TENANT_B] } },
    });
    await prisma.intelligenceInvestigationCase.deleteMany({
      where: { tenantId: { in: [TENANT_A, TENANT_B] } },
    });
    await prisma.intelligenceAliasHistory.deleteMany({
      where: { tenantId: { in: [TENANT_A, TENANT_B] } },
    });
    await prisma.enigmaReview.deleteMany({
      where: { tenantId: { in: [TENANT_A, TENANT_B] } },
    });
    await prisma.rawEvent.deleteMany({
      where: { liveSession: { tenantId: { in: [TENANT_A, TENANT_B] } } },
    });
    await prisma.liveSession.deleteMany({
      where: { tenantId: { in: [TENANT_A, TENANT_B] } },
    });
    await prisma.supporter.deleteMany({
      where: { tenantId: { in: [TENANT_A, TENANT_B] } },
    });

    await prisma.streamerAccount.upsert({
      where: { tenantId_username: { tenantId: TENANT_A, username: "streamer_a" } },
      update: {},
      create: {
        id: "streamer_acct_a",
        tenantId: TENANT_A,
        username: "streamer_a",
        displayName: "مقدم البث أ",
      },
    });
  }, 30000);

  describe("1. Enigma Entry Radar Service", () => {
    it("evaluates entrance for watchlist target and creates radar alert", async () => {
      // Add target to watchlist
      await IntelligenceLabService.addToWatchlist(TENANT_A, {
        platformUserId: "uid_sniper_target_101",
        username: "sniper_pro",
        displayName: "قناص الجولات",
        severity: "CRITICAL",
        reason: "تم رصده في 5 جولات حاسمة سابقة",
        category: "OPPONENT_SNIPER",
      });

      // Clear memory cache to ensure DB sync
      EnigmaRadarService.clearCache();

      const alert = await EnigmaRadarService.evaluateEntrance(
        {
          platformUserId: "uid_sniper_target_101",
          username: "sniper_pro",
          displayName: "قناص الجولات",
        },
        {
          tenantId: TENANT_A,
          liveSessionId: "session_test_radar_01",
        }
      );

      expect(alert).not.toBeNull();
      expect(alert?.triggerCategory).toBe("WATCHLIST_MATCH");
      expect(alert?.severity).toBe("CRITICAL");
      expect(alert?.platformUserId).toBe("uid_sniper_target_101");

      // Verify alert persisted in database
      const dbAlert = await prisma.intelligenceRadarAlert.findFirst({
        where: { tenantId: TENANT_A, platformUserId: "uid_sniper_target_101" },
      });
      expect(dbAlert).not.toBeNull();
      expect(dbAlert?.triggerCategory).toBe("WATCHLIST_MATCH");
    });

    it("respects cooldown threshold and suppresses duplicate alerts within cooldown window", async () => {
      // Add target to watchlist
      await IntelligenceLabService.addToWatchlist(TENANT_A, {
        platformUserId: "uid_cooldown_target_202",
        username: "cooldown_user",
        displayName: "مستخدم التهدئة",
        severity: "HIGH",
        reason: "اختبار فترة التهدئة",
      });

      // Set cooldown in settings
      await prisma.intelligenceSettings.upsert({
        where: { tenantId: TENANT_A },
        update: { cooldownMinutes: 10, radarEnabled: true },
        create: { tenantId: TENANT_A, cooldownMinutes: 10, radarEnabled: true },
      });

      EnigmaRadarService.clearCache();

      // First entrance
      const alert1 = await EnigmaRadarService.evaluateEntrance(
        {
          platformUserId: "uid_cooldown_target_202",
          username: "cooldown_user",
          displayName: "مستخدم التهدئة",
        },
        {
          tenantId: TENANT_A,
          liveSessionId: "session_test_radar_01",
        }
      );
      expect(alert1).not.toBeNull();

      // Second immediate entrance should be suppressed by in-memory cooldown
      const alert2 = await EnigmaRadarService.evaluateEntrance(
        {
          platformUserId: "uid_cooldown_target_202",
          username: "cooldown_user",
          displayName: "مستخدم التهدئة",
        },
        {
          tenantId: TENANT_A,
          liveSessionId: "session_test_radar_01",
        }
      );
      expect(alert2).toBeNull();
    });

    it("enforces tenant isolation on watchlist evaluations", async () => {
      // Target is in Tenant A only
      await IntelligenceLabService.addToWatchlist(TENANT_A, {
        platformUserId: "uid_tenant_a_target",
        username: "user_a",
        displayName: "مستخدم أ",
        severity: "HIGH",
        reason: "داعم مراقب في أ",
      });

      EnigmaRadarService.clearCache();

      // Evaluation in Tenant B should NOT trigger watchlist hit
      const alertB = await EnigmaRadarService.evaluateEntrance(
        {
          platformUserId: "uid_tenant_a_target",
          username: "user_a",
          displayName: "مستخدم أ",
        },
        {
          tenantId: TENANT_B,
          liveSessionId: "session_test_b",
        }
      );

      // Alert in tenant B must be null because target is not in tenant B
      expect(alertB).toBeNull();
    });
  });

  describe("2. Forensic Comparison Service", () => {
    it("returns 100% deterministic confidence when platform user IDs match", async () => {
      // Create supporter
      const supporter = await prisma.supporter.upsert({
        where: { id: "supporter_forensic_uid_test" },
        update: {},
        create: {
          id: "supporter_forensic_uid_test",
          tenantId: TENANT_A,
          platformUserId: "fixed_platform_uid_999",
          username: "account_one",
          displayName: "الحساب الأول",
          totalDiamonds: 50000,
        },
      });

      const comparison = await ForensicComparisonService.compareAccounts({
        tenantId: TENANT_A,
        accountAIdentifier: supporter.id,
        accountBIdentifier: supporter.id,
      });

      expect(comparison).not.toBeNull();
      expect(comparison.synthesis.suggestedVerdict).toBe("VERIFIED_IDENTIFIER_MATCH");
      expect(comparison.synthesis.overallSimilarityScore).toBe(100);
      expect(comparison.synthesis.disclaimer).toContain("تطابق معرّف تقني قطعي موثق");
    });

    it("evaluates behavioral comparison with transparent disclaimer for different accounts", async () => {
      // Supporter Alpha
      const suppAlpha = await prisma.supporter.upsert({
        where: { id: "supporter_forensic_alpha" },
        update: {},
        create: {
          id: "supporter_forensic_alpha",
          tenantId: TENANT_A,
          platformUserId: "uid_alpha_111",
          username: "alpha_supporter",
          displayName: "الداعم ألفا",
          totalDiamonds: 120000,
        },
      });

      // Supporter Beta
      const suppBeta = await prisma.supporter.upsert({
        where: { id: "supporter_forensic_beta" },
        update: {},
        create: {
          id: "supporter_forensic_beta",
          tenantId: TENANT_A,
          platformUserId: "uid_beta_222",
          username: "beta_supporter",
          displayName: "الداعم بيتا",
          totalDiamonds: 85000,
        },
      });

      const comparison = await ForensicComparisonService.compareAccounts({
        tenantId: TENANT_A,
        accountAIdentifier: suppAlpha.id,
        accountBIdentifier: suppBeta.id,
      });

      expect(comparison).not.toBeNull();
      expect(comparison.accountA.platformUserId).toBe("uid_alpha_111");
      expect(comparison.accountB.platformUserId).toBe("uid_beta_222");
      expect(comparison.synthesis.disclaimer).toContain("التشابه السلوكي لا يثبت بالضرورة وحدة ملكية الحسابات");
      expect(["BEHAVIORAL_SIMILARITY", "NEEDS_REVIEW", "UNRESOLVED"]).toContain(comparison.synthesis.suggestedVerdict);
    });
  });

  describe("3. Anti-Snipe Tactical Predictor Service", () => {
    it("computes comprehensive tactical prediction and threat level", async () => {
      const prediction = await AntiSnipePredictorService.evaluateBattleRisk(
        TENANT_A,
        {
          battleId: "active_battle_test_01",
          battleType: "1V1",
          team1Score: 15000,
          team2Score: 12000,
          timeRemainingSeconds: 30,
          opponentUsernames: ["rival_pro"],
        }
      );

      expect(prediction).toBeDefined();
      expect(typeof prediction.snipeRiskScore).toBe("number");
      expect(prediction.snipeRiskScore).toBeGreaterThanOrEqual(0);
      expect(prediction.snipeRiskScore).toBeLessThanOrEqual(100);

      expect([
        "LOW_SAFE",
        "GUARDED_WATCH",
        "ELEVATED_SNIPER_SUSPECTED",
        "HIGH_AMBUSH_PROBABLE",
        "CRITICAL_IMMINENT_SNIPE",
      ]).toContain(prediction.threatLevel);

      expect(prediction.signals).toHaveProperty("opponentComebackCapacity");
      expect(prediction.signals).toHaveProperty("opponentSupporterThreat");
      expect(prediction.signals).toHaveProperty("scoreStagnationExposure");
      expect(prediction.signals).toHaveProperty("boostAvailabilityImpact");
      expect(prediction.signals).toHaveProperty("historicalAccountRecords");

      expect(typeof prediction.safeLeadBufferRequired).toBe("number");
      expect(prediction.predictionLimitations.length).toBeGreaterThan(0);
    });
  });

  describe("4. Intelligence Lab Service & Overview", () => {
    it("loads command center overview with accurate aggregate metrics", async () => {
      const overview = await IntelligenceLabService.getCommandCenterOverview(TENANT_A);

      expect(overview).toBeDefined();
      expect(typeof overview.metrics.monitoredSupportersCount).toBe("number");
      expect(typeof overview.metrics.activeWatchlistCount).toBe("number");
      expect(typeof overview.metrics.recentRadarAlertsCount).toBe("number");
      expect(Array.isArray(overview.recentRadarAlerts)).toBe(true);
      expect(Array.isArray(overview.pendingReviewCases)).toBe(true);
      expect(overview.liveStatus).toHaveProperty("isConnected");
    });

    it("manages watchlist lifecycle (add, query, remove)", async () => {
      const entry = await IntelligenceLabService.addToWatchlist(TENANT_A, {
        platformUserId: "uid_lifecycle_test",
        username: "lifecycle_user",
        displayName: "مستخدم دورة الحياة",
        severity: "HIGH",
        reason: "ملاحظات اختبارية",
      });

      expect(entry.id).toBeDefined();
      expect(entry.platformUserId).toBe("uid_lifecycle_test");

      const list = await IntelligenceLabService.getWatchlist(TENANT_A);
      expect(list.some((item) => item.platformUserId === "uid_lifecycle_test")).toBe(true);

      const removed = await IntelligenceLabService.removeFromWatchlist(TENANT_A, entry.id);
      expect(removed).toBe(true);

      const listAfter = await IntelligenceLabService.getWatchlist(TENANT_A);
      expect(listAfter.some((item) => item.platformUserId === "uid_lifecycle_test")).toBe(false);
    });

    it("persists intelligence settings accurately", async () => {
      const updated = await IntelligenceLabService.updateSettings(TENANT_A, {
        radarEnabled: true,
        cooldownMinutes: 45,
        minTacticalRiskAlert: 80,
        notifyWatchlistEntries: true,
        notifyMetadataChanges: false,
      });

      expect(updated.radarEnabled).toBe(true);
      expect(updated.cooldownMinutes).toBe(45);
      expect(updated.minTacticalRiskAlert).toBe(80);
      expect(updated.notifyMetadataChanges).toBe(false);

      const fetched = await IntelligenceLabService.getSettings(TENANT_A);
      expect(fetched.cooldownMinutes).toBe(45);
      expect(fetched.minTacticalRiskAlert).toBe(80);
    });
  });

  describe("5. Intelligence Reports Integration", () => {
    it("generates ENIGMA_ENTRY_RADAR_REPORT successfully", async () => {
      const report = await ReportsService.generateReport({
        tenantId: TENANT_A,
        reportType: "ENIGMA_ENTRY_RADAR_REPORT",
      });
      expect(report).toBeDefined();
      expect(report.metadata.title).toContain("رادار الدخول");
      expect(Array.isArray(report.kpis)).toBe(true);
      expect(Array.isArray(report.rows)).toBe(true);
    });

    it("generates PK_TACTICAL_INTELLIGENCE_REPORT successfully", async () => {
      const report = await ReportsService.generateReport({
        tenantId: TENANT_A,
        reportType: "PK_TACTICAL_INTELLIGENCE_REPORT",
      });
      expect(report).toBeDefined();
      expect(report.metadata.title).toContain("استخبارات النزالات");
      expect(Array.isArray(report.kpis)).toBe(true);
      expect(Array.isArray(report.rows)).toBe(true);
    });
  });

  describe("6. Deep Historical Intelligence Analysis & Idempotency", () => {
    it("analyzes Enigma accounts, distinguishes data sufficiency, and maintains idempotency", async () => {
      // Create a test Enigma review with sufficient events
      const suppRich = await prisma.supporter.create({
        data: {
          tenantId: TENANT_A,
          platformUserId: "uid_hist_rich_99",
          username: "rich_supporter",
          displayName: "داعم غني",
          totalDiamonds: 500000,
        },
      });

      const suppSparse = await prisma.supporter.create({
        data: {
          tenantId: TENANT_A,
          platformUserId: "uid_hist_sparse_11",
          username: "sparse_user",
          displayName: "مستخدم أولي",
          totalDiamonds: 0,
        },
      });

      await prisma.enigmaReview.create({
        data: {
          tenantId: TENANT_A,
          supporter1Id: suppRich.id,
          supporter2Id: suppRich.id,
          matchLevel: "STRONG_MATCH",
          confidenceScore: 100,
          status: "CONFIRMED",
          evidenceJson: JSON.stringify({
            classification: "IDENTIFIER_MATCH",
            classificationRationale: "Direct SecUID match",
            isBehavioralOnly: false,
            ruleVersion: "2.0",
            realUsername: "rich_supporter",
            realDisplayName: "داعم غني",
            enigmaUsername: "Enigma RICH",
            enigmaDisplayName: "Enigma RICH",
            platformUserId: "uid_hist_rich_99",
            diamondsWithEnigma: 500000,
            diamondsPublic: 0,
            totalCombinedDiamonds: 500000,
            enigmaEventsCount: 25,
            topGifts: [{ name: "Lion", count: 2, diamonds: 60000, time: "2026-10-18T20:00:00Z" }],
            evidencePoints: ["SecUID verified"],
          }),
        },
      });

      await prisma.enigmaReview.create({
        data: {
          tenantId: TENANT_A,
          supporter1Id: suppSparse.id,
          supporter2Id: suppSparse.id,
          matchLevel: "INSUFFICIENT_EVIDENCE",
          confidenceScore: 0,
          status: "PENDING",
          evidenceJson: JSON.stringify({
            classification: "BEHAVIORAL_SIMILARITY",
            classificationRationale: "Minimal activity",
            isBehavioralOnly: true,
            ruleVersion: "2.0",
            realUsername: "sparse_user",
            realDisplayName: "مستخدم أولي",
            enigmaUsername: "Enigma SPARSE",
            enigmaDisplayName: "Enigma SPARSE",
            platformUserId: "uid_hist_sparse_11",
            diamondsWithEnigma: 0,
            diamondsPublic: 0,
            totalCombinedDiamonds: 0,
            enigmaEventsCount: 1,
            topGifts: [],
            evidencePoints: [],
          }),
        },
      });

      // Run deep historical analysis first time
      const result1 = await IntelligenceLabService.analyzeHistoricalEnigmaAccounts(TENANT_A);
      expect(result1.totalAudited).toBeGreaterThanOrEqual(2);
      expect(result1.sufficientDataCount).toBeGreaterThanOrEqual(1);
      expect(result1.insufficientDataCount).toBeGreaterThanOrEqual(1);

      const richCase = result1.results.find((r) => r.platformUserId === "uid_hist_rich_99");
      expect(richCase).toBeDefined();
      expect(richCase?.dataSufficiency).toBe("SUFFICIENT");
      expect(richCase?.verdictStatus).toBe("VERIFIED_IDENTIFIER_MATCH");

      const sparseCase = result1.results.find((r) => r.platformUserId === "uid_hist_sparse_11");
      expect(sparseCase).toBeDefined();
      expect(sparseCase?.dataSufficiency).toBe("INSUFFICIENT_DATA");
      expect(sparseCase?.verdictStatus).toBe("UNRESOLVED");

      // Verify idempotency: rerun must succeed without creating duplicate cases or throwing errors
      const result2 = await IntelligenceLabService.analyzeHistoricalEnigmaAccounts(TENANT_A);
      expect(result2.totalAudited).toBe(result1.totalAudited);
      expect(result2.casesCreatedOrUpdated).toBe(result1.casesCreatedOrUpdated);
    });
  });

  describe("7. Forensic Evidence Policy & Multi-Factor Verification", () => {
    it("rejects accounts with 1 or 2 events from establishing behavioral patterns", async () => {
      // 1 event account
      const supp1Event = await prisma.supporter.create({
        data: {
          tenantId: TENANT_A,
          platformUserId: "uid_sparse_1_event",
          username: "user_one_event",
          displayName: "عضو حدث واحد",
          totalDiamonds: 0,
        },
      });

      // 2 event account
      const supp2Events = await prisma.supporter.create({
        data: {
          tenantId: TENANT_A,
          platformUserId: "uid_sparse_2_events",
          username: "user_two_events",
          displayName: "عضو حدثان",
          totalDiamonds: 0,
        },
      });

      const comparison = await ForensicComparisonService.compareAccounts({
        tenantId: TENANT_A,
        accountAIdentifier: supp1Event.platformUserId,
        accountBIdentifier: supp2Events.platformUserId,
      });

      expect(comparison.synthesis.suggestedVerdict).toBe("UNRESOLVED");
      expect(comparison.synthesis.overallSimilarityScore).toBe(0);
      expect(comparison.synthesis.confidenceBand).toBe("LOW");
      expect(comparison.synthesis.limitations.length).toBeGreaterThan(0);
      expect(comparison.synthesis.limitations[0]).toContain("الحد الأدنى للمقارنة");
    });

    it("does NOT classify two accounts as verified match merely for sharing the same display name", async () => {
      // Create streamer and session for event storage
      const streamer = await prisma.streamerAccount.upsert({
        where: { tenantId_username: { tenantId: TENANT_A, username: "streamer_test_host" } },
        update: {},
        create: {
          tenantId: TENANT_A,
          username: "streamer_test_host",
          displayName: "المضيف الاختباري",
        },
      });

      const session = await prisma.liveSession.create({
        data: {
          tenantId: TENANT_A,
          streamerAccountId: streamer.id,
          status: "ENDED",
        },
      });

      // Two completely distinct accounts with the exact same display name
      const suppA = await prisma.supporter.create({
        data: {
          tenantId: TENANT_A,
          platformUserId: "uid_distinct_a_999",
          username: "falcon_ksa_01",
          displayName: "صقر الجزيرة",
          totalDiamonds: 15000,
        },
      });

      const suppB = await prisma.supporter.create({
        data: {
          tenantId: TENANT_A,
          platformUserId: "uid_distinct_b_888",
          username: "desert_eagle_02",
          displayName: "صقر الجزيرة", // Same display name!
          totalDiamonds: 20000,
        },
      });

      // Populate events for both accounts
      for (let i = 0; i < 5; i++) {
        await prisma.rawEvent.create({
          data: {
            liveSessionId: session.id,
            platformUserId: suppA.platformUserId,
            deduplicationKey: `dedup_${suppA.platformUserId}_${i}`,
            eventType: "GIFT",
            sourceTimestamp: new Date(Date.now() - 3600000 * (10 - i)),
            payload: JSON.stringify({ giftName: "Rose", diamondCount: 10 }),
          },
        });
        await prisma.rawEvent.create({
          data: {
            liveSessionId: session.id,
            platformUserId: suppB.platformUserId,
            deduplicationKey: `dedup_${suppB.platformUserId}_${i}`,
            eventType: "GIFT",
            sourceTimestamp: new Date(Date.now() - 3600000 * (5 - i)),
            payload: JSON.stringify({ giftName: "Galaxy", diamondCount: 1000 }),
          },
        });
      }

      const comparison = await ForensicComparisonService.compareAccounts({
        tenantId: TENANT_A,
        accountAIdentifier: suppA.platformUserId,
        accountBIdentifier: suppB.platformUserId,
      });

      // CRITICAL FORENSIC REQUIREMENT:
      // Two distinct UIDs sharing display name must NEVER be VERIFIED_IDENTIFIER_MATCH
      expect(comparison.synthesis.suggestedVerdict).not.toBe("VERIFIED_IDENTIFIER_MATCH");
      // Because behaviors and gift types differ, similarity score must be moderate or unresolved, not high
      expect(comparison.synthesis.overallSimilarityScore).toBeLessThan(75);
    });

    it("classifies unconfirmed masked Enigma persona as NEEDS_REVIEW with null score (no fake 85%)", async () => {
      const suppUnconfirmed = await prisma.supporter.create({
        data: {
          tenantId: TENANT_A,
          platformUserId: "uid_unconfirmed_enigma_777",
          username: "Enigma VIP777",
          displayName: "Enigma VIP777",
          totalDiamonds: 250000,
        },
      });

      await prisma.enigmaReview.create({
        data: {
          tenantId: TENANT_A,
          supporter1Id: suppUnconfirmed.id,
          supporter2Id: suppUnconfirmed.id,
          matchLevel: "PROBABLE_MATCH",
          confidenceScore: 40,
          status: "PENDING",
          evidenceJson: JSON.stringify({
            classification: "UNCONFIRMED_ASSOCIATION",
            classificationRationale: "حساب رُصد استخدامه لوضع القناع، لم يتم تأكيد تطابق معرّفه التقني مع أي حساب علني سابق.",
            isBehavioralOnly: false,
            ruleVersion: "2.0",
            realUsername: "Enigma VIP777",
            realDisplayName: "Enigma VIP777",
            enigmaUsername: "Enigma VIP777",
            enigmaDisplayName: "Enigma VIP777",
            platformUserId: "uid_unconfirmed_enigma_777",
            diamondsWithEnigma: 250000,
            diamondsPublic: 0,
            totalCombinedDiamonds: 250000,
            enigmaEventsCount: 45,
            topGifts: [{ name: "Lion", count: 1, diamonds: 30000, time: "2026-10-18T21:00:00Z" }],
            evidencePoints: ["تفعيل قناع الحساب الغامض (Enigma Mask) مع حجب الهوية الرسمية."],
          }),
        },
      });

      const audit = await IntelligenceLabService.analyzeHistoricalEnigmaAccounts(TENANT_A);
      const caseResult = audit.results.find((r) => r.platformUserId === "uid_unconfirmed_enigma_777");

      expect(caseResult).toBeDefined();
      expect(caseResult?.verdictStatus).toBe("NEEDS_REVIEW");
      expect(caseResult?.dataSufficiency).toBe("SUFFICIENT");

      // Verify in DB that similarityScore is null, eliminating the fake 85% score
      const dbCase = await prisma.intelligenceInvestigationCase.findFirst({
        where: { tenantId: TENANT_A, primaryPlatformUserId: "uid_unconfirmed_enigma_777" },
      });
      expect(dbCase).not.toBeNull();
      expect(dbCase?.verdictStatus).toBe("NEEDS_REVIEW");
      expect(dbCase?.similarityScore).toBeNull();
      expect(dbCase?.similarityScore).not.toBe(85);
    });

    it("prevents case number collisions for Arabic handles using canonical CASE-ENIGMA-${pUid}", async () => {
      // Two Arabic usernames that previously collapsed into "USER"
      const suppArabic1 = await prisma.supporter.create({
        data: {
          tenantId: TENANT_A,
          platformUserId: "uid_arabic_user_1111",
          username: "مهره_الرسمية",
          displayName: "مهره",
          totalDiamonds: 50000,
        },
      });

      const suppArabic2 = await prisma.supporter.create({
        data: {
          tenantId: TENANT_A,
          platformUserId: "uid_arabic_user_2222",
          username: "سلطان_المجد",
          displayName: "سلطان",
          totalDiamonds: 60000,
        },
      });

      await prisma.enigmaReview.create({
        data: {
          tenantId: TENANT_A,
          supporter1Id: suppArabic1.id,
          supporter2Id: suppArabic1.id,
          matchLevel: "STRONG_MATCH",
          confidenceScore: 100,
          status: "CONFIRMED",
          evidenceJson: JSON.stringify({
            classification: "IDENTIFIER_MATCH",
            realUsername: "مهره_الرسمية",
            realDisplayName: "مهره",
            enigmaUsername: "Enigma MOHRA",
            enigmaDisplayName: "Enigma MOHRA",
            platformUserId: "uid_arabic_user_1111",
            totalCombinedDiamonds: 50000,
            enigmaEventsCount: 20,
          }),
        },
      });

      await prisma.enigmaReview.create({
        data: {
          tenantId: TENANT_A,
          supporter1Id: suppArabic2.id,
          supporter2Id: suppArabic2.id,
          matchLevel: "STRONG_MATCH",
          confidenceScore: 100,
          status: "CONFIRMED",
          evidenceJson: JSON.stringify({
            classification: "IDENTIFIER_MATCH",
            realUsername: "سلطان_المجد",
            realDisplayName: "سلطان",
            enigmaUsername: "Enigma SULTAN",
            enigmaDisplayName: "Enigma SULTAN",
            platformUserId: "uid_arabic_user_2222",
            totalCombinedDiamonds: 60000,
            enigmaEventsCount: 30,
          }),
        },
      });

      const audit = await IntelligenceLabService.analyzeHistoricalEnigmaAccounts(TENANT_A);
      const case1 = audit.results.find((r) => r.platformUserId === "uid_arabic_user_1111");
      const case2 = audit.results.find((r) => r.platformUserId === "uid_arabic_user_2222");

      expect(case1?.caseNumber).toBe("CASE-ENIGMA-uid_arabic_user_1111");
      expect(case2?.caseNumber).toBe("CASE-ENIGMA-uid_arabic_user_2222");
      expect(case1?.caseNumber).not.toBe(case2?.caseNumber);
      expect(case1?.caseNumber).not.toContain("USER");
    });

    it("strictly preserves manual review outcomes and notes during re-analysis", async () => {
      const pUid = "uid_manual_review_test";
      const supp = await prisma.supporter.create({
        data: {
          tenantId: TENANT_A,
          platformUserId: pUid,
          username: "manual_reviewed_user",
          displayName: "مستخدم مفحوص يدوياً",
          totalDiamonds: 80000,
        },
      });

      await prisma.enigmaReview.create({
        data: {
          tenantId: TENANT_A,
          supporter1Id: supp.id,
          supporter2Id: supp.id,
          matchLevel: "PROBABLE_MATCH",
          confidenceScore: 40,
          status: "PENDING",
          evidenceJson: JSON.stringify({
            classification: "UNCONFIRMED_ASSOCIATION",
            realUsername: "manual_reviewed_user",
            realDisplayName: "مستخدم مفحوص يدوياً",
            enigmaUsername: "Enigma M99",
            enigmaDisplayName: "Enigma M99",
            platformUserId: pUid,
            totalCombinedDiamonds: 80000,
            enigmaEventsCount: 15,
          }),
        },
      });

      // Analyst creates investigation case manually with custom verdict
      await prisma.intelligenceInvestigationCase.create({
        data: {
          tenantId: TENANT_A,
          caseNumber: `CASE-ENIGMA-${pUid}`,
          title: "فحص يدوي مخصص",
          primaryPlatformUserId: pUid,
          verdictStatus: "DISMISSED", // Analyst decided to dismiss
          similarityScore: null,
          evidenceSummary: "تم فحص الحساب واستبعاده من المراقبة بناء على إفادة البث المباشر.",
          evidenceDetailsJson: "{}",
          assignedTo: "Chief Analyst",
          notes: "قرار المحلل الأمني: استبعاد الحساب نظراً لعدم وجود نية هجومية.",
        },
      });

      // Run automated re-analysis
      await IntelligenceLabService.analyzeHistoricalEnigmaAccounts(TENANT_A);

      // Verify manual verdict was strictly preserved
      const preservedCase = await prisma.intelligenceInvestigationCase.findFirst({
        where: { tenantId: TENANT_A, primaryPlatformUserId: pUid },
      });

      expect(preservedCase?.verdictStatus).toBe("DISMISSED");
      expect(preservedCase?.assignedTo).toBe("Chief Analyst");
      expect(preservedCase?.notes).toContain("قرار المحلل الأمني: استبعاد الحساب");
    });
  });

  describe("6. Final Integrity Hardening & Release Gate Suite", () => {
    it("verifies backfill idempotency and reconciliation without modifying resolved records", async () => {
      const sess = await prisma.liveSession.create({
        data: {
          tenantId: TENANT_A,
          streamerAccountId: "streamer_acct_a",
          status: "ENDED",
        },
      });

      // Insert 2 resolvable and 1 unresolvable test events
      const ev1 = await prisma.rawEvent.create({
        data: {
          liveSessionId: sess.id,
          eventType: "CHAT",
          deduplicationKey: `test_dedup_bf_1_${Date.now()}`,
          sourceTimestamp: new Date(),
          payload: JSON.stringify({ user: { id: "98765432101", uniqueId: "bf_user_1" }, comment: "هلا" }),
          platformUserId: null,
        },
      });

      const ev2 = await prisma.rawEvent.create({
        data: {
          liveSessionId: sess.id,
          eventType: "GIFT",
          deduplicationKey: `test_dedup_bf_2_${Date.now()}`,
          sourceTimestamp: new Date(),
          payload: JSON.stringify({ user: { id: "98765432102", uniqueId: "bf_user_2" }, gift: { diamondCount: 10 } }),
          platformUserId: null,
        },
      });

      const evUnresolvable = await prisma.rawEvent.create({
        data: {
          liveSessionId: sess.id,
          eventType: "CHAT",
          deduplicationKey: `test_dedup_bf_unres_${Date.now()}`,
          sourceTimestamp: new Date(),
          payload: JSON.stringify({ comment: "رسالة بدون مستخدم" }), // missing user object
          platformUserId: null,
        },
      });

      // First run: execute backfill batch
      const result1 = await HistoricalBackfillService.backfillMissingPlatformUserIds({
        batchSize: 100,
        maxBatches: 5,
      });

      expect(result1.newlyAttributed).toBeGreaterThanOrEqual(2);

      // Verify records in DB
      const dbEv1 = await prisma.rawEvent.findUnique({ where: { id: ev1.id } });
      const dbEv2 = await prisma.rawEvent.findUnique({ where: { id: ev2.id } });
      const dbEvUnres = await prisma.rawEvent.findUnique({ where: { id: evUnresolvable.id } });

      expect(dbEv1?.platformUserId).toBe("98765432101");
      expect(dbEv2?.platformUserId).toBe("98765432102");
      expect(dbEvUnres?.platformUserId).toBeNull();

      // Second run: verify 100% idempotency (zero newly attributed)
      const result2 = await HistoricalBackfillService.backfillMissingPlatformUserIds({
        batchSize: 100,
        maxBatches: 5,
      });

      expect(result2.newlyAttributed).toBe(0);
      expect(result2.isIdempotentVerified).toBe(true);
    }, 60000);

    it("eliminates Cartesian O(N x M) explosion using discrete 15-second activity windows", async () => {
      const sess = await prisma.liveSession.create({
        data: {
          tenantId: TENANT_A,
          streamerAccountId: "streamer_acct_a",
          status: "ENDED",
        },
      });

      const suppA = await prisma.supporter.create({
        data: {
          tenantId: TENANT_A,
          platformUserId: "uid_burst_account_a",
          username: "burst_user_a",
          displayName: "مستخدم أ",
          totalDiamonds: 5000,
        },
      });

      const suppB = await prisma.supporter.create({
        data: {
          tenantId: TENANT_A,
          platformUserId: "uid_burst_account_b",
          username: "burst_user_b",
          displayName: "مستخدم ب",
          totalDiamonds: 5000,
        },
      });

      // Insert 20 chat events for A and 20 chat events for B within the SAME 15-second window
      const baseTime = new Date("2026-10-19T10:00:00.000Z");
      const eventsToCreate = [];

      for (let i = 0; i < 20; i++) {
        eventsToCreate.push({
          liveSessionId: sess.id,
          eventType: "CHAT",
          deduplicationKey: `burst_a_${i}_${Date.now()}`,
          sourceTimestamp: new Date(baseTime.getTime() + i * 500), // all within 10 seconds!
          platformUserId: suppA.platformUserId,
          payload: JSON.stringify({ user: { id: suppA.platformUserId, uniqueId: suppA.username } }),
        });
        eventsToCreate.push({
          liveSessionId: sess.id,
          eventType: "CHAT",
          deduplicationKey: `burst_b_${i}_${Date.now()}`,
          sourceTimestamp: new Date(baseTime.getTime() + i * 500 + 200), // interleaved
          platformUserId: suppB.platformUserId,
          payload: JSON.stringify({ user: { id: suppB.platformUserId, uniqueId: suppB.username } }),
        });
      }

      for (const ev of eventsToCreate) {
        await prisma.rawEvent.create({ data: ev });
      }

      const comparison = await ForensicComparisonService.compareAccounts({
        tenantId: TENANT_A,
        accountAIdentifier: suppA.id,
        accountBIdentifier: suppB.id,
      });

      // Instead of 20 x 20 = 400 simultaneous events, discrete 15s windowing results in exactly 1 window!
      expect(comparison.temporal.simultaneousEventCount).toBe(1);
      expect(comparison.temporal.sharedSessionsCount).toBe(1);
    });

    it("requires identical liveSessionId for co-presence overlap", async () => {
      const sess1 = await prisma.liveSession.create({
        data: {
          tenantId: TENANT_A,
          streamerAccountId: "streamer_acct_a",
          status: "ENDED",
        },
      });

      const sess2 = await prisma.liveSession.create({
        data: {
          tenantId: TENANT_A,
          streamerAccountId: "streamer_acct_a",
          status: "ENDED",
        },
      });

      const suppA = await prisma.supporter.create({
        data: {
          tenantId: TENANT_A,
          platformUserId: "uid_diff_sess_a",
          username: "diff_user_a",
          displayName: "مستخدم جلسة 1",
          totalDiamonds: 5000,
        },
      });

      const suppB = await prisma.supporter.create({
        data: {
          tenantId: TENANT_A,
          platformUserId: "uid_diff_sess_b",
          username: "diff_user_b",
          displayName: "مستخدم جلسة 2",
          totalDiamonds: 5000,
        },
      });

      // Account A active in session 1 at t = 1000
      await prisma.rawEvent.create({
        data: {
          liveSessionId: sess1.id,
          eventType: "CHAT",
          deduplicationKey: `diff_sess_a_${Date.now()}`,
          sourceTimestamp: new Date("2026-10-19T10:00:00.000Z"),
          platformUserId: suppA.platformUserId,
          payload: JSON.stringify({ user: { id: suppA.platformUserId, uniqueId: suppA.username } }),
        },
      });

      // Account B active in session 2 at t = 1005 (5 seconds apart, but DIFFERENT session)
      await prisma.rawEvent.create({
        data: {
          liveSessionId: sess2.id,
          eventType: "CHAT",
          deduplicationKey: `diff_sess_b_${Date.now()}`,
          sourceTimestamp: new Date("2026-10-19T10:00:05.000Z"),
          platformUserId: suppB.platformUserId,
          payload: JSON.stringify({ user: { id: suppB.platformUserId, uniqueId: suppB.username } }),
        },
      });

      const comparison = await ForensicComparisonService.compareAccounts({
        tenantId: TENANT_A,
        accountAIdentifier: suppA.id,
        accountBIdentifier: suppB.id,
      });

      // Different sessions MUST NOT count as co-presence
      expect(comparison.temporal.sharedSessionsCount).toBe(0);
      expect(comparison.temporal.simultaneousEventCount).toBe(0);
    });

    it("treats transient single-session overlap as NEEDS_REVIEW instead of CONFLICTING_EVIDENCE", async () => {
      const sess = await prisma.liveSession.create({
        data: {
          tenantId: TENANT_A,
          streamerAccountId: "streamer_acct_a",
          status: "ENDED",
        },
      });

      const suppA = await prisma.supporter.create({
        data: {
          tenantId: TENANT_A,
          platformUserId: "uid_transient_a",
          username: "transient_user_a",
          displayName: "داعم تداخل أ",
          totalDiamonds: 25000,
        },
      });

      const suppB = await prisma.supporter.create({
        data: {
          tenantId: TENANT_A,
          platformUserId: "uid_transient_b",
          username: "transient_user_b",
          displayName: "داعم تداخل أ", // matching display name
          totalDiamonds: 25000,
        },
      });

      // Seed 6 events for A and 6 events for B with 1 overlapping window in the SAME single session
      const baseTime = new Date("2026-10-19T12:00:00.000Z");
      for (let i = 0; i < 6; i++) {
        await prisma.rawEvent.create({
          data: {
            liveSessionId: sess.id,
            eventType: "CHAT",
            deduplicationKey: `transient_a_${i}_${Date.now()}`,
            sourceTimestamp: new Date(baseTime.getTime() + i * 30000),
            platformUserId: suppA.platformUserId,
            payload: JSON.stringify({ user: { id: suppA.platformUserId, uniqueId: suppA.username } }),
          },
        });
      }

      // B overlaps only in the first window (t = baseTime)
      await prisma.rawEvent.create({
        data: {
          liveSessionId: sess.id,
          eventType: "CHAT",
          deduplicationKey: `transient_b_0_${Date.now()}`,
          sourceTimestamp: new Date(baseTime.getTime() + 2000), // same 15s window
          platformUserId: suppB.platformUserId,
          payload: JSON.stringify({ user: { id: suppB.platformUserId, uniqueId: suppB.username } }),
        },
      });

      for (let i = 1; i < 6; i++) {
        await prisma.rawEvent.create({
          data: {
            liveSessionId: sess.id,
            eventType: "CHAT",
            deduplicationKey: `transient_b_${i}_${Date.now()}`,
            sourceTimestamp: new Date(baseTime.getTime() + 600000 + i * 30000), // non-overlapping
            platformUserId: suppB.platformUserId,
            payload: JSON.stringify({ user: { id: suppB.platformUserId, uniqueId: suppB.username } }),
          },
        });
      }

      const comparison = await ForensicComparisonService.compareAccounts({
        tenantId: TENANT_A,
        accountAIdentifier: suppA.id,
        accountBIdentifier: suppB.id,
      });

      // Transient single-session overlap must yield NEEDS_REVIEW, NOT CONFLICTING_EVIDENCE
      expect(comparison.synthesis.suggestedVerdict).toBe("NEEDS_REVIEW");
      expect(comparison.synthesis.suggestedVerdict).not.toBe("CONFLICTING_EVIDENCE");
    });

    it("verifies repeated multi-session co-presence yields CONFLICTING_EVIDENCE", async () => {
      const sess1 = await prisma.liveSession.create({
        data: { tenantId: TENANT_A, streamerAccountId: "streamer_acct_a", status: "ENDED" },
      });
      const sess2 = await prisma.liveSession.create({
        data: { tenantId: TENANT_A, streamerAccountId: "streamer_acct_a", status: "ENDED" },
      });

      const suppA = await prisma.supporter.create({
        data: {
          tenantId: TENANT_A,
          platformUserId: "uid_conflict_multi_a",
          username: "multi_user_a",
          displayName: "مستخدم متعدد أ",
          totalDiamonds: 30000,
        },
      });

      const suppB = await prisma.supporter.create({
        data: {
          tenantId: TENANT_A,
          platformUserId: "uid_conflict_multi_b",
          username: "multi_user_b",
          displayName: "مستخدم متعدد ب",
          totalDiamonds: 30000,
        },
      });

      // Seed 3 overlapping windows in session 1
      for (let w = 0; w < 3; w++) {
        const time = new Date(Date.now() + w * 60000);
        await prisma.rawEvent.create({
          data: {
            liveSessionId: sess1.id,
            eventType: "CHAT",
            deduplicationKey: `conf_s1_a_${w}_${Date.now()}`,
            sourceTimestamp: time,
            platformUserId: suppA.platformUserId,
            payload: JSON.stringify({ user: { id: suppA.platformUserId, uniqueId: suppA.username } }),
          },
        });
        await prisma.rawEvent.create({
          data: {
            liveSessionId: sess1.id,
            eventType: "CHAT",
            deduplicationKey: `conf_s1_b_${w}_${Date.now()}`,
            sourceTimestamp: new Date(time.getTime() + 2000),
            platformUserId: suppB.platformUserId,
            payload: JSON.stringify({ user: { id: suppB.platformUserId, uniqueId: suppB.username } }),
          },
        });
      }

      // Seed 3 overlapping windows in session 2
      for (let w = 0; w < 3; w++) {
        const time = new Date(Date.now() + 500000 + w * 60000);
        await prisma.rawEvent.create({
          data: {
            liveSessionId: sess2.id,
            eventType: "CHAT",
            deduplicationKey: `conf_s2_a_${w}_${Date.now()}`,
            sourceTimestamp: time,
            platformUserId: suppA.platformUserId,
            payload: JSON.stringify({ user: { id: suppA.platformUserId, uniqueId: suppA.username } }),
          },
        });
        await prisma.rawEvent.create({
          data: {
            liveSessionId: sess2.id,
            eventType: "CHAT",
            deduplicationKey: `conf_s2_b_${w}_${Date.now()}`,
            sourceTimestamp: new Date(time.getTime() + 2000),
            platformUserId: suppB.platformUserId,
            payload: JSON.stringify({ user: { id: suppB.platformUserId, uniqueId: suppB.username } }),
          },
        });
      }

      const comparison = await ForensicComparisonService.compareAccounts({
        tenantId: TENANT_A,
        accountAIdentifier: suppA.id,
        accountBIdentifier: suppB.id,
      });

      // 6 overlapping windows across 2 distinct sessions -> CONFLICTING_EVIDENCE with HIGH confidence
      expect(comparison.synthesis.suggestedVerdict).toBe("CONFLICTING_EVIDENCE");
      expect(comparison.synthesis.confidenceBand).toBe("HIGH");
      expect(comparison.temporal.sharedSessionsCount).toBe(2);
    });

    it("never overrides VERIFIED_IDENTIFIER_MATCH even if temporal concurrency is detected", async () => {
      const sess = await prisma.liveSession.create({
        data: { tenantId: TENANT_A, streamerAccountId: "streamer_acct_a", status: "ENDED" },
      });

      // Same platformUserId for both supporter records (e.g. alias transition)
      const SHARED_UID = "uid_same_secuid_deterministic";

      const suppA = await prisma.supporter.create({
        data: {
          tenantId: TENANT_A,
          platformUserId: SHARED_UID,
          username: "real_account_name",
          displayName: "الحساب الحقيقي",
          totalDiamonds: 50000,
        },
      });

      // Create simultaneous events for this platformUserId under different handles/messages
      const time = new Date();
      await prisma.rawEvent.create({
        data: {
          liveSessionId: sess.id,
          eventType: "CHAT",
          deduplicationKey: `secuid_conf_1_${Date.now()}`,
          sourceTimestamp: time,
          platformUserId: SHARED_UID,
          payload: JSON.stringify({ user: { id: SHARED_UID, uniqueId: "real_account_name" } }),
        },
      });
      await prisma.rawEvent.create({
        data: {
          liveSessionId: sess.id,
          eventType: "CHAT",
          deduplicationKey: `secuid_conf_2_${Date.now()}`,
          sourceTimestamp: new Date(time.getTime() + 1000),
          platformUserId: SHARED_UID,
          payload: JSON.stringify({ user: { id: SHARED_UID, uniqueId: "enigma_mask_name" } }),
        },
      });

      const comparison = await ForensicComparisonService.compareAccounts({
        tenantId: TENANT_A,
        accountAIdentifier: suppA.id,
        accountBIdentifier: SHARED_UID,
      });

      // Deterministic UID match MUST return VERIFIED_IDENTIFIER_MATCH and 100% score
      expect(comparison.synthesis.suggestedVerdict).toBe("VERIFIED_IDENTIFIER_MATCH");
      expect(comparison.synthesis.overallSimilarityScore).toBe(100);
      expect(comparison.synthesis.confidenceBand).toBe("VERY_HIGH");
    });

    it("preserves explicit human operator verdicts across updateCaseStatus and sync cycles", async () => {
      const pUid = "uid_operator_manual_audit_test";
      const caseNumber = `CASE-ENIGMA-${pUid}`;

      const supp = await prisma.supporter.create({
        data: {
          tenantId: TENANT_A,
          platformUserId: pUid,
          username: "manual_audited_user",
          displayName: "مستخدم مفحوص",
          totalDiamonds: 50000,
        },
      });

      await prisma.enigmaReview.create({
        data: {
          tenantId: TENANT_A,
          supporter1Id: supp.id,
          supporter2Id: supp.id,
          matchLevel: "STRONG_MATCH",
          confidenceScore: 100,
          status: "CONFIRMED",
          evidenceJson: JSON.stringify({
            classification: "IDENTIFIER_MATCH",
            realUsername: "manual_audited_user",
            realDisplayName: "مستخدم مفحوص",
            enigmaUsername: "Enigma AUDIT",
            enigmaDisplayName: "Enigma AUDIT",
            platformUserId: pUid,
            totalCombinedDiamonds: 50000,
            enigmaEventsCount: 20,
          }),
        },
      });

      // Create an initial case
      const createdCase = await prisma.intelligenceInvestigationCase.create({
        data: {
          tenantId: TENANT_A,
          caseNumber,
          title: "فحص أولي للمشتبه به",
          primaryPlatformUserId: pUid,
          verdictStatus: "NEEDS_REVIEW",
          similarityScore: 50,
          evidenceSummary: "ملخص أولي مؤتمت",
          evidenceDetailsJson: JSON.stringify({ reviewProvenance: "AUTOMATED_ANALYSIS" }),
        },
      });

      // Operator performs human review and updates verdict to VERIFIED_IDENTIFIER_MATCH
      const updated = await IntelligenceLabService.updateCaseStatus(
        TENANT_A,
        createdCase.id,
        "VERIFIED_IDENTIFIER_MATCH",
        "تم التأكد من صحة الحساب بعد مكالمة هاتفية مع الداعم",
        "Security Lead Agent 07"
      );
      expect(updated).toBe(true);

      // Verify case status and provenance in DB
      const dbCase = await prisma.intelligenceInvestigationCase.findUnique({
        where: { id: createdCase.id },
      });
      expect(dbCase?.verdictStatus).toBe("VERIFIED_IDENTIFIER_MATCH");
      expect(dbCase?.assignedTo).toBe("Security Lead Agent 07");
      expect(dbCase?.notes).toContain("تم التأكد من صحة الحساب");

      const details = JSON.parse(dbCase?.evidenceDetailsJson || "{}");
      expect(details.isManuallyReviewed).toBe(true);
      expect(details.reviewProvenance).toBe("MANUAL_OPERATOR_REVIEW");
      expect(details.reviewedBy).toBe("Security Lead Agent 07");

      // Verify that re-analyzing or syncing strictly respects the manual verdict
      await IntelligenceLabService.analyzeHistoricalEnigmaAccounts(TENANT_A);

      const postSyncCase = await prisma.intelligenceInvestigationCase.findUnique({
        where: { id: createdCase.id },
      });
      expect(postSyncCase?.verdictStatus).toBe("VERIFIED_IDENTIFIER_MATCH");
      expect(postSyncCase?.assignedTo).toBe("Security Lead Agent 07");
      expect(postSyncCase?.notes).toContain("تم التأكد من صحة الحساب");
      // And verify technical telemetry refreshed without destroying human review provenance
      const postDetails = JSON.parse(postSyncCase?.evidenceDetailsJson || "{}");
      expect(postDetails.isManuallyReviewed).toBe(true);
      expect(postDetails.isManuallyPreserved).toBe(true);
      expect(postDetails.reviewedBy).toBe("Security Lead Agent 07");
      expect(postDetails.telemetryLastRefreshedAt).toBeDefined();
    }, 20000);

    it("accurately detects co-presence across arbitrary 15s boundaries (sliding window vs fixed buckets)", async () => {
      // Create session
      const streamer = await prisma.streamerAccount.findFirst({ where: { tenantId: TENANT_A } });
      const session = await prisma.liveSession.create({
        data: {
          tenantId: TENANT_A,
          streamerAccountId: streamer!.id,
          status: "ENDED",
        },
      });

      const uA = "uid_boundary_user_a";
      const uB = "uid_boundary_user_b";

      await prisma.supporter.createMany({
        data: [
          { tenantId: TENANT_A, platformUserId: uA, username: "user_boundary_a", displayName: "مستخدم أ", totalDiamonds: 1000 },
          { tenantId: TENANT_A, platformUserId: uB, username: "user_boundary_b", displayName: "مستخدم ب", totalDiamonds: 1000 },
        ],
      });

      // Events crossing a 15-second epoch mark (e.g., 14.900s and 15.100s, gap is only 200ms)
      // Fixed bucket math.floor(t / 15000) would place them in bucket 0 and bucket 1 (missed collision!)
      // Sliding window must detect them as simultaneous!
      const baseEpoch = 1700000000000;
      const t1 = new Date(baseEpoch + 14900);
      const t2 = new Date(baseEpoch + 15100);

      // Create 5 events to meet minimum sufficiency
      for (let i = 0; i < 5; i++) {
        await prisma.rawEvent.create({
          data: {
            liveSessionId: session.id,
            platformUserId: uA,
            deduplicationKey: `dedup_${uA}_${i}_${Date.now()}`,
            eventType: "CHAT",
            sourceTimestamp: i === 0 ? t1 : new Date(baseEpoch + 30000 + i * 5000),
            payload: JSON.stringify({ comment: `A chat ${i}` }),
          },
        });
        await prisma.rawEvent.create({
          data: {
            liveSessionId: session.id,
            platformUserId: uB,
            deduplicationKey: `dedup_${uB}_${i}_${Date.now()}`,
            eventType: "CHAT",
            sourceTimestamp: i === 0 ? t2 : new Date(baseEpoch + 30000 + i * 5000),
            payload: JSON.stringify({ comment: `B chat ${i}` }),
          },
        });
      }

      const comp = await ForensicComparisonService.compareAccounts({
        tenantId: TENANT_A,
        accountAIdentifier: uA,
        accountBIdentifier: uB,
      });

      // Co-presence must be detected despite crossing the 15-second boundary mark
      expect(comp.temporal.observedTemporalOverlap).toBe(true);
      expect(comp.temporal.simultaneousWindowsCount).toBeGreaterThan(0);
      expect(comp.temporal.sessionsWithOverlapCount).toBe(1);

      // Clean up test events and session so test leaves zero residue
      await prisma.rawEvent.deleteMany({ where: { liveSessionId: session.id } });
      await prisma.supporter.deleteMany({ where: { platformUserId: { in: [uA, uB] } } });
      await prisma.liveSession.delete({ where: { id: session.id } });
    });

    it("evaluates exact delta <= 15000ms boundary conditions with mathematical precision", async () => {
      const streamer = await prisma.streamerAccount.findFirst({ where: { tenantId: TENANT_A } });
      const session = await prisma.liveSession.create({
        data: {
          tenantId: TENANT_A,
          streamerAccountId: streamer!.id,
          status: "ENDED",
        },
      });

      const uA = "uid_precision_a";
      const uB = "uid_precision_b";

      await prisma.supporter.createMany({
        data: [
          { tenantId: TENANT_A, platformUserId: uA, username: "user_prec_a", displayName: "دقيق أ", totalDiamonds: 500 },
          { tenantId: TENANT_A, platformUserId: uB, username: "user_prec_b", displayName: "دقيق ب", totalDiamonds: 500 },
        ],
      });

      const t0 = 1700000000000;

      // Event A at t0, Event B exactly at t0 + 15000ms (diff === 15000ms -> SHOULD match under <= 15s)
      // Event B at t0 + 15001ms (diff === 15001ms -> SHOULD NOT match)
      // Event A at t0, Event B exactly at t0 + 15000ms (diff === 15000ms -> SHOULD match under <= 15s)
      // All other events spaced >= 60 seconds apart so only the first pair matches
      const timesA = [t0, t0 + 60000, t0 + 120000, t0 + 180000, t0 + 240000];
      const timesB = [t0 + 15000, t0 + 60000 + 15001, t0 + 120000 + 25000, t0 + 180000 + 25000, t0 + 240000 + 25000];

      for (let i = 0; i < 5; i++) {
        await prisma.rawEvent.create({
          data: {
            liveSessionId: session.id,
            platformUserId: uA,
            deduplicationKey: `prec_a_${i}_${Date.now()}`,
            eventType: "CHAT",
            sourceTimestamp: new Date(timesA[i]),
            payload: JSON.stringify({ comment: `A ${i}` }),
          },
        });
        await prisma.rawEvent.create({
          data: {
            liveSessionId: session.id,
            platformUserId: uB,
            deduplicationKey: `prec_b_${i}_${Date.now()}`,
            eventType: "CHAT",
            sourceTimestamp: new Date(timesB[i]),
            payload: JSON.stringify({ comment: `B ${i}` }),
          },
        });
      }

      const comp = await ForensicComparisonService.compareAccounts({
        tenantId: TENANT_A,
        accountAIdentifier: uA,
        accountBIdentifier: uB,
      });

      // Exactly 1 match should occur: the t0 and t0 + 15000ms pair!
      // The second pair (diff = 15001ms) must not match!
      expect(comp.temporal.simultaneousWindowsCount).toBe(1);
      expect(comp.temporal.sessionsWithOverlapCount).toBe(1);

      // Clean up test events and session so test leaves zero residue
      await prisma.rawEvent.deleteMany({ where: { liveSessionId: session.id } });
      await prisma.supporter.deleteMany({ where: { platformUserId: { in: [uA, uB] } } });
      await prisma.liveSession.delete({ where: { id: session.id } });
    });
  });
});
