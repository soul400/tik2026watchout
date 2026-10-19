import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "../src/lib/prisma";
import { EnigmaRadarService } from "../src/lib/enigma-radar-service";
import { ForensicComparisonService } from "../src/lib/forensic-comparison-service";
import { AntiSnipePredictorService } from "../src/lib/anti-snipe-predictor-service";
import { IntelligenceLabService } from "../src/lib/intelligence-lab-service";
import { ReportsService } from "../src/lib/reports-service";

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

    // Clean up test watchlist & alerts
    await prisma.intelligenceRadarAlert.deleteMany({
      where: { tenantId: { in: [TENANT_A, TENANT_B] } },
    });
    await prisma.intelligenceWatchlist.deleteMany({
      where: { tenantId: { in: [TENANT_A, TENANT_B] } },
    });
  });

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
});
