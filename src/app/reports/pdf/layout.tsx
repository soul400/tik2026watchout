import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "وثيقة تقرير رسمي معتمد | LivePulse PDF Intelligence",
  description: "وثيقة تقرير تحليلي رسمي معتمد للطباعة والحفظ بصيغة PDF",
};

export default function PdfLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="pdf-isolated-container w-full min-h-screen bg-slate-950 print:bg-white">
      {children}
    </div>
  );
}
