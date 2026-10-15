import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { TelegramService } from "@/lib/telegram-service";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    let body: any = {};
    try {
      body = await request.json();
    } catch {
      body = {};
    }

    const action = body.action || "ping";
    const botToken = body.botToken;
    const chatId = body.chatId;

    const tenant = await prisma.tenant.findUnique({ where: { slug: "mohra-live" } });
    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    if (action === "ping") {
      const res = await TelegramService.testConnection(tenant.id, botToken, chatId);
      return NextResponse.json({
        success: res.success,
        error: res.error,
        botName: res.botName,
        message: res.success ? `تم الاتصال بنجاح بالبوت (${res.botName}) وإرسال رسالة الاختبار!` : res.error,
      });
    }

    if (action === "discover_chat_id") {
      const targetUsername = body.targetUsername || "Blacksoul_8";
      const res = await TelegramService.resolveChatIdFromUpdates(tenant.id, targetUsername, botToken);
      return NextResponse.json({
        success: res.success,
        error: res.error,
        chatId: res.chatId,
        botUsername: res.botUsername,
        message: res.success
          ? `تم العثور على المعرف الرقمي لحساب @${targetUsername} (${res.chatId}) وربطه بنجاح!`
          : res.error,
      });
    }

    const res = await TelegramService.testSpecificAlert(tenant.id, action);

    return NextResponse.json({
      success: res.success,
      error: res.error,
      messageId: res.messageId,
      message: res.success ? "تم إرسال التنبيه إلى تليقرام بنجاح!" : res.error,
    });
  } catch (error: any) {
    console.error("[Telegram Test API Error]", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to execute Telegram action" },
      { status: 500 }
    );
  }
}
