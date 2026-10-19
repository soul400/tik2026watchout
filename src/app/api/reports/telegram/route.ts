import { NextResponse } from "next/server";
import { TelegramService } from "@/lib/telegram-service";
import { ReportType } from "@/lib/reports-service";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    let tenantId = body.tenantId;

    if (!tenantId) {
      const defaultTenant = await prisma.tenant.findUnique({ where: { slug: "mohra-live" } });
      tenantId = defaultTenant?.id;
    }
    if (!tenantId) {
      return NextResponse.json({ ok: false, error: "Tenant is required" }, { status: 400 });
    }

    const reportType = (body.reportType || body.type || "LIVE_SESSION_SUMMARY") as ReportType;
    const periodPreset = body.periodPreset || body.period || undefined;
    const date = body.date || undefined;
    const threshold = body.threshold ? Number(body.threshold) : undefined;
    const minHostScore = body.minHostScore ? Number(body.minHostScore) : undefined;
    const chatIdOverride = body.chatId || undefined;

    const result = await TelegramService.sendReportPdf(tenantId, reportType, {
      periodPreset,
      date,
      threshold,
      minHostScore,
      chatIdOverride,
    });

    if (!result.success) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      ok: true,
      message: `تم إرسال تقرير الـ PDF بنجاح إلى تليقرام (${result.filename})`,
      filename: result.filename,
      messageId: result.messageId,
    });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || "Internal server error" }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    let tenantId: string | null = searchParams.get("tenantId");
    if (!tenantId) {
      const defaultTenant = await prisma.tenant.findUnique({ where: { slug: "mohra-live" } });
      tenantId = defaultTenant?.id ?? null;
    }
    if (!tenantId) {
      return NextResponse.json({ ok: false, error: "Tenant is required" }, { status: 400 });
    }

    const reportType = (searchParams.get("type") || searchParams.get("reportType") || "LIVE_SESSION_SUMMARY") as ReportType;
    const periodPreset = searchParams.get("periodPreset") || searchParams.get("period") || undefined;
    const date = searchParams.get("date") || undefined;
    const threshold = searchParams.get("threshold") ? Number(searchParams.get("threshold")) : undefined;
    const minHostScore = searchParams.get("minHostScore") ? Number(searchParams.get("minHostScore")) : undefined;
    const chatIdOverride = searchParams.get("chatId") || undefined;

    const result = await TelegramService.sendReportPdf(tenantId, reportType, {
      periodPreset,
      date,
      threshold,
      minHostScore,
      chatIdOverride,
    });

    if (!result.success) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      ok: true,
      message: `تم إرسال تقرير الـ PDF بنجاح إلى تليقرام (${result.filename})`,
      filename: result.filename,
      messageId: result.messageId,
    });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || "Internal server error" }, { status: 500 });
  }
}
