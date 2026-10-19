import { describe, it, expect, beforeEach } from "vitest";
import { ReportsService, ReportType } from "../src/lib/reports-service";
import { prisma } from "../src/lib/prisma";

describe("Executive Arabic PDF Reports Suite", () => {
  const TEST_TENANT = "test-pdf-tenant";
  const TEST_STREAMER = "streamer-pdf-test";

  beforeEach(async () => {
    await prisma.tenant.upsert({
      where: { id: TEST_TENANT },
      update: {},
      create: {
        id: TEST_TENANT,
        name: "Mohra Test Studio",
        slug: "mohra-test-studio",
      },
    });

    await prisma.streamerAccount.upsert({
      where: { id: TEST_STREAMER },
      update: {},
      create: {
        id: TEST_STREAMER,
        tenantId: TEST_TENANT,
        username: "mohra.test",
        displayName: "مهرة تيست",
      },
    });
  });

  const ALL_REPORT_TYPES: ReportType[] = [
    "LIVE_SESSION_SUMMARY",
    "DAILY_OPERATIONS_SUMMARY",
    "COMMUNITY_CHAMPIONS",
    "BATTLE_POST_MATCH",
    "TACTICAL_INVENTORY_AUDIT",
    "STREAM_HEALTH_INCIDENT",
    "STQI_TIMING_REPORT",
    "DATA_QUALITY_RECONCILIATION",
    "ENIGMA_UNMASKED_ANALYSIS",
  ];

  for (const reportType of ALL_REPORT_TYPES) {
    it(`generates complete executive PDF-ready structure for: ${reportType}`, async () => {
      const report = await ReportsService.generateReport({
        tenantId: TEST_TENANT,
        reportType,
      });

      // Metadata Verification
      expect(report.metadata.reportType).toBe(reportType);
      expect(report.metadata.tenantId).toBe(TEST_TENANT);
      expect(report.metadata.dataConfidence).toBe("VERIFIED");
      expect(report.metadata.timezone).toBe("Asia/Riyadh");
      expect(report.metadata.serialNumber).toMatch(/^LP-\d{6}-\d{4}$/);

      // Executive Elements Verification
      expect(Array.isArray(report.headers)).toBe(true);
      expect(report.headers.length).toBeGreaterThan(0);
      expect(Array.isArray(report.rows)).toBe(true);
      expect(report.kpis.length).toBe(4);
      expect(typeof report.executiveSummary).toBe("string");
      expect(report.executiveSummary.length).toBeGreaterThan(20);
      expect(Array.isArray(report.recommendations)).toBe(true);

      // CSV Export Compatibility
      expect(report.csvContent?.startsWith("\uFEFF")).toBe(true);
    });
  }

  it("calculates daily operations aggregation accurately", async () => {
    // Insert dummy session
    const dummySession = await prisma.liveSession.create({
      data: {
        tenantId: TEST_TENANT,
        streamerAccountId: TEST_STREAMER,
        roomId: `room_${Date.now()}`,
        startedAt: new Date(),
        endedAt: new Date(Date.now() + 3600000), // 1 hour
        totalDiamonds: 1500,
        totalComments: 300,
        totalLikes: 2000,
        peakViewers: 120,
      },
    });

    const report = await ReportsService.generateReport({
      tenantId: TEST_TENANT,
      reportType: "DAILY_OPERATIONS_SUMMARY",
    });

    expect(report.rows.length).toBeGreaterThan(0);
    const firstRow = report.rows[0];
    expect(firstRow["عدد الجلسات"]).toBeGreaterThanOrEqual(1);
    expect(firstRow["إجمالي الماسات"]).toBeGreaterThanOrEqual(1500);

    // Clean up
    await prisma.liveSession.delete({ where: { id: dummySession.id } });
  });

  it("enforces strict deterministic matching (SecUID only) for ENIGMA_UNMASKED_ANALYSIS", async () => {
    // Create 1 strong match and 1 probable match
    const strongReview = await prisma.enigmaReview.create({
      data: {
        tenantId: TEST_TENANT,
        supporter1Id: `s1_${Date.now()}`,
        supporter2Id: `s2_${Date.now()}`,
        matchLevel: "STRONG_MATCH",
        confidenceScore: 1.0,
        evidenceJson: JSON.stringify({
          classification: "IDENTIFIER_MATCH",
          realDisplayName: "بطل موثق",
          realUsername: "champion_real",
          enigmaDisplayName: "Enigma VIP",
          enigmaUsername: "enigma_vip",
          secUid: "MS4wLjABAAAA_test_secuid_123",
          diamondsWithEnigma: 5000,
          diamondsPublic: 200,
          totalCombinedDiamonds: 5200,
          topGifts: [{ name: "Lion", count: 1, diamonds: 5000, time: new Date().toISOString() }],
        }),
      },
    });

    const probableReview = await prisma.enigmaReview.create({
      data: {
        tenantId: TEST_TENANT,
        supporter1Id: `s3_${Date.now()}`,
        supporter2Id: `s4_${Date.now()}`,
        matchLevel: "PROBABLE_MATCH",
        confidenceScore: 0.4,
        evidenceJson: JSON.stringify({
          classification: "UNCONFIRMED_ASSOCIATION",
          realDisplayName: "مجهول غير قطعي",
          realUsername: "unknown_user",
          enigmaDisplayName: "Enigma Tentative",
          enigmaUsername: "enigma_tentative",
          diamondsWithEnigma: 100,
          diamondsPublic: 0,
          totalCombinedDiamonds: 100,
          topGifts: [],
        }),
      },
    });

    const report = await ReportsService.generateReport({
      tenantId: TEST_TENANT,
      reportType: "ENIGMA_UNMASKED_ANALYSIS",
    });

    // Verify report ONLY contains the strong match
    expect(report.rows.some((r) => r["اسم الحساب المقنع"] === "Enigma VIP")).toBe(true);
    expect(report.rows.some((r) => r["اسم الحساب المقنع"] === "Enigma Tentative")).toBe(false);
    expect(report.rows.every((r) => r["مستوى التطابق"] === "تطابق قطعي (SecUID)")).toBe(true);
    expect(report.rows.every((r) => r["درجة الموثوقية"] === "100%")).toBe(true);

    // Verify support numbers and diamonds are completely hidden
    expect(report.headers.some((h) => h.includes("الماس") || h.includes("الدعم"))).toBe(false);
    for (const row of report.rows) {
      expect(row["الماسات تحت القناع"]).toBeUndefined();
      expect(row["الماسات العلنية"]).toBeUndefined();
      expect(row["إجمالي الدعم"]).toBeUndefined();
    }
    expect(report.kpis.some((k) => String(k.value).includes("💎"))).toBe(false);

    // Clean up
    await prisma.enigmaReview.deleteMany({ where: { id: { in: [strongReview.id, probableReview.id] } } });
  });

  it("STQI Timing Report features the top 3 broadcast periods by support with rankings and KPIs", async () => {
    // Upsert 4 distinct hourly analytics records for TEST_TENANT
    const hoursData = [
      { riyadhHour: 19, avgDiamonds: 2500000, stqiScore: 92 },
      { riyadhHour: 0, avgDiamonds: 1800000, stqiScore: 84 },
      { riyadhHour: 21, avgDiamonds: 1500000, stqiScore: 78 },
      { riyadhHour: 14, avgDiamonds: 100000, stqiScore: 45 },
    ];

    for (const h of hoursData) {
      await prisma.hourlyAnalytics.upsert({
        where: {
          tenantId_riyadhHour_dayOfWeek: {
            tenantId: TEST_TENANT,
            riyadhHour: h.riyadhHour,
            dayOfWeek: -1,
          },
        },
        create: {
          tenantId: TEST_TENANT,
          riyadhHour: h.riyadhHour,
          dayOfWeek: -1,
          sampleSessions: 5,
          avgDiamonds: h.avgDiamonds,
          avgLikes: 10000,
          avgComments: 2000,
          avgViewers: 300,
          stqiScore: h.stqiScore,
          consistencyScore: 0.85,
          confidenceState: "VERIFIED",
        },
        update: {
          avgDiamonds: h.avgDiamonds,
          stqiScore: h.stqiScore,
        },
      });
    }

    const report = await ReportsService.generateReport({
      tenantId: TEST_TENANT,
      reportType: "STQI_TIMING_REPORT",
    });

    // Verify headers contain support ranking
    expect(report.headers).toContain("ترتيب وتصنيف الدعم المالي");

    // Verify KPIs showcase Top 3 Support Windows
    expect(report.kpis[0].label).toContain("المركز الأول");
    expect(report.kpis[0].value).toContain("7:00 مساءً — 8:00 مساءً");
    expect(report.kpis[1].label).toContain("المركز الثاني");
    expect(report.kpis[1].value).toContain("12:00 منتصف الليل — 1:00 صباحاً");
    expect(report.kpis[2].label).toContain("المركز الثالث");
    expect(report.kpis[2].value).toContain("9:00 مساءً — 10:00 مساءً");

    // Verify top rows have correct rank tags and badges
    const topRow1 = report.rows.find((r) => r._supportRank === 1);
    expect(topRow1).toBeDefined();
    expect(topRow1?.["ترتيب وتصنيف الدعم المالي"]).toContain("🥇 المركز الأول");
    expect(topRow1?.["الساعة بتوقيت الرياض"]).toContain("7:00 مساءً");

    const topRow2 = report.rows.find((r) => r._supportRank === 2);
    expect(topRow2).toBeDefined();
    expect(topRow2?.["ترتيب وتصنيف الدعم المالي"]).toContain("🥈 المركز الثاني");

    const topRow3 = report.rows.find((r) => r._supportRank === 3);
    expect(topRow3).toBeDefined();
    expect(topRow3?.["ترتيب وتصنيف الدعم المالي"]).toContain("🥉 المركز الثالث");

    // Verify executive summary includes top 3 support windows
    expect(report.executiveSummary).toContain("أفضل 3 فترات للبث من حيث الدعم المالي");
    expect(report.executiveSummary).toContain("المركز الأول");
    expect(report.executiveSummary).toContain("المركز الثاني");
    expect(report.executiveSummary).toContain("المركز الثالث");

    // Verify recommendations
    expect(report.recommendations.length).toBeGreaterThanOrEqual(4);

    // Clean up
    await prisma.hourlyAnalytics.deleteMany({
      where: { tenantId: TEST_TENANT },
    });
  });

  it("LIVE_SESSION_SUMMARY: supports date filters, super battles (+100K), gift multipliers, and top rivals", async () => {
    // Pre-cleanup in case of prior run abort
    await prisma.rawEvent.deleteMany({ where: { deduplicationKey: { startsWith: "dedup_test_" } } });
    await prisma.battleParticipant.deleteMany({ where: { battle: { tenantId: TEST_TENANT } } });
    await prisma.battle.deleteMany({ where: { tenantId: TEST_TENANT } });
    await prisma.liveSession.deleteMany({ where: { tenantId: TEST_TENANT } });

    // 1. Create a mock live session for TEST_TENANT
    const mockSession = await prisma.liveSession.create({
      data: {
        tenantId: TEST_TENANT,
        streamerAccountId: TEST_STREAMER,
        roomId: "room_test_summary_777",
        status: "ENDED",
        startedAt: new Date("2026-10-18T10:00:00.000Z"),
        endedAt: new Date("2026-10-18T12:00:00.000Z"),
        totalDiamonds: 350000,
        peakViewers: 1200,
      },
    });

    // 2. Create Battles (one 1v1 >= 100k, one 2v2 >= 100k, one regular < 100k)
    const battle1v1 = await prisma.battle.create({
      data: {
        tenantId: TEST_TENANT,
        liveSessionId: mockSession.id,
        battleType: "1V1",
        status: "COMPLETED",
        startedAt: new Date("2026-10-18T10:15:00.000Z"),
        team1Score: 180000,
        team2Score: 95000,
        winningTeam: 1,
        participants: {
          create: [
            {
              teamNumber: 1,
              platformUserId: "streamer_mohra",
              username: "mohra.test",
              displayName: "مهرة",
            },
            {
              teamNumber: 2,
              platformUserId: "rival_omar",
              username: "omar.i76",
              displayName: "عمر الدحيم",
            },
          ],
        },
      },
    });

    const battle2v2 = await prisma.battle.create({
      data: {
        tenantId: TEST_TENANT,
        liveSessionId: mockSession.id,
        battleType: "2V2",
        status: "COMPLETED",
        startedAt: new Date("2026-10-18T11:00:00.000Z"),
        team1Score: 250000,
        team2Score: 310000,
        winningTeam: 2,
        participants: {
          create: [
            {
              teamNumber: 1,
              platformUserId: "streamer_mohra",
              username: "mohra.test",
              displayName: "مهرة",
            },
            {
              teamNumber: 2,
              platformUserId: "rival_omar",
              username: "omar.i76",
              displayName: "عمر الدحيم",
            },
            {
              teamNumber: 2,
              platformUserId: "rival_jmeel",
              username: "jmeel40",
              displayName: "جميل",
            },
          ],
        },
      },
    });

    const runId = Date.now();
    // 3. Create Raw Events for gifts: Lion x5, Rose x100
    await prisma.rawEvent.createMany({
      data: [
        {
          liveSessionId: mockSession.id,
          deduplicationKey: `dedup_test_lion_${runId}`,
          eventType: "GIFT",
          sourceTimestamp: new Date("2026-10-18T10:16:00.000Z"),
          payload: JSON.stringify({
            giftId: 1001,
            giftName: "Lion",
            diamondCount: 29999,
            repeatCount: 5,
            groupCount: 1,
            user: { userId: "supporter_1", username: "super_fan", nickname: "الداعم الذهبي" },
          }),
        },
        {
          liveSessionId: mockSession.id,
          deduplicationKey: `dedup_test_rose_${runId}`,
          eventType: "GIFT",
          sourceTimestamp: new Date("2026-10-18T10:17:00.000Z"),
          payload: JSON.stringify({
            giftId: 1002,
            giftName: "Rose",
            diamondCount: 1,
            repeatCount: 100,
            groupCount: 1,
            user: { userId: "supporter_2", username: "rose_sender", nickname: "محب الورد" },
          }),
        },
      ],
    });

    // 4. Test Single Date Filter: date="2026-10-18"
    const reportDate = await ReportsService.generateReport({
      tenantId: TEST_TENANT,
      reportType: "LIVE_SESSION_SUMMARY",
      date: "2026-10-18",
    });

    expect(reportDate.metadata.periodLabel).toContain("2026-10-18");
    expect(reportDate.rows.length).toBe(2);

    // Verify Super Battles (+100K)
    expect(reportDate._superBattles).toBeDefined();
    expect(reportDate._superBattles?.length).toBe(2);

    // Check 1v1 battle details
    const sb1v1 = reportDate._superBattles?.find((b: any) => b.battleType === "1V1");
    expect(sb1v1).toBeDefined();
    expect(sb1v1?.opponentsText).toContain("عمر الدحيم");
    expect(sb1v1?.opponentsText).not.toContain("@omar.i76");
    expect(sb1v1?.hostScore).toBe(180000);
    expect(sb1v1?.outcome).toContain("فوز المضيف");

    // Check 2v2 battle details
    const sb2v2 = reportDate._superBattles?.find((b: any) => b.battleType === "2V2");
    expect(sb2v2).toBeDefined();
    expect(sb2v2?.opponentsText).toContain("عمر الدحيم");
    expect(sb2v2?.opponentsText).toContain("جميل");
    expect(sb2v2?.opponentsText).not.toContain("@jmeel40");
    expect(sb2v2?.hostScore).toBe(250000);
    expect(sb2v2?.outcome).toContain("فوز الخصم");

    // Verify Gift Multipliers Breakdown (Only >= 10K diamonds)
    expect(reportDate._giftBreakdown).toBeDefined();
    const lionGift = reportDate._giftBreakdown?.find((g: any) => g.giftName === "Lion");
    expect(lionGift).toBeDefined();
    expect(lionGift?.formattedMultiplier).toBe("Lion × 5");
    expect(lionGift?.count).toBe(5);

    // Rose is 1 diamond each (100 total), so it must be filtered out (<10k)
    const roseGift = reportDate._giftBreakdown?.find((g: any) => g.giftName === "Rose");
    expect(roseGift).toBeUndefined();

    // Verify Top Rivals
    expect(reportDate._topRivals).toBeDefined();
    const topRival = reportDate._topRivals?.[0];
    expect(topRival).toBeDefined();
    expect(topRival?.username).toBe("omar.i76");
    expect(topRival?.totalBattles).toBe(2);
    expect(topRival?.hostWins).toBe(1);
    expect(topRival?.oppWins).toBe(1);

    // Verify KPIs
    const superBattlesKpi = reportDate.kpis.find((k: any) => k.label.includes("أقوى جولة"));
    expect(superBattlesKpi).toBeDefined();
    expect(superBattlesKpi?.value).toContain("جميل");

    const topRivalKpi = reportDate.kpis.find((k: any) => k.label.includes("أكثر منافس"));
    expect(topRivalKpi).toBeDefined();
    expect(topRivalKpi?.value).toContain("عمر الدحيم");

    const topGiftKpi = reportDate.kpis.find((k: any) => k.label.includes("أبرز هدايا"));
    expect(topGiftKpi).toBeDefined();
    expect(topGiftKpi?.value).toContain("Lion × 5");

    // 5. Test Date Preset: periodPreset="all"
    const reportAll = await ReportsService.generateReport({
      tenantId: TEST_TENANT,
      reportType: "LIVE_SESSION_SUMMARY",
      periodPreset: "all",
    });
    expect(reportAll.metadata.periodLabel).toContain("كامل السجل التشغيلي");
    expect(reportAll.rows.length).toBeGreaterThanOrEqual(2);

    // Clean up
    await prisma.rawEvent.deleteMany({ where: { liveSession: { tenantId: TEST_TENANT } } });
    await prisma.battleParticipant.deleteMany({ where: { battle: { tenantId: TEST_TENANT } } });
    await prisma.battle.deleteMany({ where: { tenantId: TEST_TENANT } });
    await prisma.liveSession.deleteMany({ where: { tenantId: TEST_TENANT } });
  });

  it("verifies BATTLE_POST_MATCH filters zero scores and generates match cards with top 10 supporters", async () => {
    // 1. Create a live session
    const session = await prisma.liveSession.create({
      data: {
        tenantId: TEST_TENANT,
        streamerAccountId: TEST_STREAMER,
        roomId: `battle_room_${Date.now()}`,
        startedAt: new Date(Date.now() - 3600000),
        endedAt: new Date(),
        totalDiamonds: 250000,
      },
    });

    // 2. Create Battle 1: Active Battle (Host 150K vs Opponent 80K)
    const battle1 = await prisma.battle.create({
      data: {
        tenantId: TEST_TENANT,
        liveSessionId: session.id,
        battleType: "1V1",
        startedAt: new Date(Date.now() - 1800000),
        durationSeconds: 300,
        team1Score: 150000,
        team2Score: 80000,
        status: "FINISHED",
      },
    });

    await prisma.battleParticipant.createMany({
      data: [
        {
          battleId: battle1.id,
          platformUserId: "uid_mohra_1",
          username: "mohra.2000",
          displayName: "مهرة 🇸🇦",
          teamNumber: 1,
        },
        {
          battleId: battle1.id,
          platformUserId: "uid_rival_1",
          username: "@king_rival",
          displayName: "@الملك المنافس",
          teamNumber: 2,
        },
      ],
    });

    // Create raw gift for battle1 to establish top 10 supporter
    const runId = Date.now();
    await prisma.rawEvent.create({
      data: {
        liveSessionId: session.id,
        deduplicationKey: `dedup_battle_gift_${runId}`,
        eventType: "GIFT",
        sourceTimestamp: new Date(Date.now() - 1700000),
        payload: JSON.stringify({
          user: { nickname: "الداعم الذهبي", displayId: "golden_supporter" },
          gift: { diamondCount: 50000 },
          repeatCount: 2,
        }),
      },
    });

    // 3. Create Battle 2: ZERO-SCORE Battle (0 vs 0) -> MUST BE EXCLUDED
    const battleZero = await prisma.battle.create({
      data: {
        tenantId: TEST_TENANT,
        liveSessionId: session.id,
        battleType: "1V1",
        startedAt: new Date(Date.now() - 900000),
        durationSeconds: 300,
        team1Score: 0,
        team2Score: 0,
        status: "FINISHED",
      },
    });

    await prisma.battleParticipant.createMany({
      data: [
        {
          battleId: battleZero.id,
          platformUserId: "uid_mohra_zero",
          username: "mohra.2000",
          displayName: "مهرة",
          teamNumber: 1,
        },
        {
          battleId: battleZero.id,
          platformUserId: "uid_rival_zero",
          username: "zero_rival",
          displayName: "خصم صفري",
          teamNumber: 2,
        },
      ],
    });

    // 4. Generate BATTLE_POST_MATCH report
    const report = await ReportsService.generateReport({
      tenantId: TEST_TENANT,
      reportType: "BATTLE_POST_MATCH",
      periodPreset: "all",
    });

    // Verify zero score battle is completely filtered out
    expect(report._matchCards).toBeDefined();
    expect(report._matchCards?.length).toBe(1);
    const card = report._matchCards?.[0];
    expect(card.id).toBe(battle1.id);
    expect(card.team1Score).toBe(150000);
    expect(card.team2Score).toBe(80000);
    expect(card.isHostWinner).toBe(true);
    expect(card.winnerLabel).toContain("فوز فريق المضيف");
    expect(card.scoreDifference).toBe(70000);

    // Verify header date & time is formatted in Arabic
    expect(card.headerDateTime).toBeDefined();
    expect(card.headerDateTime.length).toBeGreaterThan(5);

    // Verify team participants clean names without @
    expect(card.team1Participants[0].displayName).toBe("مهرة 🇸🇦");
    expect(card.team2Participants[0].displayName).toBe("الملك المنافس");
    expect(card.team2Participants[0].displayName).not.toContain("@");

    // Verify top 10 supporters in match card
    expect(card.team1TopSupporters.length).toBeGreaterThan(0);
    expect(card.team1TopSupporters[0].name).toBe("الداعم الذهبي");
    expect(card.team1TopSupporters[0].diamonds).toBe(100000);

    // 5. Test minHostScore filtering:
    // If minHostScore is higher than 150000, battle1 should be excluded
    const reportHighMin = await ReportsService.generateReport({
      tenantId: TEST_TENANT,
      reportType: "BATTLE_POST_MATCH",
      periodPreset: "all",
      minHostScore: 200000,
    });
    expect(reportHighMin._matchCards?.length).toBe(0);
    expect(reportHighMin._minHostScore).toBe(200000);
    expect(reportHighMin.metadata.title).toContain("سكور المضيف");

    // If minHostScore is 100000, battle1 (score 150000) should be included
    const reportMatchingMin = await ReportsService.generateReport({
      tenantId: TEST_TENANT,
      reportType: "BATTLE_POST_MATCH",
      periodPreset: "all",
      minHostScore: 100000,
    });
    expect(reportMatchingMin._matchCards?.length).toBe(1);
    expect(reportMatchingMin._matchCards?.[0].id).toBe(battle1.id);
    expect(reportMatchingMin._minHostScore).toBe(100000);
    expect(reportMatchingMin.metadata.title).toContain("سكور المضيف");

    // Clean up
    await prisma.rawEvent.deleteMany({ where: { liveSession: { tenantId: TEST_TENANT } } });
    await prisma.battleParticipant.deleteMany({ where: { battle: { tenantId: TEST_TENANT } } });
    await prisma.battle.deleteMany({ where: { tenantId: TEST_TENANT } });
    await prisma.liveSession.deleteMany({ where: { tenantId: TEST_TENANT } });
  });
});
