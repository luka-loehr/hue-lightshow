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

import { discoverBridgeAction } from "./hue-actions";

export class HueService {
  private static STORAGE_KEY = "hue_bridge_config";

  static async discoverBridge(): Promise<HueBridge[]> {
    return await discoverBridgeAction();
  }

  static async authenticate(bridgeIp: string, appName = "hue-light-show-creator"): Promise<string | null> {
    const MAX_RETRIES = 30; // 30 seconds
    const RETRY_DELAY = 1000;

    for (let i = 0; i < MAX_RETRIES; i++) {
        try {
            const response = await fetch(`http://${bridgeIp}/api`, {
                method: "POST",
                body: JSON.stringify({ devicetype: appName }),
            });
            const data = await response.json();
            
            if (data[0]?.success?.username) {
                return data[0].success.username;
            }
            
            if (data[0]?.error?.type === 101) {
                // Link button not pressed, wait and retry
                await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
                continue;
            }
            
            if (data[0]?.error) {
                throw new Error(data[0].error.description);
            }
        } catch (e: any) {
            // If network error, might want to fail fast or retry? 
            // For now, let's keep retrying only on specific errors or if it matches the polling pattern
            console.error("Auth attempt failed", e);
            if (i === MAX_RETRIES - 1) throw e;
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
        }
    }
    return null;
  }

  static async getLights(bridgeIp: string, username: string): Promise<HueLight[]> {
    try {
      const response = await fetch(`http://${bridgeIp}/api/${username}/lights`);
      const data = await response.json();
      return Object.entries(data).map(([id, light]: [string, any]) => ({
        id,
        ...light,
      }));
    } catch (e) {
      console.error("Failed to get lights", e);
      return [];
    }
  }

  static async setLightState(bridgeIp: string, username: string, lightId: string, state: Partial<HueLight["state"]>) {
    try {
      await fetch(`http://${bridgeIp}/api/${username}/lights/${lightId}/state`, {
        method: "PUT",
        body: JSON.stringify(state),
      });
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
