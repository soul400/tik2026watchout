# LIVEPULSE INTELLIGENCE — دليل النشر الاقتصادي على Hetzner Cloud (Hetzner Deployment)

## 1. مواصفات الخادم المستهدف وميزانية التكلفة (< $7/شهر)
- **مزود الخدمة:** Hetzner Cloud (مراكز بيانات Falkenstein أو Helsinki أو Nuremberg).
- **الخادم الموصى به:** **CAX11** (ARM64 Ampere Altra) أو **CX22** (x86 Intel/AMD).
  - **CAX11:** 2 vCPU, 4 GB RAM, 40 GB NVMe SSD, 20 TB Traffic.
  - **التكلفة الشهرية:** حوالي €3.79 إلى €4.50 شهرياً (أي ما يعادل ~ \$4.10 إلى \$4.80 USD)، وهو ما يقل بوضوح عن الميزانية المحددة (\$7).
- **IPv4 Address:** خيار إضافة IPv4 بـ €0.60/شهر، أو الاعتماد على Cloudflare Proxied IPv6 مجاناً.
- **التكلفة الإجمالية التقديرية:** ~ **$5.00 إلى $5.50 شهرياً**.

---

## 2. هيكل الحاويات (Docker Compose Architecture)
يتم تشغيل النظام بالكامل عبر `docker-compose.yml` يتضمن:
1. `app`: تطبيق Next.js 15 (Node.js Alpine) للواجهة والـ API.
2. `worker`: مشغل استقبال أحداث TikTok Live ومعالجتها خلفياً.
3. `db`: قاعدة بيانات PostgreSQL 16 Alpine مع حجم تخزين محلي دائم (Named Volume).
4. `redis`: خادم Redis 7 Alpine للتخزين المؤقت والأقفال التزامنية.
5. `caddy`: موجه عكسي (Reverse Proxy) خفيف جداً يولد شهادات SSL تلقائياً عبر Let's Encrypt مجاناً ويدعم HTTP/3.

---

## 3. خطة النسخ الاحتياطي والاستعادة (Backup & Disaster Recovery)
- سكريبت مؤتمت يومي (`backup.sh`) لأخذ `pg_dump` مشفر ومضغوط وحفظه محلياً مع تدوير النسخ (احتفاظ لـ 14 يوماً).
- سكريبت استعادة مجرب (`restore.sh`) لاختبار سلامة البيانات واسترجاعها في دقائق في بيئة معزولة.
