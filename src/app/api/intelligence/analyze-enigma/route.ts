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

    const auditResult = await IntelligenceLabService.analyzeHistoricalEnigmaAccounts(tenantId);
    return NextResponse.json({ ok: true, data: auditResult });
  } catch (err: any) {
    console.error("[INTELLIGENCE_ANALYZE_ENIGMA_API_ERROR]", err);
    return NextResponse.json(
      { ok: false, error: err?.message || "Internal server error during Enigma historical analysis" },
      { status: 500 }
    );
  }
}
