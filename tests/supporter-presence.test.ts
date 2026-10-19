import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "../src/lib/prisma";
import { SupporterPresenceEngine } from "../src/lib/supporter-presence";
import { ReportsService } from "../src/lib/reports-service";

describe("Supporter Presence Pattern Report — Production Engine Tests", () => {
  const tenantAId = "test-tenant-presence-a";
  const tenantBId = "test-tenant-presence-b";

  beforeEach(async () => {
    SupporterPresenceEngine.clearCache();

    // Clean up test tenants if existing
    await prisma.rawEvent.deleteMany({
      where: {
        liveSession: {
          tenantId: { in: [tenantAId, tenantBId] },
        },
      },
    }).catch(() => {});

    await prisma.supporter.deleteMany({
      where: { tenantId: { in: [tenantAId, tenantBId] } },
    }).catch(() => {});

    await prisma.liveSession.deleteMany({
      where: { tenantId: { in: [tenantAId, tenantBId] } },
    }).catch(() => {});

    await prisma.streamerAccount.deleteMany({
      where: { tenantId: { in: [tenantAId, tenantBId] } },
    }).catch(() => {});

    await prisma.tenant.deleteMany({
      where: { id: { in: [tenantAId, tenantBId] } },
    }).catch(() => {});

    // Create test tenant A
    await prisma.tenant.create({
      data: {
        id: tenantAId,
        name: "Presence Test Tenant A",
        slug: "presence-test-a",
      },
    });

    // Create streamer account for Tenant A
    await prisma.streamerAccount.create({
      data: {
        id: "streamer-tenant-a",
        tenantId: tenantAId,
        username: "test.streamer.a",
        displayName: "Streamer A",
      },
    });

    // Create test tenant B (for multi-tenant isolation verification)
    await prisma.tenant.create({
      data: {
        id: tenantBId,
        name: "Presence Test Tenant B",
        slug: "presence-test-b",
      },
    });
  });

  it("1. filters supporters strictly by cumulative diamonds threshold (default 100,000)", async () => {
    // Top supporter with 150k diamonds
    await prisma.supporter.create({
      data: {
        id: "supp-vip-100k",
        tenantId: tenantAId,
        platformUserId: "uid-vip-100k",
        username: "king_supporter",
        displayName: "King Supporter",
        totalDiamonds: 150000,
      },
    });

    // Supporter with exactly 100,000 diamonds
    await prisma.supporter.create({
      data: {
        id: "supp-exact-100k",
        tenantId: tenantAId,
        platformUserId: "uid-exact-100k",
        username: "edge_supporter",
        displayName: "Edge Supporter",
        totalDiamonds: 100000,
      },
    });

    // Supporter with 99,999 diamonds (should be excluded by default)
    await prisma.supporter.create({
      data: {
        id: "supp-below-100k",
        tenantId: tenantAId,
        platformUserId: "uid-below-100k",
        username: "below_supporter",
        displayName: "Below Supporter",
        totalDiamonds: 99999,
      },
    });

    // Default threshold = 100,000
    const defaultReports = await SupporterPresenceEngine.getPresencePatternsReport({
      tenantId: tenantAId,
    });
    expect(defaultReports.length).toBe(2);
    const usernames = defaultReports.map((r) => r.supporter.username);
    expect(usernames).toContain("king_supporter");
    expect(usernames).toContain("edge_supporter");
    expect(usernames).not.toContain("below_supporter");

    // Configurable threshold = 50,000 (should now include below_supporter)
    SupporterPresenceEngine.clearCache();
    const lowThresholdReports = await SupporterPresenceEngine.getPresencePatternsReport({
      tenantId: tenantAId,
      minDiamonds: 50000,
    });
    expect(lowThresholdReports.length).toBe(3);
    expect(lowThresholdReports.map((r) => r.supporter.username)).toContain("below_supporter");
  });

  it("2. accurately segments sessions based on inactivity gap (25 min) and respects broadcast boundaries", () => {
    const broadcast1 = "session-b1";
    const broadcast2 = "session-b2";

    // Base time: 2026-10-18 20:00:00 UTC
    const base = new Date("2026-10-18T20:00:00.000Z").getTime();

    const mockEvents = [
      // Broadcast 1: Session 1 (events at 0m, 5m, 15m)
      { id: "e1", liveSessionId: broadcast1, eventType: "GIFT", sourceTimestamp: new Date(base) },
      { id: "e2", liveSessionId: broadcast1, eventType: "CHAT", sourceTimestamp: new Date(base + 5 * 60000) },
      { id: "e3", liveSessionId: broadcast1, eventType: "CHAT", sourceTimestamp: new Date(base + 15 * 60000) },

      // Broadcast 1: Inactivity gap = 30 min (> 25 min default), starts Session 2 (at 45m and 55m)
      { id: "e4", liveSessionId: broadcast1, eventType: "GIFT", sourceTimestamp: new Date(base + 45 * 60000) },
      { id: "e5", liveSessionId: broadcast1, eventType: "GIFT", sourceTimestamp: new Date(base + 55 * 60000) },

      // Broadcast 2: Even if time difference is only 5 minutes from previous event,
      // it MUST NOT merge across broadcasts! Starts Session 3
      { id: "e6", liveSessionId: broadcast2, eventType: "CHAT", sourceTimestamp: new Date(base + 60 * 60000) },
      { id: "e7", liveSessionId: broadcast2, eventType: "CHAT", sourceTimestamp: new Date(base + 70 * 60000) },
    ];

    const sessions = SupporterPresenceEngine.reconstructSessions(mockEvents, 25);

    expect(sessions.length).toBe(3);

    // Session 1: broadcast1, duration = 15m - 0m = 15 min, 3 events
    expect(sessions[0].liveSessionId).toBe(broadcast1);
    expect(sessions[0].durationMinutes).toBe(15);
    expect(sessions[0].eventCount).toBe(3);

    // Session 2: broadcast1, duration = 55m - 45m = 10 min, 2 events
    expect(sessions[1].liveSessionId).toBe(broadcast1);
    expect(sessions[1].durationMinutes).toBe(10);
    expect(sessions[1].eventCount).toBe(2);

    // Session 3: broadcast2, duration = 70m - 60m = 10 min, 2 events
    expect(sessions[2].liveSessionId).toBe(broadcast2);
    expect(sessions[2].durationMinutes).toBe(10);
    expect(sessions[2].eventCount).toBe(2);
  });

  it("3. handles single-event sessions safely without inventing departure timestamps", () => {
    const singleEvent = [
      {
        id: "e-single",
        liveSessionId: "session-single",
        eventType: "GIFT",
        sourceTimestamp: new Date("2026-10-18T18:00:00.000Z"),
      },
    ];

    const sessions = SupporterPresenceEngine.reconstructSessions(singleEvent, 25);
    expect(sessions.length).toBe(1);
    expect(sessions[0].durationMinutes).toBe(0);
    expect(sessions[0].isMultiEvent).toBe(false);
    expect(sessions[0].quality).toBe("SINGLE_EVENT");

    const analysis = SupporterPresenceEngine.analyzeSupporterPresence(
      {
        id: "supp-single",
        platformUserId: "uid-single",
        username: "one_shot_supporter",
        displayName: "One Shot",
        avatarUrl: null,
        totalDiamonds: 120000,
        firstObservedAt: new Date("2026-10-18T18:00:00.000Z"),
        lastObservedAt: new Date("2026-10-18T18:00:00.000Z"),
        category: "CONTINUOUS",
      },
      singleEvent
    );

    // When only single events exist, average & median duration should be null (not 0 or invented)
    expect(analysis.sessionDuration.avgMinutes).toBeNull();
    expect(analysis.sessionDuration.medianMinutes).toBeNull();
    expect(analysis.evidenceQuality).toBe("INSUFFICIENT_DATA");
    expect(analysis.evidenceQualityLabel).toBe("بيانات غير كافية");
  });

  it("4. computes correct Asia/Riyadh hours and weekdays with midnight rollover", () => {
    // 2026-10-18 22:30:00 UTC -> in Asia/Riyadh (UTC+3) it is 2026-10-19 01:30:00 (Monday)
    const dateUtc = new Date("2026-10-18T22:30:00.000Z");
    const { hour, dayOfWeek } = SupporterPresenceEngine.getRiyadhHourAndDay(dateUtc);

    expect(hour).toBe(1); // 1:30 AM
    expect(dayOfWeek).toBe(1); // Monday in Riyadh

    // 2026-10-18 10:00:00 UTC -> 13:00 (1:00 PM) Sunday in Riyadh
    const dateUtc2 = new Date("2026-10-18T10:00:00.000Z");
    const { hour: hour2, dayOfWeek: dayOfWeek2 } = SupporterPresenceEngine.getRiyadhHourAndDay(dateUtc2);

    expect(hour2).toBe(13);
    expect(dayOfWeek2).toBe(0); // Sunday in Riyadh
  });

  it("5. classifies evidence quality progression correctly", () => {
    const supporter = {
      id: "supp-prog",
      platformUserId: "uid-prog",
      username: "prog_supporter",
      displayName: "Prog Supporter",
      avatarUrl: null,
      totalDiamonds: 200000,
      firstObservedAt: new Date("2026-10-10T10:00:00.000Z"),
      lastObservedAt: new Date("2026-10-18T10:00:00.000Z"),
      category: "CONTINUOUS",
    };

    // Case A: 2 events across 1 session -> INSUFFICIENT_DATA
    const eventsA = [
      { id: "1", liveSessionId: "s1", eventType: "GIFT", sourceTimestamp: new Date("2026-10-10T10:00:00.000Z") },
      { id: "2", liveSessionId: "s1", eventType: "CHAT", sourceTimestamp: new Date("2026-10-10T10:05:00.000Z") },
    ];
    const resA = SupporterPresenceEngine.analyzeSupporterPresence(supporter, eventsA);
    expect(resA.evidenceQuality).toBe("INSUFFICIENT_DATA");

    // Case B: 3 distinct sessions across 2 broadcasts -> INITIAL_PATTERN
    const eventsB = [
      { id: "1", liveSessionId: "s1", eventType: "GIFT", sourceTimestamp: new Date("2026-10-10T10:00:00.000Z") },
      { id: "2", liveSessionId: "s1", eventType: "CHAT", sourceTimestamp: new Date("2026-10-10T10:05:00.000Z") },
      { id: "3", liveSessionId: "s1", eventType: "CHAT", sourceTimestamp: new Date("2026-10-10T12:00:00.000Z") },
      { id: "4", liveSessionId: "s2", eventType: "GIFT", sourceTimestamp: new Date("2026-10-11T10:00:00.000Z") },
    ];
    const resB = SupporterPresenceEngine.analyzeSupporterPresence(supporter, eventsB);
    expect(resB.evidenceQuality).toBe("INITIAL_PATTERN");
  });

  it("6. guarantees multi-tenant isolation (Tenant B cannot see Tenant A's presence data)", async () => {
    // Supporter in Tenant A
    await prisma.supporter.create({
      data: {
        id: "supp-tenant-a",
        tenantId: tenantAId,
        platformUserId: "uid-tenant-a",
        username: "tenant_a_user",
        displayName: "Tenant A User",
        totalDiamonds: 250000,
      },
    });

    // Supporter in Tenant B
    await prisma.supporter.create({
      data: {
        id: "supp-tenant-b",
        tenantId: tenantBId,
        platformUserId: "uid-tenant-b",
        username: "tenant_b_user",
        displayName: "Tenant B User",
        totalDiamonds: 300000,
      },
    });

    const reportA = await SupporterPresenceEngine.getPresencePatternsReport({
      tenantId: tenantAId,
    });
    expect(reportA.length).toBe(1);
    expect(reportA[0].supporter.username).toBe("tenant_a_user");

    const reportB = await SupporterPresenceEngine.getPresencePatternsReport({
      tenantId: tenantBId,
    });
    expect(reportB.length).toBe(1);
    expect(reportB[0].supporter.username).toBe("tenant_b_user");
  });

  it("7. generates complete report via ReportsService with safe CSV and BOM", async () => {
    // Create live session and events for Tenant A
    const liveSession = await prisma.liveSession.create({
      data: {
        id: "ls-presence-test-1",
        tenantId: tenantAId,
        streamerAccountId: "streamer-tenant-a",
        status: "ENDED",
        startedAt: new Date("2026-10-18T10:00:00.000Z"),
        endedAt: new Date("2026-10-18T12:00:00.000Z"),
        totalDiamonds: 150000,
      },
    });

    // Create supporter with potential CSV injection formula in display name
    const supporter = await prisma.supporter.create({
      data: {
        id: "supp-csv-injection",
        tenantId: tenantAId,
        platformUserId: "uid-csv-test",
        username: "attacker",
        displayName: "=SUM(1+1)",
        totalDiamonds: 180000,
        firstObservedAt: new Date("2026-10-18T10:00:00.000Z"),
        lastObservedAt: new Date("2026-10-18T10:45:00.000Z"),
      },
    });

    // Create raw events using standard deduplicationKey format
    await prisma.rawEvent.create({
      data: {
        id: "re-1",
        liveSessionId: liveSession.id,
        deduplicationKey: `${liveSession.id}_GIFT_${supporter.platformUserId}_1791730000000_1`,
        eventType: "GIFT",
        sourceTimestamp: new Date("2026-10-18T10:00:00.000Z"),
        payload: JSON.stringify({ giftName: "Rosa", diamondCount: 100 }),
      },
    });

    await prisma.rawEvent.create({
      data: {
        id: "re-2",
        liveSessionId: liveSession.id,
        deduplicationKey: `${liveSession.id}_CHAT_${supporter.platformUserId}_1791731500000_2`,
        eventType: "CHAT",
        sourceTimestamp: new Date("2026-10-18T10:25:00.000Z"),
        payload: JSON.stringify({ comment: "hello" }),
      },
    });

    const report = await ReportsService.generateReport({
      tenantId: tenantAId,
      reportType: "SUPPORTER_PRESENCE_PATTERN",
    });

    expect(report.metadata.reportType).toBe("SUPPORTER_PRESENCE_PATTERN");
    expect(report.metadata.title).toContain("تقرير نمط تواجد الداعمين");
    expect(report.headers).toContain("الداعم المعتمد");
    expect(report.headers).toContain("إجمالي الدعم التراكمي");
    expect(report.headers).toContain("ساعات الذروة (بتوقيت الرياض)");
    expect(report.headers).toContain("موثوقية النمط الإحصائي");

    expect(report.rows.length).toBe(1);
    expect(report.rows[0]["عدد البثوث المرصودة"]).toBe(1);
    expect(report.rows[0]["متوسط مدة الجلسة (تقديري)"]).toContain("25 دقيقة");

    // Verify KPIs
    expect(report.kpis.length).toBeGreaterThanOrEqual(5);
    expect(report.kpis[0].label).toContain("الداعمون المؤهلون");
    expect(report.kpis[0].value).toBe(1);

    // Verify CSV Content has UTF-8 BOM
    expect(report.csvContent?.startsWith("\uFEFF")).toBe(true);

    // Verify CSV formula injection was neutralized with leading quote
    expect(report.csvContent).toContain("'=SUM(1+1)");
    expect(report.csvContent).not.toMatch(/\n=SUM\(1\+1\)/);
  });
});
