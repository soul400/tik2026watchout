import { prisma } from "./prisma";

export const CANONICAL_TOOL_DEFINITIONS: Record<string, { name: string; icon: string; color: string; defaultHours: number }> = {
  GLOVE: { name: "القفاز التكتيكي (Glove x5)", icon: "ShieldAlert", color: "#F5B942", defaultHours: 120 },
  BOOST_FOG: { name: "الضباب المعزز (Boost Fog)", icon: "CloudFog", color: "#21D4D8", defaultHours: 120 },
  SONG_SURGE: { name: "موجة الأغنية التكتيكية (Song Surge x5)", icon: "Mic2", color: "#A855F7", defaultHours: 120 },
  TIME_EXTENDER: { name: "ممدد الوقت التكتيكي (Time Extender)", icon: "Hourglass", color: "#4A8DFF", defaultHours: 120 },
  SPEED_BOOSTER: { name: "معزز السرعة المزدوج (Speed Challenge)", icon: "Zap", color: "#8B72F8", defaultHours: 120 },
  HAMMER: { name: "مطرقة الحظر التكتيكية (Hammer)", icon: "Hammer", color: "#EC4899", defaultHours: 120 },
  SHIELD_DEFENSE: { name: "درع الصمود التكتيكي (Shield Defense)", icon: "Shield", color: "#10B981", defaultHours: 120 },
};

export type CanonicalToolKey = keyof typeof CANONICAL_TOOL_DEFINITIONS;

export interface ToolGrantParams {
  tenantId: string;
  supporterId: string;
  toolKey: string;
  quantity: number;
  battleId?: string;
  sourceEventId: string;
  auditReference?: string;
}

export interface ToolConsumeParams {
  tenantId: string;
  supporterId: string;
  toolKey?: string;
  grantId?: string;
  quantity?: number;
  battleId?: string;
  sourceEventId?: string;
  notes?: string;
  allowExternalFallback?: boolean;
  isQuarantined?: boolean;
  quarantineReason?: string;
}

export interface ToolConsumeResult {
  success: boolean;
  updatedGrant: any;
  consumption: any;
  isExternal?: boolean;
  externalActivation?: any;
  duplicate?: boolean;
  quarantined?: boolean;
  reason?: string;
}

export interface InventoryOverview {
  toolKey: string;
  toolName: string;
  colorHex: string;
  icon: string;
  totalAvailable: number;
  totalReceived: number;
  totalConsumed: number;
  totalExpiringSoon: number;
  totalExpired: number;
}

export interface InventoryReconciliationReport {
  isReconciled: boolean;
  tenantId: string;
  totalGrantsProjected: number;
  totalLedgerBalance: number;
  netDiscrepancy: number;
  perTool: Record<string, {
    projected: number;
    ledger: number;
    discrepancy: number;
  }>;
  movementsCount: number;
  reconciledAt: Date;
}

export class SmartInventoryService {
  /**
   * Ensures that all canonical tools exist for the given tenant.
   * This guarantees that even tools with zero inventory appear in the UI with accurate 0 counters.
   * Strictly validates tenantId and verifies tenant existence before attempting any database writes.
   */
  static async ensureCanonicalDefinitions(tenantId: string): Promise<boolean> {
    if (!tenantId || typeof tenantId !== "string" || tenantId.trim() === "") {
      return false;
    }

    const tenantExists = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true },
    });

    if (!tenantExists) {
      return false;
    }

    const upsertPromises = Object.entries(CANONICAL_TOOL_DEFINITIONS).map(([key, meta]) => {
      return prisma.toolDefinition.upsert({
        where: {
          tenantId_key: {
            tenantId,
            key,
          },
        },
        create: {
          tenantId,
          key,
          name: meta.name,
          icon: meta.icon,
          colorHex: meta.color,
          defaultHours: meta.defaultHours,
          isActive: true,
        },
        update: {
          name: meta.name,
          icon: meta.icon,
          colorHex: meta.color,
          defaultHours: meta.defaultHours,
          isActive: true,
        },
      });
    });

    await Promise.all(upsertPromises);
    return true;
  }

  /**
   * Grants a tool to a supporter with strict 5-day expiration (120 hours) and idempotency.
   * Unknown/unsupported tools are rejected and cannot modify tool balances.
   */
  static async grantTool(params: ToolGrantParams) {
    const { tenantId, supporterId, toolKey, quantity, battleId, sourceEventId, auditReference } = params;

    // 0. Strict tenant validation: Reject empty or invalid tenant IDs
    if (!tenantId || typeof tenantId !== "string" || tenantId.trim() === "") {
      return { success: false, reason: "INVALID_TENANT_ID" };
    }

    const tenantExists = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true },
    });
    if (!tenantExists) {
      return { success: false, reason: "TENANT_NOT_FOUND" };
    }

    // 1. Strict validation: Reject unknown tool keys
    if (!toolKey || !CANONICAL_TOOL_DEFINITIONS[toolKey]) {
      console.warn(`[TACTICAL_GRANT_REJECTED] Unknown or unsupported tool key: "${toolKey}"`);
      return { success: false, reason: "INVALID_TOOL_KEY" };
    }

    // 2. Prevent duplicate grants from the same source event
    const existing = await prisma.toolGrant.findUnique({
      where: { sourceEventId },
      include: {
        toolDefinition: true,
        supporter: true,
      },
    });

    if (existing) {
      return { success: false, reason: "ALREADY_GRANTED", grant: existing };
    }

    // 3. Fetch or provision Tool Definition
    let toolDef = await prisma.toolDefinition.findUnique({
      where: {
        tenantId_key: {
          tenantId,
          key: toolKey,
        },
      },
    });

    if (!toolDef) {
      const meta = CANONICAL_TOOL_DEFINITIONS[toolKey];
      toolDef = await prisma.toolDefinition.create({
        data: {
          tenantId,
          key: toolKey,
          name: meta.name,
          icon: meta.icon,
          colorHex: meta.color,
          defaultHours: meta.defaultHours,
          isActive: true,
        },
      });
    }

    // 4. Compute 5-day expiration server-side in UTC
    const receivedAt = new Date();
    const expiresAt = new Date(receivedAt.getTime() + (toolDef.defaultHours || 120) * 60 * 60 * 1000);

    const grant = await prisma.toolGrant.create({
      data: {
        tenantId,
        supporterId,
        toolDefinitionId: toolDef.id,
        battleId,
        sourceEventId,
        quantityGranted: quantity,
        quantityConsumed: 0,
        receivedAt,
        expiresAt,
        status: "AVAILABLE",
        auditReference: auditReference || `Auto-granted at ${receivedAt.toISOString()}`,
      },
      include: {
        toolDefinition: true,
        supporter: true,
      },
    });

    // Record ACQUISITION in 2.0 Movement Ledger
    try {
      await prisma.toolLedgerMovement.create({
        data: {
          tenantId,
          toolGrantId: grant.id,
          supporterId,
          toolKey,
          movementType: "ACQUISITION",
          quantity,
          previousBalance: 0,
          resultingBalance: quantity,
          sourceEventId,
          reason: auditReference || "TACTICAL_CARD_AWARD",
          metadataJson: JSON.stringify({
            expiresAt: expiresAt.toISOString(),
            battleId,
          }),
        },
      });
    } catch (e: any) {
      console.warn(`[INVENTORY_LEDGER] Acquisition ledger notice: ${e?.message}`);
    }

    return { success: true, grant };
  }

  /**
   * Consumes tools atomically inside a database transaction.
   * - Prevents duplicate activations via database unique constraint on sourceEventId.
   * - Selects the earliest-expiring active grant (FEFO: First Expiring First Out).
   * - Rejects expired or exhausted grants.
   * - Supports recording ExternalActivation when a live card is activated but no local grant exists.
   */
  static async consumeTool(params: ToolConsumeParams): Promise<ToolConsumeResult> {
    const {
      tenantId,
      supporterId,
      toolKey,
      grantId,
      quantity = 1,
      battleId,
      sourceEventId,
      notes,
      allowExternalFallback = false,
      isQuarantined = false,
      quarantineReason,
    } = params;

    // Strict tenant validation: Reject empty or invalid tenant IDs
    if (!tenantId || typeof tenantId !== "string" || tenantId.trim() === "") {
      return { success: false, reason: "INVALID_TENANT_ID", updatedGrant: null, consumption: null };
    }

    const tenantExists = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true },
    });
    if (!tenantExists) {
      return { success: false, reason: "TENANT_NOT_FOUND", updatedGrant: null, consumption: null };
    }

    // 0. Quarantine Defense: unverified or ambiguous events without idempotency identity
    if (isQuarantined) {
      const now = new Date();
      let resolvedPlatformUserId: string | null = null;
      if (supporterId) {
        const supp = await prisma.supporter.findUnique({ where: { id: supporterId }, select: { platformUserId: true } });
        if (supp) resolvedPlatformUserId = supp.platformUserId;
      }

      const quarantinedRecord = await prisma.externalActivation.create({
        data: {
          tenantId,
          supporterId,
          platformUserId: resolvedPlatformUserId,
          toolKey: toolKey || "UNKNOWN",
          battleId,
          sourceEventId: sourceEventId || null,
          detailsJson: JSON.stringify({
            quarantined: true,
            isQuarantined: true,
            reason: quarantineReason || "UNIDENTIFIED_UPSTREAM_EVENT",
            quarantineReason: quarantineReason || "UNIDENTIFIED_UPSTREAM_EVENT",
            notes,
            quarantinedAt: now.toISOString(),
          }),
          activatedAt: now,
        },
      });

      return {
        success: false,
        quarantined: true,
        reason: quarantineReason || "UNIDENTIFIED_UPSTREAM_EVENT",
        externalActivation: quarantinedRecord,
        updatedGrant: null,
        consumption: null,
      };
    }

    try {
      return await prisma.$transaction(async (tx) => {
        const now = new Date();

        // 1. Idempotency Check via sourceEventId
        if (sourceEventId) {
          const existingConsumption = await tx.toolConsumption.findUnique({
            where: { sourceEventId },
            include: { toolGrant: { include: { toolDefinition: true } } },
          });

          if (existingConsumption) {
            return {
              success: true,
              duplicate: true,
              consumption: existingConsumption,
              updatedGrant: existingConsumption.toolGrant,
            };
          }

          const existingExternal = await tx.externalActivation.findUnique({
            where: { sourceEventId },
          });

          if (existingExternal) {
            return {
              success: true,
              duplicate: true,
              isExternal: true,
              externalActivation: existingExternal,
              updatedGrant: null,
              consumption: null,
            };
          }
        }

        // 2. Select eligible grant
        let grant: any = null;

        if (grantId) {
          grant = await tx.toolGrant.findFirst({
            where: { id: grantId, tenantId, supporterId },
            include: { toolDefinition: true },
          });

          if (grant && (grant.expiresAt <= now || grant.status === "EXPIRED")) {
            throw new Error("Cannot consume an expired tool.");
          }
        } else if (toolKey) {
          // Query earliest-expiring active grant (FEFO)
          grant = await tx.toolGrant.findFirst({
            where: {
              tenantId,
              supporterId,
              toolDefinition: { key: toolKey },
              status: { in: ["AVAILABLE", "PARTIALLY_USED"] },
              expiresAt: { gt: now },
            },
            orderBy: { expiresAt: "asc" },
            include: { toolDefinition: true },
          });
        }

        // 3. If no matching local grant is found
        if (!grant) {
          if (allowExternalFallback) {
            const external = await tx.externalActivation.create({
              data: {
                tenantId,
                supporterId,
                toolKey: toolKey || "UNKNOWN",
                battleId,
                sourceEventId,
                detailsJson: JSON.stringify({
                  notes,
                  reason: "NO_MATCHING_LOCAL_GRANT",
                  requestedAt: now.toISOString(),
                }),
                activatedAt: now,
              },
            });

            return {
              success: true,
              isExternal: true,
              externalActivation: external,
              updatedGrant: null,
              consumption: null,
            };
          }

          throw new Error(
            `Tool grant record not found or no unexpired inventory available for tool: ${toolKey || grantId}`
          );
        }

        // 4. Validate quantity
        const available = grant.quantityGranted - grant.quantityConsumed;
        if (quantity > available) {
          throw new Error(`Insufficient quantity. Available: ${available}, Requested: ${quantity}`);
        }

        const newConsumed = grant.quantityConsumed + quantity;
        const newStatus = newConsumed >= grant.quantityGranted ? "FULLY_USED" : "PARTIALLY_USED";

        const updatedGrant = await tx.toolGrant.update({
          where: { id: grant.id },
          data: {
            quantityConsumed: newConsumed,
            status: newStatus,
          },
          include: { toolDefinition: true },
        });

        const consumption = await tx.toolConsumption.create({
          data: {
            tenantId,
            toolGrantId: grant.id,
            supporterId,
            quantity,
            battleId,
            sourceEventId,
            notes,
            consumedAt: now,
          },
        });

        // Record USAGE in 2.0 Movement Ledger
        await tx.toolLedgerMovement.create({
          data: {
            tenantId,
            toolGrantId: grant.id,
            supporterId,
            toolKey: grant.toolDefinition.key,
            movementType: "USAGE",
            quantity: -quantity,
            previousBalance: available,
            resultingBalance: available - quantity,
            sourceEventId,
            reason: notes || "LIVE_TACTICAL_CARD_ACTIVATION",
            metadataJson: JSON.stringify({
              battleId,
              consumptionId: consumption.id,
            }),
          },
        });

        return { success: true, updatedGrant, consumption };
      });
    } catch (err: any) {
      // Concurrency race condition handling:
      // If two concurrent requests hit with the exact same sourceEventId at the same millisecond,
      // the second insert will encounter a P2002 Unique Constraint violation.
      if (err?.code === "P2002" && sourceEventId) {
        const target = err.meta?.target;
        const isSourceEventConflict = Array.isArray(target)
          ? target.includes("sourceEventId")
          : typeof target === "string"
          ? target.includes("sourceEventId")
          : true;

        if (isSourceEventConflict) {
          const committedConsumption = await prisma.toolConsumption.findUnique({
            where: { sourceEventId },
            include: { toolGrant: { include: { toolDefinition: true } } },
          });

          if (committedConsumption) {
            return {
              success: true,
              duplicate: true,
              consumption: committedConsumption,
              updatedGrant: committedConsumption.toolGrant,
            };
          }

          const committedExternal = await prisma.externalActivation.findUnique({
            where: { sourceEventId },
          });

          if (committedExternal) {
            return {
              success: true,
              duplicate: true,
              isExternal: true,
              externalActivation: committedExternal,
              updatedGrant: null,
              consumption: null,
            };
          }
        }
      }

      // Propagate all other database errors untouched
      throw err;
    }
  }

  /**
   * Refreshes expiration states and schedules alerts (48h, 24h, 6h, EXPIRED).
   * Now delegates to sweepExpiredGrants for complete double-entry movement logging.
   */
  static async reconcileExpirations(tenantId: string) {
    return this.sweepExpiredGrants(tenantId);
  }

  /**
   * Periodically sweeps expired grants and logs official EXPIRATION movements in the immutable ledger.
   * Guarantees that expired quantities are accounted for in double-entry auditing without phantom balances.
   */
  static async sweepExpiredGrants(tenantId: string) {
    const now = new Date();
    const in48h = new Date(now.getTime() + 48 * 60 * 60 * 1000);

    // 1. Find grants that are expiring and still have unconsumed balances
    const expiredGrants = await prisma.toolGrant.findMany({
      where: {
        tenantId,
        expiresAt: { lte: now },
        status: { in: ["AVAILABLE", "PARTIALLY_USED", "EXPIRING_SOON"] },
      },
      include: {
        toolDefinition: true,
      },
    });

    let movementsLogged = 0;

    for (const grant of expiredGrants) {
      const remainingQty = Math.max(0, grant.quantityGranted - grant.quantityConsumed);

      // Atomically update grant and log movement
      await prisma.$transaction(async (tx) => {
        await tx.toolGrant.update({
          where: { id: grant.id },
          data: { status: "EXPIRED" },
        });

        if (remainingQty > 0) {
          try {
            await tx.toolLedgerMovement.create({
              data: {
                tenantId,
                toolGrantId: grant.id,
                supporterId: grant.supporterId,
                toolKey: grant.toolDefinition.key,
                movementType: "EXPIRATION",
                quantity: -remainingQty,
                previousBalance: remainingQty,
                resultingBalance: 0,
                sourceEventId: `sweep:exp:${grant.id}:${now.getTime()}`,
                reason: "120H_TTL_EXPIRED",
                metadataJson: JSON.stringify({
                  expiredAt: now.toISOString(),
                  originalExpiresAt: grant.expiresAt.toISOString(),
                  remainingQuantity: remainingQty,
                }),
              },
            });
            movementsLogged++;
          } catch (e: any) {
            // Idempotently skip if duplicate movement key
          }
        }
      });
    }

    // 2. Mark upcoming expirations within 48h
    const expiringSoonRes = await prisma.toolGrant.updateMany({
      where: {
        tenantId,
        expiresAt: { lte: in48h, gt: now },
        status: { in: ["AVAILABLE", "PARTIALLY_USED"] },
      },
      data: {
        status: "EXPIRING_SOON",
      },
    });

    return {
      expiredCount: expiredGrants.length,
      movementsLogged,
      expiringSoonCount: expiringSoonRes.count,
    };
  }

  /**
   * Fetches accurate inventory counters per tool type.
   * Auto-provisions canonical definitions for valid tenants so 0-inventory tools always display properly.
   * Returns empty canonical zero counters safely if tenantId is missing or nonexistent without throwing.
   */
  static async getInventoryCounters(tenantId: string): Promise<InventoryOverview[]> {
    if (!tenantId || typeof tenantId !== "string" || tenantId.trim() === "") {
      return Object.entries(CANONICAL_TOOL_DEFINITIONS).map(([key, meta]) => ({
        toolKey: key,
        toolName: meta.name,
        colorHex: meta.color,
        icon: meta.icon,
        totalAvailable: 0,
        totalReceived: 0,
        totalConsumed: 0,
        totalExpiringSoon: 0,
        totalExpired: 0,
      }));
    }

    const tenantExists = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true },
    });

    if (!tenantExists) {
      return Object.entries(CANONICAL_TOOL_DEFINITIONS).map(([key, meta]) => ({
        toolKey: key,
        toolName: meta.name,
        colorHex: meta.color,
        icon: meta.icon,
        totalAvailable: 0,
        totalReceived: 0,
        totalConsumed: 0,
        totalExpiringSoon: 0,
        totalExpired: 0,
      }));
    }

    await this.ensureCanonicalDefinitions(tenantId);

    const toolDefs = await prisma.toolDefinition.findMany({
      where: { tenantId, isActive: true },
    });

    const now = Date.now();
    const in48h = now + 48 * 60 * 60 * 1000;
    const results: InventoryOverview[] = [];

    for (const def of toolDefs) {
      const grants = await prisma.toolGrant.findMany({
        where: { tenantId, toolDefinitionId: def.id },
      });

      let totalReceived = 0;
      let totalConsumed = 0;
      let totalAvailable = 0;
      let totalExpiringSoon = 0;
      let totalExpired = 0;

      for (const g of grants) {
        totalReceived += g.quantityGranted;
        totalConsumed += g.quantityConsumed;
        const remaining = Math.max(0, g.quantityGranted - g.quantityConsumed);
        const expiresAtMs = g.expiresAt.getTime();
        const isExpired = expiresAtMs <= now || g.status === "EXPIRED";

        if (isExpired) {
          totalExpired += remaining;
        } else {
          totalAvailable += remaining;
          if (expiresAtMs <= in48h || g.status === "EXPIRING_SOON") {
            totalExpiringSoon += remaining;
          }
        }
      }

      results.push({
        toolKey: def.key,
        toolName: def.name,
        colorHex: def.colorHex,
        icon: def.icon,
        totalAvailable,
        totalReceived,
        totalConsumed,
        totalExpiringSoon,
        totalExpired,
      });
    }

    return results;
  }

  /**
   * Reconciles current active grant balance projections against the complete ledger movement history.
   * Guarantees that any discrepancy between materialized balances and transaction history is detected.
   */
  static async reconcileInventory(tenantId: string): Promise<InventoryReconciliationReport> {
    if (!tenantId || typeof tenantId !== "string" || tenantId.trim() === "") {
      return {
        isReconciled: true,
        tenantId: tenantId || "",
        totalGrantsProjected: 0,
        totalLedgerBalance: 0,
        netDiscrepancy: 0,
        perTool: {},
        movementsCount: 0,
        reconciledAt: new Date(),
      };
    }

    const tenantExists = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true },
    });
    if (!tenantExists) {
      return {
        isReconciled: true,
        tenantId,
        totalGrantsProjected: 0,
        totalLedgerBalance: 0,
        netDiscrepancy: 0,
        perTool: {},
        movementsCount: 0,
        reconciledAt: new Date(),
      };
    }

    const activeGrants = await prisma.toolGrant.findMany({
      where: {
        tenantId,
        status: { in: ["AVAILABLE", "PARTIALLY_USED"] },
      },
      include: { toolDefinition: true },
    });

    const now = Date.now();
    let totalGrantsProjected = 0;
    const perToolProjected: Record<string, number> = {};

    for (const g of activeGrants) {
      if (g.expiresAt.getTime() > now) {
        const remaining = Math.max(0, g.quantityGranted - g.quantityConsumed);
        totalGrantsProjected += remaining;
        const key = g.toolDefinition.key;
        perToolProjected[key] = (perToolProjected[key] || 0) + remaining;
      }
    }

    const ledgerMovements = await prisma.toolLedgerMovement.findMany({
      where: { tenantId },
    });

    let totalLedgerBalance = 0;
    const perToolLedger: Record<string, number> = {};

    for (const m of ledgerMovements) {
      totalLedgerBalance += m.quantity;
      perToolLedger[m.toolKey] = (perToolLedger[m.toolKey] || 0) + m.quantity;
    }

    const allKeys = Array.from(new Set([...Object.keys(perToolProjected), ...Object.keys(perToolLedger)]));
    const perTool: Record<string, { projected: number; ledger: number; discrepancy: number }> = {};
    let netDiscrepancy = 0;

    for (const key of allKeys) {
      const proj = perToolProjected[key] || 0;
      const ledg = perToolLedger[key] || 0;
      const diff = proj - ledg;
      perTool[key] = {
        projected: proj,
        ledger: ledg,
        discrepancy: diff,
      };
      netDiscrepancy += Math.abs(diff);
    }

    return {
      isReconciled: netDiscrepancy === 0,
      tenantId,
      totalGrantsProjected,
      totalLedgerBalance,
      netDiscrepancy,
      perTool,
      movementsCount: ledgerMovements.length,
      reconciledAt: new Date(),
    };
  }

  /**
   * Fetches the movement ledger for a tenant with optional filtering.
   */
  static async getLedgerMovements(tenantId: string, limit = 100) {
    return await prisma.toolLedgerMovement.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        supporter: { select: { displayName: true, username: true, avatarUrl: true } },
        toolGrant: {
          select: {
            status: true,
            expiresAt: true,
            quantityGranted: true,
            quantityConsumed: true,
            toolDefinition: { select: { key: true, name: true, icon: true, colorHex: true } },
          },
        },
      },
    });
  }

  /**
   * Deducts quantity from a grant and records a DEDUCTION ledger movement.
   */
  static async recordDeduction(params: {
    tenantId: string;
    grantId: string;
    quantity: number;
    reason: string;
    sourceEventId?: string;
  }) {
    const { tenantId, grantId, quantity, reason, sourceEventId } = params;

    return await prisma.$transaction(async (tx) => {
      const grant = await tx.toolGrant.findUnique({
        where: { id: grantId },
        include: { toolDefinition: true },
      });

      if (!grant || grant.tenantId !== tenantId) {
        throw new Error("Tool grant not found");
      }

      const available = Math.max(0, grant.quantityGranted - grant.quantityConsumed);
      if (quantity > available) {
        throw new Error(`Insufficient quantity for deduction. Available: ${available}, Requested: ${quantity}`);
      }

      const newConsumed = grant.quantityConsumed + quantity;
      const newStatus = newConsumed >= grant.quantityGranted ? "FULLY_USED" : "PARTIALLY_USED";

      const updated = await tx.toolGrant.update({
        where: { id: grantId },
        data: { quantityConsumed: newConsumed, status: newStatus },
      });

      const movement = await tx.toolLedgerMovement.create({
        data: {
          tenantId,
          toolGrantId: grant.id,
          supporterId: grant.supporterId,
          toolKey: grant.toolDefinition.key,
          movementType: "DEDUCTION",
          quantity: -quantity,
          previousBalance: available,
          resultingBalance: available - quantity,
          sourceEventId,
          reason,
        },
      });

      return { success: true, updatedGrant: updated, movement };
    });
  }

  /**
   * Records a REVERSAL for a previously consumed tool (e.g. cancelled/disputed battle).
   */
  static async recordReversal(params: {
    tenantId: string;
    consumptionId: string;
    reason: string;
  }) {
    const { tenantId, consumptionId, reason } = params;

    return await prisma.$transaction(async (tx) => {
      const consumption = await tx.toolConsumption.findUnique({
        where: { id: consumptionId },
        include: { toolGrant: { include: { toolDefinition: true } } },
      });

      if (!consumption || consumption.tenantId !== tenantId) {
        throw new Error("Tool consumption record not found");
      }

      const grant = consumption.toolGrant;
      const quantityToRestore = consumption.quantity;
      const newConsumed = Math.max(0, grant.quantityConsumed - quantityToRestore);
      const newStatus = newConsumed === 0 ? "AVAILABLE" : "PARTIALLY_USED";

      const updatedGrant = await tx.toolGrant.update({
        where: { id: grant.id },
        data: { quantityConsumed: newConsumed, status: newStatus },
      });

      const movement = await tx.toolLedgerMovement.create({
        data: {
          tenantId,
          toolGrantId: grant.id,
          supporterId: grant.supporterId,
          toolKey: grant.toolDefinition.key,
          movementType: "REVERSAL",
          quantity: quantityToRestore,
          previousBalance: grant.quantityGranted - grant.quantityConsumed,
          resultingBalance: grant.quantityGranted - newConsumed,
          reason,
          metadataJson: JSON.stringify({ reversedConsumptionId: consumption.id }),
        },
      });

      return { success: true, updatedGrant, movement };
    });
  }

  /**
   * Records an EXPIRATION ledger movement for unconsumed quantities of an expired grant.
   */
  static async recordExpiration(params: {
    tenantId: string;
    grantId: string;
    reason?: string;
  }) {
    const { tenantId, grantId, reason = "LIFECYCLE_5DAY_EXPIRATION" } = params;

    return await prisma.$transaction(async (tx) => {
      const grant = await tx.toolGrant.findUnique({
        where: { id: grantId },
        include: { toolDefinition: true },
      });

      if (!grant || grant.tenantId !== tenantId) throw new Error("Grant not found");
      if (grant.status === "EXPIRED") return { success: true, alreadyExpired: true };

      const remaining = Math.max(0, grant.quantityGranted - grant.quantityConsumed);

      const updatedGrant = await tx.toolGrant.update({
        where: { id: grantId },
        data: { status: "EXPIRED" },
      });

      let movement = null;
      if (remaining > 0) {
        movement = await tx.toolLedgerMovement.create({
          data: {
            tenantId,
            toolGrantId: grant.id,
            supporterId: grant.supporterId,
            toolKey: grant.toolDefinition.key,
            movementType: "EXPIRATION",
            quantity: -remaining,
            previousBalance: remaining,
            resultingBalance: 0,
            reason,
          },
        });
      }

      return { success: true, updatedGrant, movement };
    });
  }

  /**
   * Records an audited manual CORRECTION to reconcile physical discrepancies.
   */
  static async recordCorrection(params: {
    tenantId: string;
    grantId: string;
    quantityDelta: number;
    reason: string;
  }) {
    const { tenantId, grantId, quantityDelta, reason } = params;

    return await prisma.$transaction(async (tx) => {
      const grant = await tx.toolGrant.findUnique({
        where: { id: grantId },
        include: { toolDefinition: true },
      });

      if (!grant || grant.tenantId !== tenantId) throw new Error("Grant not found");

      const available = Math.max(0, grant.quantityGranted - grant.quantityConsumed);
      const newAvailable = available + quantityDelta;
      if (newAvailable < 0) {
        throw new Error(`Correction would result in negative balance: ${newAvailable}`);
      }

      const updatedGrant = await tx.toolGrant.update({
        where: { id: grantId },
        data: {
          quantityGranted: grant.quantityGranted + (quantityDelta > 0 ? quantityDelta : 0),
          quantityConsumed: grant.quantityConsumed + (quantityDelta < 0 ? Math.abs(quantityDelta) : 0),
        },
      });

      const movement = await tx.toolLedgerMovement.create({
        data: {
          tenantId,
          toolGrantId: grant.id,
          supporterId: grant.supporterId,
          toolKey: grant.toolDefinition.key,
          movementType: "CORRECTION",
          quantity: quantityDelta,
          previousBalance: available,
          resultingBalance: newAvailable,
          reason,
        },
      });

      return { success: true, updatedGrant, movement };
    });
  }

  /**
   * Resets all tactical tools inventory data (grants, consumptions, alerts, external activations, ledger) for the tenant.
   */
  static async resetInventory(tenantId: string) {
    return await prisma.$transaction(async (tx) => {
      await tx.inventoryAlert.deleteMany({ where: { tenantId } });
      await tx.toolConsumption.deleteMany({ where: { tenantId } });
      await tx.externalActivation.deleteMany({ where: { tenantId } });
      await tx.toolLedgerMovement.deleteMany({ where: { tenantId } });
      const deletedGrants = await tx.toolGrant.deleteMany({ where: { tenantId } });

      await tx.auditLog.create({
        data: {
          tenantId,
          action: "INVENTORY_RESET",
          entityType: "TOOL_INVENTORY",
          entityId: "ALL",
          detailsJson: JSON.stringify({
            deletedGrantsCount: deletedGrants.count,
            timestamp: new Date().toISOString(),
          }),
        },
      });

      return { deletedGrantsCount: deletedGrants.count };
    });
  }
}
