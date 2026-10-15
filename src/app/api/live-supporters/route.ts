import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { LiveStreamSupportersService } from "@/lib/live-supporters-service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limitParam = searchParams.get("limit");
    const limit = limitParam ? Math.min(100, Math.max(5, parseInt(limitParam, 10))) : 50;

    const tenant = await prisma.tenant.findUnique({
      where: { slug: "mohra-live" },
    });

    if (!tenant) {
      return NextResponse.json({ success: false, error: "Tenant not found" }, { status: 404 });
    }

    const data = await LiveStreamSupportersService.getCurrentLiveSupporters(tenant.id, limit, true);

    return NextResponse.json({
      success: true,
      ...data,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to fetch live supporters" },
      { status: 500 }
    );
  }
}
