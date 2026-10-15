import { prisma } from "../src/lib/prisma";

async function main() {
  const tenant = await prisma.tenant.findUnique({ where: { slug: "mohra-live" } });
  if (!tenant) {
    console.log("Tenant not found");
    return;
  }

  // Get all sessions
  const sessions = await prisma.liveSession.findMany({
    where: { tenantId: tenant.id },
    orderBy: { startedAt: "asc" },
  });

  console.log(`Total sessions: ${sessions.length}`);

  // Fetch all GIFT and CHAT raw events
  console.log("Fetching raw events...");
  const rawEvents = await prisma.rawEvent.findMany({
    select: {
      eventType: true,
      sourceTimestamp: true,
      payload: true,
      liveSessionId: true,
    },
  });

  console.log(`Fetched ${rawEvents.length} raw events.`);

  // Group events by riyadhHour (0 - 23)
  // Asia/Riyadh is UTC + 3
  const hourMap = new Map<number, {
    diamonds: number;
    comments: number;
    likes: number;
    sessionIds: Set<string>;
    eventCount: number;
  }>();

  for (let h = 0; h < 24; h++) {
    hourMap.set(h, {
      diamonds: 0,
      comments: 0,
      likes: 0,
      sessionIds: new Set<string>(),
      eventCount: 0,
    });
  }

  for (const ev of rawEvents) {
    const d = new Date(ev.sourceTimestamp);
    // Riyadh is UTC + 3
    const riyadhHour = (d.getUTCHours() + 3) % 24;
    const entry = hourMap.get(riyadhHour)!;
    entry.eventCount++;
    entry.sessionIds.add(ev.liveSessionId);

    if (ev.eventType === "GIFT") {
      try {
        const parsed = JSON.parse(ev.payload);
        const count = Number(parsed.repeatCount || 1);
        const diamondUnit = Number(parsed.diamondCount || parsed.gift?.diamondCount || 0);
        entry.diamonds += count * diamondUnit;
      } catch {}
    } else if (ev.eventType === "CHAT") {
      entry.comments++;
    }
  }

  // Also factor in session likes and peakViewers
  for (const s of sessions) {
    if (s.totalLikes > 0 || s.totalDiamonds > 0) {
      const d = new Date(s.startedAt);
      const riyadhHour = (d.getUTCHours() + 3) % 24;
      const entry = hourMap.get(riyadhHour)!;
      entry.sessionIds.add(s.id);
      entry.likes += s.totalLikes;
    }
  }

  console.log("\n--- HOURLY BREAKDOWN (Asia/Riyadh UTC+3) ---");
  for (let h = 0; h < 24; h++) {
    const data = hourMap.get(h)!;
    if (data.sessionIds.size > 0 || data.eventCount > 0) {
      console.log(
        `Hour ${h.toString().padStart(2, '0')}:00 | Sessions: ${data.sessionIds.size} | Events: ${data.eventCount} | Diamonds: ${data.diamonds.toLocaleString()} | Comments: ${data.comments.toLocaleString()} | Likes: ${data.likes.toLocaleString()}`
      );
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
