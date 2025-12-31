import {
  CaptionsIcon,
  ArrowLeftRightIcon,
  SparklesIcon,
  StickerIcon,
  MusicIcon,
  LightbulbIcon,
  BlendIcon,
  SlidersHorizontalIcon,
  LucideIcon,
  TypeIcon,
  SettingsIcon,
} from "lucide-react";
import { create } from "zustand";

export type Tab =
  | "lights"
  | "sounds"
  | "text"
  | "stickers"
  | "effects"
  | "transitions"
  | "captions"
  | "filters"
  | "adjustment"
  | "settings";

export const tabs: { [key in Tab]: { icon: LucideIcon; label: string } } = {
  lights: {
    icon: LightbulbIcon,
    label: "Lights",
  },
  sounds: {
    icon: MusicIcon,
    label: "Sounds",
  },
  text: {
    icon: TypeIcon,
    label: "Text",
  },
  stickers: {
    icon: StickerIcon,
    label: "Stickers",
  },
  effects: {
    icon: SparklesIcon,
    label: "Effects",
  },
  transitions: {
    icon: ArrowLeftRightIcon,
    label: "Transitions",
  },
  captions: {
    icon: CaptionsIcon,
    label: "Captions",
  },
  filters: {
    icon: BlendIcon,
    label: "Filters",
  },
  adjustment: {
    icon: SlidersHorizontalIcon,
    label: "Adjustment",
  },
  settings: {
    icon: SettingsIcon,
    label: "Settings",
  },
};

interface MediaPanelStore {
  activeTab: Tab;
  setActiveTab: (tab: Tab) => void;
  highlightMediaId: string | null;
  requestRevealMedia: (mediaId: string) => void;
  clearHighlight: () => void;
}

export const useMediaPanelStore = create<MediaPanelStore>((set) => ({
  activeTab: "lights",
  setActiveTab: (tab) => set({ activeTab: tab }),
  highlightMediaId: null,
  requestRevealMedia: (mediaId) =>
    set({ activeTab: "lights", highlightMediaId: mediaId }),
  clearHighlight: () => set({ highlightMediaId: null }),
}));
