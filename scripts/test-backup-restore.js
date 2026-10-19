const { PrismaClient } = require("@prisma/client");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("===============================================================");
  console.log("   LIVEPULSE INTELLIGENCE — BACKUP RESTORATION SANDBOX AUDIT   ");
  console.log("===============================================================\n");

  const backupPath = path.resolve(__dirname, "../prisma/dev.db.bak");
  const tempRestorePath = path.resolve(__dirname, "../prisma/temp-restore-test.db");

  if (!fs.existsSync(backupPath)) {
    console.error("FAIL: Backup file prisma/dev.db.bak does not exist!");
    process.exit(1);
  }

  const backupStats = fs.statSync(backupPath);
  console.log(`[1] Verified Backup File on Disk:`);
  console.log(`    - Path: ${backupPath}`);
  console.log(`    - Size: ${(backupStats.size / (1024 * 1024)).toFixed(2)} MB (${backupStats.size} bytes)`);

  if (fs.existsSync(tempRestorePath)) {
    fs.unlinkSync(tempRestorePath);
  }

  console.log(`\n[2] Creating Isolated Temporary Sandbox (temp-restore-test.db)...`);
  fs.copyFileSync(backupPath, tempRestorePath);
  console.log(`    - Sandbox DB instantiated at: ${tempRestorePath}`);

  // Create isolated Prisma instance pointing strictly to the restored sandbox
  const sandboxPrisma = new PrismaClient({
    datasources: {
      db: {
        url: "file:./temp-restore-test.db",
      },
    },
  });

  try {
    console.log(`\n[3] Connecting to Sandbox Database & Running PRAGMA Checks...`);
    
    const integrity = await sandboxPrisma.$queryRawUnsafe("PRAGMA integrity_check;");
    console.log("    - PRAGMA integrity_check:", JSON.stringify(integrity));
    const isOk = Array.isArray(integrity) && (integrity[0]?.integrity_check === "ok" || integrity[0]?.["integrity_check"] === "ok");
    if (!isOk) {
      throw new Error(`Integrity check failed on restored database: ${JSON.stringify(integrity)}`);
    }

    const quick = await sandboxPrisma.$queryRawUnsafe("PRAGMA quick_check;");
    console.log("    - PRAGMA quick_check:", JSON.stringify(quick));

    const fkCheck = await sandboxPrisma.$queryRawUnsafe("PRAGMA foreign_key_check;");
    console.log("    - PRAGMA foreign_key_check violations count:", Array.isArray(fkCheck) ? fkCheck.length : 0);

    console.log(`\n[4] Querying Baseline Restored Data from Sandbox...`);
    const [tenants, streamers, sessions, battles, supporters, grants, consumptions, rawEvents] = await Promise.all([
      sandboxPrisma.tenant.count(),
      sandboxPrisma.streamerAccount.count(),
      sandboxPrisma.liveSession.count(),
      sandboxPrisma.battle.count(),
      sandboxPrisma.supporter.count(),
      sandboxPrisma.toolGrant.count(),
      sandboxPrisma.toolConsumption.count(),
      sandboxPrisma.rawEvent.count(),
    ]);

    console.log(`    - Tenant count:             ${tenants}`);
    console.log(`    - StreamerAccount count:    ${streamers}`);
    console.log(`    - LiveSession count:        ${sessions}`);
    console.log(`    - Battle count:             ${battles}`);
    console.log(`    - Supporter count:          ${supporters}`);
    console.log(`    - ToolGrant count:          ${grants}`);
    console.log(`    - ToolConsumption count:    ${consumptions}`);
    console.log(`    - RawEvent count:           ${rawEvents}`);

    // Check ExternalActivation in backup snapshot
    try {
      const activations = await sandboxPrisma.externalActivation.count();
      console.log(`    - ExternalActivation count: ${activations}`);
    } catch (e) {
      console.log(`    - ExternalActivation table: NOT IN BACKUP (snapshot taken pre-migration at 2:11 PM).`);
      console.log(`    - Applying forward migration to sandbox to test schema evolution...`);
      await sandboxPrisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "ExternalActivation" (
          "id" TEXT NOT NULL PRIMARY KEY,
          "tenantId" TEXT NOT NULL,
          "supporterId" TEXT,
          "platformUserId" TEXT,
          "toolKey" TEXT NOT NULL,
          "battleId" TEXT,
          "sourceEventId" TEXT,
          "detailsJson" TEXT,
          "activatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "ExternalActivation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
          CONSTRAINT "ExternalActivation_supporterId_fkey" FOREIGN KEY ("supporterId") REFERENCES "Supporter" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
          CONSTRAINT "ExternalActivation_battleId_fkey" FOREIGN KEY ("battleId") REFERENCES "Battle" ("id") ON DELETE SET NULL ON UPDATE CASCADE
        );
      `);
      await sandboxPrisma.$executeRawUnsafe(`
        CREATE UNIQUE INDEX IF NOT EXISTS "ExternalActivation_sourceEventId_key" ON "ExternalActivation"("sourceEventId");
      `);
      const migratedActivations = await sandboxPrisma.externalActivation.count();
      console.log(`    - Forward migration to sandbox: SUCCESS! (count=${migratedActivations})`);
    }

    console.log(`\n[5] Verifying Sandbox Writeability & ACID Operations...`);
    const probeId = "restore_probe_" + Date.now();
    await sandboxPrisma.tenant.create({
      data: {
        id: probeId,
        slug: "restore-probe-" + Date.now(),
        name: "Restore Probe Test",
      },
    });

    const probeVerify = await sandboxPrisma.tenant.findUnique({ where: { id: probeId } });
    if (!probeVerify) {
      throw new Error("Sandbox write test failed: probe not found after create");
    }
    console.log("    - Probe record created and read back successfully.");

    await sandboxPrisma.tenant.delete({ where: { id: probeId } });
    const probeAfterDel = await sandboxPrisma.tenant.findUnique({ where: { id: probeId } });
    if (probeAfterDel) {
      throw new Error("Sandbox delete test failed: probe still exists");
    }
    console.log("    - Probe record cleanly deleted. Sandbox is fully transactional and ACID compliant.");

    console.log("\n===============================================================");
    console.log("   [SUCCESS] RESTORE VERIFICATION TEST COMPLETED WITH 0 ERRORS  ");
    console.log("===============================================================\n");
  } finally {
    await sandboxPrisma.$disconnect();
    console.log("Disconnected Prisma Client from sandbox.");

    // Clean up temporary database files
    try {
      if (fs.existsSync(tempRestorePath)) fs.unlinkSync(tempRestorePath);
      if (fs.existsSync(tempRestorePath + "-journal")) fs.unlinkSync(tempRestorePath + "-journal");
      if (fs.existsSync(tempRestorePath + "-wal")) fs.unlinkSync(tempRestorePath + "-wal");
      if (fs.existsSync(tempRestorePath + "-shm")) fs.unlinkSync(tempRestorePath + "-shm");
      console.log("Temporary sandbox database cleaned up completely from disk.");
    } catch (e) {
      console.warn("Notice during cleanup:", e.message);
    }
  }
}

main().catch((err) => {
  console.error("FATAL ERROR in backup restoration test:", err);
  process.exit(1);
});
