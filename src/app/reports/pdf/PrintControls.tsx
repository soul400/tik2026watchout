"use client";

import React, { useEffect, useState } from "react";
import { Printer, Download, ArrowRight, CheckCircle2, ShieldCheck, FileSpreadsheet } from "lucide-react";
import Link from "next/link";

interface PrintControlsProps {
  reportType: string;
  tenantId: string;
  autoPrint?: boolean;
}

export function PrintControls({ reportType, tenantId, autoPrint }: PrintControlsProps) {
  const [isPrinting, setIsPrinting] = useState(false);

  useEffect(() => {
    if (autoPrint) {
      const timer = setTimeout(() => {
        window.print();
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [autoPrint]);

  const handlePrint = () => {
    setIsPrinting(true);
    window.print();
    setTimeout(() => setIsPrinting(false), 1000);
  };

  const handleCsvExport = () => {
    window.open(`/api/reports/export?type=${reportType}&format=csv&tenantId=${tenantId}`, "_blank");
  };

  return (
    <div className="no-print bg-slate-900 border-b border-slate-800 text-white py-3.5 px-4 sticky top-0 z-50 shadow-xl backdrop-blur-md bg-opacity-95">
      <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-3">
        {/* Left: Back Link & Info */}
        <div className="flex items-center gap-3">
          <Link
            href="/reports"
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-lg border border-slate-700 transition-colors"
          >
            <ArrowRight className="w-3.5 h-3.5" />
            <span>العودة للوحة التقارير</span>
          </Link>
          <div className="hidden sm:flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-md border border-emerald-500/20 font-mono">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>نسخة PDF معتمدة A4 جاهزة للحفظ</span>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={handleCsvExport}
            className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 px-3.5 py-2 rounded-xl text-xs font-semibold border border-slate-700 transition-colors"
            title="تنزيل نسخة بيانات إكسل CSV"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
            <span>تصدير Excel (CSV)</span>
          </button>

          <button
            onClick={handlePrint}
            className="flex items-center gap-2 bg-gradient-to-r from-red-600 via-rose-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white px-5 py-2 rounded-xl text-xs font-bold shadow-lg shadow-red-900/30 transition-all transform hover:scale-[1.02] active:scale-[0.98]"
            title="حفظ بصيغة PDF أو طباعة مباشرة"
          >
            <Printer className="w-4 h-4" />
            <span>{isPrinting ? "جارٍ التجهيز..." : "طباعة / حفظ كملف PDF"}</span>
          </button>
        </div>
      </div>

      {/* Helpful Hint */}
      <div className="max-w-6xl mx-auto mt-2 text-[11px] text-slate-400 flex items-center justify-between">
        <span>💡 نصيحة للطباعة: في نافذة الطباعة، اختر الوجهة <strong>&quot;حفظ بتنسيق PDF&quot; (Save as PDF)</strong> وتأكد من تفعيل خيار <strong>&quot;رسومات الخلفية&quot; (Background graphics)</strong>.</span>
        <span className="font-mono text-slate-500">A4 Portrait • Vector RTL Quality</span>
      </div>
    </div>
  );
}
