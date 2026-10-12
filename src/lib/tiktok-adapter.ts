import { TikTokLiveConnection } from "tiktok-live-connector";
import { EventEmitter } from "events";
import { ITikTokConnectorAdapter } from "./tiktok-types";

export class RealTikTokConnectorAdapter extends EventEmitter implements ITikTokConnectorAdapter {
  private connection: TikTokLiveConnection | null = null;
  private isLiveConnected = false;

  constructor(private options: Record<string, any> = {}) {
    super();
  }

  async checkIsLive(username: string): Promise<boolean> {
    try {
      const probe = new TikTokLiveConnection(username, {});
      return await probe.fetchIsLive();
    } catch {
      return false;
    }
  }

  async connect(username: string): Promise<boolean> {
    try {
      this.connection = new TikTokLiveConnection(username, {
        processInitialData: false,
        enableExtendedGiftInfo: false,
        ...this.options,
      });

      const conn = this.connection as any;

      // Bind TikTok-Live-Connector events
      conn.on("connected", (state: any) => {
        this.isLiveConnected = true;
        this.emit("connected", state);
      });

      conn.on("disconnected", () => {
        this.isLiveConnected = false;
        this.emit("disconnected");
      });

      conn.on("streamEnd", (actionId: any) => {
        this.isLiveConnected = false;
        this.emit("streamEnd", actionId);
      });

      conn.on("chat", (data: any) => {
        this.emit("chat", data);
      });

      conn.on("gift", (data: any) => {
        this.emit("gift", data);
      });

      conn.on("like", (data: any) => {
        this.emit("like", data);
      });

      conn.on("roomUser", (data: any) => {
        this.emit("roomUser", data);
      });

      conn.on("linkMicBattle", (data: any) => {
        this.emit("linkMicBattle", data);
      });

      conn.on("linkMicArmies", (data: any) => {
        this.emit("linkMicArmies", data);
      });

      conn.on("linkMicBattleItemCard", (data: any) => {
        this.emit("linkMicBattleItemCard", data);
      });

      const state = await this.connection.connect();
      this.isLiveConnected = true;
      return true;
    } catch (err: any) {
      this.isLiveConnected = false;
      this.emit("error", err);
      return false;
    }
  }

  async disconnect(): Promise<void> {
    if (this.connection) {
      try {
        await this.connection.disconnect();
      } catch (err) {
        // ignore
      }
      this.isLiveConnected = false;
    }
  }

  isConnected(): boolean {
    return this.isLiveConnected;
  }
}
