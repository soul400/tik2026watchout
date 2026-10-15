import { prisma } from "./prisma";
import { ITikTokConnectorAdapter, NormalizedLiveEvent } from "./tiktok-types";
import { BattleScoreResolver, BattleContext } from "./battle-score-resolver";
import { TelegramService } from "./telegram-service";

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

  private sessionVipAlertsSent = new Set<string>();

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
    this.adapter.on("roomUser", (data) => this.handleRoomUser(data));
    this.adapter.on("member", (data) => this.handleMember(data));
    this.adapter.on("linkMicBattle", (data) => this.handleBattle(data));
    this.adapter.on("linkMicArmies", (data) => this.handleArmies(data));
    this.adapter.on("linkMicBattleItemCard", (data) => this.handleBattleItemCard(data));
    this.adapter.on("linkMicBattleTask", (data) => this.handleBattleItemCard(data));
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

      // Auto-elevate supporter to CONTINUOUS tier if total diamonds reached >= 10,000
      if (supporter.totalDiamonds >= 10000 && supporter.category !== "CONTINUOUS") {
        await prisma.supporter.update({
          where: { id: supporter.id },
          data: { category: "CONTINUOUS" },
        }).catch(() => {});
      }

      await this.checkAndTriggerVipAlert(actor.platformUserId, actor.username, actor.displayName);

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
          const activeBattle = await prisma.battle.findFirst({
            where: { tenantId: this.tenantId, status: "IN_PROGRESS" },
            select: { id: true },
          });

          await SmartInventoryService.grantTool({
            tenantId: this.tenantId,
            supporterId: supporter.id,
            toolKey: detectedToolKey,
            quantity: repeatCount,
            battleId: activeBattle?.id || undefined,
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

      await this.checkAndTriggerVipAlert(actor.platformUserId, actor.username, actor.displayName);

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

  async handleRoomUser(data: any): Promise<void> {
    try {
      const count = Number(data.viewerCount || data.count || 0);
      if (count > 0) {
        const session = await prisma.liveSession.findUnique({
          where: { id: this.liveSessionId },
          select: { peakViewers: true },
        });
        if (session && count > session.peakViewers) {
          await prisma.liveSession.update({
            where: { id: this.liveSessionId },
            data: { peakViewers: count },
          }).catch(() => {});
        }
      }
    } catch {
      // non-blocking
    }
  }

  private async checkAndTriggerVipAlert(platformUserId: string, username: string, displayName: string): Promise<void> {
    const supporterKey = platformUserId || username;
    if (!supporterKey || supporterKey.startsWith("guest_") || this.sessionVipAlertsSent.has(supporterKey)) {
      return;
    }

    try {
      const config = await TelegramService.getConfig(this.tenantId);
      if (!config.isEnabled || !config.alertVipEntry) {
        return;
      }

      // Match by platformUserId OR username to guarantee VIP detection on join
      const supporter = await prisma.supporter.findFirst({
        where: {
          tenantId: this.tenantId,
          OR: [
            ...(platformUserId ? [{ platformUserId }] : []),
            ...(username && username !== "user" ? [{ username }] : []),
          ],
        },
      });

      if (supporter && supporter.totalDiamonds >= config.vipDiamondsThreshold) {
        this.sessionVipAlertsSent.add(supporterKey);
        if (supporter.platformUserId) this.sessionVipAlertsSent.add(supporter.platformUserId);
        if (supporter.username) this.sessionVipAlertsSent.add(supporter.username);

        console.log(
          `[LIVE VIP ENTRANCE] 👑 VIP Supporter @${supporter.username} (${supporter.totalDiamonds.toLocaleString()} 💎) entered! Sending Telegram alert...`
        );
        await TelegramService.sendVipEntryAlert(this.tenantId, supporter).catch(() => {});
      }
    } catch {
      // Non-blocking
    }
  }

  async handleMember(data: any): Promise<void> {
    try {
      const actor = this.extractActor(data);
      if (actor.platformUserId && !actor.platformUserId.startsWith("guest_")) {
        await this.checkAndTriggerVipAlert(actor.platformUserId, actor.username, actor.displayName);
      }
    } catch {
      // non-blocking
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
        // 1. Fetch host streamer account
        const hostStreamer = await prisma.streamerAccount.findFirst({
          where: { tenantId: this.tenantId },
        });

        const hostUsername = hostStreamer?.username || "mohra.2000";
        let knownHostUid = hostStreamer?.platformUserId || "";

        // 2. Parse all anchors from anchorsInfo into a normalized list
        interface NormalizedAnchor {
          uid: string;
          username: string;
          displayName: string;
          avatarUrl: string | null;
          isHost: boolean;
        }

        const normalizedAnchors: NormalizedAnchor[] = [];

        if (Array.isArray(data.anchorsInfo)) {
          for (const item of data.anchorsInfo) {
            const user = item.value?.user || item.user || item.value || item || {};
            const uid = String(
              user.userId ||
              user.userIdStr ||
              user.id ||
              item.key ||
              ""
            ).trim();
            const uname = String(
              user.displayId ||
              user.uniqueId ||
              user.username ||
              ""
            ).trim();
            const displayName = String(
              user.nickName ||
              user.nickname ||
              uname ||
              "مشارك"
            ).trim();
            const avatarUrl =
              user.avatarThumb?.urlList?.[0] ||
              user.avatarThumb?.urls?.[0] ||
              user.avatarUrl ||
              null;

            if (uid || uname) {
              const isHost =
                (uname && (
                  uname.toLowerCase() === hostUsername.toLowerCase() ||
                  uname.toLowerCase().includes("mohra")
                )) ||
                (uid && knownHostUid && uid === knownHostUid) ||
                displayName.toLowerCase().includes("mohra") ||
                displayName.includes("مهرة") ||
                displayName.includes("المهره");

              if (isHost && uid && uid !== knownHostUid) {
                knownHostUid = uid;
                if (hostStreamer) {
                  await prisma.streamerAccount.update({
                    where: { id: hostStreamer.id },
                    data: { platformUserId: uid },
                  }).catch(() => {});
                }
              }

              // Deduplicate
              if (!normalizedAnchors.some((a) => a.uid === uid || (uname && a.username === uname))) {
                normalizedAnchors.push({
                  uid: uid || `anchor_${uname}`,
                  username: uname || `user_${uid}`,
                  displayName,
                  avatarUrl,
                  isHost,
                });
              }
            }
          }
        }

        // 3. Ensure host is present in normalized list
        let hostAnchor = normalizedAnchors.find((a) => a.isHost);
        if (!hostAnchor) {
          hostAnchor = {
            uid: knownHostUid || "mohra_official",
            username: hostUsername,
            displayName: hostStreamer?.displayName || "مهـرة 🇸🇦",
            avatarUrl: hostStreamer?.avatarUrl || "/mohra-avatar.webp",
            isHost: true,
          };
          normalizedAnchors.unshift(hostAnchor);
        }

        // 4. Map teams from data.teamMember / data.teamArmies
        // Determine which raw teamId belongs to the Host
        let hostTeamRawId: string | null = null;

        if (Array.isArray(data.teamMember)) {
          for (const tm of data.teamMember) {
            const rawTid = String(tm.teamId ?? "");
            const memberUids = (tm.userId || []).map((u: any) => String(u).trim());
            if (memberUids.includes(hostAnchor.uid) || memberUids.some((u: string) => normalizedAnchors.find((a) => a.uid === u)?.isHost)) {
              hostTeamRawId = rawTid;
              break;
            }
          }
        }

        if (!hostTeamRawId && Array.isArray(data.teamArmies)) {
          for (const teamEntry of data.teamArmies) {
            const rawTid = String(teamEntry.teamId ?? "");
            const members = (teamEntry.teamUser || teamEntry.userArmies || []).map((m: any) =>
              String(m.userId || m.userIdStr || m.user?.userId || "").trim()
            );
            if (members.includes(hostAnchor.uid) || members.some((u: string) => normalizedAnchors.find((a) => a.uid === u)?.isHost)) {
              hostTeamRawId = rawTid;
              break;
            }
          }
        }

        // Build participant mapping
        const userToTeamMap = new Map<string, number>();

        if (hostTeamRawId && Array.isArray(data.teamMember)) {
          for (const tm of data.teamMember) {
            const rawTid = String(tm.teamId ?? "");
            const assignedTeam = rawTid === hostTeamRawId ? 1 : 2;
            if (Array.isArray(tm.userId)) {
              for (const uid of tm.userId) {
                userToTeamMap.set(String(uid).trim(), assignedTeam);
              }
            }
          }
        } else if (hostTeamRawId && Array.isArray(data.teamArmies)) {
          for (const teamEntry of data.teamArmies) {
            const rawTid = String(teamEntry.teamId ?? "");
            const assignedTeam = rawTid === hostTeamRawId ? 1 : 2;
            const members = teamEntry.teamUser || teamEntry.userArmies || [];
            for (const m of members) {
              const uid = String(m.userId || m.userIdStr || m.user?.userId || "").trim();
              if (uid) userToTeamMap.set(uid, assignedTeam);
            }
          }
        }

        // 5. Assign team numbers to normalized anchors
        const participantsData: any[] = [];
        const otherAnchors = normalizedAnchors.filter((a) => !a.isHost);

        // Host is ALWAYS Team 1
        participantsData.push({
          teamNumber: 1,
          platformUserId: hostAnchor.uid,
          username: hostAnchor.username,
          displayName: hostAnchor.displayName,
          avatarUrl: hostAnchor.avatarUrl,
        });

        if (normalizedAnchors.length >= 4 || otherAnchors.length >= 3) {
          // 2v2 Match: exactly 1 teammate in Team 1 + 2 opponents in Team 2
          let assignedAlly = false;

          // First pass: use verified userToTeamMap
          otherAnchors.forEach((anchor) => {
            const mappedTeam = userToTeamMap.get(anchor.uid);
            if (mappedTeam === 1 && !assignedAlly) {
              assignedAlly = true;
              participantsData.push({
                teamNumber: 1,
                platformUserId: anchor.uid,
                username: anchor.username,
                displayName: anchor.displayName,
                avatarUrl: anchor.avatarUrl,
              });
            }
          });

          // Second pass: fill remaining anchors
          otherAnchors.forEach((anchor) => {
            const alreadyAdded = participantsData.some((p) => p.platformUserId === anchor.uid);
            if (!alreadyAdded) {
              let teamNumber = 2;
              if (!assignedAlly) {
                teamNumber = 1;
                assignedAlly = true;
              }
              participantsData.push({
                teamNumber,
                platformUserId: anchor.uid,
                username: anchor.username,
                displayName: anchor.displayName,
                avatarUrl: anchor.avatarUrl,
              });
            }
          });
        } else {
          // 1v1 Match: all other anchors are Team 2
          otherAnchors.forEach((anchor) => {
            participantsData.push({
              teamNumber: 2,
              platformUserId: anchor.uid,
              username: anchor.username,
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
      // ── DIAGNOSTIC: log full raw payload so we can learn TikTok's exact field names ──
      const payloadSummary = {
        msgType: data.msgType,
        battleId: data.battleId,
        awardCardNotice: data.awardCardNotice ? {
          noticeId: data.awardCardNotice.noticeId,
          cardType: data.awardCardNotice.cardType,
          cardName: data.awardCardNotice.cardName,
          toolKey: data.awardCardNotice.toolKey,
          count: data.awardCardNotice.count,
          displayContent: data.awardCardNotice.displayContent,
          awardedUsers_count: Array.isArray(data.awardCardNotice.awardedUsers) ? data.awardCardNotice.awardedUsers.length : 0,
          awardedUsers_sample: Array.isArray(data.awardCardNotice.awardedUsers)
            ? data.awardCardNotice.awardedUsers.slice(0, 3).map((u: any) => ({
                userId: u?.user?.userId || u?.userId,
                displayId: u?.user?.displayId || u?.displayId,
                cardType: u?.cardType,
                cardName: u?.cardName,
                toolKey: u?.toolKey,
                count: u?.count || u?.quantity || u?.cardNum || u?.num,
              }))
            : null,
        } : undefined,
        cardObtainGuide: data.cardObtainGuide ? {
          cardName: data.cardObtainGuide.cardName,
          toolKey: data.cardObtainGuide.toolKey,
        } : undefined,
        topLevelKeys: Object.keys(data || {}).filter((k) => !['common'].includes(k)),
      };
      console.log(`[TACTICAL_RAW] msgType=${data.msgType} | battleId=${data.battleId || 'none'} | summary=${JSON.stringify(payloadSummary)}`);

      let targetBattleId = String(data.battleId || "");
      if (!targetBattleId) {
        const activeBattle = await prisma.battle.findFirst({
          where: { tenantId: this.tenantId, status: "IN_PROGRESS" },
          orderBy: { startedAt: "desc" },
          select: { id: true },
        });
        if (activeBattle) {
          targetBattleId = activeBattle.id;
        }
      }

      const { SmartInventoryService } = await import("./smart-inventory");

      // Helper to classify tool type from raw strings and message types
      // We accumulate ALL string tokens from a field and check any match.
      const resolveToolKey = (rawStr: string, msgType?: number): string => {
        const s = (rawStr || "").toLowerCase();
        // Song Surge / Wave
        if (s.includes("wave") || s.includes("song") || s.includes("surge") || s.includes("sing") ||
            s.includes("موجة") || s.includes("غناء") || msgType === 8) {
          return "SONG_SURGE";
        }
        // Boost Fog / Magic Mist / Smoke
        if (s.includes("fog") || s.includes("smoke") || s.includes("mist") || s.includes("boost_fog") ||
            s.includes("ضباب") || s.includes("دخان") || s.includes("سحاب") ||
            s.includes("magic") || msgType === 3) {
          return "BOOST_FOG";
        }
        // Time Extender
        if (s.includes("time") || s.includes("timer") || s.includes("extender") || s.includes("extra_time") ||
            s.includes("وقت") || s.includes("تمديد") || msgType === 5) {
          return "TIME_EXTENDER";
        }
        // Hammer / Stun
        if (s.includes("hammer") || s.includes("stun") || s.includes("special_effect") ||
            s.includes("مطرقة") || s.includes("تعطيل") || msgType === 6 || msgType === 9) {
          return "HAMMER";
        }
        // Speed Booster / Challenge
        if (s.includes("speed") || s.includes("challenge") || s.includes("booster") ||
            s.includes("سرعة") || s.includes("تحدي")) {
          return "SPEED_BOOSTER";
        }
        // Shield / Defense
        if (s.includes("shield") || s.includes("defense") || s.includes("protect") ||
            s.includes("درع") || s.includes("حماية")) {
          return "SHIELD_DEFENSE";
        }
        // Glove / Critical Strike / Vault
        if (s.includes("glove") || s.includes("critical") || s.includes("vault") ||
            s.includes("قفاز") || s.includes("ضربة") || msgType === 2 || msgType === 12) {
          return "GLOVE";
        }
        // Unknown — still default to GLOVE but log a warning
        console.warn(`[TACTICAL_RESOLVE] Could not classify tool: rawStr="${rawStr}" msgType=${msgType} → defaulting to GLOVE`);
        return "GLOVE";
      };

      // 1. Check AwardCardNotice (Tools awarded at the end or during battle)
      if (data.awardCardNotice) {
        // Collect all potential card metadata strings for accurate detection
        const rawMetaPieces: string[] = [
          data.awardCardNotice?.cardType,
          data.awardCardNotice?.cardName,
          data.awardCardNotice?.toolKey,
          data.awardCardNotice?.displayContent?.key,
          data.awardCardNotice?.displayContent?.defaultPattern,
          data.cardObtainGuide?.cardName,
          data.cardObtainGuide?.toolKey,
        ];

        if (Array.isArray(data.awardCardNotice?.displayContent?.pieces)) {
          for (const piece of data.awardCardNotice.displayContent.pieces) {
            if (piece?.stringValue) rawMetaPieces.push(piece.stringValue);
            if (piece?.patternRef?.key) rawMetaPieces.push(piece.patternRef.key);
          }
        }

        const globalToolKey = resolveToolKey(rawMetaPieces.filter(Boolean).join(" "), data.msgType);
        const awardedUsers = data.awardCardNotice.awardedUsers || [];

        for (let idx = 0; idx < awardedUsers.length; idx++) {
          const userInfo = awardedUsers[idx];
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

            // Per-user card info if present (supports mixed awards in one notice)
            const userCardInfo = String(userInfo.cardType || userInfo.cardName || userInfo.toolKey || "");
            const userToolKey = userCardInfo ? resolveToolKey(userCardInfo) : globalToolKey;

            // Extract quantity (supports multi-quantity tool grants)
            const quantity = Number(
              userInfo.count ||
              userInfo.quantity ||
              userInfo.cardNum ||
              userInfo.cardCount ||
              userInfo.num ||
              data.awardCardNotice?.count ||
              1
            ) || 1;

            // Deterministic deduplication key incorporating battle, user, tool, notice, and index
            // Ensures multiple different tools awarded to same supporter are both granted,
            // while guarding against network replays of the exact same event.
            const noticeId = data.awardCardNotice?.noticeId || data.common?.msgId || data.msgId || "award";
            const dedupKey = `card_${targetBattleId || "live"}_${uid}_${userToolKey}_${noticeId}_${idx}`;

            await SmartInventoryService.grantTool({
              tenantId: this.tenantId,
              supporterId: supporter.id,
              toolKey: userToolKey,
              quantity,
              battleId: targetBattleId || undefined,
              sourceEventId: dedupKey,
              auditReference: `TikTok Battle Item Card Award (${userToolKey} x${quantity}, Battle: ${targetBattleId || "live"})`,
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
        consumedToolKey = "BOOST_FOG"; // Smoke Card = الضباب المعزز (Magic Mist)
        targetUser = data.useSmokeCard.cardInfo?.sendUser;
      } else if (data.useExtraTimeCard) {
        consumedToolKey = "TIME_EXTENDER"; // Extra Time = ممدد الوقت (+10s)
        targetUser = data.useExtraTimeCard.cardInfo?.sendUser;
      } else if (data.useWaveCard) {
        consumedToolKey = "SONG_SURGE"; // Wave Card = موجة الأغنية التكتيكية (Song Surge x5)
        targetUser = data.useWaveCard.cardInfo?.sendUser;
      } else if (data.useSpecialEffectCard) {
        consumedToolKey = "HAMMER"; // Special Effect Card = مطرقة الحظر/التعطيل (Victory Hammer / Stun)
        targetUser = data.useSpecialEffectCard.cardInfo?.sendUser;
      } else if (data.specialEffectNotice) {
        consumedToolKey = "HAMMER";
        targetUser = data.specialEffectNotice.fromUserId ? { userId: data.specialEffectNotice.fromUserId } : null;
      } else if (data.useVaultGloveCard) {
        consumedToolKey = "GLOVE";
        targetUser = data.useVaultGloveCard.cardInfo?.sendUser;
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
                battleId: targetBattleId || undefined,
                notes: `Live TikTok Battle Card Activation (${consumedToolKey})`,
              }).catch(() => {});
            }
          }
        }
      }

      this.stats.processedCount++;
    } catch (err) {
      this.stats.errorCount++;
      console.error("[TACTICAL_ERROR] handleBattleItemCard failed:", err);
    }
  }

  getStats(): EventPipelineStats {
    return { ...this.stats };
  }
}
