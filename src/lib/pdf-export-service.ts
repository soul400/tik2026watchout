import React from "react";
import puppeteer from "puppeteer-core";
import fs from "fs";
import { prisma } from "./prisma";
import { ReportsService, ReportType } from "./reports-service";
import { PdfReportDocument } from "../app/reports/pdf/PdfReportDocument";

export class PdfExportService {
  /**
   * Discovers existing Google Chrome or Microsoft Edge binaries on Windows host.
   */
  static getBrowserExecutablePath(): string | null {
    const candidates = [
      "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
      "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
      "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
      process.env.CHROME_BIN || "",
      process.env.EDGE_BIN || "",
    ].filter(Boolean);

    for (const p of candidates) {
      if (fs.existsSync(p)) return p;
    }
    return null;
  }

  /**
   * Generates a high-fidelity executive PDF Buffer directly in-memory
   * using the canonical certified Arabic document template and Headless Chromium.
   */
  static async generatePdfBuffer(params: {
    tenantId: string;
    reportType: ReportType;
    threshold?: number;
    minHostScore?: number;
    supporterId?: string;
    date?: string;
    periodPreset?: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<{
    buffer: Buffer;
    filename: string;
    reportTitle: string;
    periodLabel: string;
    streamerUsername: string;
    streamerDisplayName: string;
  }> {
    const { tenantId, reportType } = params;

    // 1. Fetch streamer account metadata for authentic branding
    const streamer = await prisma.streamerAccount.findFirst({
      where: { tenantId },
      select: { username: true, displayName: true, avatarUrl: true },
    });
    const streamerUsername = streamer?.username || "mohra.2000";
    const streamerDisplayName = streamer?.displayName || "مهرة | Mohra";

    // 2. Generate authoritative analytical report
    const report = await ReportsService.generateReport({
      tenantId,
      reportType,
      minDiamonds: params.threshold,
      minHostScore: params.minHostScore,
      supporterId: params.supporterId,
      date: params.date,
      periodPreset: params.periodPreset,
      startDate: params.startDate,
      endDate: params.endDate,
    });

    // 3. Render exact identical JSX document markup via ReactDOMServer
    // Using dynamic import to prevent Next.js SWC build compiler error on react-dom/server
    const ReactDOMServer = await import("react-dom/server");
    const renderFn = ReactDOMServer.renderToStaticMarkup || (ReactDOMServer as any).default?.renderToStaticMarkup;
    const bodyMarkup = renderFn(
      React.createElement(PdfReportDocument, {
        report,
        reportType,
        streamerDisplayName,
        streamerUsername,
        threshold: params.threshold,
      })
    );

    // 4. Construct complete HTML document shell with Tailwind CDN and RTL font rules
    const fullHtml = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${report.metadata.title}</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
      @page {
        size: A4;
        margin: 10mm;
      }
      body {
        font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
        background-color: #ffffff;
        color: #0f172a;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .page-break-inside-avoid {
        break-inside: avoid;
        page-break-inside: avoid;
      }
      .dir-ltr {
        direction: ltr;
        unicode-bidi: embed;
      }
      .pdf-report-canvas {
        width: 100% !important;
        max-width: none !important;
        margin: 0 !important;
        padding: 0 !important;
        border: none !important;
        box-shadow: none !important;
      }
    </style>
  </head>
  <body class="bg-white p-2">
    ${bodyMarkup}
  </body>
</html>`;

    // 5. Launch Chrome or Edge to render PDF
    const browserExe = this.getBrowserExecutablePath();
    if (!browserExe) {
      throw new Error("لم يتم العثور على متصفح Chrome أو Edge لتوليد مستند الـ PDF.");
    }

    const browser = await puppeteer.launch({
      executablePath: browserExe,
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-gpu",
        "--disable-dev-shm-usage",
        "--font-render-hinting=medium",
      ],
    });

    try {
      const page = await browser.newPage();
      await page.setViewport({ width: 1200, height: 1600, deviceScaleFactor: 2 });

      try {
        await page.setContent(fullHtml, { waitUntil: "load", timeout: 8000 });
      } catch {
        await page.setContent(fullHtml, { waitUntil: "domcontentloaded", timeout: 5000 });
      }

      const pdfUint8Array = await page.pdf({
        format: "A4",
        printBackground: true,
        preferCSSPageSize: true,
        margin: { top: "10mm", bottom: "10mm", left: "10mm", right: "10mm" },
      });

      const dateStr = new Date().toISOString().split("T")[0];
      const filename = `${reportType}_${dateStr}.pdf`;

      return {
        buffer: Buffer.from(pdfUint8Array),
        filename,
        reportTitle: report.metadata.title,
        periodLabel: report.metadata.periodLabel || "تاريخ محدد",
        streamerUsername,
        streamerDisplayName,
      };
    } finally {
      await browser.close();
    }
  }
}
