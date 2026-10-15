import { prisma } from "@/lib/prisma";
import { EnigmaEngine } from "@/lib/enigma-engine";
import { EnigmaClient } from "./EnigmaClient";

export const dynamic = "force-dynamic";

export default async function EnigmasPage() {
  const tenant = await prisma.tenant.findUnique({
    where: { slug: "mohra-live" },
  });
  const tenantId = tenant?.id || "";

  let reviews = tenantId ? await EnigmaEngine.getEnigmaReviews(tenantId) : [];

  // Auto-sync if table is empty
  if (reviews.length === 0 && tenantId) {
    await EnigmaEngine.analyzeAndSyncEnigmaReviews(tenantId);
    reviews = await EnigmaEngine.getEnigmaReviews(tenantId);
  }

  return <EnigmaClient initialReviews={reviews} />;
}
