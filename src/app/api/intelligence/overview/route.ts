import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { IntelligenceLabService } from "@/lib/intelligence-lab-service";

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

    const overview = await IntelligenceLabService.getCommandCenterOverview(tenantId);
    return NextResponse.json({ ok: true, data: overview });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
