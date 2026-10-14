import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding comprehensive TikTok LIVE Power-Up tools catalog...");

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

  const user = await prisma.user.upsert({
    where: { email: "owner@mohra2000.com" },
    update: {},
    create: {
      email: "owner@mohra2000.com",
      name: "مهـرة",
      avatarUrl: "https://p16-sign-va.tiktokcdn.com/tos-maliva-avt-0068/default.jpeg",
    },
  });

  await prisma.tenantMembership.upsert({
    where: {
      tenantId_userId: {
        tenantId: tenant.id,
        userId: user.id,
      },
    },
    update: {},
    create: {
      tenantId: tenant.id,
      userId: user.id,
      role: "STREAMER_OWNER",
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
      avatarUrl: "https://p16-sign-va.tiktokcdn.com/tos-maliva-avt-0068/default.jpeg",
      status: "ACTIVE",
    },
  });

  // 1. ALL TIKTOK LIVE POWER-UPS CATALOG
  const tools = [
    {
      key: "GLOVE",
      name: "القفاز المعزز (Boosting Glove x5)",
      description: "نافذة 30 ثانية تمنح الهدايا فرصة تصل إلى 30% لمضاعفة النقاط ×5 أثناء المعركة",
      icon: "ShieldAlert",
      colorHex: "#F5B942", // Gold
      defaultHours: 120, // 5 days
    },
    {
      key: "SONG_SURGE",
      name: "موجة الغناء (Song Surge)",
      description: "أداة تفاعلية تمنح المضيف 30 ثانية لبدء الغناء وتفعيل فرصة 30% لمضاعفة نقاط الهدايا ×5",
      icon: "Mic2",
      colorHex: "#A855F7", // Purple/Violet
      defaultHours: 120,
    },
    {
      key: "BOOST_FOG",
      name: "الضباب السحري (Magic Mist)",
      description: "يُنشر في آخر 30 ثانية من الجولة لحجب سكور الهدايا وإرباك حسابات المنافس",
      icon: "CloudFog",
      colorHex: "#21D4D8", // Turquoise
      defaultHours: 120,
    },
    {
      key: "TIME_EXTENDER",
      name: "ممدد الوقت +10ث (Timer Extender)",
      description: "يُستخدم في الثواني الأخيرة لتمديد وقت الجولة ومنح الفريق فرصة حسم إضافية",
      icon: "Hourglass",
      colorHex: "#3B82F6", // Blue
      defaultHours: 120,
    },
    {
      key: "HAMMER",
      name: "مطرقة النصر والتجميد (Victory Hammer)",
      description: "تُستخدم أثناء فترة الاحتفال بالنصر لتجميد وتعطيل تفاعل المنافس",
      icon: "Hammer",
      colorHex: "#EC4899", // Pink
      defaultHours: 120,
    },
    {
      key: "SPEED_BOOSTER",
      name: "معزز السرعة (Speed Challenge)",
      description: "يضاعف سرعة احتساب نقاط التكبيس والهدايا في فترات السرعة الخاطفة",
      icon: "Zap",
      colorHex: "#8B72F8", // Violet
      defaultHours: 120,
    },
    {
      key: "SHIELD_DEFENSE",
      name: "درع الصمود التكتيكي (Shield Defense)",
      description: "يمتص ضربات الخصم المفاجئة ويحمي تقدم النقاط لفترة زمنية محددة",
      icon: "Shield",
      colorHex: "#10B981", // Emerald
      defaultHours: 120,
    },
  ];

  const createdToolDefs = [];
  for (const t of tools) {
    const def = await prisma.toolDefinition.upsert({
      where: {
        tenantId_key: {
          tenantId: tenant.id,
          key: t.key,
        },
      },
      update: {
        name: t.name,
        description: t.description,
        colorHex: t.colorHex,
        defaultHours: t.defaultHours,
      },
      create: {
        tenantId: tenant.id,
        key: t.key,
        name: t.name,
        description: t.description,
        icon: t.icon,
        colorHex: t.colorHex,
        defaultHours: t.defaultHours,
        isActive: true,
      },
    });
    createdToolDefs.push(def);
  }

  // 2. Supporters
  const s1 = await prisma.supporter.upsert({
    where: {
      tenantId_platformUserId: {
        tenantId: tenant.id,
        platformUserId: "user_khalid_999",
      },
    },
    update: {},
    create: {
      tenantId: tenant.id,
      platformUserId: "user_khalid_999",
      username: "khalid_alqahtani",
      displayName: "خـالد القحطاني 🦅",
      category: "CONTINUOUS",
      totalDiamonds: 520000,
      totalLikes: 18400,
      totalComments: 490,
      dataConfidence: "VERIFIED",
    },
  });

  const s2 = await prisma.supporter.upsert({
    where: {
      tenantId_platformUserId: {
        tenantId: tenant.id,
        platformUserId: "user_faisal_vip",
      },
    },
    update: {},
    create: {
      tenantId: tenant.id,
      platformUserId: "user_faisal_vip",
      username: "faisal_vip",
      displayName: "فـيصل الشمري ⭐",
      category: "BATTLE_PARTICIPANT",
      totalDiamonds: 340000,
      totalLikes: 11200,
      totalComments: 280,
      dataConfidence: "VERIFIED",
    },
  });

  const s3 = await prisma.supporter.upsert({
    where: {
      tenantId_platformUserId: {
        tenantId: tenant.id,
        platformUserId: "user_turki_ksa",
      },
    },
    update: {},
    create: {
      tenantId: tenant.id,
      platformUserId: "user_turki_ksa",
      username: "turki_ksa",
      displayName: "تـركي العتيبي 🇸🇦",
      category: "ACTIVE",
      totalDiamonds: 210000,
      totalLikes: 9400,
      totalComments: 310,
      dataConfidence: "VERIFIED",
    },
  });

  // 3. Grants for All Tool Types with Exact 5-Day Expiration
  const now = new Date();
  const fiveDaysLater = new Date(now.getTime() + 120 * 60 * 60 * 1000);

  const sampleGrants = [
    { def: createdToolDefs[0], sup: s1, qty: 3, id: "grant_khalid_glove_01" },
    { def: createdToolDefs[1], sup: s1, qty: 2, id: "grant_khalid_fog_01" },
    { def: createdToolDefs[2], sup: s2, qty: 1, id: "grant_faisal_extender_01" },
    { def: createdToolDefs[3], sup: s2, qty: 2, id: "grant_faisal_speed_01" },
    { def: createdToolDefs[4], sup: s3, qty: 1, id: "grant_turki_hammer_01" },
    { def: createdToolDefs[5], sup: s3, qty: 2, id: "grant_turki_shield_01" },
  ];

  for (const g of sampleGrants) {
    await prisma.toolGrant.upsert({
      where: { sourceEventId: g.id },
      update: {},
      create: {
        tenantId: tenant.id,
        supporterId: g.sup.id,
        toolDefinitionId: g.def.id,
        sourceEventId: g.id,
        quantityGranted: g.qty,
        quantityConsumed: 0,
        receivedAt: now,
        expiresAt: fiveDaysLater,
        status: "AVAILABLE",
        auditReference: "منحة تلقائية - انتصار في الجولة التكتيكية",
      },
    });
  }

  console.log("Seeding all Power-Up tools completed successfully!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
