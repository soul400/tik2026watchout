# LIVEPULSE INTELLIGENCE — منهجية التحليلات ومعادلات الاحتساب (Analytics Methodology)

## 1. التوقيت المرجعي والحسابات
- كافة السجلات في قاعدة البيانات تُخزن بـ **UTC** (`TIMESTAMPTZ`).
- كافة التحليلات التجميعية، وتصنيفات الساعات والأيام، والتقارير تُحسب وفق توقيت المملكة العربية السعودية:
  $$\text{Timezone} = \text{Asia/Riyadh} \quad (\text{UTC}+3)$$

---

## 2. معادلة احتساب أبطال المجتمع (Community Champions Scoring)

تعتمد المنصة معادلة أوزان معيارية شفافة تضمن تكريم كافة جوانب التفاعل وليس الدعم المالي فحسب:

$$\text{FinalScore} = (W_{\text{presence}} \times Z_{\text{presence}}) + (W_{\text{chat}} \times Z_{\text{chat}}) + (W_{\text{likes}} \times Z_{\text{likes}}) + (W_{\text{shares}} \times Z_{\text{shares}}) + (W_{\text{mentions}} \times Z_{\text{mentions}})$$

### الأوزان الافتراضية (Configurable Weights):
- **الحضور المرصود ($W_{\text{presence}}$):** 35%
- **التعليقات والمحادثة ($W_{\text{chat}}$):** 25%
- **التكبيس / الإعجابات ($W_{\text{likes}}$):** 15%
- **المشاركات ($W_{\text{shares}}$):** 15%
- **المنشن والتفاعل مع الأعضاء ($W_{\text{mentions}}$):** 10%

### قواعد التطبيع والمعايرة (Normalization):
- يتم تطبيق Min-Max Normalization أو Z-Score على كل مقياس قبل الدمج لمنع تشويه النتيجة بحساب فردي أرسل ملايين التكبيسات الآلية.
- إزالة التكرار (Deduplication) للمشاركات والتكبيسات المبرمجة غير الطبيعية (Anti-Spam Filter).
- في حال غياب مقياس معين من مصدر البث، يُعاد توزيع وزنه بنسب متكافئة على المقاييس المتاحة مع وضع وسم توضيحي في بطاقة البطل يشرح استبعاد المقياس لضمان الشفافية والعدالة.

---

## 3. مؤشر جودة وقت البث (Stream Time Quality Index - STQI)

لا تعتمد المنصة على إجمالي الدعم وحده لتقييم الساعة الأفضل، بل تقيم الساعة عبر **مؤشر مركب قابل للتفسير**:

$$\text{STQI} = \text{ConsistencyScore} \times \left( \alpha \cdot \text{RatePerMinute} + \beta \cdot \text{AvgViewers} + \gamma \cdot \text{EngagementRate} \right)$$

- **معامل الاستمرارية (Consistency):** يقيس تباين الأداء (Variance) عبر عدة أسابيع. فإذا جاءت قمة الساعة من جلسة استثنائية واحدة، يكون المعامل منخفضاً.
- **تنبيه نقص البيانات:** إذا كان عدد الجلسات في ساعة معينة أقل من 3 جلسات، يتم تصنيف التوصية صراحة بـ "أدلة غير كافية (Insufficient Data)" لمنع التضليل الإحصائي.
