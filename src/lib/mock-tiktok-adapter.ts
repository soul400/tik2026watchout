import { EventEmitter } from "events";
import { ITikTokConnectorAdapter } from "./tiktok-types";

export class MockSimulatedConnectorAdapter extends EventEmitter implements ITikTokConnectorAdapter {
  private connected = false;
  private intervalTimer: NodeJS.Timeout | null = null;

  async connect(username: string): Promise<boolean> {
    this.connected = true;
    setTimeout(() => {
      this.emit("connected", { roomId: "sim_room_987654321" });
    }, 100);

    return true;
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
      this.intervalTimer = null;
    }
    this.emit("disconnected");
  }

  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Helper method for integration tests to emit deterministic events
   */
  emitSimulatedEvent(eventName: string, data: any) {
    this.emit(eventName, data);
  }
}
