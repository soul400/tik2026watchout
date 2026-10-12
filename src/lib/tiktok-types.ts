export interface TikTokRawGiftEvent {
  giftId: number | string;
  giftName: string;
  diamondCount: number;
  repeatCount?: number;
  userId: string;
  secUid?: string;
  uniqueId: string;
  nickname: string;
  profilePictureUrl?: string;
  timestamp?: number;
}

export interface TikTokRawChatEvent {
  comment: string;
  userId: string;
  secUid?: string;
  uniqueId: string;
  nickname: string;
  profilePictureUrl?: string;
  timestamp?: number;
}

export interface TikTokRawLikeEvent {
  likeCount: number;
  totalLikes: number;
  userId: string;
  uniqueId: string;
  nickname: string;
}

export interface TikTokRawBattleEvent {
  battleId: string;
  battleStatus: number; // 1: In progress, 2: Finished
  teams: {
    teamId: number;
    points: number;
    players: {
      userId: string;
      uniqueId: string;
      nickname: string;
      avatarUrl?: string;
    }[];
  }[];
}

export type NormalizedEventType =
  | "GIFT"
  | "CHAT"
  | "LIKE"
  | "BATTLE_START"
  | "BATTLE_UPDATE"
  | "BATTLE_END"
  | "VIEWER_UPDATE";

export interface NormalizedLiveEvent {
  id: string; // Generated unique UUID
  tenantId: string;
  streamerUsername: string;
  liveSessionId: string;
  eventType: NormalizedEventType;
  sourceEventId?: string;
  deduplicationKey: string;
  actor: {
    platformUserId: string;
    username: string;
    displayName: string;
    avatarUrl?: string;
  };
  payload: Record<string, any>;
  sourceTimestamp: Date;
  receivedAt: Date;
  confidence: "VERIFIED" | "PARTIAL" | "ESTIMATED";
}

/**
 * Adapter interface allowing modular swapping of TikTok connectors.
 */
export interface ITikTokConnectorAdapter {
  connect(username: string): Promise<boolean>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
  on(event: string, listener: (...args: any[]) => void): void;
}
