"use client"

import { useEffect, useState, useCallback } from "react"
import { Save, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { apiClient } from "@/lib/api-client"

interface GlobalConfig {
  recording_mode: "continuous" | "scheduled" | "event_based"
  retention_days: number
  auto_purge: boolean
  storage_type: "local" | "s3"
  format: "fmp4" | "mkv"
  resolution: "original" | "720p" | "480p"
  max_segment_size_mb: number
}

const DEFAULT_GLOBAL_CONFIG: GlobalConfig = {
  recording_mode: "continuous",
  retention_days: 30,
  auto_purge: true,
  storage_type: "local",
  format: "fmp4",
  resolution: "original",
  max_segment_size_mb: 1024,
}

export function RecordingSettingsTab() {
  const [config, setConfig] = useState<GlobalConfig>(DEFAULT_GLOBAL_CONFIG)
  const [configLoading, setConfigLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const fetchGlobalConfig = useCallback(async () => {
    setConfigLoading(true)
    try {
      const res = await apiClient.get<{ data: GlobalConfig }>(
        "/recording-config/global",
      )
      setConfig(res.data)
    } catch {
      // Use defaults on error
    } finally {
      setConfigLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchGlobalConfig()
  }, [fetchGlobalConfig])

  async function handleSave() {
    setSaving(true)
    try {
      await apiClient.put("/recording-config/global", config)
      toast.success("Configuration saved and applied to active cameras")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save configuration")
    } finally {
      setSaving(false)
    }
  }

  if (configLoading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 bg-muted rounded" />
          <div className="h-64 bg-muted rounded" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Recording Mode */}
      <Card>
        <CardHeader>
          <CardTitle>Recording Mode</CardTitle>
          <CardDescription>
            Choose how cameras record footage. This applies to all cameras unless overridden at the site, project, or camera level.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="recording-mode">Mode</Label>
            <Select
              value={config.recording_mode}
              onValueChange={(val) =>
                setConfig((prev) => ({ ...prev, recording_mode: val as GlobalConfig["recording_mode"] }))
              }
            >
              <SelectTrigger id="recording-mode" className="w-full sm:w-[280px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="continuous">
                  <div>
                    <span className="font-medium">Continuous</span>
                    <span className="text-muted-foreground ml-2">— Record 24/7</span>
                  </div>
                </SelectItem>
                <SelectItem value="scheduled">
                  <div>
                    <span className="font-medium">Scheduled</span>
                    <span className="text-muted-foreground ml-2">— Time windows only</span>
                  </div>
                </SelectItem>
                <SelectItem value="event_based">
                  <div>
                    <span className="font-medium">Event Based</span>
                    <span className="text-muted-foreground ml-2">— On motion/trigger</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {config.recording_mode === "continuous" && "Cameras will record continuously around the clock. Best for high-security areas."}
              {config.recording_mode === "scheduled" && "Cameras will only record during configured time windows (e.g., 18:00–06:00). Saves storage."}
              {config.recording_mode === "event_based" && "Cameras will start recording when triggered by AI events like motion detection."}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Retention & Cleanup */}
      <Card>
        <CardHeader>
          <CardTitle>Retention & Cleanup</CardTitle>
          <CardDescription>
            How long recordings are kept before being automatically deleted. Limited by your plan tier.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-6 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="retention-days">Retention Period</Label>
              <Select
                value={String(config.retention_days)}
                onValueChange={(val) =>
                  setConfig((prev) => ({ ...prev, retention_days: Number(val) }))
                }
              >
                <SelectTrigger id="retention-days">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">7 days</SelectItem>
                  <SelectItem value="14">14 days</SelectItem>
                  <SelectItem value="30">30 days</SelectItem>
                  <SelectItem value="60">60 days</SelectItem>
                  <SelectItem value="90">90 days</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Recordings older than this will be deleted. Plan limits: Starter 7d, Pro 30d, Enterprise 90d.
              </p>
            </div>
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="auto-purge">Auto-purge</Label>
              <p className="text-xs text-muted-foreground">
                Automatically delete recordings and files when they exceed the retention period.
              </p>
            </div>
            <Switch
              id="auto-purge"
              checked={config.auto_purge}
              onCheckedChange={(checked) =>
                setConfig((prev) => ({ ...prev, auto_purge: checked }))
              }
            />
          </div>
        </CardContent>
      </Card>

      {/* Storage */}
      <Card>
        <CardHeader>
          <CardTitle>Storage</CardTitle>
          <CardDescription>
            Where recording files are stored. Local disk is recommended for on-premise deployments.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="storage-type">Storage Backend</Label>
            <Select
              value={config.storage_type}
              onValueChange={(val) =>
                setConfig((prev) => ({ ...prev, storage_type: val as GlobalConfig["storage_type"] }))
              }
            >
              <SelectTrigger id="storage-type" className="w-full sm:w-[280px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="local">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">Local Disk</span>
                    <Badge variant="secondary" className="text-[10px]">Recommended</Badge>
                  </div>
                </SelectItem>
                <SelectItem value="s3">
                  <span className="font-medium">S3 Compatible</span>
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {config.storage_type === "local"
                ? "Files are stored on the server's local disk. Fast access, no external dependencies."
                : "Files are stored in an S3-compatible bucket (AWS S3, MinIO). Good for cloud deployments and long-term archival."}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Quality */}
      <Card>
        <CardHeader>
          <CardTitle>Quality & Format</CardTitle>
          <CardDescription>
            Recording file format and quality settings. Lower resolution saves storage but reduces playback quality.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-6 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="format">File Format</Label>
              <Select
                value={config.format}
                onValueChange={(val) =>
                  setConfig((prev) => ({ ...prev, format: val as GlobalConfig["format"] }))
                }
              >
                <SelectTrigger id="format">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fmp4">
                    <div className="flex items-center gap-2">
                      <span>fMP4</span>
                      <Badge variant="secondary" className="text-[10px]">Recommended</Badge>
                    </div>
                  </SelectItem>
                  <SelectItem value="mkv">MKV</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                fMP4 (fragmented MP4) supports streaming playback. MKV is better for archival but requires download.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="resolution">Resolution</Label>
              <Select
                value={config.resolution}
                onValueChange={(val) =>
                  setConfig((prev) => ({ ...prev, resolution: val as GlobalConfig["resolution"] }))
                }
              >
                <SelectTrigger id="resolution">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="original">
                    <div className="flex items-center gap-2">
                      <span>Original</span>
                      <Badge variant="secondary" className="text-[10px]">No quality loss</Badge>
                    </div>
                  </SelectItem>
                  <SelectItem value="720p">720p — Saves ~50% storage</SelectItem>
                  <SelectItem value="480p">480p — Saves ~75% storage</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Original keeps the camera's native resolution. Lower resolutions reduce file size.
              </p>
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label htmlFor="max-segment-size">Max Segment Size</Label>
            <div className="flex items-center gap-2">
              <Input
                id="max-segment-size"
                type="number"
                min={1}
                max={4096}
                className="w-[120px]"
                value={config.max_segment_size_mb}
                onChange={(e) =>
                  setConfig((prev) => ({
                    ...prev,
                    max_segment_size_mb: Number(e.target.value) || 1024,
                  }))
                }
              />
              <span className="text-sm text-muted-foreground">MB</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Recording files are split into segments of this size. Smaller segments enable faster seek but create more files.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Save */}
      <div className="flex items-center gap-3 pt-2">
        <Button onClick={handleSave} disabled={saving} size="lg">
          {saving ? (
            <Loader2 className="mr-2 size-4 animate-spin" />
          ) : (
            <Save className="mr-2 size-4" />
          )}
          {saving ? "Saving..." : "Save & Apply"}
        </Button>
        <p className="text-xs text-muted-foreground">
          Changes are saved to the database and automatically synced to MediaMTX for all active cameras.
        </p>
      </div>
    </div>
  )
}
