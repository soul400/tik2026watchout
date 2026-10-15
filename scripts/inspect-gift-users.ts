import { prisma } from "../src/lib/prisma";

async function main() {
  const giftEvents = await prisma.rawEvent.findMany({
    where: { eventType: "GIFT" },
    select: { payload: true, sourceTimestamp: true },
    take: 500,
  });

  console.log(`Checking ${giftEvents.length} gift events...`);
  const userKeys = new Set<string>();
  const suspectUsers: any[] = [];

  for (const ge of giftEvents) {
    try {
      const p = JSON.parse(ge.payload);
      const u = p.user || {};
      Object.keys(u).forEach(k => userKeys.add(k));

      // Check if user has anonymous or secret or enigma flags or names
      const nickname = String(u.nickname || p.nickname || "");
      const displayId = String(u.displayId || p.uniqueId || "");
      const secUid = String(u.secUid || p.secUid || "");
      const id = String(u.id || p.userId || "");

      // Check if any flag mentions mystery/anonymous/incognito
      if (
        p.isMystery || p.isAnonymous || u.isAnonymous ||
        nickname.includes("غامض") || nickname.includes("مجهول") || nickname.includes("خفي") ||
        displayId.includes("user_") || displayId.includes("tiktok") ||
        nickname === "" || displayId === ""
      ) {
        suspectUsers.push({
          nickname,
          displayId,
          secUid: secUid.slice(0, 15) + "...",
          id,
          gift: p.gift?.name || p.giftName,
          diamondCount: p.diamondCount || p.gift?.diamondCount,
        });
      }
    } catch {}
  }

  console.log("Unique user payload keys:", Array.from(userKeys));
  console.log(`Suspect/Anonymous users in 500 gifts: ${suspectUsers.length}`);
  if (suspectUsers.length > 0) {
    console.log("Sample suspect users:", suspectUsers.slice(0, 10));
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
