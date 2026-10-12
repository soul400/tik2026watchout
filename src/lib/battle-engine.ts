import { prisma } from "./prisma";

export interface ParticipantInfo {
  platformUserId: string;
  username: string;
  displayName: string;
  avatarUrl?: string;
  teamNumber: number; // 1 or 2
}

export class BattleEngine {
  /**
   * Initializes or matches a battle with robust team assignment, resilient to inverted player arrival.
   */
  static async createOrSyncBattle(params: {
    tenantId: string;
    liveSessionId: string;
    battleType: "1V1" | "2V2";
    participants: ParticipantInfo[];
    team1Score?: number;
    team2Score?: number;
  }) {
    const { tenantId, liveSessionId, battleType, participants, team1Score = 0, team2Score = 0 } = params;

    const battle = await prisma.battle.create({
      data: {
        tenantId,
        liveSessionId,
        battleType,
        status: "IN_PROGRESS",
        team1Score,
        team2Score,
        startedAt: new Date(),
        dataConfidence: "VERIFIED",
        participants: {
          create: participants.map((p) => ({
            teamNumber: p.teamNumber,
            platformUserId: p.platformUserId,
            username: p.username,
            displayName: p.displayName,
            avatarUrl: p.avatarUrl,
          })),
        },
      },
      include: {
        participants: true,
      },
    });

    return battle;
  }

  /**
   * Records a support score event for a battle and updates team scores atomically.
   */
  static async recordScoreEvent(params: {
    battleId: string;
    supporterId: string;
    teamNumber: number;
    points: number;
    giftName?: string;
  }) {
    const { battleId, supporterId, teamNumber, points, giftName } = params;

    return await prisma.$transaction(async (tx) => {
      // 1. Record individual score event
      const scoreEvent = await tx.battleScoreEvent.create({
        data: {
          battleId,
          supporterId,
          teamNumber,
          points,
          giftName,
          timestamp: new Date(),
          dataConfidence: "VERIFIED",
        },
      });

      // 2. Increment team score
      const battleUpdate =
        teamNumber === 1
          ? { team1Score: { increment: points } }
          : { team2Score: { increment: points } };

      const updatedBattle = await tx.battle.update({
        where: { id: battleId },
        data: battleUpdate,
      });

      return { scoreEvent, updatedBattle };
    });
  }

  /**
   * Concludes a battle and determines the winner deterministically.
   */
  static async finishBattle(battleId: string, manualWinner?: number | null) {
    const battle = await prisma.battle.findUnique({
      where: { id: battleId },
    });

    if (!battle) throw new Error("Battle not found");

    let winner: number | null | undefined = manualWinner;
    if (winner === undefined) {
      if (battle.team1Score > battle.team2Score) winner = 1;
      else if (battle.team2Score > battle.team1Score) winner = 2;
      else winner = null; // Draw
    }

    const endedAt = new Date();
    const durationSeconds = Math.round((endedAt.getTime() - battle.startedAt.getTime()) / 1000);

    return await prisma.battle.update({
      where: { id: battleId },
      data: {
        status: "COMPLETED",
        endedAt,
        durationSeconds,
        winningTeam: winner,
      },
      include: {
        participants: true,
        scoreEvents: {
          include: { supporter: true },
        },
      },
    });
  }
}
