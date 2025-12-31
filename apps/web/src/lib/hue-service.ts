export interface HueBridge {
  id: string;
  internalipaddress: string;
  username?: string;
  name?: string;
}

export interface HueLight {
  id: string;
  name: string;
  type: string;
  state: {
    on: boolean;
    bri: number;
    hue: number;
    sat: number;
    effect: string;
    xy: [number, number];
    ct: number;
    alert: string;
    colormode: string;
    mode: string;
    reachable: boolean;
  };
}

import { 
  discoverBridgeAction, 
  authenticateBridgeAction, 
  getLightsAction, 
  setLightStateAction 
} from "./hue-actions";

export class HueService {
  private static STORAGE_KEY = "hue_bridge_config";

  static async discoverBridge(): Promise<HueBridge[]> {
    return await discoverBridgeAction();
  }

  static async authenticate(bridgeIp: string, appName = "hue-light-show-creator"): Promise<string | null> {
    return await authenticateBridgeAction(bridgeIp, appName);
  }

  static async getLights(bridgeIp: string, username: string): Promise<HueLight[]> {
    try {
      return await getLightsAction(bridgeIp, username);
    } catch (e) {
      console.error("Failed to get lights", e);
      return [];
    }
  }

  static async setLightState(bridgeIp: string, username: string, lightId: string, state: Partial<HueLight["state"]>) {
    try {
      await setLightStateAction(bridgeIp, username, lightId, state);
    } catch (e) {
      console.error("Failed to set light state", e);
    }
  }

  static saveConfig(bridge: HueBridge) {
    if (typeof window !== "undefined") {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(bridge));
    }
  }

  static loadConfig(): HueBridge | null {
    if (typeof window !== "undefined") {
      const data = localStorage.getItem(this.STORAGE_KEY);
      return data ? JSON.parse(data) : null;
    }
    return null;
  }
}
