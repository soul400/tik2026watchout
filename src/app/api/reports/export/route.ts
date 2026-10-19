import { NextResponse } from "next/server";
import { ReportsService, ReportType } from "@/lib/reports-service";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const reportType = (searchParams.get("type") || "LIVE_SESSION_SUMMARY") as ReportType;
    const format = (searchParams.get("format") || "csv").toLowerCase();
    let tenantId = searchParams.get("tenantId");

    if (!tenantId) {
      const defaultTenant = await prisma.tenant.findUnique({ where: { slug: "mohra-live" } });
      if (defaultTenant) tenantId = defaultTenant.id;
    }

    if (!tenantId) {
      return NextResponse.json({ ok: false, error: "Tenant is required" }, { status: 400 });
    }

    const supporterId = searchParams.get("supporterId") || undefined;
    const minDiamonds = searchParams.get("threshold")
      ? parseInt(searchParams.get("threshold")!, 10)
      : searchParams.get("minDiamonds")
      ? parseInt(searchParams.get("minDiamonds")!, 10)
      : undefined;
    const minHostScore = searchParams.get("minHostScore")
      ? parseInt(searchParams.get("minHostScore")!, 10)
      : searchParams.get("minScore")
      ? parseInt(searchParams.get("minScore")!, 10)
      : undefined;
    const inactivityGapMinutes = searchParams.get("inactivityGapMinutes")
      ? parseInt(searchParams.get("inactivityGapMinutes")!, 10)
      : undefined;
    const startDate = searchParams.get("startDate") ? new Date(searchParams.get("startDate")!) : undefined;
    const endDate = searchParams.get("endDate") ? new Date(searchParams.get("endDate")!) : undefined;
    const date = searchParams.get("date") || undefined;
    const periodPreset = searchParams.get("periodPreset") || searchParams.get("period") || undefined;

    // Direct redirection for PDF format
    if (format === "pdf") {
      let pdfUrlStr = `/reports/pdf?type=${reportType}&tenantId=${tenantId}&autoPrint=true`;
      if (supporterId) pdfUrlStr += `&supporterId=${encodeURIComponent(supporterId)}`;
      if (minDiamonds) pdfUrlStr += `&threshold=${minDiamonds}`;
      if (minHostScore) pdfUrlStr += `&minHostScore=${minHostScore}`;
      if (date) pdfUrlStr += `&date=${encodeURIComponent(date)}`;
      if (periodPreset) pdfUrlStr += `&periodPreset=${encodeURIComponent(periodPreset)}`;
      if (startDate) pdfUrlStr += `&startDate=${encodeURIComponent(startDate.toISOString())}`;
      if (endDate) pdfUrlStr += `&endDate=${encodeURIComponent(endDate.toISOString())}`;
      const pdfUrl = new URL(pdfUrlStr, req.url);
      return NextResponse.redirect(pdfUrl);
    }

    const report = await ReportsService.generateReport({
      tenantId,
      reportType,
      supporterId,
      minDiamonds,
      inactivityGapMinutes,
      minHostScore,
      startDate,
      endDate,
      date,
      periodPreset,
    });

    if (format === "json") {
      return NextResponse.json({ ok: true, report });
    }

    // Default to CSV with BOM for Arabic Excel
    const filename = `LivePulse_${reportType}_${new Date().toISOString().slice(0, 10)}.csv`;
    return new Response(report.csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-cache",
      },
    });
  } catch (error: any) {
    console.error("[REPORTS_EXPORT] Error generating report:", error);
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to generate report" },
      { status: 500 }
    );
  }
}
