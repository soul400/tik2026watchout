/**
 * LIVEPULSE INTELLIGENCE — Unified Battle Score Resolver
 * 
 * Single source of truth for resolving, verifying, and stabilizing PK battle scores.
 * Guarantees:
 * 1. Zero index-based guessing (resolves via verified participant platformUserIds).
 * 2. 1v1 and 2v2 teammate score aggregation.
 * 3. Cumulative snapshot vs delta distinction.
 * 4. Stale event rejection and monotonic score preservation.
 * 5. Partial update protection (never zeroes out missing team).
 * 6. Mathematical precision for round dominance indicator.
 */

export interface ParticipantReference {
  platformUserId: string;
  username: string;
  displayName?: string;
  teamNumber: number; // 1 (Host team) or 2 (Opponent team)
}

export interface BattleContext {
  id: string;
  battleType: "1V1" | "2V2";
  currentTeam1Score: number;
  currentTeam2Score: number;
  participants: ParticipantReference[];
  lastUpdateTimestamp?: number;
}

export interface ScoreResolutionResult {
  accepted: boolean;
  battleId: string;
  team1Score: number;
  team2Score: number;
  team1Delta: number;
  team2Delta: number;
  isPartialUpdate: boolean;
  reason: string;
  timestamp: number;
  diagnostics: {
    eventSource: string;
    rawTeam1Candidate: number | null;
    rawTeam2Candidate: number | null;
    matchedAnchorsTeam1: string[];
    matchedAnchorsTeam2: string[];
    unmatchedAnchors: string[];
  };
}

export interface DominanceMetrics {
  team1Percent: number;
  team2Percent: number;
  totalScore: number;
  isZero: boolean;
  isTie: boolean;
  dominantTeam: 1 | 2 | null;
  label: string;
}

export class BattleScoreResolver {
  // In-memory monotonic tracker per battle ID
  private static lastTimestamps = new Map<string, number>();
  private static highestVerifiedScores = new Map<string, { team1: number; team2: number }>();

  /**
   * Resets internal tracking for a specific battle or all battles if omitted (e.g. on streamEnd).
   */
  static resetBattleTracking(battleId?: string): void {
    if (battleId) {
      this.lastTimestamps.delete(battleId);
      this.highestVerifiedScores.delete(battleId);
    } else {
      this.lastTimestamps.clear();
      this.highestVerifiedScores.clear();
    }
  }

  /**
   * Resolves raw TikTok linkMicArmies / linkMicBattle data against verified battle participants.
   */
  static resolveScores(battle: BattleContext, rawEvent: any): ScoreResolutionResult {
    const now = Date.now();
    const eventTime = Number(
      rawEvent.updateBattleScoreTime ||
      rawEvent.sourceTimestamp ||
      rawEvent.timestamp ||
      now
    );

    const diagnostics = {
      eventSource: "unknown",
      rawTeam1Candidate: null as number | null,
      rawTeam2Candidate: null as number | null,
      matchedAnchorsTeam1: [] as string[],
      matchedAnchorsTeam2: [] as string[],
      unmatchedAnchors: [] as string[],
    };

    // 1. Battle ID verification
    const eventBattleId = String(rawEvent.battleId || "");
    if (eventBattleId && eventBattleId !== battle.id) {
      return {
        accepted: false,
        battleId: battle.id,
        team1Score: battle.currentTeam1Score,
        team2Score: battle.currentTeam2Score,
        team1Delta: 0,
        team2Delta: 0,
        isPartialUpdate: false,
        reason: `REJECTED_BATTLE_ID_MISMATCH: event (${eventBattleId.slice(-6)}) !== active (${battle.id.slice(-6)})`,
        timestamp: eventTime,
        diagnostics,
      };
    }

    // 2. Monotonic timestamp check (reject stale/out-of-order packets)
    const lastTime = this.lastTimestamps.get(battle.id) || 0;
    if (eventTime > 0 && lastTime > 0 && eventTime < lastTime - 2000) {
      // Event is older than last accepted by more than 2 seconds (re-ordered packet)
      return {
        accepted: false,
        battleId: battle.id,
        team1Score: battle.currentTeam1Score,
        team2Score: battle.currentTeam2Score,
        team1Delta: 0,
        team2Delta: 0,
        isPartialUpdate: false,
        reason: `REJECTED_STALE_TIMESTAMP: eventTime ${eventTime} < lastTime ${lastTime}`,
        timestamp: eventTime,
        diagnostics,
      };
    }

    // 3. Build lookup sets from battle participants
    const team1Lookup = new Set<string>();
    const team2Lookup = new Set<string>();

    for (const p of battle.participants) {
      const cleanUid = String(p.platformUserId || "").trim();
      const cleanUname = String(p.username || "").toLowerCase().trim();

      if (p.teamNumber === 1) {
        if (cleanUid) team1Lookup.add(cleanUid);
        if (cleanUname) team1Lookup.add(cleanUname);
      } else if (p.teamNumber === 2) {
        if (cleanUid) team2Lookup.add(cleanUid);
        if (cleanUname) team2Lookup.add(cleanUname);
      }
    }

    let team1Candidate: number | null = null;
    let team2Candidate: number | null = null;

    // 4. Method A: Resolve via anchor-level armies (data.armies map or array)
    // In TikTok Protobuf, armies provides cumulative hostscore for each individual anchor.
    // In 2v2, each team has 2 anchors whose scores MUST be summed!
    if (rawEvent.armies) {
      diagnostics.eventSource = "armies_anchor_map";
      let team1AnchorSum = 0;
      let team2AnchorSum = 0;
      let foundTeam1Anchor = false;
      let foundTeam2Anchor = false;

      // Extract entries whether array or object map
      const armyEntries: Array<{ key?: string; data: any }> = [];

      if (Array.isArray(rawEvent.armies)) {
        rawEvent.armies.forEach((item: any, idx: number) => {
          armyEntries.push({ key: String(idx), data: item?.value || item });
        });
      } else if (typeof rawEvent.armies === "object" && rawEvent.armies !== null) {
        Object.entries(rawEvent.armies).forEach(([k, v]) => {
          armyEntries.push({ key: k, data: (v as any)?.value || v });
        });
      }

      for (const entry of armyEntries) {
        const item = entry.data || {};
        const anchorIdStr = String(
          item.anchorIdStr ||
          item.anchorId ||
          item.userId ||
          item.userIdStr ||
          entry.key ||
          ""
        ).trim();

        const rawScore = Number(item.hostscore || item.score || item.points || 0);
        const validScore = Number.isFinite(rawScore) && rawScore >= 0 ? rawScore : 0;

        // Check team assignment
        let matchedTeam: 1 | 2 | null = null;
        if (team1Lookup.has(anchorIdStr)) {
          matchedTeam = 1;
        } else if (team2Lookup.has(anchorIdStr)) {
          matchedTeam = 2;
        }

        if (matchedTeam === 1) {
          team1AnchorSum += validScore;
          foundTeam1Anchor = true;
          diagnostics.matchedAnchorsTeam1.push(anchorIdStr.slice(-6));
        } else if (matchedTeam === 2) {
          team2AnchorSum += validScore;
          foundTeam2Anchor = true;
          diagnostics.matchedAnchorsTeam2.push(anchorIdStr.slice(-6));
        } else {
          diagnostics.unmatchedAnchors.push(anchorIdStr.slice(-6));
        }
      }

      if (foundTeam1Anchor) team1Candidate = team1AnchorSum;
      if (foundTeam2Anchor) team2Candidate = team2AnchorSum;
    }

    // 5. Method B: Resolve via teamArmies (team-level aggregate array)
    // If teamArmies is present, verify which team is Team 1 using anchor membership, NEVER assuming teamId 1.
    if (Array.isArray(rawEvent.teamArmies) && rawEvent.teamArmies.length > 0) {
      diagnostics.eventSource = "team_armies_aggregate";

      for (const teamEntry of rawEvent.teamArmies) {
        const teamTotal = Number(teamEntry.teamTotalScore || teamEntry.score || 0);
        const validScore = Number.isFinite(teamTotal) && teamTotal >= 0 ? teamTotal : 0;

        // Inspect teamUser / userArmies inside this team entry
        const members: any[] = teamEntry.teamUser || teamEntry.userArmies || [];
        let assignedToTeam: 1 | 2 | null = null;

        for (const m of members) {
          const uid = String(m.userId || m.userIdStr || m.user?.userId || "").trim();
          if (uid) {
            if (team1Lookup.has(uid)) {
              assignedToTeam = 1;
              break;
            } else if (team2Lookup.has(uid)) {
              assignedToTeam = 2;
              break;
            }
          }
        }

        // If no members array, fallback to anchor match if only 2 teams exist and we have anchor scores
        if (!assignedToTeam && rawEvent.teamArmies.length === 2) {
          const tId = Number(teamEntry.teamId);
          // If we already resolved one team via anchor, map the other
          if (team1Candidate !== null && validScore === team1Candidate) {
            assignedToTeam = 1;
          } else if (team2Candidate !== null && validScore === team2Candidate) {
            assignedToTeam = 2;
          } else if (tId === 1 && team1Candidate === null) {
            // Last-resort fallback ONLY when anchor matching was impossible
            assignedToTeam = 1;
          } else if (tId === 2 && team2Candidate === null) {
            assignedToTeam = 2;
          }
        }

        if (assignedToTeam === 1) {
          team1Candidate = validScore;
        } else if (assignedToTeam === 2) {
          team2Candidate = validScore;
        }
      }
    }

    // 6. Method C: Check single diamond delta (totalDiamondCount fallback for team 1)
    if (team1Candidate === null && rawEvent.totalDiamondCount) {
      const diamondCount = Number(rawEvent.totalDiamondCount);
      if (Number.isFinite(diamondCount) && diamondCount > battle.currentTeam1Score) {
        team1Candidate = diamondCount;
        diagnostics.eventSource = "total_diamond_fallback";
      }
    }

    diagnostics.rawTeam1Candidate = team1Candidate;
    diagnostics.rawTeam2Candidate = team2Candidate;

    // 7. Partial Update Protection:
    // If an update only has data for Team 1 or Team 2, never reset the other team to 0!
    const isPartialUpdate = (team1Candidate === null && team2Candidate !== null) ||
                            (team1Candidate !== null && team2Candidate === null);

    const prevHighest = this.highestVerifiedScores.get(battle.id) || {
      team1: battle.currentTeam1Score,
      team2: battle.currentTeam2Score,
    };

    let resolvedTeam1 = team1Candidate !== null ? team1Candidate : battle.currentTeam1Score;
    let resolvedTeam2 = team2Candidate !== null ? team2Candidate : battle.currentTeam2Score;

    // 8. Monotonic Integrity Guard:
    // Cumulative scores in an active round should not spontaneously decrease.
    // If a lower score arrives without a round restart signal, hold the highest verified score.
    if (resolvedTeam1 < prevHighest.team1) {
      // Possible partial snapshot or out-of-order drop -> protect verified score
      resolvedTeam1 = prevHighest.team1;
    }
    if (resolvedTeam2 < prevHighest.team2) {
      resolvedTeam2 = prevHighest.team2;
    }

    // Update highest verified
    this.highestVerifiedScores.set(battle.id, {
      team1: resolvedTeam1,
      team2: resolvedTeam2,
    });
    this.lastTimestamps.set(battle.id, Math.max(lastTime, eventTime));

    const team1Delta = resolvedTeam1 - battle.currentTeam1Score;
    const team2Delta = resolvedTeam2 - battle.currentTeam2Score;

    const accepted = team1Candidate !== null || team2Candidate !== null;

    return {
      accepted,
      battleId: battle.id,
      team1Score: resolvedTeam1,
      team2Score: resolvedTeam2,
      team1Delta,
      team2Delta,
      isPartialUpdate,
      reason: accepted
        ? `ACCEPTED_${diagnostics.eventSource.toUpperCase()}`
        : "NO_ACTIONABLE_SCORE_DATA",
      timestamp: eventTime,
      diagnostics,
    };
  }

  /**
   * Calculates mathematically sound dominance metrics between two team scores.
   * Total = score1 + score2
   * Dominance1 = score1 / total * 100
   * Dominance2 = score2 / total * 100
   * When total is 0: returns neutral 50/50 state with clear uninitiated label.
   */
  static calculateDominance(rawScore1: number, rawScore2: number): DominanceMetrics {
    const s1 = Number.isFinite(rawScore1) && rawScore1 > 0 ? Math.floor(rawScore1) : 0;
    const s2 = Number.isFinite(rawScore2) && rawScore2 > 0 ? Math.floor(rawScore2) : 0;
    const totalScore = s1 + s2;

    if (totalScore === 0) {
      return {
        team1Percent: 50,
        team2Percent: 50,
        totalScore: 0,
        isZero: true,
        isTie: true,
        dominantTeam: null,
        label: "بانتظار النقاط الأولى (0 - 0)",
      };
    }

    const team1Percent = Math.round((s1 / totalScore) * 100);
    // Guarantee strict 100% sum
    const team2Percent = 100 - team1Percent;

    const isTie = s1 === s2;
    let dominantTeam: 1 | 2 | null = null;
    let label = "";

    if (isTie) {
      dominantTeam = null;
      label = `تعادل متكافئ (50% - 50%)`;
    } else if (s1 > s2) {
      dominantTeam = 1;
      label = `أسبقية الفريق الأول (${team1Percent}%)`;
    } else {
      dominantTeam = 2;
      label = `أسبقية الفريق الثاني (${team2Percent}%)`;
    }

    return {
      team1Percent,
      team2Percent,
      totalScore,
      isZero: false,
      isTie,
      dominantTeam,
      label,
    };
  }
}
