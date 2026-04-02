"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import type { CreateStreamProfileInput, StreamProfile } from "@/lib/api-client";

interface ProfileFormDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: CreateStreamProfileInput) => void;
  initialData?: StreamProfile;
  mode: "create" | "edit";
}

const RESOLUTION_OPTIONS = [
  { value: "original", label: "Original" },
  { value: "2160p", label: "2160p (4K)" },
  { value: "1440p", label: "1440p (QHD)" },
  { value: "1080p", label: "1080p (Full HD)" },
  { value: "720p", label: "720p (HD)" },
  { value: "480p", label: "480p (SD)" },
  { value: "360p", label: "360p" },
  { value: "240p", label: "240p" },
];

const FRAMERATE_OPTIONS = [
  { value: "original", label: "Original" },
  { value: "5", label: "5 fps" },
  { value: "10", label: "10 fps" },
  { value: "15", label: "15 fps" },
  { value: "24", label: "24 fps" },
  { value: "30", label: "30 fps" },
  { value: "custom", label: "Custom" },
];

export function ProfileFormDialog({
  open,
  onClose,
  onSave,
  initialData,
  mode,
}: ProfileFormDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [audioMode, setAudioMode] = useState<"include" | "strip" | "mute">("include");
  const [framerateOption, setFramerateOption] = useState("original");
  const [customFramerate, setCustomFramerate] = useState(15);
  const [resolution, setResolution] = useState("original");
  const [transcodeMode, setTranscodeMode] = useState<"transcode" | "original">("transcode");
  const [keyframeInterval, setKeyframeInterval] = useState(2);

  useEffect(() => {
    if (initialData) {
      setName(initialData.name);
      setDescription(initialData.description ?? "");
      setAudioMode(initialData.audio_mode);
      setResolution((initialData as any).output_resolution ?? "original");
      setKeyframeInterval((initialData as any).keyframe_interval ?? 2);

      // Map codec to transcode mode
      const codec = (initialData as any).output_codec ?? "h264";
      setTranscodeMode(codec === "passthrough" || codec === "copy" ? "original" : "transcode");

      if (initialData.max_framerate === null || initialData.max_framerate === 0) {
        setFramerateOption("original");
      } else {
        const match = FRAMERATE_OPTIONS.find(
          (o) => o.value === String(initialData.max_framerate)
        );
        if (match) {
          setFramerateOption(match.value);
        } else {
          setFramerateOption("custom");
          setCustomFramerate(initialData.max_framerate);
        }
      }
    } else {
      setName("");
      setDescription("");
      setAudioMode("include");
      setFramerateOption("original");
      setCustomFramerate(15);
      setResolution("original");
      setTranscodeMode("transcode");
      setKeyframeInterval(2);
    }
  }, [initialData, open]);

  // When switching to original, reset resolution/framerate
  useEffect(() => {
    if (transcodeMode === "original") {
      setResolution("original");
      setFramerateOption("original");
    }
  }, [transcodeMode]);

  function handleSubmit() {
    let maxFramerate: number | null = null;
    if (framerateOption === "custom") {
      maxFramerate = customFramerate;
    } else if (framerateOption !== "original") {
      maxFramerate = Number(framerateOption);
    }

    const isTranscode = transcodeMode === "transcode";

    onSave({
      name: name.trim(),
      description: description.trim() || undefined,
      output_protocol: "hls",
      audio_mode: audioMode,
      max_framerate: isTranscode ? (maxFramerate ?? 0) : 0,
      output_resolution: isTranscode ? resolution : "original",
      output_codec: isTranscode ? "h264" : "passthrough",
      keyframe_interval: isTranscode ? keyframeInterval : 2,
    } as any);
  }

  const isTranscode = transcodeMode === "transcode";
  const showTranscodingWarning =
    isTranscode && (framerateOption !== "original" || resolution !== "original");

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-[480px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Create Stream Profile" : "Edit Stream Profile"}
          </DialogTitle>
          <DialogDescription>
            {mode === "create"
              ? "Define a reusable output configuration for your camera streams."
              : "Update the stream profile settings."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="profile-name">Name</Label>
            <Input
              id="profile-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Public Embed HD"
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="profile-description">Description</Label>
            <Input
              id="profile-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
            />
          </div>

          {/* Transcode Mode */}
          <div className="space-y-2">
            <Label>Video Processing</Label>
            <Select value={transcodeMode} onValueChange={(v) => setTranscodeMode(v as typeof transcodeMode)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="transcode">Transcode (H.264)</SelectItem>
                <SelectItem value="original">Original (Passthrough)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {isTranscode
                ? "Re-encode to H.264 — allows resolution, framerate, and audio changes. Uses CPU."
                : "Stream camera output directly — no processing, lowest latency, lowest CPU."}
            </p>
          </div>

          {/* Audio Mode */}
          <div className="space-y-2">
            <Label>Audio Mode</Label>
            <Select value={audioMode} onValueChange={(v) => setAudioMode(v as typeof audioMode)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="include">Include</SelectItem>
                <SelectItem value="strip">Strip</SelectItem>
                <SelectItem value="mute">Mute</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {audioMode === "include" && "Audio from camera included in output."}
              {audioMode === "strip" && "Audio removed — reduces bandwidth, recommended for embeds."}
              {audioMode === "mute" && "Silent audio track — player shows controls but no sound."}
            </p>
          </div>

          {/* Transcode-only settings */}
          {isTranscode && (
            <>
              {/* Output Resolution */}
              <div className="space-y-2">
                <Label>Output Resolution</Label>
                <Select value={resolution} onValueChange={setResolution}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RESOLUTION_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Downscale video output. Will not upscale beyond camera native resolution.
                </p>
              </div>

              {/* Max Framerate */}
              <div className="space-y-2">
                <Label>Max Framerate</Label>
                <Select value={framerateOption} onValueChange={setFramerateOption}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FRAMERATE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {framerateOption === "custom" && (
                  <Input
                    type="number"
                    min={1}
                    max={60}
                    value={customFramerate}
                    onChange={(e) => setCustomFramerate(Number(e.target.value))}
                    placeholder="Enter framerate"
                  />
                )}

                {showTranscodingWarning && (
                  <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-200">
                    Requires transcoding &mdash; uses additional CPU
                  </Badge>
                )}
              </div>

              {/* Keyframe Interval */}
              <div className="space-y-2">
                <Label>Keyframe Interval</Label>
                <Select
                  value={String(keyframeInterval)}
                  onValueChange={(v) => setKeyframeInterval(Number(v))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 second (fastest start)</SelectItem>
                    <SelectItem value="2">2 seconds (recommended)</SelectItem>
                    <SelectItem value="4">4 seconds</SelectItem>
                    <SelectItem value="5">5 seconds</SelectItem>
                    <SelectItem value="10">10 seconds (lowest bandwidth)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  How often a full frame (keyframe) is inserted. Shorter = faster stream start but slightly more bandwidth.
                </p>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!name.trim()}>
            {mode === "create" ? "Create" : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
