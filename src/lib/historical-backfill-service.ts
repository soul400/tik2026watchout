/**
 * LivePulse Intelligence Lab 2.0 — Resumable Idempotent Historical Event Backfill Engine
 * Safely extracts authoritative platform user identifiers from raw payloads into the indexed platformUserId column.
 * Operates in bounded batches without long-running database locks.
 */

import { PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "./prisma";

export interface BackfillOptions {
  prismaClient?: PrismaClient;
  batchSize?: number;
  maxBatches?: number;
  onProgress?: (progress: BackfillProgress) => void;
}

export interface BackfillProgress {
  batchesCompleted: number;
  totalProcessed: number;
  totalUpdated: number;
  totalUnresolved: number;
  currentCursor?: string;
  percentEstimated?: number;
}

export type BackfillExecutionStatus =
  | "COMPLETED_ALL_PROCESSED"
  | "COMPLETED_WITH_UNRESOLVED"
  | "STOPPED_MAX_BATCHES_LIMIT"
  | "TERMINATED_NO_UPDATES"
  | "FAILED";

export interface BackfillReconciliationReport {
  timestamp: string;
  executionStatus: BackfillExecutionStatus;
  batchesCompleted: number;
  totalProcessed: number;
  totalRawEventsBefore: number;
  totalRawEventsAfter: number;
  populatedBefore: number;
  populatedAfter: number;
  newlyAttributed: number;
  unresolvedCount: number;
  totalUnresolvedExamined: number;
  allEligibleProcessed: boolean;
  byEventType: Record<string, { total: number; populated: number; unresolved: number }>;
  unresolvedSamples: Array<{ id: string; eventType: string; reason: string }>;
  isIdempotentVerified: boolean;
  durationMs: number;
}

export class HistoricalBackfillService {
  /**
   * Authoritative extraction rule: strictly extracts user.id / user.userId / user.uid.
   * Rejects any non-numeric or missing identifier. Never infers from display name or chat text.
   */
  static extractAuthoritativeUserId(payloadStr: string): { validId: string | null; reason?: string } {
    try {
      const parsed = JSON.parse(payloadStr);
      const user = parsed.user || parsed.actor || parsed.sender || parsed.data?.user;
      if (!user) {
        return { validId: null, reason: "NO_USER_OR_ACTOR_OBJECT_IN_PAYLOAD" };
      }

      const rawId = user.id ?? user.userId ?? user.uid;
      if (rawId === undefined || rawId === null) {
        return { validId: null, reason: "USER_OBJECT_LACKS_ID_FIELD" };
      }

      const strId = String(rawId).trim();
      if (!strId || strId === "0" || strId === "undefined" || strId === "null") {
        return { validId: null, reason: "EMPTY_OR_ZERO_IDENTIFIER" };
      }

      // Must be numeric platform user ID
      if (!/^\d+$/.test(strId)) {
        return { validId: null, reason: `NON_NUMERIC_IDENTIFIER: ${strId.slice(0, 20)}` };
      }

      return { validId: strId };
    } catch {
      return { validId: null, reason: "MALFORMED_JSON_PAYLOAD" };
    }
  }

  /**
   * Executes a safe, resumable, idempotent batch backfill.
   */
  static async backfillMissingPlatformUserIds(options: BackfillOptions = {}): Promise<BackfillReconciliationReport> {
    return this.executeBackfill(options);
  }

  /**
   * Executes a safe, resumable, idempotent batch backfill.
   */
  static async executeBackfill(options: BackfillOptions = {}): Promise<BackfillReconciliationReport> {
    const startTime = Date.now();
    const prisma = (options.prismaClient as any) || defaultPrisma;
    const batchSize = Math.min(options.batchSize || 500, 5000); // Default tested 500
    const maxBatches = options.maxBatches || 1000;

    // 1. Initial State Counts
    const totalRawEventsBefore = await prisma.rawEvent.count();
    const populatedBefore = await prisma.rawEvent.count({
      where: { platformUserId: { not: null } },
    });

    let batchesCompleted = 0;
    let totalProcessed = 0;
    let totalUpdated = 0;
    let executionStatus: BackfillExecutionStatus = "COMPLETED_ALL_PROCESSED";
    const unresolvableIds = new Set<string>();
    const unresolvedSamples: Array<{ id: string; eventType: string; reason: string }> = [];

    try {
      // Continuous loop over unpopulated events
      while (batchesCompleted < maxBatches) {
        const batch = await prisma.rawEvent.findMany({
          where: {
            platformUserId: null,
            ...(unresolvableIds.size > 0 ? { id: { notIn: Array.from(unresolvableIds) } } : {}),
          },
          select: { id: true, eventType: true, payload: true },
          take: batchSize,
          orderBy: { id: "asc" },
        });

        if (batch.length === 0) {
          executionStatus = unresolvableIds.size > 0 ? "COMPLETED_WITH_UNRESOLVED" : "COMPLETED_ALL_PROCESSED";
          break;
        }

        const updates: Array<{ id: string; uid: string }> = [];

        for (const ev of batch) {
          totalProcessed++;
          const { validId, reason } = this.extractAuthoritativeUserId(ev.payload);
          if (validId) {
            updates.push({ id: ev.id, uid: validId });
          } else {
            unresolvableIds.add(ev.id);
            if (unresolvedSamples.length < 20) {
              unresolvedSamples.push({ id: ev.id, eventType: ev.eventType, reason: reason || "UNKNOWN" });
            }
          }
        }

        // Apply batch update via SQLite UPDATE ... FROM CTE
        if (updates.length > 0) {
          const placeholders = updates.map(() => "(?, ?)").join(", ");
          const params: string[] = [];
          updates.forEach((u) => params.push(u.id, u.uid));

          const query = `
            WITH updates(id, uid) AS (
              VALUES ${placeholders}
            )
            UPDATE RawEvent
            SET platformUserId = updates.uid
            FROM updates
            WHERE RawEvent.id = updates.id;
          `;

          await prisma.$executeRawUnsafe(query, ...params);
          totalUpdated += updates.length;
        }

        batchesCompleted++;

        if (options.onProgress) {
          options.onProgress({
            batchesCompleted,
            totalProcessed,
            totalUpdated,
            totalUnresolved: unresolvableIds.size,
            currentCursor: batch[batch.length - 1].id,
          });
        }

        // If this batch was smaller than batchSize and had no updates, all records are exhausted
        if (batch.length < batchSize && updates.length === 0) {
          executionStatus = "COMPLETED_WITH_UNRESOLVED";
          break;
        }

        if (batchesCompleted >= maxBatches) {
          executionStatus = "STOPPED_MAX_BATCHES_LIMIT";
          break;
        }
      }

      // 2. Final State Counts
      const totalRawEventsAfter = await prisma.rawEvent.count();
      const populatedAfter = await prisma.rawEvent.count({
        where: { platformUserId: { not: null } },
      });
      const unresolvedCount = totalRawEventsAfter - populatedAfter;
      const allEligibleProcessed = unresolvedCount === unresolvableIds.size;

      // If unexamined unpopulated records remain and we haven't flagged stopped limit, flag it
      if (!allEligibleProcessed && executionStatus !== "STOPPED_MAX_BATCHES_LIMIT") {
        executionStatus = "STOPPED_MAX_BATCHES_LIMIT";
      }

      // 3. Breakdown by eventType
      const breakdownRows = (await prisma.$queryRawUnsafe(`
        SELECT
          eventType,
          COUNT(*) as total,
          SUM(CASE WHEN platformUserId IS NOT NULL THEN 1 ELSE 0 END) as populated,
          SUM(CASE WHEN platformUserId IS NULL THEN 1 ELSE 0 END) as unresolved
        FROM RawEvent
        GROUP BY eventType;
      `)) as any[];

      const byEventType: Record<string, { total: number; populated: number; unresolved: number }> = {};
      for (const r of breakdownRows) {
        byEventType[r.eventType] = {
          total: Number(r.total),
          populated: Number(r.populated),
          unresolved: Number(r.unresolved),
        };
      }

      return {
        timestamp: new Date().toISOString(),
        executionStatus,
        batchesCompleted,
        totalProcessed,
        totalRawEventsBefore,
        totalRawEventsAfter,
        populatedBefore,
        populatedAfter,
        newlyAttributed: populatedAfter - populatedBefore,
        unresolvedCount,
        totalUnresolvedExamined: unresolvableIds.size,
        allEligibleProcessed,
        byEventType,
        unresolvedSamples,
        isIdempotentVerified: (populatedAfter - populatedBefore) === totalUpdated && allEligibleProcessed && executionStatus !== "STOPPED_MAX_BATCHES_LIMIT",
        durationMs: Date.now() - startTime,
      };
    } finally {
      if (options.prismaClient) {
        await options.prismaClient.$disconnect().catch(() => {});
      }
    }
  }
}
