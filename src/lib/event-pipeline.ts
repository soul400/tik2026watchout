import { prisma } from "./prisma";
import { ITikTokConnectorAdapter, NormalizedLiveEvent } from "./tiktok-types";
import { BattleScoreResolver, BattleContext } from "./battle-score-resolver";

export interface EventPipelineStats {
  receivedCount: number;
  processedCount: number;
  duplicateCount: number;
  errorCount: number;
}

export class LiveEventPipeline {
  private stats: EventPipelineStats = {
    receivedCount: 0,
    processedCount: 0,
    duplicateCount: 0,
    errorCount: 0,
  };

  constructor(
    private tenantId: string,
    private liveSessionId: string,
    private adapter: ITikTokConnectorAdapter
  ) {
    this.setupListeners();
  }

  private setupListeners() {
    this.adapter.on("gift", (data) => this.handleGift(data));
    this.adapter.on("chat", (data) => this.handleChat(data));
    this.adapter.on("like", (data) => this.handleLike(data));
    this.adapter.on("linkMicBattle", (data) => this.handleBattle(data));
    this.adapter.on("linkMicArmies", (data) => this.handleArmies(data));
    this.adapter.on("linkMicBattleItemCard", (data) => this.handleBattleItemCard(data));
  }

  private extractActor(data: any) {
    const user = data.user || {};
    const platformUserId = String(
      user.id || user.secUid || data.secUid || data.userId || data.uniqueId || `guest_${Date.now()}`
    );
    const username = String(user.displayId || data.uniqueId || user.nickname || "user");
    const displayName = String(user.nickname || data.nickname || username || "داعم");
    const avatarUrl = user.avatarThumb?.urlList?.[0] || data.profilePictureUrl || null;
    return { platformUserId, username, displayName, avatarUrl };
  }

  private generateDedupKey(type: string, actorId: string, timestamp: number, extraId?: string): string {
    const msgId = extraId || Math.random().toString(36).substring(2, 9);
    return `${this.liveSessionId}_${type}_${actorId}_${timestamp}_${msgId}`;
  }

  async handleGift(data: any): Promise<NormalizedLiveEvent | null> {
    this.stats.receivedCount++;
    const timestamp = Number(data.common?.createTime || data.timestamp || Date.now());
    const actor = this.extractActor(data);
    const giftId = String(data.giftId || data.gift?.id || "generic_gift");
    const repeatCount = Number(data.repeatCount || 1);
    const diamondsPerUnit = Number(data.diamondCount || data.gift?.diamondCount || 0);
    const diamonds = diamondsPerUnit * repeatCount;
    const msgId = String(data.common?.msgId || data.msgId || `${giftId}_${repeatCount}_${Math.random()}`);
    const dedupKey = this.generateDedupKey("GIFT", actor.platformUserId, timestamp, msgId);

    try {
      // 1. Idempotency Check & Raw Event Persistence
      const existing = await prisma.rawEvent.findUnique({
        where: { deduplicationKey: dedupKey },
      });

      if (existing) {
        this.stats.duplicateCount++;
        return null;
      }

      await prisma.rawEvent.create({
        data: {
          liveSessionId: this.liveSessionId,
          deduplicationKey: dedupKey,
          eventType: "GIFT",
          sourceTimestamp: new Date(timestamp),
          payload: JSON.stringify(data),
          processingStatus: "PROCESSED",
        },
      });

      // 2. Supporter Profile Upsert & Diamond Accumulation
      const supporter = await prisma.supporter.upsert({
        where: {
          tenantId_platformUserId: {
            tenantId: this.tenantId,
            platformUserId: actor.platformUserId,
          },
        },
        update: {
          totalDiamonds: { increment: diamonds },
          lastObservedAt: new Date(timestamp),
          username: actor.username,
          displayName: actor.displayName,
          avatarUrl: actor.avatarUrl || undefined,
        },
        create: {
          tenantId: this.tenantId,
          platformUserId: actor.platformUserId,
          username: actor.username,
          displayName: actor.displayName,
          avatarUrl: actor.avatarUrl,
          totalDiamonds: diamonds,
          firstObservedAt: new Date(timestamp),
          lastObservedAt: new Date(timestamp),
          category: diamonds > 10000 ? "CONTINUOUS" : "ACTIVE",
          dataConfidence: "VERIFIED",
        },
      });

      // 3. Update Live Session Totals
      await prisma.liveSession.update({
        where: { id: this.liveSessionId },
        data: {
          totalDiamonds: { increment: diamonds },
        },
      });

      // 4. Map Tactical Gifts to Smart Inventory Power-Ups
      const giftNameLower = (data.gift?.name || data.giftName || "").toLowerCase();
      let detectedToolKey: string | null = null;

      if (giftNameLower.includes("glove") || giftNameLower.includes("قفاز")) {
        detectedToolKey = "GLOVE";
      } else if (giftNameLower.includes("fog") || giftNameLower.includes("ضباب")) {
        detectedToolKey = "BOOST_FOG";
      } else if (giftNameLower.includes("hammer") || giftNameLower.includes("مطرقة")) {
        detectedToolKey = "HAMMER";
      } else if (giftNameLower.includes("shield") || giftNameLower.includes("درع")) {
        detectedToolKey = "SHIELD_DEFENSE";
      } else if (giftNameLower.includes("time") || giftNameLower.includes("وقت")) {
        detectedToolKey = "TIME_EXTENDER";
      } else if (giftNameLower.includes("speed") || giftNameLower.includes("سرعة")) {
        detectedToolKey = "SPEED_BOOSTER";
      }

      if (detectedToolKey) {
        try {
          const { SmartInventoryService } = await import("./smart-inventory");
          await SmartInventoryService.grantTool({
            tenantId: this.tenantId,
            supporterId: supporter.id,
            toolKey: detectedToolKey,
            quantity: repeatCount,
            sourceEventId: dedupKey,
            auditReference: `Gift: ${data.gift?.name || data.giftName} x${repeatCount}`,
          });
        } catch (toolErr) {
          // Non-blocking
        }
      }

      this.stats.processedCount++;

      return {
        id: dedupKey,
        tenantId: this.tenantId,
        streamerUsername: "",
        liveSessionId: this.liveSessionId,
        eventType: "GIFT",
        deduplicationKey: dedupKey,
        actor: {
          platformUserId: actor.platformUserId,
          username: supporter.username,
          displayName: supporter.displayName,
          avatarUrl: supporter.avatarUrl || undefined,
        },
        payload: {
          giftId,
          giftName: data.gift?.name || data.giftName || "هدية",
          diamondCount: diamonds,
        },
        sourceTimestamp: new Date(timestamp),
        receivedAt: new Date(),
        confidence: "VERIFIED",
      };
    } catch (err) {
      this.stats.errorCount++;
      return null;
    }
  }

  async handleChat(data: any): Promise<NormalizedLiveEvent | null> {
    this.stats.receivedCount++;
    const timestamp = Number(data.common?.createTime || data.timestamp || Date.now());
    const actor = this.extractActor(data);
    const comment = String(data.content || data.comment || "");
    const msgId = String(data.common?.msgId || data.msgId || `${comment.substring(0, 10)}_${Math.random()}`);
    const dedupKey = this.generateDedupKey("CHAT", actor.platformUserId, timestamp, msgId);

    try {
      const existing = await prisma.rawEvent.findUnique({
        where: { deduplicationKey: dedupKey },
      });
      if (existing) {
        this.stats.duplicateCount++;
        return null;
      }

      await prisma.rawEvent.create({
        data: {
          liveSessionId: this.liveSessionId,
          deduplicationKey: dedupKey,
          eventType: "CHAT",
          sourceTimestamp: new Date(timestamp),
          payload: JSON.stringify(data),
          processingStatus: "PROCESSED",
        },
      });

      await prisma.supporter.upsert({
        where: {
          tenantId_platformUserId: {
            tenantId: this.tenantId,
            platformUserId: actor.platformUserId,
          },
        },
        update: {
          totalComments: { increment: 1 },
          lastObservedAt: new Date(timestamp),
          username: actor.username,
          displayName: actor.displayName,
          avatarUrl: actor.avatarUrl || undefined,
        },
        create: {
          tenantId: this.tenantId,
          platformUserId: actor.platformUserId,
          username: actor.username,
          displayName: actor.displayName,
          avatarUrl: actor.avatarUrl,
          totalComments: 1,
          firstObservedAt: new Date(timestamp),
          lastObservedAt: new Date(timestamp),
          category: "CHATTER",
          dataConfidence: "VERIFIED",
        },
      });

      await prisma.liveSession.update({
        where: { id: this.liveSessionId },
        data: {
          totalComments: { increment: 1 },
        },
      });

      this.stats.processedCount++;
      return null;
    } catch (err) {
      this.stats.errorCount++;
      return null;
    }
  }

  async handleLike(data: any): Promise<void> {
    this.stats.receivedCount++;
    const timestamp = Number(data.common?.createTime || data.timestamp || Date.now());
    const actor = this.extractActor(data);
    const likes = Number(data.likeCount || data.count || 1);

    try {
      await prisma.liveSession.update({
        where: { id: this.liveSessionId },
        data: {
          totalLikes: { increment: likes },
        },
      });

      if (actor.platformUserId && !actor.platformUserId.startsWith("guest_")) {
        await prisma.supporter.upsert({
          where: {
            tenantId_platformUserId: {
              tenantId: this.tenantId,
              platformUserId: actor.platformUserId,
            },
          },
          update: {
            totalLikes: { increment: likes },
            lastObservedAt: new Date(timestamp),
          },
          create: {
            tenantId: this.tenantId,
            platformUserId: actor.platformUserId,
            username: actor.username,
            displayName: actor.displayName,
            avatarUrl: actor.avatarUrl,
            totalLikes: likes,
            firstObservedAt: new Date(timestamp),
            lastObservedAt: new Date(timestamp),
            category: "ENGAGED",
            dataConfidence: "VERIFIED",
          },
        });
      }
      this.stats.processedCount++;
    } catch {
      this.stats.errorCount++;
    }
  }

  async handleBattle(data: any): Promise<void> {
    this.stats.receivedCount++;
    try {
      const battleId = String(data.battleId || "");
      if (!battleId) return;

      const action = Number(data.action || 0);
      // Action 4: OPEN, Action 5: FINISH, Action 6: CUT_SHORT
      if (action === 5 || action === 6) {
        // Battle finished
        BattleScoreResolver.resetBattleTracking(battleId);
        await prisma.battle.updateMany({
          where: { id: battleId, tenantId: this.tenantId },
          data: { status: "COMPLETED", endedAt: new Date() },
        });
        return;
      }

      // Check if battle already exists or create it
      const existing = await prisma.battle.findUnique({
        where: { id: battleId },
      });

      if (!existing) {
        // Extract anchors / participants
        const participantsData: any[] = [];
        
        // Parse participants from anchorsInfo and teamMember
        const hostStreamer = await prisma.streamerAccount.findFirst({
          where: { tenantId: this.tenantId },
        });

        const hostUid = hostStreamer?.platformUserId || "mohra_official";
        const hostUsername = hostStreamer?.username || "mohra.2000";

        // Map team IDs if teamMember is present
        const teamMemberMap = new Map<string, number>();
        if (Array.isArray(data.teamMember)) {
          data.teamMember.forEach((tm: any, idx: number) => {
            const teamNum = Number(tm.teamId || idx + 1);
            if (Array.isArray(tm.userId)) {
              tm.userId.forEach((uid: any) => {
                teamMemberMap.set(String(uid), teamNum);
              });
            }
          });
        }

        const rawAnchors: any[] = [];
        if (Array.isArray(data.anchorsInfo)) {
          for (const item of data.anchorsInfo) {
            const user = item.value?.user || item.user || {};
            const uid = String(user.userId || user.displayId || "");
            const uname = String(user.displayId || user.nickName || "");
            if (uid && uname) {
              // Exclude host account completely by username or displayId or uid
              if (
                uid === hostUid ||
                uname === hostUsername ||
                uname.toLowerCase().includes("mohra") ||
                user.displayId === hostUsername
              ) {
                continue;
              }
              // Deduplicate
              if (!rawAnchors.some((a) => a.uid === uid || a.uname === uname)) {
                rawAnchors.push({
                  uid,
                  uname,
                  displayName: String(user.nickName || uname || "لاعب"),
                  avatarUrl: user.avatarThumb?.urlList?.[0] || null,
                });
              }
            }
          }
        }

        // Host is always Team 1
        participantsData.push({
          teamNumber: 1,
          platformUserId: hostUid,
          username: hostUsername,
          displayName: hostStreamer?.displayName || "مهـرة",
          avatarUrl: hostStreamer?.avatarUrl || "/mohra-avatar.webp",
        });

        const otherAnchors = rawAnchors;

        if (otherAnchors.length >= 3) {
          // 2v2 Match: 1 teammate (Team 1) + 2 opponents (Team 2)
          let hostTeamId = teamMemberMap.get(hostUid);
          let assignedTeammate = false;

          otherAnchors.forEach((anchor, index) => {
            let assignedTeam = 2;
            const mappedTeam = teamMemberMap.get(anchor.uid);

            if (mappedTeam && hostTeamId && mappedTeam === hostTeamId) {
              assignedTeam = 1;
              assignedTeammate = true;
            } else if (!assignedTeammate && (index === 0 || mappedTeam === 1)) {
              // First co-host anchor alongside host is teammate
              assignedTeam = 1;
              assignedTeammate = true;
            }

            participantsData.push({
              teamNumber: assignedTeam,
              platformUserId: anchor.uid,
              username: anchor.uname,
              displayName: anchor.displayName,
              avatarUrl: anchor.avatarUrl,
            });
          });
        } else if (otherAnchors.length === 1) {
          // 1v1 Match: The only anchor is Team 2
          participantsData.push({
            teamNumber: 2,
            platformUserId: otherAnchors[0].uid,
            username: otherAnchors[0].uname,
            displayName: otherAnchors[0].displayName,
            avatarUrl: otherAnchors[0].avatarUrl,
          });
        } else {
          // Standard / 2 opponents
          otherAnchors.forEach((anchor) => {
            participantsData.push({
              teamNumber: 2,
              platformUserId: anchor.uid,
              username: anchor.uname,
              displayName: anchor.displayName,
              avatarUrl: anchor.avatarUrl,
            });
          });
        }

        // Fallback if no opponent was parsed
        if (participantsData.length === 1) {
          participantsData.push({
            teamNumber: 2,
            platformUserId: `opp_${battleId.slice(-6)}`,
            username: "rival_streamer",
            displayName: "المنافس",
            avatarUrl: null,
          });
        }

        await prisma.battle.create({
          data: {
            id: battleId,
            tenantId: this.tenantId,
            liveSessionId: this.liveSessionId,
            battleType: participantsData.length > 2 ? "2V2" : "1V1",
            status: "IN_PROGRESS",
            startedAt: new Date(),
            team1Score: 0,
            team2Score: 0,
            dataConfidence: "VERIFIED",
            participants: {
              create: participantsData,
            },
          },
        });
      }

      this.stats.processedCount++;
    } catch (err) {
      this.stats.errorCount++;
    }
  }

  async handleArmies(data: any): Promise<void> {
    this.stats.receivedCount++;
    try {
      const battleId = String(data.battleId || "");

      // Find the active or matching battle
      const battle = await prisma.battle.findFirst({
        where: {
          tenantId: this.tenantId,
          ...(battleId ? { id: battleId } : { status: "IN_PROGRESS" }),
        },
        include: {
          participants: true,
        },
        orderBy: { startedAt: "desc" },
      });

      if (!battle) {
        this.stats.processedCount++;
        return;
      }

      const context: BattleContext = {
        id: battle.id,
        battleType: battle.battleType as "1V1" | "2V2",
        currentTeam1Score: battle.team1Score,
        currentTeam2Score: battle.team2Score,
        participants: battle.participants.map((p) => ({
          platformUserId: p.platformUserId,
          username: p.username,
          displayName: p.displayName,
          teamNumber: p.teamNumber,
        })),
      };

      const resolution = BattleScoreResolver.resolveScores(context, data);

      if (resolution.accepted) {
        if (
          resolution.team1Score !== battle.team1Score ||
          resolution.team2Score !== battle.team2Score
        ) {
          await prisma.battle.update({
            where: { id: battle.id },
            data: {
              team1Score: resolution.team1Score,
              team2Score: resolution.team2Score,
            },
          });
        }

        console.log(
          `[BATTLE_SCORE_RESOLVER] Round #${battle.id.slice(-6)} | ${resolution.reason} | ` +
          `T1: ${battle.team1Score} -> ${resolution.team1Score} | ` +
          `T2: ${battle.team2Score} -> ${resolution.team2Score} | ` +
          `Matched T1: [${resolution.diagnostics.matchedAnchorsTeam1.join(",") || "none"}] | ` +
          `Matched T2: [${resolution.diagnostics.matchedAnchorsTeam2.join(",") || "none"}]`
        );
      }

      this.stats.processedCount++;
    } catch (err) {
      console.error("[BATTLE_SCORE_ERROR]", err);
      this.stats.errorCount++;
    }
  }

  async handleBattleItemCard(data: any): Promise<void> {
    this.stats.receivedCount++;
    try {
      const battleId = String(data.battleId || "");
      const { SmartInventoryService } = await import("./smart-inventory");

      // 1. Check AwardCardNotice (Tools awarded at the end or during battle)
      if (data.awardCardNotice) {
        const awardedUsers = data.awardCardNotice.awardedUsers || [];
        for (const userInfo of awardedUsers) {
          const user = userInfo.user || userInfo;
          const uid = String(user.userId || user.displayId || "");
          const uname = String(user.displayId || user.nickName || "supporter");
          const displayName = String(user.nickName || uname || "داعم");

          if (uid) {
            // Find or upsert supporter
            const supporter = await prisma.supporter.upsert({
              where: {
                tenantId_platformUserId: {
                  tenantId: this.tenantId,
                  platformUserId: uid,
                },
              },
              update: {
                username: uname,
                displayName,
              },
              create: {
                tenantId: this.tenantId,
                platformUserId: uid,
                username: uname,
                displayName,
                dataConfidence: "VERIFIED",
              },
            });

            // Grant Glove (GLOVE) by default for battle awards or detect type
            const dedupKey = `card_${battleId}_${uid}_${Date.now()}`;
            await SmartInventoryService.grantTool({
              tenantId: this.tenantId,
              supporterId: supporter.id,
              toolKey: "GLOVE",
              quantity: 1,
              battleId: battleId || undefined,
              sourceEventId: dedupKey,
              auditReference: `TikTok Battle Item Card Award (Battle: ${battleId})`,
            }).catch(() => {});
          }
        }
      }

      // 2. Check Tool Consumptions during battle
      let consumedToolKey: string | null = null;
      let targetUser: any = null;

      if (data.useCriticalStrikeCard) {
        consumedToolKey = "GLOVE"; // Critical Strike = القفاز x5
        targetUser = data.useCriticalStrikeCard.cardInfo?.sendUser;
      } else if (data.useSmokeCard) {
        consumedToolKey = "BOOST_FOG"; // Smoke Card = الضباب
        targetUser = data.useSmokeCard.cardInfo?.sendUser;
      } else if (data.useExtraTimeCard) {
        consumedToolKey = "TIME_EXTENDER"; // Extra Time = ممدد الوقت
        targetUser = data.useExtraTimeCard.cardInfo?.sendUser;
      }

      if (consumedToolKey && targetUser) {
        const u = targetUser.user || targetUser;
        const uid = String(u.userId || u.displayId || "");
        if (uid) {
          const supporter = await prisma.supporter.findUnique({
            where: {
              tenantId_platformUserId: {
                tenantId: this.tenantId,
                platformUserId: uid,
              },
            },
          });

          if (supporter) {
            const availableGrant = await prisma.toolGrant.findFirst({
              where: {
                tenantId: this.tenantId,
                supporterId: supporter.id,
                toolDefinition: { key: consumedToolKey },
                status: { in: ["AVAILABLE", "PARTIALLY_USED"] },
              },
            });

            if (availableGrant) {
              await SmartInventoryService.consumeTool({
                tenantId: this.tenantId,
                grantId: availableGrant.id,
                supporterId: supporter.id,
                quantity: 1,
                battleId: battleId || undefined,
                notes: `Live TikTok Battle Card Activation (${consumedToolKey})`,
              }).catch(() => {});
            }
          }
        }
      }

      this.stats.processedCount++;
    } catch (err) {
      this.stats.errorCount++;
    }
  }

  getStats(): EventPipelineStats {
    return { ...this.stats };
  }
}
