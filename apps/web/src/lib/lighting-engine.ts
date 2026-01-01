import { HueService } from "./hue-service";
import { LightElement, TimelineTrack } from "@/types/timeline";

interface LightState {
    on: boolean;
    bri: number;
    xy?: [number, number];
}

export class LightingEngine {
    private lastKnownState: Map<string, LightState> = new Map();
    private lastUpdate: number = 0;
    private UPDATE_THROTTLE_MS = 100; // Limit updates to 10Hz to avoid flooding bridge

    constructor() {}

    public sync(
        currentTime: number, 
        tracks: TimelineTrack[], 
        bridgeIp: string, 
        username: string,
        force: boolean = false
    ) {
        const now = Date.now();
        if (!force && now - this.lastUpdate < this.UPDATE_THROTTLE_MS) {
            return;
        }
        this.lastUpdate = now;

        // 1. Identify active state for all lights involved in the timeline
        const targetStates = new Map<string, LightState>();
        
        // Collect all lights that *should* be controlled by the timeline
        // We scan all light tracks
        tracks.filter(t => t.type === 'light').forEach(track => {
            // Find element active at currentTime (accounting for trimStart and trimEnd)
            const element = track.elements.find((e) => {
                const elementStart = e.startTime;
                const elementEnd = e.startTime + (e.duration - e.trimStart - e.trimEnd);
                return currentTime >= elementStart && currentTime < elementEnd;
            }) as LightElement | undefined;

            if (element) {
                const xy = this.hexToXY(element.color);
                targetStates.set(element.lightId, {
                    on: true,
                    bri: element.brightness,
                    xy: xy
                });
            } else {
                // If this track targets a light, but no element is active, what should we do?
                // The track itself doesn't define the light, the elements do. 
                // However, we might want to turn OFF lights that were previously ON but now have no element.
            }
        });

        // 2. Diff and Send Commands
        // We only care about lights we have seen or are currently targeting
        const allInvolvedLights = new Set([...this.lastKnownState.keys(), ...targetStates.keys()]);

        allInvolvedLights.forEach(lightId => {
            const target = targetStates.get(lightId);
            const current = this.lastKnownState.get(lightId);

            if (target) {
                // Light should be ON
                if (this.shouldUpdate(current, target)) {
                    HueService.setLightState(bridgeIp, username, lightId, target);
                    this.lastKnownState.set(lightId, target);
                }
            } else {
                // Light should be OFF (if it was previously controlled by us)
                if (current && current.on) {
                    const offState = { on: false, bri: 0 };
                    HueService.setLightState(bridgeIp, username, lightId, { on: false });
                    this.lastKnownState.set(lightId, offState);
                }
            }
        });
    }

    private shouldUpdate(current: LightState | undefined, target: LightState): boolean {
        if (!current) return true;
        if (current.on !== target.on) return true;
        if (Math.abs(current.bri - target.bri) > 5) return true; // Tolerate small bri changes
        if (current.xy && target.xy) {
             if (Math.abs(current.xy[0] - target.xy[0]) > 0.01 || Math.abs(current.xy[1] - target.xy[1]) > 0.01) return true;
        }
        return false;
    }

    // Helper: Hex to CIE XY
    // Simplified conversion. For production, gamma correction and gamut triangles should be used.
    private hexToXY(hex: string): [number, number] {
        const r = parseInt(hex.slice(1, 3), 16) / 255;
        const g = parseInt(hex.slice(3, 5), 16) / 255;
        const b = parseInt(hex.slice(5, 7), 16) / 255;

        // Gamma correction
        const red = (r > 0.04045) ? Math.pow((r + 0.055) / (1.0 + 0.055), 2.4) : (r / 12.92);
        const green = (g > 0.04045) ? Math.pow((g + 0.055) / (1.0 + 0.055), 2.4) : (g / 12.92);
        const blue = (b > 0.04045) ? Math.pow((b + 0.055) / (1.0 + 0.055), 2.4) : (b / 12.92);

        const X = red * 0.664511 + green * 0.154324 + blue * 0.162028;
        const Y = red * 0.283881 + green * 0.729298 + blue * 0.027045; // Luminance?
        const Z = red * 0.000088 + green * 0.083861 + blue * 0.088009; // Note: Z usually not used for xy

        const sum = X + Y + Z;
        if (sum === 0) return [0, 0];
        
        return [X / sum, Y / sum];
    }
}

export const lightingEngine = new LightingEngine();
