"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { PlusIcon, Music, Loader2, PlayIcon, PauseIcon, Trash2 } from "lucide-react";
import { useMediaStore } from "@/stores/media-store";
import { useProjectStore } from "@/stores/project-store";
import { processMediaFiles } from "@/lib/media-processing";
import { toast } from "sonner";
import { DraggableMediaItem } from "@/components/ui/draggable-item";
import { MediaFile } from "@/types/media";

export function SoundsView() {
  const { mediaFiles, addMediaFile, removeMediaFile } = useMediaStore();
  const { activeProject } = useProjectStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);

  // Filter to only show audio files
  const audioFiles = mediaFiles.filter(
    (file) => file.type === "audio" && !file.ephemeral
  );

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    if (!activeProject) {
      toast.error("No active project");
      return;
    }

    // Filter to only MP3/audio files
    const audioFilesArray = Array.from(e.target.files).filter((file) =>
      file.type.startsWith("audio/")
    );

    if (audioFilesArray.length === 0) {
      toast.error("Please select audio files (MP3, WAV, etc.)");
      return;
    }

    setIsProcessing(true);
    try {
      const processedItems = await processMediaFiles(audioFilesArray);
      for (const item of processedItems) {
        await addMediaFile(activeProject.id, item);
      }
      toast.success(`Added ${processedItems.length} audio file(s)`);
    } catch (error) {
      console.error("Error processing audio files:", error);
      toast.error("Failed to process audio files");
    } finally {
      setIsProcessing(false);
      e.target.value = "";
    }
  };

  const handleRemove = async (id: string) => {
    if (!activeProject) {
      toast.error("No active project");
      return;
    }
    
    // Stop if playing
    if (playingId === id) {
      audioElement?.pause();
      setPlayingId(null);
    }
    
    await removeMediaFile(activeProject.id, id);
  };

  const playSound = (file: MediaFile) => {
    if (playingId === file.id) {
      audioElement?.pause();
      setPlayingId(null);
      return;
    }

    audioElement?.pause();

    if (file.url) {
      const audio = new Audio(file.url);
      audio.addEventListener("ended", () => {
        setPlayingId(null);
      });
      audio.addEventListener("error", () => {
        setPlayingId(null);
        toast.error("Failed to play audio");
      });
      audio.play().catch(() => {
        setPlayingId(null);
      });

      setAudioElement(audio);
      setPlayingId(file.id);
    }
  };

  const formatDuration = (duration?: number) => {
    if (!duration) return "0:00";
    const min = Math.floor(duration / 60);
    const sec = Math.floor(duration % 60);
    return `${min}:${sec.toString().padStart(2, "0")}`;
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b flex items-center justify-between">
        <h2 className="font-semibold">Sounds ({audioFiles.length})</h2>
        <Button
          variant="outline"
          size="icon"
          onClick={handleUploadClick}
          disabled={isProcessing}
        >
          {isProcessing ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <PlusIcon className="w-4 h-4" />
          )}
        </Button>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*"
        multiple
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3">
        {audioFiles.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center gap-3 text-center p-4">
            <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center">
              <Music className="w-6 h-6 text-muted-foreground" />
            </div>
            <div className="space-y-1">
              <p className="font-medium">No sounds yet</p>
              <p className="text-sm text-muted-foreground">
                Click the + button to upload MP3 files
              </p>
            </div>
            <Button variant="outline" onClick={handleUploadClick} disabled={isProcessing}>
              {isProcessing ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <PlusIcon className="w-4 h-4 mr-2" />
              )}
              Upload Audio
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {audioFiles.map((file) => (
              <div
                key={file.id}
                className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/50 transition-colors group"
              >
                {/* Play button */}
                <button
                  type="button"
                  className="w-10 h-10 bg-muted rounded-md flex items-center justify-center shrink-0 hover:bg-muted/80 transition-colors"
                  onClick={() => playSound(file)}
                >
                  {playingId === file.id ? (
                    <PauseIcon className="w-4 h-4" />
                  ) : (
                    <PlayIcon className="w-4 h-4" />
                  )}
                </button>

                {/* Draggable area */}
                <DraggableMediaItem
                  name={file.name}
                  variant="compact"
                  isDraggable={true}
                  showLabel={false}
                  dragData={{
                    id: file.id,
                    type: "audio",
                    name: file.name,
                    duration: file.duration || 5,
                  }}
                  containerClassName="flex-1 min-w-0"
                  className="p-0 h-auto"
                  preview={
                    <div className="flex items-center gap-2 w-full cursor-grab">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{file.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDuration(file.duration)}
                        </p>
                      </div>
                    </div>
                  }
                />

                {/* Delete button */}
                <Button
                  variant="text"
                  size="icon"
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                  onClick={() => handleRemove(file.id)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
