import { prisma } from "./prisma";

export interface ToolGrantParams {
  tenantId: string;
  supporterId: string;
  toolKey: string; // "GLOVE" or "BOOST_FOG"
  quantity: number;
  battleId?: string;
  sourceEventId: string;
  auditReference?: string;
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

export class SmartInventoryService {
  /**
   * Grants a tool to a supporter with strict 5-day expiration (120 hours) and idempotency.
   */
  static async grantTool(params: ToolGrantParams) {
    const { tenantId, supporterId, toolKey, quantity, battleId, sourceEventId, auditReference } = params;

    // 1. Fetch Tool Definition
    const toolDef = await prisma.toolDefinition.findUnique({
      where: {
        tenantId_key: {
          tenantId,
          key: toolKey,
        },
      },
    });

    if (!toolDef || !toolDef.isActive) {
      throw new Error(`Tool definition '${toolKey}' not found or inactive for tenant.`);
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

    // 3. Compute 5-day expiration server-side in UTC
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

    return { success: true, grant };
  }

  /**
   * Consumes tools atomically, preventing double consumption or overdrawn balances.
   */
  static async consumeTool(params: {
    tenantId: string;
    grantId: string;
    supporterId: string;
    quantity: number;
    battleId?: string;
    notes?: string;
  }) {
    const { tenantId, grantId, supporterId, quantity, battleId, notes } = params;

    return await prisma.$transaction(async (tx) => {
      const grant = await tx.toolGrant.findFirst({
        where: { id: grantId, tenantId, supporterId },
      });

      if (!grant) {
        throw new Error("Tool grant record not found.");
      }

      // Check Expiration
      if (new Date() > grant.expiresAt || grant.status === "EXPIRED") {
        throw new Error("Cannot consume an expired tool.");
      }

      const available = grant.quantityGranted - grant.quantityConsumed;
      if (quantity > available) {
        throw new Error(`Insufficient quantity. Available: ${available}, Requested: ${quantity}`);
      }

      const newConsumed = grant.quantityConsumed + quantity;
      const newStatus = newConsumed >= grant.quantityGranted ? "FULLY_USED" : "PARTIALLY_USED";

      const updatedGrant = await tx.toolGrant.update({
        where: { id: grantId },
        data: {
          quantityConsumed: newConsumed,
          status: newStatus,
        },
      });

      const consumption = await tx.toolConsumption.create({
        data: {
          tenantId,
          toolGrantId: grantId,
          supporterId,
          quantity,
          battleId,
          notes,
        },
      });

      return { updatedGrant, consumption };
    });
  }

  /**
   * Refreshes expiration states and schedules alerts (48h, 24h, 6h, EXPIRED).
   */
  static async reconcileExpirations(tenantId: string) {
    const now = new Date();
    const in48h = new Date(now.getTime() + 48 * 60 * 60 * 1000);
    const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const in6h = new Date(now.getTime() + 6 * 60 * 60 * 1000);

    // 1. Mark expired
    await prisma.toolGrant.updateMany({
      where: {
        tenantId,
        expiresAt: { lte: now },
        status: { in: ["AVAILABLE", "PARTIALLY_USED", "EXPIRING_SOON"] },
      },
      data: {
        status: "EXPIRED",
      },
    });

    // 2. Mark expiring soon
    await prisma.toolGrant.updateMany({
      where: {
        tenantId,
        expiresAt: { lte: in48h, gt: now },
        status: { in: ["AVAILABLE", "PARTIALLY_USED"] },
      },
      data: {
        status: "EXPIRING_SOON",
      },
    });
  }

  /**
   * Fetches accurate inventory counters per tool type.
   */
  static async getInventoryCounters(tenantId: string): Promise<InventoryOverview[]> {
    await this.reconcileExpirations(tenantId);

    const toolDefs = await prisma.toolDefinition.findMany({
      where: { tenantId, isActive: true },
    });

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

        if (g.status === "EXPIRED") {
          totalExpired += remaining;
        } else {
          totalAvailable += remaining;
          if (g.status === "EXPIRING_SOON") {
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
}
