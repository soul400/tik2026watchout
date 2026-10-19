import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { EnigmaRadarService } from "@/lib/enigma-radar-service";
import { RadarTriggerCategory } from "@/lib/intelligence-types";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    let tenantId = searchParams.get("tenantId");

    if (!tenantId) {
      const defaultTenant = await prisma.tenant.findUnique({
        where: { slug: "mohra-live" },
      });
      tenantId = defaultTenant?.id || null;
    }

    if (!tenantId) {
      return NextResponse.json({ ok: false, error: "Tenant is required" }, { status: 400 });
    }

    const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit") || 50)));
    const triggerCategory = (searchParams.get("category") as RadarTriggerCategory) || undefined;
    const reviewStatus = searchParams.get("status") || undefined;

    const alerts = await EnigmaRadarService.getRecentAlerts({
      tenantId,
      limit,
      triggerCategory,
      reviewStatus,
    });

    return NextResponse.json({ ok: true, data: alerts });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
