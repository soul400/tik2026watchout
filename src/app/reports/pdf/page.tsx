import React from "react";
import { prisma } from "@/lib/prisma";
import { ReportsService, ReportType } from "@/lib/reports-service";
import { PrintControls } from "./PrintControls";
import { PdfReportDocument } from "./PdfReportDocument";

export const dynamic = "force-dynamic";

interface PdfReportPageProps {
  searchParams: Promise<{
    type?: string;
    tenantId?: string;
    autoPrint?: string;
    threshold?: string;
    supporterId?: string;
    minHostScore?: string;
    date?: string;
    periodPreset?: string;
    period?: string;
    startDate?: string;
    endDate?: string;
  }>;
}

export default async function PdfReportPage({ searchParams }: PdfReportPageProps) {
  const resolvedParams = await searchParams;
  const reportType = (resolvedParams.type || "LIVE_SESSION_SUMMARY") as ReportType;
  let tenantId = resolvedParams.tenantId;

  if (!tenantId) {
    const defaultTenant = await prisma.tenant.findUnique({
      where: { slug: "mohra-live" },
    });
    tenantId = defaultTenant?.id || "";
  }

  // Fetch streamer account for branding
  const streamer = await prisma.streamerAccount.findFirst({
    where: { tenantId },
    select: { username: true, displayName: true, avatarUrl: true },
  });

  const streamerUsername = streamer?.username || "mohra.2000";
  const streamerDisplayName = streamer?.displayName || "مهرة | Mohra";

  // Generate authoritative report
  const report = await ReportsService.generateReport({
    tenantId,
    reportType,
    minDiamonds: resolvedParams.threshold ? parseInt(resolvedParams.threshold, 10) : undefined,
    minHostScore: resolvedParams.minHostScore ? parseInt(resolvedParams.minHostScore, 10) : undefined,
    supporterId: resolvedParams.supporterId,
    date: resolvedParams.date,
    periodPreset: resolvedParams.periodPreset || resolvedParams.period,
    startDate: resolvedParams.startDate ? new Date(resolvedParams.startDate) : undefined,
    endDate: resolvedParams.endDate ? new Date(resolvedParams.endDate) : undefined,
  });

  const shouldAutoPrint = resolvedParams.autoPrint === "true";

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans print:bg-white print:text-black">
      {/* Top Action Bar (Screen Only - Hidden during PDF print) */}
      <PrintControls
        reportType={reportType}
        tenantId={tenantId}
        autoPrint={shouldAutoPrint}
      />

      {/* Main Printable Document Canvas */}
      <PdfReportDocument
        report={report}
        reportType={reportType}
        streamerDisplayName={streamerDisplayName}
        streamerUsername={streamerUsername}
        threshold={resolvedParams.threshold ? parseInt(resolvedParams.threshold, 10) : undefined}
      />
    </div>
  );
}
