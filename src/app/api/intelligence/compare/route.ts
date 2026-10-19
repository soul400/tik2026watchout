import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ForensicComparisonService } from "@/lib/forensic-comparison-service";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    let { tenantId, accountA, accountB } = body;

    if (!tenantId) {
      const defaultTenant = await prisma.tenant.findUnique({
        where: { slug: "mohra-live" },
      });
      tenantId = defaultTenant?.id || null;
    }

    if (!tenantId) {
      return NextResponse.json({ ok: false, error: "Tenant is required" }, { status: 400 });
    }

    if (!accountA || !accountB) {
      return NextResponse.json(
        { ok: false, error: "يجب تحديد طرفي المقارنة (Account A و Account B)" },
        { status: 400 }
      );
    }

    const result = await ForensicComparisonService.compareAccounts({
      tenantId,
      accountAIdentifier: accountA,
      accountBIdentifier: accountB,
    });

    return NextResponse.json({ ok: true, data: result });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
