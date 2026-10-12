import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SmartInventoryService } from "@/lib/smart-inventory";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const tenant = await prisma.tenant.findUnique({
      where: { slug: "mohra-live" },
    });
    if (!tenant) return NextResponse.json({ counters: [], grants: [] });

    const counters = await SmartInventoryService.getInventoryCounters(tenant.id);
    const grants = await prisma.toolGrant.findMany({
      where: { tenantId: tenant.id },
      include: {
        toolDefinition: true,
        supporter: true,
      },
      orderBy: { receivedAt: "desc" },
    });

    const serializedGrants = grants.map((g) => ({
      ...g,
      receivedAt: g.receivedAt.toISOString(),
      expiresAt: g.expiresAt.toISOString(),
    }));

    return NextResponse.json({
      counters,
      grants: serializedGrants,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message }, { status: 500 });
  }
}
