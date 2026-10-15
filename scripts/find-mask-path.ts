import { prisma } from "../src/lib/prisma";

async function main() {
  const event = await prisma.$queryRawUnsafe<any[]>(`
    SELECT payload 
    FROM RawEvent 
    WHERE (payload LIKE '%"isEnigmaMaskOn":true%' OR payload LIKE '%"isEnigmaMaskOn": true%')
      AND payload LIKE '%njd_000%'
    LIMIT 1;
  `);

  if (event.length > 0) {
    const p = JSON.parse(event[0].payload);
    console.log("Full JSON keys:", Object.keys(p));
    // Find where isEnigmaMaskOn: true is in this object
    function findKey(obj: any, path: string = ""): void {
      if (!obj || typeof obj !== "object") return;
      for (const k of Object.keys(obj)) {
        const val = obj[k];
        if (k === "isEnigmaMaskOn" && (val === true || val === "true" || val === 1)) {
          console.log(`FOUND isEnigmaMaskOn: true at path: ${path}.${k}`);
        }
        if (typeof val === "object") {
          findKey(val, `${path}.${k}`);
        }
      }
    }
    findKey(p, "root");
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
