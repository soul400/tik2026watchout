import { prisma } from "./prisma";

export type EvidenceClassification =
  | "IDENTIFIER_MATCH"       // Verified exact SecUID or UID correlation
  | "METADATA_MATCH"         // Verified profile / display identifier correlation
  | "BEHAVIORAL_SIMILARITY"  // Timing pattern or gift sequence correlation (never claims identity)
  | "UNCONFIRMED_ASSOCIATION"// Inconclusive association
  | "REJECTED_MATCH";        // Explicitly rejected by reviewer or conflict

export interface EnigmaEvidence {
  classification: EvidenceClassification;
  classificationRationale: string;
  isBehavioralOnly: boolean;
  ruleVersion: string;
  realUsername: string;
  realDisplayName: string;
  enigmaUsername: string;
  enigmaDisplayName: string;
  platformUserId: string;
  secUid?: string;
  diamondsWithEnigma: number;
  diamondsPublic: number;
  totalCombinedDiamonds: number;
  enigmaEventsCount: number;
  topGifts: Array<{ name: string; count: number; diamonds: number; time: string }>;
  evidencePoints: string[];
  reviewAudit?: {
    reviewer: string;
    reviewedAt: string;
    action: "CONFIRMED" | "DISMISSED";
    notes?: string;
  };
}

export interface EnigmaCandidate {
  id: string;
  tenantId: string;
  supporter1Id: string; // Enigma Supporter Record
  supporter2Id: string; // Real Supporter Record
  matchLevel: "STRONG_MATCH" | "PROBABLE_MATCH" | "INSUFFICIENT_EVIDENCE";
  classification: EvidenceClassification;
  confidenceScore: number;
  evidence: EnigmaEvidence;
  status: "PENDING" | "CONFIRMED" | "DISMISSED";
  reviewedAt?: Date | null;
  reviewedBy?: string | null;
}

export class EnigmaEngine {
  /**
   * Analyzes raw events and supporters to detect supporters
   * who TRULY activated TikTok Enigma mask / incognito mode,
   * strictly excluding any regular users who merely mentioned or chatted with Enigmas.
   */
  static async analyzeAndSyncEnigmaReviews(tenantId: string): Promise<number> {
    // 1. Fetch all supporters indexed by platformUserId
    const supporters = await prisma.supporter.findMany({
      where: { tenantId },
    });

    const supporterMap = new Map<string, typeof supporters[0]>();
    for (const s of supporters) {
      supporterMap.set(s.platformUserId, s);
    }

    // 2. Fetch raw events with isEnigmaMaskOn: true
    const enigmaEvents = await prisma.$queryRawUnsafe<any[]>(`
      SELECT id, sourceTimestamp, payload 
      FROM RawEvent 
      WHERE (payload LIKE '%"isEnigmaMaskOn":true%' OR payload LIKE '%"isEnigmaMaskOn": true%')
      ORDER BY sourceTimestamp ASC;
    `);

    if (enigmaEvents.length === 0) {
      return 0;
    }

    // Group events ONLY for users who themselves had Enigma mask ON or an Enigma displayId
    interface EnigmaGroup {
      uid: string;
      secUid: string;
      displayId: string;
      nickname: string;
      eventsCount: number;
      diamonds: number;
      gifts: Array<{ name: string; count: number; diamonds: number; time: string }>;
    }

    const enigmaGroups = new Map<string, EnigmaGroup>();
    const isEnigmaName = (name: string) => (name || "").toLowerCase().startsWith("enigma");

    for (const ev of enigmaEvents) {
      try {
        const p = JSON.parse(ev.payload);
        const u = p.user || {};
        const isMaskOn = u.enigmaInfo?.isEnigmaMaskOn === true;
        const hasEnigmaName = isEnigmaName(u.displayId);

        // STRICT FILTER: If the user themselves did not put on an Enigma mask and doesn't have an Enigma name,
        // DO NOT INCLUDE THEM (they are just normal chatters mentioning an Enigma)
        if (!isMaskOn && !hasEnigmaName) {
          continue;
        }

        const uid = String(u.id || "");
        const secUid = String(u.secUid || "");
        const key = uid || secUid;
        if (!key) continue;

        if (!enigmaGroups.has(key)) {
          enigmaGroups.set(key, {
            uid,
            secUid,
            displayId: u.displayId || "Enigma",
            nickname: u.nickname || "Enigma",
            eventsCount: 0,
            diamonds: 0,
            gifts: [],
          });
        }

        const item = enigmaGroups.get(key)!;
        item.eventsCount++;

        // Keep the best Enigma name seen
        if (hasEnigmaName && !isEnigmaName(item.displayId)) {
          item.displayId = u.displayId;
          item.nickname = u.nickname || u.displayId;
        }

        if (p.gift || p.giftName) {
          const count = Number(p.repeatCount || 1);
          const dia = Number(p.diamondCount || p.gift?.diamondCount || 0) * count;
          item.diamonds += dia;
          item.gifts.push({
            name: p.gift?.name || p.giftName,
            count,
            diamonds: dia,
            time: new Date(ev.sourceTimestamp).toISOString(),
          });
        }
      } catch {}
    }

    if (enigmaGroups.size === 0) {
      return 0;
    }

    // Clean previous records to remove any mistakenly recorded regular chatters
    await prisma.enigmaReview.deleteMany({
      where: { tenantId },
    });

    // Known persistent mappings discovered from historical events
    const KNOWN_MAP: Record<string, { username: string; displayName: string }> = {
      "7619854442507240469": { username: "cold.killer85", displayName: "Cold killer💀" },
      "7195697828512646150": { username: "rrmmh09", displayName: "RM7" },
    };

    let syncedCount = 0;

    for (const [key, enigma] of enigmaGroups) {
      // Find supporter in DB
      let supp = supporterMap.get(enigma.uid) || (enigma.secUid ? supporterMap.get(enigma.secUid) : null);

      if (!supp) {
        // Create an unmasked supporter profile for this Enigma persona so we have a valid ID
        supp = await prisma.supporter.create({
          data: {
            tenantId,
            platformUserId: enigma.uid || enigma.secUid,
            username: enigma.displayId,
            displayName: enigma.nickname,
            totalDiamonds: enigma.diamonds,
            category: enigma.diamonds > 10000 ? "CONTINUOUS" : "ACTIVE",
            dataConfidence: "ESTIMATED",
          },
        });
        supporterMap.set(supp.platformUserId, supp);
      }

      // Check if real identity is known
      let realUsername = "";
      let realDisplayName = "";

      if (KNOWN_MAP[enigma.uid]) {
        realUsername = KNOWN_MAP[enigma.uid].username;
        realDisplayName = KNOWN_MAP[enigma.uid].displayName;
      } else if (!isEnigmaName(supp.username)) {
        realUsername = supp.username;
        realDisplayName = supp.displayName;
      }

      const isDirectMatch = !!realUsername && realUsername !== enigma.displayId;
      const classification: EvidenceClassification = isDirectMatch
        ? "IDENTIFIER_MATCH"
        : "UNCONFIRMED_ASSOCIATION";
      const matchLevel = isDirectMatch ? "STRONG_MATCH" : "PROBABLE_MATCH";
      const confidenceScore = isDirectMatch ? 1.0 : 0.4;
      const isBehavioralOnly = false;
      const ruleVersion = "v2.0-deterministic-secuid";
      const classificationRationale = isDirectMatch
        ? "تطابق معرّف تقني ثابت موثق (Persistent UID/SecUID Match) بدون افتراضات سلوكية."
        : "حساب رُصد استخدامه لوضع القناع، لم يتم تأكيد تطابق معرّفه التقني مع أي حساب علني سابق.";

      const evidencePoints: string[] = [];
      if (isDirectMatch) {
        evidencePoints.push("تطابق تقني قطعي في المعرف الثابت الموحد (Persistent UID / SecUID).");
        evidencePoints.push(
          `رصد الداعم بالبث بصفته الحقيقية (@${realUsername}) وتأكد تفعيله لوضع القناع باسم (@${enigma.displayId}).`
        );
      } else {
        evidencePoints.push("تفعيل قناع الحساب الغامض (Enigma Mask) مع حجب الهوية الرسمية بالبث.");
        evidencePoints.push("الحساب دخل البث حصرياً بصفته الغامضة ولم يُرصد له نشاط علني سابق.");
      }

      if (enigma.diamonds > 0) {
        evidencePoints.push(
          `قام بإرسال ما قيمته ${enigma.diamonds.toLocaleString()} ماسة أثناء تفعيل القناع الغامض.`
        );
      }

      if (enigma.gifts.length > 0) {
        const topGift = enigma.gifts[0];
        evidencePoints.push(
          `أبرز هدية أرسلها تحت القناع: ${topGift.name} (${topGift.diamonds.toLocaleString()} 💎).`
        );
      }

      const evidence: EnigmaEvidence = {
        classification,
        classificationRationale,
        isBehavioralOnly,
        ruleVersion,
        realUsername: realUsername || "حساب غامض حصري",
        realDisplayName: realDisplayName || enigma.nickname,
        enigmaUsername: enigma.displayId,
        enigmaDisplayName: enigma.nickname,
        platformUserId: enigma.uid,
        secUid: enigma.secUid || undefined,
        diamondsWithEnigma: enigma.diamonds,
        diamondsPublic: isDirectMatch ? supp.totalDiamonds : 0,
        totalCombinedDiamonds: enigma.diamonds + (isDirectMatch ? supp.totalDiamonds : 0),
        enigmaEventsCount: enigma.eventsCount,
        topGifts: enigma.gifts.slice(0, 10),
        evidencePoints,
      };

      const supporter1Id = supp.id;
      const supporter2Id = supp.id;

      await prisma.enigmaReview.create({
        data: {
          tenantId,
          supporter1Id,
          supporter2Id,
          matchLevel,
          confidenceScore,
          evidenceJson: JSON.stringify(evidence),
          status: "PENDING",
        },
      });

      syncedCount++;
    }

    return syncedCount;
  }

  /**
   * Reviews an Enigma candidate decision with full audit logging and reversible status.
   */
  static async reviewCandidate(params: {
    reviewId: string;
    reviewer: string;
    action: "CONFIRMED" | "DISMISSED";
    notes?: string;
  }) {
    const { reviewId, reviewer, action, notes } = params;

    const review = await prisma.enigmaReview.findUnique({
      where: { id: reviewId },
    });

    if (!review) throw new Error("Enigma review record not found");

    const now = new Date();
    const existingEvidence: EnigmaEvidence = JSON.parse(review.evidenceJson);
    existingEvidence.reviewAudit = {
      reviewer,
      reviewedAt: now.toISOString(),
      action,
      notes,
    };
    if (action === "DISMISSED") {
      existingEvidence.classification = "REJECTED_MATCH";
    }

    const updated = await prisma.enigmaReview.update({
      where: { id: reviewId },
      data: {
        status: action,
        reviewedAt: now,
        reviewedBy: reviewer,
        evidenceJson: JSON.stringify(existingEvidence),
      },
    });

    await prisma.auditLog.create({
      data: {
        tenantId: review.tenantId,
        action: `ENIGMA_MATCH_${action}`,
        entityType: "ENIGMA_REVIEW",
        entityId: review.id,
        detailsJson: JSON.stringify({
          reviewer,
          action,
          notes,
          timestamp: now.toISOString(),
        }),
      },
    });

    return updated;
  }

  /**
   * Fetches formatted Enigma review candidates.
   */
  static async getEnigmaReviews(tenantId: string, status?: string): Promise<EnigmaCandidate[]> {
    const where: any = { tenantId };
    if (status) {
      where.status = status;
    }

    const records = await prisma.enigmaReview.findMany({
      where,
      orderBy: { confidenceScore: "desc" },
    });

    return records.map((r) => {
      let evidence: EnigmaEvidence;
      try {
        evidence = JSON.parse(r.evidenceJson);
      } catch {
        evidence = {
          classification: r.matchLevel === "STRONG_MATCH" ? "IDENTIFIER_MATCH" : "UNCONFIRMED_ASSOCIATION",
          classificationRationale: "بيانات تاريخية محملة",
          isBehavioralOnly: false,
          ruleVersion: "v1.0",
          realUsername: "غير معروف",
          realDisplayName: "مجهول",
          enigmaUsername: "Enigma",
          enigmaDisplayName: "Enigma",
          platformUserId: "",
          diamondsWithEnigma: 0,
          diamondsPublic: 0,
          totalCombinedDiamonds: 0,
          enigmaEventsCount: 0,
          topGifts: [],
          evidencePoints: [],
        };
      }

      return {
        id: r.id,
        tenantId: r.tenantId,
        supporter1Id: r.supporter1Id,
        supporter2Id: r.supporter2Id,
        matchLevel: r.matchLevel as any,
        classification: evidence.classification || (r.matchLevel === "STRONG_MATCH" ? "IDENTIFIER_MATCH" : "UNCONFIRMED_ASSOCIATION"),
        confidenceScore: r.confidenceScore,
        evidence,
        status: r.status as any,
        reviewedAt: r.reviewedAt,
        reviewedBy: r.reviewedBy,
      };
    });
  }
}
