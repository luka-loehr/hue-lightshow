import { create } from 'zustand';
import { HueBridge, HueLight, HueService } from '@/lib/hue-service';

interface HueStore {
  bridge: HueBridge | null;
  lights: HueLight[];
  isConnected: boolean;
  isAuthenticated: boolean;
  isAuthenticating: boolean;
  error: string | null;
  
  connect: (bridge: HueBridge) => Promise<void>;
  authenticate: () => Promise<void>;
  fetchLights: () => Promise<void>;
  setLightState: (lightId: string, state: Partial<HueLight['state']>) => Promise<void>;
  disconnect: () => void;
  loadSavedConnection: () => void;
}

export const useHueStore = create<HueStore>((set, get) => ({
  bridge: null,
  lights: [],
  isConnected: false,
  isAuthenticated: false,
  isAuthenticating: false,
  error: null,

  connect: async (bridge) => {
    set({ bridge, error: null, isConnected: true });
    // If we have a username already, authenticate immediately
    if (bridge.username) {
        set({ isAuthenticated: true });
        await get().fetchLights();
    }
  },

  authenticate: async () => {
    const { bridge } = get();
    if (!bridge) return;

    set({ isAuthenticating: true, error: null });
    try {
      const username = await HueService.authenticate(bridge.internalipaddress);
      if (username) {
        const updatedBridge = { ...bridge, username };
        set({ 
          bridge: updatedBridge, 
          isAuthenticated: true, 
          isConnected: true, 
          isAuthenticating: false,
          error: null 
        });
        HueService.saveConfig(updatedBridge);
        await get().fetchLights();
      } else {
        set({ isAuthenticating: false, error: "Authentication failed. Please try again." });
      }
    } catch (e: any) {
      set({ 
        isAuthenticating: false, 
        error: e.message || "Authentication failed. Make sure you pressed the button on the bridge." 
      });
    }
  },

  fetchLights: async () => {
    const { bridge } = get();
    if (!bridge || !bridge.username) return;

    try {
      const lights = await HueService.getLights(bridge.internalipaddress, bridge.username);
      set({ lights });
    } catch (e) {
      console.error(e);
      set({ error: "Failed to fetch lights" });
    }
  },

  setLightState: async (lightId, state) => {
    const { bridge } = get();
    if (!bridge || !bridge.username) return;
    
    // Optimistic update
    set(s => ({
        lights: s.lights.map(l => l.id === lightId ? { ...l, state: { ...l.state, ...state } } : l)
    }));

    await HueService.setLightState(bridge.internalipaddress, bridge.username, lightId, state);
  },

  disconnect: () => {
    set({ bridge: null, lights: [], isConnected: false, isAuthenticated: false });
    if (typeof window !== "undefined") {
        localStorage.removeItem("hue_bridge_config");
    }
  },

  loadSavedConnection: () => {
      const saved = HueService.loadConfig();
      if (saved) {
          get().connect(saved);
      }
  }
}));
