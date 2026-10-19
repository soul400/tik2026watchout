import { prisma } from "@/lib/prisma";
import { ConfidenceBadge } from "@/components/ConfidenceBadge";
import { History, Calendar, Swords, Shield, ChevronLeft } from "lucide-react";
import { SupportValue } from "@/components/SupportValue";

export const dynamic = "force-dynamic";

export default async function StreamMemoryPage() {
  const tenant = await prisma.tenant.findUnique({ where: { slug: "mohra-live" } });
  const tenantId = tenant?.id || "";

  const sessions = await prisma.liveSession.findMany({
    where: {
      tenantId,
      OR: [
        { totalDiamonds: { gt: 0 } },
        { totalComments: { gt: 0 } },
      ],
    },
    include: {
      battles: {
        include: { participants: true },
      },
    },
    orderBy: { startedAt: "desc" },
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <h2 className="text-2xl font-bold text-white tracking-tight">ذاكرة البث التاريخية (Stream Memory)</h2>
          <ConfidenceBadge state="VERIFIED" methodology="سجل مترابط يجمع كل جلسة بنزالاتها وأدواتها دون تناقض مرجعي" />
        </div>
        <p className="text-sm text-secondaryText">
          سجل تاريخي مترابط يحفظ كل بث ونزالاته وداعميه والأدوات الممنوحة خلاله في خط زمني موحد
        </p>
      </div>

      {/* Timeline */}
      <div className="space-y-6">
        {sessions.length === 0 ? (
          <div className="bg-surface rounded-xl border border-white/5 p-12 text-center text-secondaryText">
            <History className="w-10 h-10 mx-auto mb-3 opacity-40 text-turquoise" />
            <p className="text-sm font-medium text-white">لا توجد جلسات بث سابقة تحتوي على ماسات أو تعليقات مرصودة</p>
            <p className="text-xs text-secondaryText mt-1">يتم استبعاد الجلسات الفارغة تلقائياً للحفاظ على دقة ونظافة السجل التاريخي.</p>
          </div>
        ) : (
          sessions.map((s) => (
            <div key={s.id} className="bg-surface rounded-xl border border-white/5 p-6 relative">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-4 border-b border-white/5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-turquoise/10 border border-turquoise/20 flex items-center justify-center text-turquoise">
                    <Calendar className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-base">
                      جلسة بث: {new Date(s.startedAt).toLocaleDateString("ar-SA")}
                    </h3>
                    <span className="text-xs text-secondaryText">
                      بدأ في {new Date(s.startedAt).toLocaleTimeString("ar-SA")}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-xs">
                  <div>
                    <span className="text-secondaryText block">إجمالي الماس المرصود:</span>
                    <span className="font-bold text-gold">
                      <SupportValue value={s.totalDiamonds} suffix=" 💎" />
                    </span>
                  </div>
                  <div>
                    <span className="text-secondaryText block">التعليقات:</span>
                    <span className="font-bold text-white">{s.totalComments.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* Linked Battles */}
              <div>
                <span className="text-xs font-semibold text-secondaryText block mb-3">النزالات المرتبطة بالجلسة:</span>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {s.battles.map((b) => (
                    <div key={b.id} className="bg-elevated p-3 rounded-lg border border-white/5 flex items-center justify-between">
                      <div>
                        <span className="text-xs font-bold text-white block">نزال {b.battleType}</span>
                        <span className="text-[11px] text-secondaryText">
                          النتيجة: {b.team1Score.toLocaleString()} مقابل {b.team2Score.toLocaleString()}
                        </span>
                      </div>
                      <span className="text-xs text-turquoise font-medium">مكتمل وموثق</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
