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

      // 4. Tactical Tool Separation:
      // Ordinary gifts (even containing terms like 'glove' or 'fog') are financial/score contributions
      // and must NEVER grant tactical inventory tools. Tactical tools are only awarded via explicit battle card events.

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

        // Trigger Telegram Battle Final Alert
        try {
          const finishedBattle = await prisma.battle.findUnique({
            where: { id: battleId },
            include: { participants: true },
          });
          if (finishedBattle) {
            const winner =
              finishedBattle.team1Score > finishedBattle.team2Score
                ? 1
                : finishedBattle.team2Score > finishedBattle.team1Score
                ? 2
                : null;

            await TelegramService.sendBattleEndAlert(this.tenantId, {
              battleId: finishedBattle.id,
              battleType: finishedBattle.battleType as "1V1" | "2V2",
              team1Score: finishedBattle.team1Score,
              team2Score: finishedBattle.team2Score,
              team1Members: finishedBattle.participants
                .filter((p) => p.teamNumber === 1)
                .map((p) => p.displayName || p.username),
              team2Members: finishedBattle.participants
                .filter((p) => p.teamNumber === 2)
                .map((p) => p.displayName || p.username),
              winningTeam: winner,
              durationSeconds:
                finishedBattle.durationSeconds ||
                Math.round((Date.now() - new Date(finishedBattle.startedAt).getTime()) / 1000),
            });
          }
        } catch (alertErr) {
          console.error("[TELEGRAM_BATTLE_END_ALERT_ERROR]", alertErr);
        }
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

        // Trigger initial Telegram Battle Score Board
        TelegramService.sendOrUpdateBattleScore(this.tenantId, {
          battleId,
          battleType: participantsData.length > 2 ? "2V2" : "1V1",
          team1Score: 0,
          team2Score: 0,
          team1Members: participantsData
            .filter((p) => p.teamNumber === 1)
            .map((p) => p.displayName || p.username),
          team2Members: participantsData
            .filter((p) => p.teamNumber === 2)
            .map((p) => p.displayName || p.username),
        }).catch((err) => console.error("[TELEGRAM_BATTLE_START_ERROR]", err));
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

        // Live Telegram Score Update (throttled & in-place live edit)
        TelegramService.sendOrUpdateBattleScore(this.tenantId, {
          battleId: battle.id,
          battleType: battle.battleType as "1V1" | "2V2",
          team1Score: resolution.team1Score,
          team2Score: resolution.team2Score,
          team1Members: battle.participants
            .filter((p) => p.teamNumber === 1)
            .map((p) => p.displayName || p.username),
          team2Members: battle.participants
            .filter((p) => p.teamNumber === 2)
            .map((p) => p.displayName || p.username),
        }).catch((err) => console.error("[TELEGRAM_BATTLE_SCORE_UPDATE_ERROR]", err));
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

      // Helper to extract numeric quantity across all known protobuf and JSON field variants
      const extractItemQuantity = (obj: any): number => {
        if (!obj || typeof obj !== "object") return 0;
        const candidates = [
          obj.awardCount,
          obj.awardCardCount,
          obj.cardAmount,
          obj.cardCount,
          obj.count,
          obj.quantity,
          obj.amount,
          obj.cardNum,
          obj.num,
          obj.rewardCount,
          obj.totalCount,
          obj.score,
          obj.card_count,
          obj.card_amount,
          obj.card_num,
          obj.award_count,
          obj.award_card_count,
        ];
        for (const c of candidates) {
          const n = Number(c);
          if (!isNaN(n) && n > 0) return n;
        }
        return 0;
      };

      // Helper to parse count from text (e.g. "x2", "بطاقتين", "قفازين", "3 بطاقات")
      const extractCountFromText = (text: string): number => {
        if (!text) return 0;
        const s = text.toLowerCase();
        if (
          s.includes("بطاقتين") ||
          s.includes("قفازين") ||
          s.includes("ضبابين") ||
          s.includes("قنبلتين") ||
          s.includes("موجتين") ||
          s.includes("اثنين") ||
          s.includes("اثنان")
        ) {
          return 2;
        }
        if (s.includes("3 بطاقات") || s.includes("ثلاث بطاقات") || s.includes("ثلاث قفازات")) {
          return 3;
        }
        const m = s.match(/(?:x|×|\*|\b)(\d+)\s*(?:cards?|items?|بطاق(?:ة|ات)?|قفاز(?:ات)?|ضباب|دخان)?\b/i);
        if (m && m[1]) {
          const val = parseInt(m[1], 10);
          if (val >= 1 && val <= 50) return val;
        }
        return 0;
      };

      // Helper to classify tool type from raw strings and message types
      // Explicit mapping only — NEVER defaults to GLOVE
      const resolveToolKey = (rawStr: string, msgType?: number): string | null => {
        const s = (rawStr || "").toLowerCase().trim();
        if (!s && msgType === undefined) return null;

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
        // Speed Booster / Challenge / Boost x2 & x3 (BattleCardMsgType 10 & 11)
        if (s.includes("speed") || s.includes("challenge") || s.includes("booster") ||
            s.includes("سرعة") || s.includes("تحدي") || s.includes("boost") ||
            s.includes("top2") || s.includes("top3") || s.includes("مضاعف") ||
            msgType === 10 || msgType === 11) {
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

        // Unknown tool — log warning and return null (never default to GLOVE)
        if (s || msgType !== undefined) {
          console.warn(`[TACTICAL_RESOLVE_UNKNOWN] Unrecognized tool representation: rawStr="${rawStr}" msgType=${msgType}`);
        }
        return null;
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

        const rawMetaText = rawMetaPieces.filter(Boolean).join(" ").toLowerCase();
        const isMatchGuideGotPowerUps =
          rawMetaText.includes("gotpowerups") ||
          rawMetaText.includes("match_guide") ||
          rawMetaText.includes("power-ups") ||
          rawMetaText.includes("powerups") ||
          (Number(data.msgType) === 4 && (data.awardCardNotice.awardedUsers || []).length > 0 && !data.awardCardNotice.cardType);

        const globalToolKey = isMatchGuideGotPowerUps ? null : resolveToolKey(rawMetaPieces.filter(Boolean).join(" "), data.msgType);
        const awardedUsers = data.awardCardNotice.awardedUsers || [];

        if (isMatchGuideGotPowerUps) {
          console.log(`[TACTICAL_MATCH_GUIDE] 🏆 Match Guide Power-Ups Award notice detected | battle=${targetBattleId || 'live'} | awardedUsers=${awardedUsers.length}`);
        }

        // Authoritative Battle Resolution & Cross-Tenant Validation
        let battle: any = null;
        if (targetBattleId) {
          battle = await prisma.battle.findUnique({
            where: { id: targetBattleId },
            include: { participants: true },
          });

          // Cross-tenant check: if battle belongs to another tenant, reject immediately
          if (battle && battle.tenantId !== this.tenantId) {
            console.warn(`[TACTICAL_CROSS_TENANT_REJECTED] Battle ${targetBattleId} tenant (${battle.tenantId}) does not match pipeline tenant (${this.tenantId})`);
            return;
          }
        }

        // If it's a Match Guide multi-tool award, rank supporters by contribution if possible
        interface RankedAwardUser {
          raw: any;
          originalIndex: number;
        }

        const rankedAwardedUsers: RankedAwardUser[] = awardedUsers.map((item: any, originalIndex: number) => ({
          raw: item,
          originalIndex,
        }));

        if (isMatchGuideGotPowerUps && awardedUsers.length > 1) {
          const uids = awardedUsers.map((item: any) => {
            const u = item.user || item;
            return String(u.userId || u.displayId || "");
          }).filter(Boolean);

          const supportersInDb = await prisma.supporter.findMany({
            where: {
              tenantId: this.tenantId,
              platformUserId: { in: uids },
            },
            select: { platformUserId: true, totalDiamonds: true },
          });
          const diamondsMap = new Map(supportersInDb.map((s) => [s.platformUserId, s.totalDiamonds]));

          rankedAwardedUsers.sort((a, b) => {
            const uA = a.raw.user || a.raw;
            const uB = b.raw.user || b.raw;
            const uidA = String(uA.userId || uA.displayId || "");
            const uidB = String(uB.userId || uB.displayId || "");

            // 1. Explicit rank if present
            const rankA = Number(a.raw.rank ?? a.raw.order ?? 0);
            const rankB = Number(b.raw.rank ?? b.raw.order ?? 0);
            if (rankA > 0 && rankB > 0) return rankA - rankB;

            // 2. Explicit score/points if present
            const scoreA = Number(a.raw.score ?? a.raw.points ?? a.raw.diamonds ?? 0);
            const scoreB = Number(b.raw.score ?? b.raw.points ?? b.raw.diamonds ?? 0);
            if (scoreA !== scoreB && (scoreA > 0 || scoreB > 0)) return scoreB - scoreA;

            // 3. Database diamonds ranking
            const diaA = diamondsMap.get(uidA) || 0;
            const diaB = diamondsMap.get(uidB) || 0;
            if (diaA !== diaB) return diaB - diaA;

            return a.originalIndex - b.originalIndex;
          });
        }

        for (let rankIndex = 0; rankIndex < rankedAwardedUsers.length; rankIndex++) {
          const entry = rankedAwardedUsers[rankIndex];
          const userInfo = entry.raw;
          const idx = entry.originalIndex;
          const user = userInfo.user || userInfo;
          const uid = String(user.userId || user.displayId || "");
          const uname = String(user.displayId || user.nickName || "supporter");
          const displayName = String(user.nickName || uname || "داعم");

          if (!uid) continue;

          // ── AUTHORITATIVE TEAM RESOLUTION (No relying on gift score alone) ──
          const explicitTeam = Number(userInfo.teamNumber ?? userInfo.teamId ?? 0);
          const anchorId = String(userInfo.anchorId || userInfo.anchorUserId || data.awardCardNotice?.anchorId || "");

          let participantTeam: number | null = null;
          let anchorTeam: number | null = null;

          if (battle?.participants) {
            const userParticipant = battle.participants.find((p: any) => p.platformUserId === uid);
            if (userParticipant) {
              participantTeam = userParticipant.teamNumber;
            }
            if (anchorId) {
              const matchingAnchor = battle.participants.find((p: any) => p.platformUserId === anchorId);
              if (matchingAnchor) {
                anchorTeam = matchingAnchor.teamNumber;
              } else {
                // If anchorId matches the host streamer's known ID
                const hostStreamer = await prisma.streamerAccount.findFirst({
                  where: { tenantId: this.tenantId },
                  select: { platformUserId: true },
                });
                if (hostStreamer?.platformUserId && anchorId === hostStreamer.platformUserId) {
                  anchorTeam = 1;
                }
              }
            }
          }

          // Evaluate all authoritative team indicators
          const detectedTeams = new Set<number>();
          if (explicitTeam === 1 || explicitTeam === 2) detectedTeams.add(explicitTeam);
          if (participantTeam === 1 || participantTeam === 2) detectedTeams.add(participantTeam);
          if (anchorTeam === 1 || anchorTeam === 2) detectedTeams.add(anchorTeam);

          // 1. Conflicting indicators check
          if (detectedTeams.size > 1) {
            console.warn(`[TACTICAL_RECONCILIATION_CONFLICT] Conflicting team indicators for uid=${uid}: explicit=${explicitTeam}, participant=${participantTeam}, anchor=${anchorTeam}`);
            continue;
          }

          // Fallback grace check: if no indicators but user actively gifted the host in this session
          if (detectedTeams.size === 0) {
            const recentHostGift = await prisma.rawEvent.findFirst({
              where: {
                liveSessionId: this.liveSessionId,
                deduplicationKey: { contains: uid },
                eventType: "GIFT",
              },
            });
            if (recentHostGift) {
              detectedTeams.add(1);
            }
          }

          let authoritativeTeam: number | null = null;
          if (detectedTeams.size === 1) {
            authoritativeTeam = Array.from(detectedTeams)[0];
          }

          // 2. Reject confirmed opponent team supporters (Team 2)
          if (authoritativeTeam === 2) {
            console.log(`[TACTICAL_TEAM_FILTER] Skipping card grant for confirmed opponent team supporter: uid=${uid}`);
            continue;
          }

          // 3. Reject if membership evidence is missing or insufficient to confirm Team 1
          if (authoritativeTeam !== 1) {
            console.warn(`[TACTICAL_RECONCILIATION_INSUFFICIENT_EVIDENCE] Insufficient authoritative membership evidence for uid=${uid} (explicit=${explicitTeam}, battle=${targetBattleId})`);
            continue;
          }

          // Comprehensive Quantity Extraction: Check 17+ field variants and text plurals
          const rawTextForQty = [
            userInfo.displayContent,
            userInfo.describe,
            userInfo.cardName,
            data.awardCardNotice?.displayContent,
            data.awardCardNotice?.describe,
          ]
            .filter(Boolean)
            .map((x) => (typeof x === "string" ? x : JSON.stringify(x)))
            .join(" ");

          const qtyFromFields = extractItemQuantity(userInfo) || extractItemQuantity(data.awardCardNotice);
          const qtyFromText = extractCountFromText(rawTextForQty);
          const defaultQuantity = qtyFromFields > 0 ? qtyFromFields : (qtyFromText > 0 ? qtyFromText : 1);

          // Determine tools to award for this user
          const userCardInfo = String(userInfo.cardType || userInfo.cardName || userInfo.toolKey || "");
          const toolsToAward: Array<{ toolKey: string; quantity: number }> = [];

          if (userCardInfo) {
            const singleKey = resolveToolKey(userCardInfo);
            if (singleKey) {
              toolsToAward.push({ toolKey: singleKey, quantity: defaultQuantity });
            }
          } else if (isMatchGuideGotPowerUps) {
            // TikTok Match Guide Power-Ups Award Package
            // Rank 1: Speed Booster (⚡) + Glove (🥊)
            // Rank 2 & 3: Glove (🥊) + Hammer (🔨)
            if (rankIndex === 0) {
              toolsToAward.push({ toolKey: "SPEED_BOOSTER", quantity: 1 });
              toolsToAward.push({ toolKey: "GLOVE", quantity: 1 });
            } else {
              toolsToAward.push({ toolKey: "GLOVE", quantity: 1 });
              toolsToAward.push({ toolKey: "HAMMER", quantity: 1 });
            }
          } else if (globalToolKey) {
            toolsToAward.push({ toolKey: globalToolKey, quantity: defaultQuantity });
          }

          // Reject unrecognized or ambiguous cards
          if (toolsToAward.length === 0) {
            console.warn(`[TACTICAL_UNRECOGNIZED_CARD] Cannot award unknown tool card to user ${uid}: userCardInfo="${userCardInfo}", global=${globalToolKey}, isMatchGuide=${isMatchGuideGotPowerUps}`);
            continue;
          }

          // ── STABLE IDEMPOTENCY IDENTIFIER ──
          const noticeId = data.awardCardNotice?.noticeId || data.common?.msgId || data.msgId;
          if (!noticeId) {
            console.warn(`[TACTICAL_QUARANTINE_UNIDENTIFIED] Award notice lacks upstream event ID, cannot establish idempotency. uid=${uid}`);
            continue;
          }

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

          for (const item of toolsToAward) {
            // Scoped deterministic idempotency key incorporating tenant, battle/session, supporter, tool, notice, and index
            const dedupKey = `livepulse:${this.tenantId}:${targetBattleId || this.liveSessionId}:${uid}:${item.toolKey}:${noticeId}:${idx}`;

            const grantRes = await SmartInventoryService.grantTool({
              tenantId: this.tenantId,
              supporterId: supporter.id,
              toolKey: item.toolKey,
              quantity: item.quantity,
              battleId: targetBattleId || undefined,
              sourceEventId: dedupKey,
              auditReference: `TikTok Battle Card Award (${item.toolKey} x${item.quantity}, Battle: ${targetBattleId || "live"}, User: @${uname})`,
            });

            if (grantRes.success) {
              console.log(
                `[TACTICAL_TOOL_AWARDED] 🎯 Granted ${item.toolKey} x${item.quantity} to @${uname} (${uid}) [Notice: ${noticeId}]`
              );
            } else if (grantRes.reason !== "ALREADY_GRANTED") {
              console.warn(`[TACTICAL_GRANT_REJECTED] Tool grant rejected for ${uid} (${item.toolKey}): ${grantRes.reason}`);
            }
          }
        }
      }

      // 2. Check Tool Consumptions during battle
      let consumedToolKey: string | null = null;
      let targetUser: any = null;
      let activationMsgId: string | null = null;

      if (data.useCriticalStrikeCard) {
        consumedToolKey = "GLOVE"; // Critical Strike = القفاز x5
        targetUser = data.useCriticalStrikeCard.cardInfo?.sendUser;
        activationMsgId = data.useCriticalStrikeCard.cardInfo?.noticeId || data.useCriticalStrikeCard.noticeId;
      } else if (data.useSmokeCard) {
        consumedToolKey = "BOOST_FOG"; // Smoke Card = الضباب المعزز (Magic Mist)
        targetUser = data.useSmokeCard.cardInfo?.sendUser;
        activationMsgId = data.useSmokeCard.cardInfo?.noticeId || data.useSmokeCard.noticeId;
      } else if (data.useExtraTimeCard) {
        consumedToolKey = "TIME_EXTENDER"; // Extra Time = ممدد الوقت (+10s)
        targetUser = data.useExtraTimeCard.cardInfo?.sendUser;
        activationMsgId = data.useExtraTimeCard.cardInfo?.noticeId || data.useExtraTimeCard.noticeId;
      } else if (data.useWaveCard) {
        consumedToolKey = "SONG_SURGE"; // Wave Card = موجة الأغنية التكتيكية (Song Surge x5)
        targetUser = data.useWaveCard.cardInfo?.sendUser;
        activationMsgId = data.useWaveCard.cardInfo?.noticeId || data.useWaveCard.noticeId;
      } else if (data.useSpecialEffectCard) {
        consumedToolKey = "HAMMER"; // Special Effect Card = مطرقة الحظر/التعطيل (Victory Hammer / Stun)
        targetUser = data.useSpecialEffectCard.cardInfo?.sendUser;
        activationMsgId = data.useSpecialEffectCard.cardInfo?.noticeId || data.useSpecialEffectCard.noticeId;
      } else if (data.specialEffectNotice) {
        consumedToolKey = "HAMMER";
        targetUser = data.specialEffectNotice.fromUserId ? { userId: data.specialEffectNotice.fromUserId } : null;
        activationMsgId = data.specialEffectNotice.noticeId;
      } else if (data.useVaultGloveCard) {
        consumedToolKey = "GLOVE";
        targetUser = data.useVaultGloveCard.cardInfo?.sendUser;
        activationMsgId = data.useVaultGloveCard.cardInfo?.noticeId || data.useVaultGloveCard.noticeId;
      } else if (data.useTop2Card) {
        consumedToolKey = "SPEED_BOOSTER"; // Boost x2 Challenge
        targetUser = data.useTop2Card.cardInfo?.sendUser;
        activationMsgId = data.useTop2Card.cardInfo?.noticeId || data.useTop2Card.noticeId;
      } else if (data.useTop3Card) {
        consumedToolKey = "SPEED_BOOSTER"; // Boost x3 Challenge
        targetUser = data.useTop3Card.cardInfo?.sendUser;
        activationMsgId = data.useTop3Card.cardInfo?.noticeId || data.useTop3Card.noticeId;
      }

      if (consumedToolKey && targetUser) {
        const u = targetUser.user || targetUser;
        const uid = String(u.userId || u.displayId || "");
        if (uid) {
          let supporter = await prisma.supporter.findUnique({
            where: {
              tenantId_platformUserId: {
                tenantId: this.tenantId,
                platformUserId: uid,
              },
            },
          });

          if (!supporter) {
            supporter = await prisma.supporter.create({
              data: {
                tenantId: this.tenantId,
                platformUserId: uid,
                username: String(u.displayId || u.nickName || `user_${uid}`),
                displayName: String(u.nickName || u.displayId || "داعم"),
                dataConfidence: "VERIFIED",
              },
            });
          }

          // Stable, deterministic sourceEventId derived from verified upstream ID
          const rawId = activationMsgId || data.common?.msgId || data.msgId;

          if (!rawId) {
            // Quarantine un-identified event: record evidence without claiming exactly-once deduplication
            console.warn(`[TACTICAL_QUARANTINE_UNIDENTIFIED] Tool activation for ${consumedToolKey} lacks upstream event ID. Quarantining event for uid=${uid}`);
            await SmartInventoryService.consumeTool({
              tenantId: this.tenantId,
              supporterId: supporter.id,
              toolKey: consumedToolKey,
              quantity: 1,
              battleId: targetBattleId || undefined,
              isQuarantined: true,
              quarantineReason: "UNIDENTIFIED_UPSTREAM_EVENT",
              notes: `Live TikTok Battle Card Activation (${consumedToolKey}) [QUARANTINED: Missing Upstream ID]`,
              allowExternalFallback: true,
            });
            return;
          }

          const sourceEventId = `livepulse:${this.tenantId}:${targetBattleId || this.liveSessionId}:${uid}:${consumedToolKey}:${rawId}`;

          try {
            const consumeRes = await SmartInventoryService.consumeTool({
              tenantId: this.tenantId,
              supporterId: supporter.id,
              toolKey: consumedToolKey,
              quantity: 1,
              battleId: targetBattleId || undefined,
              sourceEventId,
              notes: `Live TikTok Battle Card Activation (${consumedToolKey})`,
              allowExternalFallback: true,
            });

            if (consumeRes.isExternal) {
              console.log(`[TACTICAL_EXTERNAL_ACTIVATION] Recorded external card activation for ${consumedToolKey} (Supporter: ${uid})`);
            } else if (consumeRes.duplicate) {
              console.log(`[TACTICAL_DUPLICATE_CONSUME] Idempotently handled duplicate activation: ${sourceEventId}`);
            } else {
              console.log(`[TACTICAL_CONSUMED] Successfully consumed ${consumedToolKey} from grant ${consumeRes.updatedGrant?.id}`);
            }
          } catch (consumeErr: any) {
            console.error(`[TACTICAL_CONSUME_ERROR] Failed to consume tool ${consumedToolKey} for ${uid}:`, consumeErr.message);
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
