export interface MetricConfidenceItem {
  metricName: string;
  metricLabelArabic: string;
  source: "TIKTOK_WEBCAST" | "INTERNAL_LEDGER" | "COMPUTED_DERIVED";
  confidenceState: "VERIFIED" | "PARTIAL" | "ESTIMATED" | "OUTDATED" | "INSUFFICIENT_DATA";
  methodologyArabic: string;
  limitationsArabic?: string;
  lastUpdated: string;
}

export class DataConfidenceLedger {
  static getConfidenceBadge(state: string) {
    switch (state) {
      case "VERIFIED":
        return { label: "موثوق قطعي", color: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10" };
      case "PARTIAL":
        return { label: "مكتمل جزئياً", color: "text-blue-400 border-blue-500/30 bg-blue-500/10" };
      case "ESTIMATED":
        return { label: "تقديري موثق", color: "text-amber-400 border-amber-500/30 bg-amber-500/10" };
      case "OUTDATED":
        return { label: "متأخر التحديث", color: "text-orange-400 border-orange-500/30 bg-orange-500/10" };
      case "INSUFFICIENT_DATA":
      default:
        return { label: "بيانات غير كافية", color: "text-rose-400 border-rose-500/30 bg-rose-500/10" };
    }
  }

  static getStandardMetrics(): Record<string, MetricConfidenceItem> {
    const now = new Date().toISOString();

    return {
      BATTLE_POINTS: {
        metricName: "BATTLE_POINTS",
        metricLabelArabic: "نقاط النزالات والهدايا",
        source: "TIKTOK_WEBCAST",
        confidenceState: "VERIFIED",
        methodologyArabic: "احتساب تراكمي دقيق بالماس المستلم لكل حدث نزال",
        lastUpdated: now,
      },
      INVENTORY_TOOLS: {
        metricName: "INVENTORY_TOOLS",
        metricLabelArabic: "خزينة الأدوات الذكية",
        source: "INTERNAL_LEDGER",
        confidenceState: "VERIFIED",
        methodologyArabic: "تسجيل ذري بالخادم بمدة صلاحية 120 ساعة ومنع الاستهلاك المزدوج",
        lastUpdated: now,
      },
      OBSERVED_PRESENCE: {
        metricName: "OBSERVED_PRESENCE",
        metricLabelArabic: "دقائق الحضور المرصودة",
        source: "COMPUTED_DERIVED",
        confidenceState: "ESTIMATED",
        methodologyArabic: "مشتق من نافذة أول وآخر نشاط تفاعلي للمستخدم في البث",
        limitationsArabic: "TikTok Webcast لا يوفر قائمة المشاهدين الصامتين (Lurkers)",
        lastUpdated: now,
      },
      BEST_STREAM_TIME: {
        metricName: "BEST_STREAM_TIME",
        metricLabelArabic: "مؤشر أفضل وقت للبث (STQI)",
        source: "COMPUTED_DERIVED",
        confidenceState: "PARTIAL",
        methodologyArabic: "مؤشر مركب يقيس الاستمرارية والتفاعل وليس الجلسة الاستثنائية الواحدة",
        limitationsArabic: "يتطلب تراكم ما لا يقل عن 3 جلسات في نفس الساعة لاعتماده قطيعاً",
        lastUpdated: now,
      },
    };
  }
}
