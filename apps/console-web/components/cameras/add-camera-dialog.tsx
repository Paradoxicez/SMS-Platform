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
import type { Project, Site } from "@repo/types";

interface AddCameraDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  siteId?: string;
}

export function AddCameraDialog({
  open,
  onOpenChange,
  onSuccess,
  siteId: defaultSiteId,
}: AddCameraDialogProps) {
  const [submitting, setSubmitting] = useState(false);

  const [projects, setProjects] = useState<Project[]>([]);
  const [sitesForProject, setSitesForProject] = useState<Site[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");

  const [streamUrl, setStreamUrl] = useState("");
  const [name, setName] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [tags, setTags] = useState("");
  const [siteId, setSiteId] = useState(defaultSiteId ?? "");
  const [srtMode, setSrtMode] = useState<string>("caller");
  const [profiles, setProfiles] = useState<StreamProfile[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState("");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; error?: string; detail?: string } | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeResult, setAnalyzeResult] = useState<{
    codec: string | null;
    resolution: string | null;
    fps: number | null;
    audio: string | null;
  } | null>(null);

  const isSrt = streamUrl.startsWith("srt://");

  const handleAnalyze = useCallback(async () => {
    if (!streamUrl || !streamUrl.startsWith("rtsp://")) return;
    setAnalyzing(true);
    try {
      const res = await apiClient.post<{ data: { codec: string | null; resolution: string | null; fps: number | null; audio: string | null } }>(
        "/cameras/analyze",
        { rtsp_url: streamUrl },
      );
      setAnalyzeResult(res.data);
    } catch {
      setAnalyzeResult(null);
    } finally {
      setAnalyzing(false);
    }
  }, [streamUrl]);

  // Auto-analyze when RTSP URL changes (debounce 2s)
  useEffect(() => {
    if (!streamUrl || !streamUrl.startsWith("rtsp://") || streamUrl.length < 15) {
      setAnalyzeResult(null);
      return;
    }
    const timer = setTimeout(() => {
      handleAnalyze();
    }, 2000);
    return () => clearTimeout(timer);
  }, [streamUrl, handleAnalyze]);

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

  // Fetch projects on mount
  useEffect(() => {
    if (defaultSiteId) return; // Skip if site is pre-selected
    apiClient.listProjects(1, 100).then((res) => {
      setProjects(res.data ?? []);
    }).catch(() => {});
  }, [defaultSiteId]);

  // Fetch profiles on mount
  useEffect(() => {
    apiClient.listProfiles().then((res) => {
      setProfiles(res.data ?? []);
    }).catch(() => {});
  }, []);

  // Auto-select profile when siteId changes
  useEffect(() => {
    if (!siteId) return;
    apiClient.getSite(siteId).then((res) => {
      if (res.data.default_profile_id) {
        setSelectedProfileId(res.data.default_profile_id);
      }
    }).catch(() => {});
  }, [siteId]);

  // Fetch sites when project changes
  useEffect(() => {
    if (!selectedProjectId || defaultSiteId) return;
    setSiteId("");
    apiClient.listSites(selectedProjectId, 1, 100).then((res) => {
      setSitesForProject(res.data ?? []);
    }).catch(() => {
      setSitesForProject([]);
    });
  }, [selectedProjectId, defaultSiteId]);

  function resetForm() {
    setStreamUrl("");
    setName("");
    setLatitude("");
    setLongitude("");
    setTags("");
    setSelectedProfileId("");
    if (!defaultSiteId) {
      setSiteId("");
      setSelectedProjectId("");
      setSitesForProject([]);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!streamUrl || !name || !siteId) {
      toast.error("Validation Error", {
        description: "Stream URL, camera name, and site are required.",
      });
      return;
    }

    if (!streamUrl.startsWith("rtsp://") && !streamUrl.startsWith("srt://")) {
      toast.error("Validation Error", {
        description: "Stream URL must start with rtsp:// or srt://",
      });
      return;
    }

    setSubmitting(true);

    try {
      const tagList = tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);

      await apiClient.createCamera(siteId, {
        name,
        rtsp_url: streamUrl,
        lat: latitude ? parseFloat(latitude) : undefined,
        lng: longitude ? parseFloat(longitude) : undefined,
        tags: tagList.length > 0 ? tagList : undefined,
        profile_id: selectedProfileId || undefined,
      });

      toast.success("Camera Added", {
        description: `Camera "${name}" has been onboarded and stream validation is in progress.`,
      });

      resetForm();
      onSuccess();
    } catch (err) {
      toast.error("Error", {
        description:
          err instanceof Error ? err.message : "Failed to add camera.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add Camera</DialogTitle>
          <DialogDescription>
            Onboard a new camera by providing its stream connection details. The
            platform supports RTSP and SRT protocols and will validate the
            connection automatically.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {!defaultSiteId && (
            <>
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="projectSelect">
                  Project *
                </label>
                <Select
                  value={selectedProjectId}
                  onValueChange={setSelectedProjectId}
                >
                  <SelectTrigger id="projectSelect">
                    <SelectValue placeholder="Select a project" />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="siteSelect">
                  Site *
                </label>
                <Select
                  value={siteId}
                  onValueChange={setSiteId}
                  disabled={!selectedProjectId}
                >
                  <SelectTrigger id="siteSelect">
                    <SelectValue placeholder={selectedProjectId ? "Select a site" : "Select a project first"} />
                  </SelectTrigger>
                  <SelectContent>
                    {sitesForProject.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          <div className="space-y-2">
            <Label>Stream Profile</Label>
            <Select value={selectedProfileId} onValueChange={setSelectedProfileId}>
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
            <p className="text-xs text-muted-foreground">
              Output configuration for this camera. Leave empty to use the site or tenant default.
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="name">
              Camera Name *
            </label>
            <Input
              id="name"
              placeholder="e.g., Lobby Entrance Camera"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="streamUrl">
              Stream URL *
            </label>
            <div className="flex gap-2">
              <Input
                id="streamUrl"
                placeholder="rtsp://camera-ip:554/stream"
                value={streamUrl}
                onChange={(e) => {
                  setStreamUrl(e.target.value);
                  setTestResult(null);
                  setAnalyzeResult(null);
                }}
                required
                className="flex-1"
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
            {!testResult && !analyzeResult && !analyzing && (
              <p className="text-xs text-muted-foreground">
                Supports rtsp:// and srt:// protocols
              </p>
            )}
            {(analyzing || analyzeResult) && (
              <div className="rounded-md border p-2 text-xs space-y-1">
                {analyzing ? (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="size-3.5 animate-spin" />
                    Analyzing stream source...
                  </div>
                ) : analyzeResult?.codec ? (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="font-medium">Source Info</span>
                      <Button type="button" variant="ghost" size="sm" className="h-5 text-[10px] px-1.5" onClick={handleAnalyze}>
                        Re-analyze
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-muted-foreground">
                      <span>Codec: <span className="text-foreground font-medium">{analyzeResult.codec}</span></span>
                      <span>Resolution: <span className="text-foreground font-medium">{analyzeResult.resolution ?? "Unknown"}</span></span>
                      {analyzeResult.fps && <span>FPS: <span className="text-foreground font-medium">{analyzeResult.fps}</span></span>}
                      <span>Audio: <span className="text-foreground font-medium">{analyzeResult.audio ?? "None"}</span></span>
                    </div>
                    {analyzeResult.codec === "H265" && (
                      <p className="text-yellow-600 font-medium mt-1">
                        H265 detected — auto transcode to H264 will be enabled for browser compatibility
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-muted-foreground">Could not detect stream info. Check the URL and try again.</p>
                )}
              </div>
            )}
          </div>

          {isSrt && (
            <div className="space-y-2">
              <label className="text-sm font-medium">SRT Mode</label>
              <Select value={srtMode} onValueChange={setSrtMode}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="caller">Caller</SelectItem>
                  <SelectItem value="listener">Listener</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Caller: the server connects to the camera. Listener: the camera connects to the server.
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="latitude">
                Latitude
              </label>
              <Input
                id="latitude"
                type="number"
                step="any"
                placeholder="e.g., 13.7563"
                value={latitude}
                onChange={(e) => setLatitude(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="longitude">
                Longitude
              </label>
              <Input
                id="longitude"
                type="number"
                step="any"
                placeholder="e.g., 100.5018"
                value={longitude}
                onChange={(e) => setLongitude(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="tags">
              Tags
            </label>
            <Input
              id="tags"
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
              {submitting ? "Adding..." : "Add Camera"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
