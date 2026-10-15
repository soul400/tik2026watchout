import { prisma } from "../src/lib/prisma";

async function main() {
  const supporters = await prisma.supporter.findMany({
    orderBy: { totalDiamonds: "desc" },
    take: 50,
  });

  console.log("Top 50 supporters:");
  for (const s of supporters) {
    console.log(`ID: ${s.id} | platformUserId: ${s.platformUserId} | username: ${s.username} | displayName: ${s.displayName} | diamonds: ${s.totalDiamonds}`);
  }

  // Look for any supporters with anonymous/mystery/enigma names or multiple usernames for same platformUserId
  const allSupporters = await prisma.supporter.findMany();
  console.log(`\nTotal supporters in DB: ${allSupporters.length}`);

  const enigmaKeywords = ["غامض", "مجهول", "خفي", "enigma", "ghost", "incognito", "secret", "user_", "tiktok user", "مستخدم"];
  const suspectSupporters = allSupporters.filter(s => {
    const un = (s.username || "").toLowerCase();
    const dn = (s.displayName || "").toLowerCase();
    return enigmaKeywords.some(k => un.includes(k) || dn.includes(k));
  });

  console.log(`\nSuspect / Generic / Enigma named supporters: ${suspectSupporters.length}`);
  for (const s of suspectSupporters) {
    console.log(`- ${s.username} (${s.displayName}) | platformUserId: ${s.platformUserId} | diamonds: ${s.totalDiamonds} | comments: ${s.totalComments}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
