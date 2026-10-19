import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { IntelligenceLabService } from "@/lib/intelligence-lab-service";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    let tenantId = body?.tenantId;

    if (!tenantId) {
      const defaultTenant = await prisma.tenant.findUnique({
        where: { slug: "mohra-live" },
      });
      tenantId = defaultTenant?.id || null;
    }

    if (!tenantId) {
      return NextResponse.json({ ok: false, error: "Tenant is required" }, { status: 400 });
    }

    const result = await IntelligenceLabService.syncHistoricalIntelligenceData(tenantId);
    return NextResponse.json({ ok: true, data: result });
  } catch (err: any) {
    console.error("[INTELLIGENCE_SYNC_API_ERROR]", err);
    return NextResponse.json(
      { ok: false, error: err?.message || "Internal server error during intelligence sync" },
      { status: 500 }
    );
  }
}
