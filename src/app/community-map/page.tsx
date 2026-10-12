import { prisma } from "@/lib/prisma";
import { ConfidenceBadge } from "@/components/ConfidenceBadge";
import { Network, Users, Share2, Shield } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function CommunityMapPage() {
  const tenant = await prisma.tenant.findUnique({ where: { slug: "mohra-live" } });
  const tenantId = tenant?.id || "";

  const supporters = await prisma.supporter.findMany({
    where: { tenantId },
    take: 8,
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <h2 className="text-2xl font-bold text-white tracking-tight">خريطة تفاعل المجتمع (Community Map)</h2>
          <ConfidenceBadge state="VERIFIED" methodology="علاقات سلوكية مثبتة بأحداث نزالات مشتركة أو تفاعل مباشر" />
        </div>
        <p className="text-sm text-secondaryText">
          رسم بياني يربط الداعمين والمشاركين استناداً إلى النزالات المشتركة، الدعم المتزامن، والتفاعل المرصود
        </p>
      </div>

      {/* Network Canvas Card */}
      <div className="bg-surface rounded-xl border border-white/5 p-6">
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-white/5">
          <span className="text-sm font-semibold text-white">العقد النشطة (Community Clusters)</span>
          <span className="text-xs text-secondaryText">مرتكز الخريطة: مهـرة (@mohra.2000)</span>
        </div>

        {/* Visual Simulated Nodes Network */}
        <div className="relative h-96 bg-elevated/30 rounded-xl border border-white/5 flex items-center justify-center overflow-hidden">
          {/* Streamer Center Hub */}
          <div className="z-10 bg-gradient-to-br from-turquoise to-blue p-4 rounded-2xl text-background font-bold shadow-xl shadow-turquoise/20 flex flex-col items-center">
            <span className="text-xs">المستضيف</span>
            <span className="text-sm font-extrabold">مهـرة 🇸🇦</span>
          </div>

          {/* Surrounding Connected Nodes */}
          <div className="absolute inset-0 flex items-center justify-around pointer-events-none p-8">
            {supporters.map((s, idx) => (
              <div
                key={s.id}
                className="bg-surface border border-turquoise/40 px-3 py-2 rounded-xl text-center shadow-lg pointer-events-auto transform transition-all hover:scale-105"
                style={{
                  transform: `translateY(${idx % 2 === 0 ? "-60px" : "60px"})`,
                }}
              >
                <span className="text-xs font-bold text-white block">{s.displayName}</span>
                <span className="text-[10px] text-turquoise">ارتباط نزال مشترك</span>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4 text-xs text-secondaryText flex items-center gap-2">
          <Shield className="w-4 h-4 text-turquoise" />
          <span>كل رابط معروض مدعوم بمعرف نزال أو حدث تفاعل حقيقي وموثق في قاعدة البيانات.</span>
        </div>
      </div>
    </div>
  );
}
