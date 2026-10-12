import { describe, it, expect, beforeEach } from "vitest";
import { BattleScoreResolver, BattleContext, ParticipantReference } from "../src/lib/battle-score-resolver";

describe("BattleScoreResolver — Comprehensive Test Suite (15 Critical Scenarios)", () => {
  const battleId = "battle_test_round_123456";

  const hostParticipant: ParticipantReference = {
    platformUserId: "7108920192847291001",
    username: "mohra.2000",
    displayName: "مهرة",
    teamNumber: 1,
  };

  const allyParticipant: ParticipantReference = {
    platformUserId: "7108920192847291002",
    username: "ally_streamer",
    displayName: "حليف مهرة",
    teamNumber: 1,
  };

  const opponent1Participant: ParticipantReference = {
    platformUserId: "6983076164613456001",
    username: "rival_one",
    displayName: "المنافس الأول",
    teamNumber: 2,
  };

  const opponent2Participant: ParticipantReference = {
    platformUserId: "6983076164613456002",
    username: "rival_two",
    displayName: "المنافس الثاني",
    teamNumber: 2,
  };

  beforeEach(() => {
    BattleScoreResolver.resetBattleTracking(battleId);
  });

  // SCENARIO 1: Independent Updates (Team A update does not touch Team B)
  it("Scenario 1: Team A update does not touch or corrupt Team B's verified score", () => {
    const battle: BattleContext = {
      id: battleId,
      battleType: "1V1",
      currentTeam1Score: 1000,
      currentTeam2Score: 2500,
      participants: [hostParticipant, opponent1Participant],
    };

    const updateEvent = {
      battleId,
      timestamp: Date.now(),
      armies: {
        [hostParticipant.platformUserId]: {
          anchorIdStr: hostParticipant.platformUserId,
          hostscore: 1800,
        },
      },
    };

    const result = BattleScoreResolver.resolveScores(battle, updateEvent);
    expect(result.accepted).toBe(true);
    expect(result.team1Score).toBe(1800);
    expect(result.team2Score).toBe(2500); // Team B completely untouched
    expect(result.team1Delta).toBe(800);
    expect(result.team2Delta).toBe(0);
  });

  // SCENARIO 2: Idempotent Cumulative Snapshots (Replaying same snapshot does not double score)
  it("Scenario 2: Cumulative snapshot is idempotent and does not accumulate as delta", () => {
    const battle: BattleContext = {
      id: battleId,
      battleType: "1V1",
      currentTeam1Score: 3000,
      currentTeam2Score: 3000,
      participants: [hostParticipant, opponent1Participant],
    };

    const snapshot = {
      battleId,
      timestamp: Date.now(),
      armies: {
        [hostParticipant.platformUserId]: {
          anchorIdStr: hostParticipant.platformUserId,
          hostscore: 3000,
        },
        [opponent1Participant.platformUserId]: {
          anchorIdStr: opponent1Participant.platformUserId,
          hostscore: 3000,
        },
      },
    };

    const result1 = BattleScoreResolver.resolveScores(battle, snapshot);
    expect(result1.team1Score).toBe(3000);
    expect(result1.team2Score).toBe(3000);

    // Replay identical snapshot
    const battleAfter1: BattleContext = {
      ...battle,
      currentTeam1Score: result1.team1Score,
      currentTeam2Score: result1.team2Score,
    };
    const result2 = BattleScoreResolver.resolveScores(battleAfter1, snapshot);
    expect(result2.team1Score).toBe(3000); // Not 6000!
    expect(result2.team2Score).toBe(3000);
    expect(result2.team1Delta).toBe(0);
  });

  // SCENARIO 3: Partial Update Protection (Missing team is not zeroed out)
  it("Scenario 3: Partial update containing only one team does not zero out the other team", () => {
    const battle: BattleContext = {
      id: battleId,
      battleType: "1V1",
      currentTeam1Score: 4500,
      currentTeam2Score: 6200,
      participants: [hostParticipant, opponent1Participant],
    };

    const partialEvent = {
      battleId,
      timestamp: Date.now(),
      armies: {
        [opponent1Participant.platformUserId]: {
          anchorIdStr: opponent1Participant.platformUserId,
          hostscore: 7000,
        },
      },
    };

    const result = BattleScoreResolver.resolveScores(battle, partialEvent);
    expect(result.accepted).toBe(true);
    expect(result.isPartialUpdate).toBe(true);
    expect(result.team2Score).toBe(7000);
    expect(result.team1Score).toBe(4500); // Preserved Team 1!
  });

  // SCENARIO 4: Stale Out-of-Order Events (Older timestamp rejected)
  it("Scenario 4: Rejects out-of-order events with stale timestamps", () => {
    const baseTime = Date.now();
    const battle: BattleContext = {
      id: battleId,
      battleType: "1V1",
      currentTeam1Score: 1000,
      currentTeam2Score: 1000,
      participants: [hostParticipant, opponent1Participant],
    };

    // First event at T = 5000
    BattleScoreResolver.resolveScores(battle, {
      battleId,
      timestamp: baseTime + 5000,
      armies: {
        [hostParticipant.platformUserId]: { hostscore: 1500 },
      },
    });

    // Stale event arrived from T = 1000
    const staleResult = BattleScoreResolver.resolveScores(battle, {
      battleId,
      timestamp: baseTime + 1000,
      armies: {
        [hostParticipant.platformUserId]: { hostscore: 800 },
      },
    });

    expect(staleResult.accepted).toBe(false);
    expect(staleResult.reason).toContain("REJECTED_STALE_TIMESTAMP");
  });

  // SCENARIO 5: Reconnection Replay (Re-sending last snapshot keeps verified score)
  it("Scenario 5: Reconnection replay of last snapshot preserves exact score state", () => {
    const battle: BattleContext = {
      id: battleId,
      battleType: "1V1",
      currentTeam1Score: 8400,
      currentTeam2Score: 9100,
      participants: [hostParticipant, opponent1Participant],
    };

    const replayPacket = {
      battleId,
      timestamp: Date.now(),
      teamArmies: [
        {
          teamId: 1,
          teamTotalScore: 8400,
          teamUser: [{ userId: hostParticipant.platformUserId }],
        },
        {
          teamId: 2,
          teamTotalScore: 9100,
          teamUser: [{ userId: opponent1Participant.platformUserId }],
        },
      ],
    };

    const result = BattleScoreResolver.resolveScores(battle, replayPacket);
    expect(result.accepted).toBe(true);
    expect(result.team1Score).toBe(8400);
    expect(result.team2Score).toBe(9100);
  });

  // SCENARIO 6: Inverted Array Order (Opponent first in array does NOT flip scores)
  it("Scenario 6: Inverted army order in source payload does NOT flip team scores", () => {
    const battle: BattleContext = {
      id: battleId,
      battleType: "1V1",
      currentTeam1Score: 0,
      currentTeam2Score: 0,
      participants: [hostParticipant, opponent1Participant],
    };

    // Opponent is placed at index 0, Host at index 1
    const invertedArrayPayload = {
      battleId,
      timestamp: Date.now(),
      armies: [
        {
          anchorIdStr: opponent1Participant.platformUserId, // Opponent first!
          hostscore: 950,
        },
        {
          anchorIdStr: hostParticipant.platformUserId, // Host second!
          hostscore: 3200,
        },
      ],
    };

    const result = BattleScoreResolver.resolveScores(battle, invertedArrayPayload);
    expect(result.accepted).toBe(true);
    expect(result.team1Score).toBe(3200); // Host correctly received 3200!
    expect(result.team2Score).toBe(950);  // Opponent correctly received 950!
  });

  // SCENARIO 7: Battle Switch (Payload for another battle is rejected)
  it("Scenario 7: Reject updates belonging to a different battleId", () => {
    const battle: BattleContext = {
      id: battleId,
      battleType: "1V1",
      currentTeam1Score: 500,
      currentTeam2Score: 500,
      participants: [hostParticipant, opponent1Participant],
    };

    const foreignBattlePayload = {
      battleId: "old_expired_battle_999999",
      timestamp: Date.now(),
      armies: {
        [hostParticipant.platformUserId]: { hostscore: 99999 },
      },
    };

    const result = BattleScoreResolver.resolveScores(battle, foreignBattlePayload);
    expect(result.accepted).toBe(false);
    expect(result.reason).toContain("REJECTED_BATTLE_ID_MISMATCH");
    expect(result.team1Score).toBe(500); // Intact
  });

  // SCENARIO 8: Disconnect & Resync (Re-syncing after brief disconnect)
  it("Scenario 8: Re-syncing after room disconnect updates to new valid cumulative total", () => {
    const battle: BattleContext = {
      id: battleId,
      battleType: "1V1",
      currentTeam1Score: 1200,
      currentTeam2Score: 1500,
      participants: [hostParticipant, opponent1Participant],
    };

    // New event arrives after connection restored with higher score
    const resyncEvent = {
      battleId,
      timestamp: Date.now() + 10000,
      armies: {
        [hostParticipant.platformUserId]: { hostscore: 4500 },
        [opponent1Participant.platformUserId]: { hostscore: 4100 },
      },
    };

    const result = BattleScoreResolver.resolveScores(battle, resyncEvent);
    expect(result.accepted).toBe(true);
    expect(result.team1Score).toBe(4500);
    expect(result.team2Score).toBe(4100);
  });

  // SCENARIO 9: 2v2 Teammate Scoring (Scores of both teammates aggregate accurately)
  it("Scenario 9: 2v2 teammate scores correctly sum into each team's score without cross-leakage", () => {
    const battle2v2: BattleContext = {
      id: battleId,
      battleType: "2V2",
      currentTeam1Score: 0,
      currentTeam2Score: 0,
      participants: [
        hostParticipant,
        allyParticipant,
        opponent1Participant,
        opponent2Participant,
      ],
    };

    // 4 individual armies payload (TikTok format)
    const payload2v2 = {
      battleId,
      timestamp: Date.now(),
      armies: {
        // Team 1: Host (1200) + Ally (800) = 2000
        [hostParticipant.platformUserId]: { hostscore: 1200 },
        [allyParticipant.platformUserId]: { hostscore: 800 },
        // Team 2: Rival 1 (1500) + Rival 2 (1100) = 2600
        [opponent1Participant.platformUserId]: { hostscore: 1500 },
        [opponent2Participant.platformUserId]: { hostscore: 1100 },
      },
    };

    const result = BattleScoreResolver.resolveScores(battle2v2, payload2v2);
    expect(result.accepted).toBe(true);
    expect(result.team1Score).toBe(2000); // 1200 + 800
    expect(result.team2Score).toBe(2600); // 1500 + 1100
  });

  // SCENARIO 10: 1v1 vs 2v2 Transitions (No identity confusion)
  it("Scenario 10: Smooth transition between 1v1 and 2v2 matches resets tracking cleanly", () => {
    // End first battle
    BattleScoreResolver.resetBattleTracking(battleId);

    const newBattleId = "battle_new_round_2v2_999";
    const battle2v2: BattleContext = {
      id: newBattleId,
      battleType: "2V2",
      currentTeam1Score: 0,
      currentTeam2Score: 0,
      participants: [
        hostParticipant,
        allyParticipant,
        opponent1Participant,
        opponent2Participant,
      ],
    };

    const update = {
      battleId: newBattleId,
      timestamp: Date.now(),
      armies: {
        [hostParticipant.platformUserId]: { hostscore: 500 },
        [allyParticipant.platformUserId]: { hostscore: 250 },
        [opponent1Participant.platformUserId]: { hostscore: 300 },
        [opponent2Participant.platformUserId]: { hostscore: 100 },
      },
    };

    const result = BattleScoreResolver.resolveScores(battle2v2, update);
    expect(result.team1Score).toBe(750);
    expect(result.team2Score).toBe(400);
  });

  // SCENARIO 11: 0 vs 0 Dominance (Neutral balanced state)
  it("Scenario 11: 0 vs 0 yields clean neutral dominance state with uninitiated label", () => {
    const dominance = BattleScoreResolver.calculateDominance(0, 0);
    expect(dominance.isZero).toBe(true);
    expect(dominance.team1Percent).toBe(50);
    expect(dominance.team2Percent).toBe(50);
    expect(dominance.totalScore).toBe(0);
    expect(dominance.dominantTeam).toBeNull();
    expect(dominance.label).toContain("بانتظار النقاط الأولى");
  });

  // SCENARIO 12: Single-Sided Dominance (100% vs 0%)
  it("Scenario 12: Single-sided scoring produces exact 100% and 0% dominance metrics", () => {
    const dominanceHostWinning = BattleScoreResolver.calculateDominance(500, 0);
    expect(dominanceHostWinning.isZero).toBe(false);
    expect(dominanceHostWinning.team1Percent).toBe(100);
    expect(dominanceHostWinning.team2Percent).toBe(0);
    expect(dominanceHostWinning.dominantTeam).toBe(1);

    const dominanceOpponentWinning = BattleScoreResolver.calculateDominance(0, 750);
    expect(dominanceOpponentWinning.isZero).toBe(false);
    expect(dominanceOpponentWinning.team1Percent).toBe(0);
    expect(dominanceOpponentWinning.team2Percent).toBe(100);
    expect(dominanceOpponentWinning.dominantTeam).toBe(2);
  });

  // SCENARIO 13: High Score Precision & Ratio
  it("Scenario 13: Massive scores compute with perfect arithmetic ratio without overflow", () => {
    // 1,500,000 vs 500,000 => 75% vs 25%
    const dominance = BattleScoreResolver.calculateDominance(1500000, 500000);
    expect(dominance.team1Percent).toBe(75);
    expect(dominance.team2Percent).toBe(25);
    expect(dominance.totalScore).toBe(2000000);
    expect(dominance.team1Percent + dominance.team2Percent).toBe(100);
  });

  // SCENARIO 14: Rapid Burst Updates (Sequential monotonic processing)
  it("Scenario 14: Rapid burst events process monotonically without race regression", () => {
    let currentT1 = 0;
    let currentT2 = 0;
    const battle: BattleContext = {
      id: battleId,
      battleType: "1V1",
      currentTeam1Score: currentT1,
      currentTeam2Score: currentT2,
      participants: [hostParticipant, opponent1Participant],
    };

    const bursts = [
      { t1: 100, t2: 50 },
      { t1: 300, t2: 120 },
      { t1: 750, t2: 400 },
      { t1: 1200, t2: 950 },
    ];

    bursts.forEach((burst, idx) => {
      const res = BattleScoreResolver.resolveScores(
        { ...battle, currentTeam1Score: currentT1, currentTeam2Score: currentT2 },
        {
          battleId,
          timestamp: Date.now() + idx * 500,
          armies: {
            [hostParticipant.platformUserId]: { hostscore: burst.t1 },
            [opponent1Participant.platformUserId]: { hostscore: burst.t2 },
          },
        }
      );
      expect(res.team1Score).toBe(burst.t1);
      expect(res.team2Score).toBe(burst.t2);
      currentT1 = res.team1Score;
      currentT2 = res.team2Score;
    });

    expect(currentT1).toBe(1200);
    expect(currentT2).toBe(950);
  });

  // SCENARIO 15: Ambiguous Event Handling (Preserves verified state without swapping)
  it("Scenario 15: Ambiguous/unmatched payload preserves last trusted state without swapping sides", () => {
    const battle: BattleContext = {
      id: battleId,
      battleType: "1V1",
      currentTeam1Score: 3300,
      currentTeam2Score: 2100,
      participants: [hostParticipant, opponent1Participant],
    };

    // Unknown anchor IDs that cannot be matched to any team
    const ambiguousPayload = {
      battleId,
      timestamp: Date.now(),
      armies: {
        "ghost_anchor_xyz": { hostscore: 99999 },
      },
    };

    const result = BattleScoreResolver.resolveScores(battle, ambiguousPayload);
    // Preserves current verified scores
    expect(result.team1Score).toBe(3300);
    expect(result.team2Score).toBe(2100);
    expect(result.diagnostics.unmatchedAnchors).toContain("or_xyz");
  });
});
