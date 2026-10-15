import { prisma } from "../src/lib/prisma";

async function main() {
  const tenant = await prisma.tenant.findUnique({ where: { slug: "mohra-live" } });
  if (!tenant) return;

  const sessions = await prisma.liveSession.findMany({
    where: {
      tenantId: tenant.id,
      OR: [
        { totalDiamonds: { gt: 0 } },
        { totalLikes: { gt: 0 } },
        { totalComments: { gt: 0 } },
      ],
    },
    orderBy: { startedAt: "asc" },
  });

  // Calculate session hourly contributions
  // For each hour 0..23, collect data from all sessions that overlapped this hour
  interface SessionHourContribution {
    sessionId: string;
    diamonds: number;
    likes: number;
    comments: number;
    viewers: number;
  }

  const hourlyContributions = new Map<number, SessionHourContribution[]>();
  for (let h = 0; h < 24; h++) {
    hourlyContributions.set(h, []);
  }

  for (const s of sessions) {
    const started = new Date(s.startedAt);
    const ended = s.endedAt ? new Date(s.endedAt) : new Date(started.getTime() + 60 * 60 * 1000);
    const durationMin = Math.max(1, Math.round((ended.getTime() - started.getTime()) / 60000));
    const diamondRatePerHour = (s.totalDiamonds / durationMin) * 60;
    const likeRatePerHour = (s.totalLikes / durationMin) * 60;
    const commentRatePerHour = (s.totalComments / durationMin) * 60;

    // Find all Riyadh hours this session touched
    // We can iterate minute by minute or hour by hour
    const startMs = started.getTime();
    const endMs = ended.getTime();
    const touchedHours = new Set<number>();

    // Step in 10-minute intervals to find which Riyadh hours were active
    for (let t = startMs; t <= endMs; t += 10 * 60 * 1000) {
      const d = new Date(t);
      const riyadhHour = (d.getUTCHours() + 3) % 24;
      touchedHours.add(riyadhHour);
    }

    for (const h of touchedHours) {
      hourlyContributions.get(h)!.push({
        sessionId: s.id,
        diamonds: diamondRatePerHour,
        likes: likeRatePerHour,
        comments: commentRatePerHour,
        viewers: s.peakViewers || 0,
      });
    }
  }

  // Find max values across hours for normalization
  let maxAvgDiamonds = 1;
  let maxAvgComments = 1;
  let maxAvgLikes = 1;

  const tempStats: Array<{
    hour: number;
    sessionsCount: number;
    avgDiamonds: number;
    avgLikes: number;
    avgComments: number;
    avgViewers: number;
    consistency: number;
  }> = [];

  for (let h = 0; h < 24; h++) {
    const list = hourlyContributions.get(h)!;
    if (list.length === 0) continue;

    const count = list.length;
    const avgDiamonds = list.reduce((a, b) => a + b.diamonds, 0) / count;
    const avgLikes = list.reduce((a, b) => a + b.likes, 0) / count;
    const avgComments = list.reduce((a, b) => a + b.comments, 0) / count;
    const avgViewers = list.reduce((a, b) => a + b.viewers, 0) / count;

    // Consistency: variance of diamonds and comments
    let consistency = 0.5;
    if (count > 1) {
      const diamondVariance = list.reduce((acc, x) => acc + Math.pow(x.diamonds - avgDiamonds, 2), 0) / count;
      const diamondStdDev = Math.sqrt(diamondVariance);
      const cv = diamondStdDev / (avgDiamonds + 1);
      consistency = Math.max(0.15, Math.min(0.95, 1 / (1 + cv * 0.5)));
    }

    if (avgDiamonds > maxAvgDiamonds) maxAvgDiamonds = avgDiamonds;
    if (avgComments > maxAvgComments) maxAvgComments = avgComments;
    if (avgLikes > maxAvgLikes) maxAvgLikes = avgLikes;

    tempStats.push({
      hour: h,
      sessionsCount: count,
      avgDiamonds,
      avgLikes,
      avgComments,
      avgViewers,
      consistency,
    });
  }

  console.log("\n=== SIMULATED STQI SCORES ===");
  for (const item of tempStats) {
    const sDiamonds = (item.avgDiamonds / maxAvgDiamonds) * 100;
    const sChat = (item.avgComments / maxAvgComments) * 100;
    const sLikes = (item.avgLikes / maxAvgLikes) * 100;
    const sEngagement = (sChat * 0.7) + (sLikes * 0.3);
    const sConsistency = item.consistency * 100;
    const sReliability = Math.min(100, (item.sessionsCount / 5) * 100);

    const stqi = (0.35 * sDiamonds) + (0.25 * sEngagement) + (0.25 * sConsistency) + (0.15 * sReliability);
    const confidence = item.sessionsCount >= 6 ? "VERIFIED" : item.sessionsCount >= 3 ? "PARTIAL" : "INSUFFICIENT_DATA";

    const hourLabel = item.hour === 0 ? "12:00 ص" : item.hour < 12 ? `${item.hour}:00 ص` : item.hour === 12 ? "12:00 م" : `${item.hour - 12}:00 م`;
    console.log(
      `الساعة ${hourLabel.padEnd(8)} | الجلسات: ${item.sessionsCount} | 💎: ${Math.round(item.avgDiamonds).toLocaleString()} | 💬: ${Math.round(item.avgComments).toLocaleString()} | استمرارية: ${Math.round(item.consistency * 100)}% | STQI: ${stqi.toFixed(1)} | الثقة: ${confidence}`
    );
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
