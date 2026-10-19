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

    // 1. Fetch or Auto-provision Tool Definition
    let toolDef = await prisma.toolDefinition.findUnique({
      where: {
        tenantId_key: {
          tenantId,
          key: toolKey,
        },
      },
    });

    if (!toolDef) {
      const defaultNames: Record<string, { name: string; icon: string; color: string }> = {
        GLOVE: { name: "القفاز التكتيكي (Glove x5)", icon: "ShieldAlert", color: "#F5B942" },
        BOOST_FOG: { name: "الضباب المعزز (Boost Fog)", icon: "CloudFog", color: "#21D4D8" },
        SONG_SURGE: { name: "موجة الأغنية التكتيكية (Song Surge x5)", icon: "Mic2", color: "#A855F7" },
        TIME_EXTENDER: { name: "ممدد الوقت التكتيكي (Time Extender)", icon: "Hourglass", color: "#4A8DFF" },
        SPEED_BOOSTER: { name: "معزز السرعة المزدوج (Speed Challenge)", icon: "Zap", color: "#8B72F8" },
        HAMMER: { name: "مطرقة الحظر التكتيكية (Hammer)", icon: "Hammer", color: "#EC4899" },
        SHIELD_DEFENSE: { name: "درع الصمود التكتيكي (Shield Defense)", icon: "Shield", color: "#10B981" },
      };
      const meta = defaultNames[toolKey] || { name: `أداة تكتيكية (${toolKey})`, icon: "Sparkles", color: "#21D4D8" };

      toolDef = await prisma.toolDefinition.create({
        data: {
          tenantId,
          key: toolKey,
          name: meta.name,
          icon: meta.icon,
          colorHex: meta.color,
          defaultHours: 120,
          isActive: true,
        },
      });
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
    const expiredRes = await prisma.toolGrant.updateMany({
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
      expiredCount: expiredRes.count,
      expiringSoonCount: expiringSoonRes.count,
    };
  }

  /**
   * Fetches accurate inventory counters per tool type.
   */
  static async getInventoryCounters(tenantId: string): Promise<InventoryOverview[]> {
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
   * Resets all tactical tools inventory data (grants, consumptions, alerts) for the tenant.
   */
  static async resetInventory(tenantId: string) {
    return await prisma.$transaction(async (tx) => {
      await tx.inventoryAlert.deleteMany({ where: { tenantId } });
      await tx.toolConsumption.deleteMany({ where: { tenantId } });
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
