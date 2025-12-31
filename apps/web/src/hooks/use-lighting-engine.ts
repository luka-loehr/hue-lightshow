"use client";

import { useEffect } from "react";
import { lightingEngine } from "@/lib/lighting-engine";
import { useTimelineStore } from "@/stores/timeline-store";
import { useHueStore } from "@/stores/hue-store";
import { usePlaybackStore } from "@/stores/playback-store";

export function useLightingEngine() {
  const { tracks } = useTimelineStore();
  const { bridge, isAuthenticated } = useHueStore();

  useEffect(() => {
    if (!bridge || !isAuthenticated || !bridge.username) return;

    const handleUpdate = (e: Event) => {
        if (!bridge?.username) return;
        const customEvent = e as CustomEvent;
        const time = customEvent.detail.time;
        
        lightingEngine.sync(
            time, 
            useTimelineStore.getState().tracks, 
            bridge.internalipaddress, 
            bridge.username
        );
    };
    
    // Also handle seek to update immediately
    const handleSeek = (e: Event) => {
        if (!bridge?.username) return;
        const customEvent = e as CustomEvent;
        const time = customEvent.detail.time;
        
        lightingEngine.sync(
            time, 
            useTimelineStore.getState().tracks, 
            bridge.internalipaddress, 
            bridge.username,
            true // force update on seek
        );
    };

    window.addEventListener("playback-update", handleUpdate);
    window.addEventListener("playback-seek", handleSeek);

    return () => {
      window.removeEventListener("playback-update", handleUpdate);
      window.removeEventListener("playback-seek", handleSeek);
    };
  }, [bridge, isAuthenticated]);
}
