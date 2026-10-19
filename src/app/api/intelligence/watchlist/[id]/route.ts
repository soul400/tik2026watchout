import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { IntelligenceLabService } from "@/lib/intelligence-lab-service";

export const dynamic = "force-dynamic";

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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

    await IntelligenceLabService.removeFromWatchlist(tenantId, id);
    return NextResponse.json({ ok: true, message: "تمت إزالة الحساب من قائمة المراقبة" });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
