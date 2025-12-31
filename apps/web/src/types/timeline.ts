import { MediaType } from "@/types/media";
import { generateUUID } from "@/lib/utils";

export type TrackType = "media" | "text" | "audio" | "light";

// Base element properties
interface BaseTimelineElement {
  id: string;
  name: string;
  duration: number;
  startTime: number;
  trimStart: number;
  trimEnd: number;
  hidden?: boolean;
}

// Media element that references MediaStore
export interface MediaElement extends BaseTimelineElement {
  type: "media";
  mediaId: string;
  muted?: boolean;
}

// Text element with embedded text data
export interface TextElement extends BaseTimelineElement {
  type: "text";
  content: string;
  fontSize: number;
  fontFamily: string;
  color: string;
  backgroundColor: string;
  textAlign: "left" | "center" | "right";
  fontWeight: "normal" | "bold";
  fontStyle: "normal" | "italic";
  textDecoration: "none" | "underline" | "line-through";
  x: number; // Position relative to canvas center
  y: number; // Position relative to canvas center
  rotation: number; // in degrees
  opacity: number; // 0-1
}

// Light element for controlling Hue lights
export interface LightElement extends BaseTimelineElement {
  type: "light";
  color: string;
  brightness: number; // 0-254
  lightId: string;
}

// Typed timeline elements
export type TimelineElement = MediaElement | TextElement | LightElement;

// Creation types (without id, for addElementToTrack)
export type CreateMediaElement = Omit<MediaElement, "id">;
export type CreateTextElement = Omit<TextElement, "id">;
export type CreateLightElement = Omit<LightElement, "id">;
export type CreateTimelineElement = CreateMediaElement | CreateTextElement | CreateLightElement;

export interface TimelineElementProps {
  element: TimelineElement;
  track: TimelineTrack;
  zoomLevel: number;
  isSelected: boolean;
  onElementMouseDown: (e: React.MouseEvent, element: TimelineElement) => void;
  onElementClick: (e: React.MouseEvent, element: TimelineElement) => void;
}

export interface ResizeState {
  elementId: string;
  side: "left" | "right";
  startX: number;
  initialTrimStart: number;
  initialTrimEnd: number;
}

// Drag data types for type-safe drag and drop
export interface MediaItemDragData {
  id: string;
  type: MediaType;
  name: string;
}

export interface TextItemDragData {
  id: string;
  type: "text";
  name: string;
  content: string;
}

export interface LightItemDragData {
  id: string; // light id
  type: "light";
  name: string;
  color: string;
  brightness: number;
}

export type DragData = MediaItemDragData | TextItemDragData | LightItemDragData;

export interface TimelineTrack {
  id: string;
  name: string;
  type: TrackType;
  elements: TimelineElement[];
  muted?: boolean;
  isMain?: boolean;
}

export function sortTracksByOrder(tracks: TimelineTrack[]): TimelineTrack[] {
  return [...tracks].sort((a, b) => {
    // Text tracks always go to the top
    if (a.type === "text" && b.type !== "text") return -1;
    if (b.type === "text" && a.type !== "text") return 1;

    // Audio tracks always go to bottom
    if (a.type === "audio" && b.type !== "audio") return 1;
    if (b.type === "audio" && a.type !== "audio") return -1;

    // Light tracks go to bottom, below audio
    if (a.type === "light" && b.type !== "light") return 1;
    if (b.type === "light" && a.type !== "light") return -1;

    // Main track goes above audio but below text tracks
    if (a.isMain && !b.isMain && b.type !== "audio" && b.type !== "text")
      return 1;
    if (b.isMain && !a.isMain && a.type !== "audio" && a.type !== "text")
      return -1;

    // Within same category, maintain creation order
    return 0;
  });
}

export function getMainTrack(tracks: TimelineTrack[]): TimelineTrack | null {
  return tracks.find((track) => track.isMain) || null;
}

export function ensureMainTrack(tracks: TimelineTrack[]): TimelineTrack[] {
  const hasMainTrack = tracks.some((track) => track.isMain);

  if (!hasMainTrack) {
    // Create main track if it doesn't exist
    const mainTrack: TimelineTrack = {
      id: generateUUID(),
      name: "Main Track",
      type: "media",
      elements: [],
      muted: false,
      isMain: true,
    };
    return [mainTrack, ...tracks];
  }

  return tracks;
}

// Timeline validation utilities
export function canElementGoOnTrack(
  elementType: "text" | "media" | "light",
  trackType: TrackType
): boolean {
  if (elementType === "text") {
    return trackType === "text";
  }
  if (elementType === "media") {
    return trackType === "media" || trackType === "audio";
  }
  if (elementType === "light") {
    return trackType === "light";
  }
  return false;
}

export function validateElementTrackCompatibility(
  element: { type: "text" | "media" | "light" },
  track: { type: TrackType }
): { isValid: boolean; errorMessage?: string } {
  const isValid = canElementGoOnTrack(element.type, track.type);

  if (!isValid) {
    const errorMessage =
      element.type === "text"
        ? "Text elements can only be placed on text tracks"
        : element.type === "light"
          ? "Light elements can only be placed on light tracks"
          : "Media elements can only be placed on media or audio tracks";

    return { isValid: false, errorMessage };
  }

  return { isValid: true };
}
