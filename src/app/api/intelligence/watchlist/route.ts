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

    const entries = await IntelligenceLabService.getWatchlist(tenantId);
    return NextResponse.json({ ok: true, data: entries });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    let { tenantId, username, displayName, platformUserId, reason, category, severity } = body;

    if (!tenantId) {
      const defaultTenant = await prisma.tenant.findUnique({
        where: { slug: "mohra-live" },
      });
      tenantId = defaultTenant?.id || null;
    }

    if (!tenantId) {
      return NextResponse.json({ ok: false, error: "Tenant is required" }, { status: 400 });
    }

    if (!username || !reason) {
      return NextResponse.json(
        { ok: false, error: "يجب تحديد اسم المستخدم وسبب المراقبة" },
        { status: 400 }
      );
    }

    const created = await IntelligenceLabService.addToWatchlist(tenantId, {
      username,
      displayName,
      platformUserId,
      reason,
      category,
      severity,
    });

    return NextResponse.json({ ok: true, data: created });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
