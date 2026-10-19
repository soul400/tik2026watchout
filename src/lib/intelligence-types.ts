/**
 * LivePulse Intelligence Lab — Unified Types & DTO Definitions
 * Certified for Asia/Riyadh timezone & Multi-Tenant Evidence Architecture
 */

export type VerdictStatus =
  | "VERIFIED_IDENTIFIER_MATCH" // Stable platform identifier match (UID / SecUID)
  | "PUBLIC_ALIAS_HISTORY"      // Documented public rename or profile transition
  | "BEHAVIORAL_SIMILARITY"     // Pattern correlation (does not prove identity)
  | "NEEDS_REVIEW"              // Flagged for analyst investigation
  | "CONFLICTING_EVIDENCE"      // Contradictory observations (e.g. simultaneous active streams)
  | "UNRESOLVED"                // Insufficient data to conclude
  | "DISMISSED";                // Explicitly dismissed by operator

export type RadarTriggerCategory =
  | "KNOWN_ACCOUNT_ENTRY"       // Returning previously observed high-value account
  | "METADATA_CHANGE"           // Name, handle, or avatar change on stable identifier
  | "POTENTIAL_HANDOVER"        // Temporal handover sequence (15-180s gap)
  | "OPPONENT_SUPPORTER"        // Account with documented loyalty to opponent
  | "WATCHLIST_MATCH"           // Account present in active watchlist
  | "HIGH_IMPACT_POTENTIAL";    // High-tier supporter or documented high firepower

export type RadarSeverity = "INFO" | "NOTICE" | "WARNING" | "CRITICAL";

export type SnipeThreatLevel =
  | "LOW_SAFE"
  | "MODERATE_CAUTION"
  | "HIGH_AMBUSH_RISK"
  | "CRITICAL_IMMINENT_SNIPE";

export interface AccountIdentityDTO {
  id: string;
  platformUserId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  totalDiamonds: number;
  totalLikes: number;
  totalComments: number;
  category: string;
  firstObservedAt: string;
  lastObservedAt: string;
  dataConfidence: string;
  aliasHistoryCount?: number;
  isEnigmaMaskObserved?: boolean;
}

export interface AliasHistoryItemDTO {
  id: string;
  platformUserId: string;
  previousUsername: string | null;
  newUsername: string;
  previousDisplayName: string | null;
  newDisplayName: string;
  previousAvatarUrl: string | null;
  newAvatarUrl: string | null;
  changeType: string;
  source: string;
  observedAt: string;
}

export interface CircadianHourBin {
  hourRiyadh: number; // 0 - 23
  eventCount: number;
  diamonds: number;
}

export interface GiftDistributionItem {
  giftName: string;
  count: number;
  diamonds: number;
  percentage: number;
}

export interface ForensicComparisonDTO {
  accountA: AccountIdentityDTO;
  accountB: AccountIdentityDTO;
  comparisonTimestamp: string;
  timezone: "Asia/Riyadh";

  // Dimension 1: Temporal Overlap
  temporal: {
    accountAFirstSeen: string;
    accountALastSeen: string;
    accountBFirstSeen: string;
    accountBLastSeen: string;
    sharedSessionsCount: number;
    simultaneousEventCount: number;
    overlapDurationMinutes: number;
    overlapPercentage: number;
    potentialHandoverEventsCount: number;
    handoverSummary: string;
  };

  // Dimension 2: 24h Circadian Overlay (Asia/Riyadh)
  circadian: {
    hourlyA: CircadianHourBin[];
    hourlyB: CircadianHourBin[];
    correlationScore: number; // -1.0 to 1.0
    peakHoursA: number[];
    peakHoursB: number[];
    isSampleSufficient: boolean;
  };

  // Dimension 3: Gift Cadence & Distribution
  giftDistribution: {
    topGiftsA: GiftDistributionItem[];
    topGiftsB: GiftDistributionItem[];
    avgGiftValueA: number;
    avgGiftValueB: number;
    cosineSimilarity: number; // 0.0 to 1.0
    isSampleSufficient: boolean;
  };

  // Dimension 4: PK Tactical Patterns
  pkTactics: {
    final10SecondsPointsA: number;
    final10SecondsPercentageA: number;
    final10SecondsPointsB: number;
    final10SecondsPercentageB: number;
    gloveBoostPointsA: number;
    gloveBoostPointsB: number;
    highScoreRoundParticipationA: number;
    highScoreRoundParticipationB: number;
    tacticalSimilarityScore: number; // 0 to 100
  };

  // Dimension 5: Opponent Interaction
  opponentInteraction: {
    sharedOpponentsCount: number;
    topOpponentsA: string[];
    topOpponentsB: string[];
    sharedOpponentsPercentage: number;
  };

  // Composite Synthesis
  synthesis: {
    overallSimilarityScore: number; // 0 - 100
    confidenceBand: "VERY_HIGH" | "HIGH" | "MODERATE" | "LOW" | "INSUFFICIENT_DATA";
    weightedBreakdown: {
      temporalWeight: number; // default 30%
      giftPkWeight: number;   // default 30%
      circadianWeight: number;// default 15%
      opponentWeight: number; // default 15%
      metadataWeight: number; // default 10%
    };
    suggestedVerdict: VerdictStatus;
    evidencePoints: string[];
    limitations: string[];
    disclaimer: string;
  };
}

export interface RadarAlertDTO {
  id: string;
  liveSessionId: string | null;
  platformUserId: string;
  username: string;
  displayName: string;
  triggerCategory: RadarTriggerCategory;
  severity: RadarSeverity;
  summaryText: string;
  details: Record<string, any>;
  reviewStatus: "NEW" | "REVIEWED" | "DISMISSED" | "ACTIONED";
  telegramSent: boolean;
  createdAt: string;
}

export interface WatchlistEntryDTO {
  id: string;
  platformUserId: string | null;
  username: string;
  displayName: string | null;
  reason: string;
  category: string;
  severity: RadarSeverity;
  isActive: boolean;
  notifyOnEntry: boolean;
  createdAt: string;
}

export interface AntiSnipePredictionDTO {
  battleId: string;
  battleType: "1V1" | "2V2";
  calculatedAt: string;
  timezone: "Asia/Riyadh";
  team1Score: number;
  team2Score: number;
  scoreDifference: number;
  timeRemainingSeconds: number;
  snipeRiskScore: number; // 0 - 100
  threatLevel: SnipeThreatLevel;
  estimatedSnipeFirepower: number; // projected points
  safeLeadBufferRequired: number; // recommended diamond gap
  identifiedSnipers: Array<{
    username: string;
    displayName: string;
    historicalLatePoints: number;
    confidence: string;
  }>;
  signals: {
    opponentComebackCapacity: number; // Signal A (0-100)
    opponentSupporterThreat: number;   // Signal B (0-100)
    scoreStagnationExposure: number;   // Signal C (0-100)
    boostAvailabilityImpact: number;   // Signal D (0-100)
    historicalAccountRecords: number;  // Signal E (0-100)
  };
  dataCoverage: "VERIFIED_HIGH" | "MODERATE" | "PRELIMINARY";
  predictionLimitations: string[];
}

export interface InvestigationCaseDTO {
  id: string;
  caseNumber: string;
  title: string;
  primaryPlatformUserId: string;
  secondaryPlatformUserId: string | null;
  verdictStatus: VerdictStatus;
  similarityScore: number | null;
  evidenceSummary: string;
  evidenceDetails: Record<string, any>;
  assignedTo: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface IntelligenceSettingsDTO {
  radarEnabled: boolean;
  telegramRadarAlerts: boolean;
  notifyWatchlistEntries: boolean;
  notifyMetadataChanges: boolean;
  notifyOpponentSupporters: boolean;
  cooldownMinutes: number;
  minTacticalRiskAlert: number;
  minBehavioralSimilarityAlert: number;
  autoSyncEnigmaOnConnect: boolean;
}

export interface CommandCenterOverviewDTO {
  liveStatus: {
    isConnected: boolean;
    streamer: string;
    activeSessionId: string | null;
    peakViewers: number;
    totalDiamonds: number;
    dataConfidence: string;
  };
  activeBattle: {
    isActive: boolean;
    battleId: string | null;
    battleType: string | null;
    team1Score: number;
    team2Score: number;
    scoreDifference: number;
    timeRemainingSeconds: number;
    threatLevel: SnipeThreatLevel;
    snipeRiskScore: number;
  } | null;
  metrics: {
    monitoredSupportersCount: number;
    activeWatchlistCount: number;
    enigmaReviewsPendingCount: number;
    enigmaReviewsConfirmedCount: number;
    verifiedAliasChangesCount: number;
    recentRadarAlertsCount: number;
    criticalThreatsCount: number;
  };
  recentRadarAlerts: RadarAlertDTO[];
  pendingReviewCases: InvestigationCaseDTO[];
  dataFreshnessSeconds: number;
  lastAnalysisTimestamp: string;
}
