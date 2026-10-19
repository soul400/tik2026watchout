import { NextResponse } from "next/server";
import { TelegramService } from "@/lib/telegram-service";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const update = await req.json();
    const { searchParams } = new URL(req.url);
    let tenantId = searchParams.get("tenantId");

    if (!tenantId) {
      const defaultTenant = await prisma.tenant.findUnique({ where: { slug: "mohra-live" } });
      if (defaultTenant) tenantId = defaultTenant.id;
    }

    if (!tenantId) {
      return NextResponse.json({ ok: false, error: "Tenant required" }, { status: 400 });
    }

    const message = update.message || update.edited_message;
    if (!message) {
      return NextResponse.json({ ok: true, ignored: true });
    }

    const result = await TelegramService.processIncomingCommand(tenantId, message);
    return NextResponse.json({ ok: true, result });
  } catch (error: any) {
    console.error("[TELEGRAM_WEBHOOK] Error handling update:", error);
    return NextResponse.json({ ok: false, error: error?.message || "Internal error" }, { status: 500 });
  }
}
