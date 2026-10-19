import { NextResponse } from "next/server";
import { StreamHealthService } from "@/lib/stream-health";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    let tenantId = searchParams.get("tenantId");

    if (!tenantId) {
      const defaultTenant = await prisma.tenant.findUnique({ where: { slug: "mohra-live" } });
      if (defaultTenant) tenantId = defaultTenant.id;
    }

    const health = await StreamHealthService.getHealthTelemetry(tenantId || undefined);

    const httpStatus = health.overallHealth === "CRITICAL" ? 503 : 200;
    return NextResponse.json(health, { status: httpStatus });
  } catch (error: any) {
    return NextResponse.json(
      {
        status: "DEGRADED",
        overallHealth: "CRITICAL",
        error: error?.message || "Health check execution failure",
        checkedAt: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
