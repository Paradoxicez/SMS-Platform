"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { apiClient, type StreamProfile } from "../../lib/api-client";
import type { Camera } from "@repo/types";

interface EditCameraDialogProps {
  camera: Camera;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function EditCameraDialog({
  camera,
  open,
  onOpenChange,
  onSuccess,
}: EditCameraDialogProps) {
  const [submitting, setSubmitting] = useState(false);
  const [profiles, setProfiles] = useState<StreamProfile[]>([]);

  const [name, setName] = useState("");
  const [streamUrl, setStreamUrl] = useState("");
  const [selectedProfileId, setSelectedProfileId] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [tags, setTags] = useState("");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; error?: string; detail?: string } | null>(null);

  // Populate form when camera changes or dialog opens
  useEffect(() => {
    if (open && camera) {
      setName(camera.name);
      setStreamUrl(
        (camera as any).rtsp_url ?? (camera as any).rtspUrl ?? "",
      );
      setSelectedProfileId(
        (camera as any).profile_id ?? (camera as any).profileId ?? "",
      );
      setLatitude(
        (camera as any).lat != null ? String((camera as any).lat) : "",
      );
      setLongitude(
        (camera as any).lng != null ? String((camera as any).lng) : "",
      );
      setTags(
        camera.tags ? (camera.tags as string[]).join(", ") : "",
      );
    }
    setTestResult(null);
  }, [open, camera]);

  const handleTestConnection = useCallback(async () => {
    if (!streamUrl) return;
    setTesting(true);
    setTestResult(null);
    try {
      const res = await apiClient.post<{ data: { success: boolean; error?: string; detail?: string } }>(
        "/cameras/test-connection",
        { url: streamUrl },
      );
      setTestResult(res.data);
    } catch (err) {
      setTestResult({
        success: false,
        error: "Test failed",
        detail: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setTesting(false);
    }
  }, [streamUrl]);

  // Fetch profiles on mount
  useEffect(() => {
    if (!open) return;
    apiClient
      .listProfiles()
      .then((res) => setProfiles(res.data ?? []))
      .catch(() => {});
  }, [open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!name) {
      toast.error("Validation Error", {
        description: "Camera name is required.",
      });
      return;
    }

    setSubmitting(true);

    try {
      // Fetch current version for OCC
      const camRes = await apiClient.get<{
        data: { version: number };
      }>(`/cameras/${camera.id}`);
      const version = camRes.data.version;

      const tagList = tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);

      await apiClient.updateCamera(camera.id, {
        name,
        rtsp_url: streamUrl || undefined,
        lat: latitude ? parseFloat(latitude) : null,
        lng: longitude ? parseFloat(longitude) : null,
        tags: tagList.length > 0 ? tagList : [],
        version,
      });

      toast.success("Camera Updated", {
        description: `Camera "${name}" has been updated.`,
      });

      onSuccess();
      onOpenChange(false);
    } catch (err) {
      toast.error("Error", {
        description:
          err instanceof Error ? err.message : "Failed to update camera.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Edit Camera</DialogTitle>
          <DialogDescription>
            Update camera settings. Changes to the stream URL will trigger
            automatic re-validation.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Stream Profile</Label>
            <Select
              value={selectedProfileId}
              onValueChange={setSelectedProfileId}
            >
              <SelectTrigger>
                <SelectValue placeholder="Default" />
              </SelectTrigger>
              <SelectContent>
                {profiles.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name} {p.is_default && "(Default)"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="editName">Camera Name *</Label>
            <Input
              id="editName"
              placeholder="e.g., Lobby Entrance Camera"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="editStreamUrl">Stream URL</Label>
            <div className="flex gap-2">
              <Input
                id="editStreamUrl"
                placeholder="rtsp://camera-ip:554/stream"
                value={streamUrl}
                onChange={(e) => {
                  setStreamUrl(e.target.value);
                  setTestResult(null);
                }}
                className="font-mono text-sm flex-1"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="shrink-0 whitespace-nowrap"
                disabled={!streamUrl || testing}
                onClick={handleTestConnection}
              >
                {testing ? (
                  <><Loader2 className="size-3.5 mr-1 animate-spin" />Testing...</>
                ) : (
                  "Test Connection"
                )}
              </Button>
            </div>
            {testResult && (
              <div className={`flex items-start gap-2 rounded-md p-2 text-xs ${testResult.success ? "bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400" : "bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400"}`}>
                {testResult.success ? <CheckCircle2 className="size-4 shrink-0 mt-0.5" /> : <XCircle className="size-4 shrink-0 mt-0.5" />}
                <div>
                  <p className="font-medium">{testResult.success ? "Connected successfully" : testResult.error}</p>
                  {testResult.detail && <p className="mt-0.5 opacity-80">{testResult.detail}</p>}
                </div>
              </div>
            )}
            {!testResult && (
              <p className="text-xs text-muted-foreground">
                Supports rtsp:// and srt:// protocols
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="editLatitude">Latitude</Label>
              <Input
                id="editLatitude"
                type="number"
                step="any"
                placeholder="e.g., 13.7563"
                value={latitude}
                onChange={(e) => setLatitude(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="editLongitude">Longitude</Label>
              <Input
                id="editLongitude"
                type="number"
                step="any"
                placeholder="e.g., 100.5018"
                value={longitude}
                onChange={(e) => setLongitude(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="editTags">Tags</Label>
            <Input
              id="editTags"
              placeholder="indoor, lobby, hd (comma-separated)"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
