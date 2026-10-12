# LIVEPULSE INTELLIGENCE — مقارنة وتقييم مستودعات تكامل TikTok LIVE

## 1. فحص ومقارنة المستودعات مفتوحة المصدر

| المعيار | ZerodyTrash / TikTok-Live-Connector (Node.js) | Isaac Kogan / TikTokLive (Python) | TikTool / tiktok-live-events |
| :--- | :--- | :--- | :--- |
| **التقنية** | Node.js (TypeScript/JavaScript) | Python 3.9+ | Node.js / Multi-service |
| **طريقة الاتصال** | TikTok Webcast WebSocket + Protobuf parsing | TikTok Webcast HTTP polling + WebSocket | Wrapper حول WebSocket/Webhooks |
| **الأحداث المدعومة** | `chat`, `gift`, `like`, `member`, `roomUser`, `linkMicBattle`, `linkMicArmies` | `chat`, `gift`, `like`, `join`, `battle`, `link_mic` | يدعم أحداث عامة وغير محدثة باستمرار |
| **حالة الصيانة** | مجتمع نشط جداً ومحدث بانتظام لمواكبة تشفير TikTok | مجتمع نشط ويحظى بتحديثات دورية | صيانة متقطعة وقديمة نسبيًا |
| **الترخيص** | MIT | MIT | MIT / Proprietary mix |
| **ملاءمته للنظام** | **ممتاز جداً**: توافق تام 100% مع مكدس Next.js/Node.js وTypeScript | جيد لكنه يفرض إضافة بيئة تشغيل Python إضافية للعمال | غير مناسب بسبب الاعتماديات غير المستقرة |
| **القرار الهندسي** | **الموصل الأساسي المعتمد في المنصة** | خيار بديل (Fallback Adapter) في حال الحاجة | **مرفوض** |

---

## 2. مصفوفة الأحداث المدعومة وحدود الموثوقية الفعلية

| اسم الحدث | الحدث المقابل في TikTok | البيانات المتوفرة فعلياً | درجة الموثوقية والقيود |
| :--- | :--- | :--- | :--- |
| `gift` | هدايا ودعم | `giftId`, `giftName`, `diamondCount`, `repeatCount`, `userId`, `secUid` | **عالية جداً (High)**: يتم استلام كل هدية مع قيمتها الماسية ومعرف الداعم. |
| `chat` | تعليقات البث | `comment`, `userId`, `uniqueId`, `nickname` | **متوسطة إلى عالية**: قد تقوم TikTok باقتطاع بعض التعليقات في البثوث فائقة الكثافة (Rate Limiting). |
| `like` | التكبيس / الإعجابات | `likeCount`, `totalLikes`, `userId` | **متوسطة**: لا يرسل تيك توك كل نقرة على حدة، بل يرسل دفعات مجمعة (Batched likes). |
| `linkMicBattle` | بداية وتفاصيل النزال | `battleId`, `battleStatus`, `teams`, `scores` | **عالية**: يزودنا بمعرف الجولة وحالة الفرق وأطراف النزال. |
| `linkMicArmies` | تفاصيل جيش الداعمين | `teamMembers`, `points`, `participants` | **عالية**: يزود بقائمة الداعمين المساهمين في نقاط الجولة. |
| `roomUser` | عدد المشاهدين المتزامن | `viewerCount` | **عالية كإحصائية عامة**، لكن قائمة أسماء الحاضرين الكاملة غير متاحة من المصدر. |

> [!IMPORTANT]
> **قاعدة الشفافية:** لا تدعم تيك توك قائمة حضور ثابتة لجميع المشاهدين الصامتين في البث الحقيقي (Lurkers). لذلك فإن مقياس "الحضور" في أبطال المجتمع يُحسب بناءً على النشاط المرصود وفترات التفاعل، ويتم تصنيفه في سجل الثقة كـ **تقديري موثق (Estimated Observed Presence)** وليس حقيقة قطعية.
