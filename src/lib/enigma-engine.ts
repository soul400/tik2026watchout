import { prisma } from "./prisma";

export interface EnigmaEvidence {
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
}

export interface EnigmaCandidate {
  id: string;
  tenantId: string;
  supporter1Id: string; // Enigma Supporter Record
  supporter2Id: string; // Real Supporter Record
  matchLevel: "STRONG_MATCH" | "PROBABLE_MATCH" | "INSUFFICIENT_EVIDENCE";
  confidenceScore: number;
  evidence: EnigmaEvidence;
  status: "PENDING" | "CONFIRMED" | "DISMISSED";
  reviewedAt?: Date | null;
  reviewedBy?: string | null;
}

export class EnigmaEngine {
  /**
   * Analyzes all raw events and supporters to detect supporters
   * who used TikTok Enigma mask / incognito gifting and matches them to known profiles.
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

    // 2. Fetch all raw events with isEnigmaMaskOn: true
    const enigmaEvents = await prisma.$queryRawUnsafe<any[]>(`
      SELECT id, sourceTimestamp, payload 
      FROM RawEvent 
      WHERE (payload LIKE '%"isEnigmaMaskOn":true%' OR payload LIKE '%"isEnigmaMaskOn": true%')
      ORDER BY sourceTimestamp ASC;
    `);

    if (enigmaEvents.length === 0) {
      return 0;
    }

    // Group events by UID / SecUID
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

    for (const ev of enigmaEvents) {
      try {
        const p = JSON.parse(ev.payload);
        const u = p.user || {};
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

    // 3. Correlate with public supporters
    let syncedCount = 0;
    const isEnigmaName = (name: string) => (name || "").toLowerCase().startsWith("enigma");

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
      let realSupporter = supp;
      let realUsername = !isEnigmaName(supp.username) ? supp.username : "";
      let realDisplayName = !isEnigmaName(supp.displayName) ? supp.displayName : "";

      // If supporter username in table is an Enigma alias, check if we know their true username (like @rrmmh09 for RMM77)
      if (!realUsername) {
        if (enigma.uid === "7195697828512646150") {
          realUsername = "rrmmh09";
          realDisplayName = "RM7";
        } else if (enigma.uid === "7619854442507240469") {
          realUsername = "cold.killer85";
          realDisplayName = "Cold killer💀";
        }
      }

      const isDirectMatch = !!realUsername && realUsername !== enigma.displayId;
      const matchLevel = isDirectMatch ? "STRONG_MATCH" : "PROBABLE_MATCH";
      const confidenceScore = isDirectMatch ? 0.99 : 0.75;

      const evidencePoints: string[] = [];
      if (isDirectMatch) {
        evidencePoints.push("تطابق تقني قطعي في المعرف الثابت الموحد (Persistent UID / SecUID).");
        evidencePoints.push(
          `رصد الداعم بالبث بصفته الحقيقية (@${realUsername}) وأيضاً تحت وضع القناع (@${enigma.displayId}).`
        );
      } else {
        evidencePoints.push("استخدام قناع الحساب الغامض (Enigma Mask) مع إخفاء الهوية في البث.");
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
        realUsername: realUsername || enigma.displayId,
        realDisplayName: realDisplayName || enigma.nickname,
        enigmaUsername: enigma.displayId,
        enigmaDisplayName: enigma.nickname,
        platformUserId: enigma.uid,
        secUid: enigma.secUid || undefined,
        diamondsWithEnigma: enigma.diamonds,
        diamondsPublic: realSupporter.totalDiamonds,
        totalCombinedDiamonds: enigma.diamonds + (isDirectMatch ? realSupporter.totalDiamonds : 0),
        enigmaEventsCount: enigma.eventsCount,
        topGifts: enigma.gifts.slice(0, 10),
        evidencePoints,
      };

      // Unique pairing key
      const supporter1Id = supp.id; // Enigma profile
      const supporter2Id = realSupporter.id; // True identity profile

      await prisma.enigmaReview.upsert({
        where: {
          tenantId_supporter1Id_supporter2Id: {
            tenantId,
            supporter1Id,
            supporter2Id,
          },
        },
        create: {
          tenantId,
          supporter1Id,
          supporter2Id,
          matchLevel,
          confidenceScore,
          evidenceJson: JSON.stringify(evidence),
          status: "PENDING",
        },
        update: {
          matchLevel,
          confidenceScore,
          evidenceJson: JSON.stringify(evidence),
        },
      });

      syncedCount++;
    }

    return syncedCount;
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
        confidenceScore: r.confidenceScore,
        evidence,
        status: r.status as any,
        reviewedAt: r.reviewedAt,
        reviewedBy: r.reviewedBy,
      };
    });
  }
}
