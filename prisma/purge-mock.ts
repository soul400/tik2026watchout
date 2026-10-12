import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function purgeMockData() {
  console.log("==================================================");
  console.log("Purging all mock, simulated, and seeded data...");
  console.log("==================================================");

  // 1. Delete all mock transactions and events
  await prisma.auditLog.deleteMany({});
  await prisma.analyticalReport.deleteMany({});
  await prisma.enigmaReview.deleteMany({});
  await prisma.championScore.deleteMany({});
  await prisma.championPeriod.deleteMany({});
  await prisma.hourlyAnalytics.deleteMany({});
  await prisma.inventoryAlert.deleteMany({});
  await prisma.toolConsumption.deleteMany({});
  await prisma.toolGrant.deleteMany({});
  await prisma.battleScoreEvent.deleteMany({});
  await prisma.battleParticipant.deleteMany({});
  await prisma.battle.deleteMany({});
  await prisma.rawEvent.deleteMany({});
  await prisma.liveSession.deleteMany({});
  await prisma.supporter.deleteMany({});

  console.log("✓ All mock supporters, battles, grants, and events deleted.");

  // 2. Keep Clean System Definitions & Real Streamer Account (@mohra.2000)
  const tenant = await prisma.tenant.upsert({
    where: { slug: "mohra-live" },
    update: {},
    create: {
      name: "Mohra Live Intelligence",
      slug: "mohra-live",
      plan: "PRO",
      status: "ACTIVE",
    },
  });

  const streamer = await prisma.streamerAccount.upsert({
    where: {
      tenantId_username: {
        tenantId: tenant.id,
        username: "mohra.2000",
      },
    },
    update: {},
    create: {
      tenantId: tenant.id,
      username: "mohra.2000",
      displayName: "مهـرة 🇸🇦",
      platformUserId: "7108920192847291001",
      status: "ACTIVE",
    },
  });

  // Ensure standard TikTok LIVE Power-Up definitions exist in catalog
  const powerUps = [
    { key: "GLOVE", name: "القفاز التكتيكي (Glove x5)", icon: "ShieldAlert", colorHex: "#F5B942" },
    { key: "BOOST_FOG", name: "الضباب المعزز (Boost Fog)", icon: "CloudFog", colorHex: "#21D4D8" },
    { key: "TIME_EXTENDER", name: "ممدد الوقت التكتيكي (Time Extender)", icon: "Hourglass", colorHex: "#4A8DFF" },
    { key: "SPEED_BOOSTER", name: "معزز السرعة المزدوج (Speed Challenge)", icon: "Zap", colorHex: "#8B72F8" },
    { key: "HAMMER", name: "مطرقة الحظر التكتيكية (Hammer)", icon: "Hammer", colorHex: "#F06464" },
    { key: "SHIELD_DEFENSE", name: "درع الصمود الدفاعي (Shield)", icon: "Shield", colorHex: "#26C281" },
  ];

  for (const p of powerUps) {
    await prisma.toolDefinition.upsert({
      where: { tenantId_key: { tenantId: tenant.id, key: p.key } },
      update: {},
      create: {
        tenantId: tenant.id,
        key: p.key,
        name: p.name,
        icon: p.icon,
        colorHex: p.colorHex,
        defaultHours: 120,
        isActive: true,
      },
    });
  }

  console.log("✓ System catalog ready. Database is 100% clean and ready for LIVE stream events.");
  console.log("==================================================");
}

purgeMockData()
  .catch((e) => {
    console.error("Purge error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
