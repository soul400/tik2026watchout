const puppeteer = require('puppeteer-core');
const fs = require('fs');

async function test() {
  const start = Date.now();
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
  });
  const page = await browser.newPage();
  const html = `
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
      <head>
        <meta charset="utf-8" />
        <script src="https://cdn.tailwindcss.com"></script>
        <style>
          @page { size: A4; margin: 12mm; }
          body { font-family: system-ui, -apple-system, sans-serif; }
        </style>
      </head>
      <body class="bg-white p-6 text-slate-900">
        <div class="border-b-2 border-slate-900 pb-4 mb-4 flex justify-between items-center">
          <div>
            <h1 class="text-2xl font-black text-indigo-900">منصة لايف بالس للذكاء التحليلي</h1>
            <p class="text-xs text-slate-500 font-mono">LivePulse Intelligence • تقرير رسمي معتمد</p>
          </div>
          <span class="bg-emerald-100 text-emerald-800 font-bold text-xs px-3 py-1 rounded-full border border-emerald-300">
            معتمد ومطابق 100%
          </span>
        </div>
        <div class="grid grid-cols-3 gap-4 mb-6">
          <div class="bg-amber-50 border border-amber-200 p-4 rounded-xl">
            <span class="text-xs text-amber-700 block">إجمالي الدعم</span>
            <span class="text-xl font-bold font-mono text-amber-950">💎 1,250,000</span>
          </div>
          <div class="bg-blue-50 border border-blue-200 p-4 rounded-xl">
            <span class="text-xs text-blue-700 block">الجولات الفائزة</span>
            <span class="text-xl font-bold font-mono text-blue-950">14 جولة</span>
          </div>
          <div class="bg-purple-50 border border-purple-200 p-4 rounded-xl">
            <span class="text-xs text-purple-700 block">نسبة الفوز</span>
            <span class="text-xl font-bold font-mono text-purple-950">87.5%</span>
          </div>
        </div>
      </body>
    </html>
  `;
  await page.setContent(html, { waitUntil: 'networkidle0', timeout: 5000 });
  const pdf = await page.pdf({ format: 'A4', printBackground: true });
  await browser.close();
  console.log('Rendered Tailwind PDF in', Date.now() - start, 'ms, size:', pdf.length);
  fs.writeFileSync('test-tailwind.pdf', pdf);
}

test().catch(console.error);
