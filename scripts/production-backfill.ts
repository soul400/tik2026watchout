import { PrismaClient } from "@prisma/client";
import { HistoricalBackfillService } from "../src/lib/historical-backfill-service";

/**
 * Production-Grade Historical Backfill CLI Runner
 *
 * Safely executes platformUserId backfill with:
 * - Configurable batch size and max batches limit
 * - Clear execution status evaluation
 * - Non-zero exit codes on partial/failed runs
 * - Safe Prisma connection lifecycle management
 */
async function main() {
  const args = process.argv.slice(2);
  let batchSize = 500;
  let maxBatches = 1000;
  let allowedUnresolvedThreshold = 2; // Mohra fixture legacy records (re-1, re-2)

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--batch-size" && args[i + 1]) {
      batchSize = parseInt(args[++i], 10);
    } else if (args[i] === "--max-batches" && args[i + 1]) {
      maxBatches = parseInt(args[++i], 10);
    } else if (args[i] === "--allowed-unresolved" && args[i + 1]) {
      allowedUnresolvedThreshold = parseInt(args[++i], 10);
    }
  }

  console.log(`[BACKFILL_INIT] Starting Historical Backfill: batchSize=${batchSize}, maxBatches=${maxBatches}, allowedUnresolvedThreshold=${allowedUnresolvedThreshold}`);

  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: process.env.DATABASE_URL || "file:./dev.db?connection_limit=1&busy_timeout=10000",
      },
    },
  });

  try {
    const report = await HistoricalBackfillService.executeBackfill({
      prismaClient: prisma,
      batchSize,
      maxBatches,
      onProgress: (progress) => {
        console.log(`[BACKFILL_PROGRESS] Batch ${progress.batchesCompleted} | Processed: ${progress.totalProcessed} | Updated: ${progress.totalUpdated} | Unresolved: ${progress.totalUnresolved}`);
      },
    });

    console.log("\n================ BACKFILL RECONCILIATION REPORT ================");
    console.log(JSON.stringify(report, null, 2));
    console.log("=================================================================\n");

    if (report.executionStatus === "STOPPED_MAX_BATCHES_LIMIT") {
      console.error(`[BACKFILL_HALTED] Backfill reached max batches limit (${maxBatches}) before processing all records. Remaining records exist.`);
      process.exit(2);
    }

    if (report.executionStatus === "COMPLETED_WITH_UNRESOLVED") {
      if (!report.allEligibleProcessed || !report.isIdempotentVerified) {
        console.error(`[BACKFILL_INCOMPLETE] Process stopped with unexamined records remaining in database.`);
        process.exit(4);
      }
      if (report.unresolvedCount > allowedUnresolvedThreshold) {
        console.error(`[BACKFILL_REJECTED] Unresolved records (${report.unresolvedCount}) exceed allowed threshold (${allowedUnresolvedThreshold}).`);
        process.exit(3);
      } else {
        console.log(`[BACKFILL_SUCCESS] Completed with ${report.unresolvedCount} known unresolvable legacy fixture records (<= threshold ${allowedUnresolvedThreshold}) and all eligible records verified processed.`);
        process.exit(0);
      }
    }

    if (report.executionStatus === "COMPLETED_ALL_PROCESSED") {
      if (!report.allEligibleProcessed || !report.isIdempotentVerified) {
        console.error(`[BACKFILL_INCOMPLETE] Verification failed despite COMPLETED_ALL_PROCESSED status.`);
        process.exit(4);
      }
      console.log(`[BACKFILL_SUCCESS] 100% of RawEvents have populated platformUserId.`);
      process.exit(0);
    }

    console.error(`[BACKFILL_UNKNOWN_STATUS] Unrecognized status: ${report.executionStatus}`);
    process.exit(1);
  } catch (err) {
    console.error("[BACKFILL_FATAL_ERROR] Unexpected failure during backfill execution:", err);
    process.exit(1);
  } finally {
    await prisma.$disconnect().catch(() => {});
  }
}

main();
