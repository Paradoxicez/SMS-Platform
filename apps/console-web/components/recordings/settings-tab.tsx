"use client"

import { useEffect, useState, useCallback } from "react"
import { Save, Trash2, Plus, HardDrive } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
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
import { Switch } from "@/components/ui/switch"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { apiClient } from "@/lib/api-client"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface GlobalConfig {
  recording_mode: "continuous" | "scheduled" | "event_based"
  retention_days: number
  auto_purge: boolean
  storage_type: "local" | "s3"
  format: "fmp4" | "mkv"
  resolution: "original" | "720p" | "480p"
  max_segment_size_mb: number
}

interface ScopeOverride {
  id: string
  scope_type: "site" | "project" | "camera"
  scope_id: string
  scope_name: string
  settings: Partial<GlobalConfig>
}

interface StorageUsage {
  total_bytes: number
  total_count: number
  top_cameras: {
    camera_id: string
    total_bytes: number
    recording_count: number
  }[]
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B"
  const units = ["B", "KB", "MB", "GB", "TB"]
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  const value = bytes / Math.pow(1024, i)
  return `${value.toFixed(1)} ${units[i] ?? "B"}`
}

const DEFAULT_GLOBAL_CONFIG: GlobalConfig = {
  recording_mode: "continuous",
  retention_days: 30,
  auto_purge: true,
  storage_type: "local",
  format: "fmp4",
  resolution: "original",
  max_segment_size_mb: 64,
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function RecordingSettingsTab() {
  // Global config state
  const [config, setConfig] = useState<GlobalConfig>(DEFAULT_GLOBAL_CONFIG)
  const [configLoading, setConfigLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Scope overrides state
  const [overrides, setOverrides] = useState<ScopeOverride[]>([])
  const [overridesLoading, setOverridesLoading] = useState(true)
  const [scopeTab, setScopeTab] = useState<"site" | "project" | "camera">("site")
  const [showAddForm, setShowAddForm] = useState(false)
  const [newOverride, setNewOverride] = useState({
    scope_id: "",
    recording_mode: "" as string,
    retention_days: "" as string,
    auto_purge: undefined as boolean | undefined,
  })

  // Storage usage state
  const [storageUsage, setStorageUsage] = useState<StorageUsage | null>(null)
  const [storageLoading, setStorageLoading] = useState(true)

  // ---------------------------------------------------------------------------
  // Data fetching
  // ---------------------------------------------------------------------------

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

  const fetchOverrides = useCallback(async () => {
    setOverridesLoading(true)
    try {
      const res = await apiClient.get<{ data: ScopeOverride[] }>(
        "/recording-config/overrides",
      )
      setOverrides(res.data)
    } catch {
      setOverrides([])
    } finally {
      setOverridesLoading(false)
    }
  }, [])

  const fetchStorageUsage = useCallback(async () => {
    setStorageLoading(true)
    try {
      const res = await apiClient.get<{ data: StorageUsage }>(
        "/recording-config/storage-usage",
      )
      setStorageUsage(res.data)
    } catch {
      setStorageUsage(null)
    } finally {
      setStorageLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchGlobalConfig()
    fetchOverrides()
    fetchStorageUsage()
  }, [fetchGlobalConfig, fetchOverrides, fetchStorageUsage])

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  async function handleSaveGlobal() {
    setSaving(true)
    setSaveSuccess(false)
    setSaveError(null)
    try {
      await apiClient.put("/recording-config/global", config)
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
    } catch (err) {
      setSaveError(
        err instanceof Error ? err.message : "Failed to save configuration.",
      )
    } finally {
      setSaving(false)
    }
  }

  async function handleAddOverride() {
    if (!newOverride.scope_id.trim()) return
    try {
      const settings: Partial<GlobalConfig> = {}
      if (newOverride.recording_mode) {
        settings.recording_mode = newOverride.recording_mode as GlobalConfig["recording_mode"]
      }
      if (newOverride.retention_days) {
        settings.retention_days = Number(newOverride.retention_days)
      }
      if (newOverride.auto_purge !== undefined) {
        settings.auto_purge = newOverride.auto_purge
      }

      await apiClient.post("/recording-config/overrides", {
        scope_type: scopeTab,
        scope_id: newOverride.scope_id.trim(),
        settings,
      })
      setShowAddForm(false)
      setNewOverride({ scope_id: "", recording_mode: "", retention_days: "", auto_purge: undefined })
      fetchOverrides()
    } catch {
      // Silently fail for now
    }
  }

  async function handleRemoveOverride(id: string) {
    try {
      await apiClient.delete(`/recording-config/overrides/${id}`)
      fetchOverrides()
    } catch {
      // Silently fail for now
    }
  }

  // ---------------------------------------------------------------------------
  // Render helpers
  // ---------------------------------------------------------------------------

  function renderOverridesList(scopeType: "site" | "project" | "camera") {
    const filtered = overrides.filter((o) => o.scope_type === scopeType)

    if (overridesLoading) {
      return (
        <div className="animate-pulse space-y-2 py-4">
          <div className="h-8 bg-muted rounded" />
          <div className="h-8 bg-muted rounded" />
        </div>
      )
    }

    if (filtered.length === 0 && !showAddForm) {
      return (
        <p className="text-sm text-muted-foreground py-4">
          No overrides configured for this scope.
        </p>
      )
    }

    return (
      <div className="space-y-3">
        {filtered.map((override) => (
          <div
            key={override.id}
            className="flex items-center justify-between rounded-md border p-3"
          >
            <div className="space-y-1">
              <p className="text-sm font-medium">
                {override.scope_name || override.scope_id}
              </p>
              <div className="flex flex-wrap gap-1">
                {override.settings.recording_mode && (
                  <Badge variant="outline" className="text-xs">
                    Mode: {override.settings.recording_mode}
                  </Badge>
                )}
                {override.settings.retention_days && (
                  <Badge variant="outline" className="text-xs">
                    Retention: {override.settings.retention_days}d
                  </Badge>
                )}
                {override.settings.auto_purge !== undefined && (
                  <Badge variant="outline" className="text-xs">
                    Auto-purge: {override.settings.auto_purge ? "on" : "off"}
                  </Badge>
                )}
                {override.settings.storage_type && (
                  <Badge variant="outline" className="text-xs">
                    Storage: {override.settings.storage_type}
                  </Badge>
                )}
                {override.settings.format && (
                  <Badge variant="outline" className="text-xs">
                    Format: {override.settings.format}
                  </Badge>
                )}
                {override.settings.resolution && (
                  <Badge variant="outline" className="text-xs">
                    Res: {override.settings.resolution}
                  </Badge>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm">
                Edit
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleRemoveOverride(override.id)}
              >
                <Trash2 className="size-4 text-destructive" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // Loading state
  // ---------------------------------------------------------------------------

  if (configLoading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 bg-muted rounded" />
          <div className="h-64 bg-muted rounded" />
          <div className="h-48 bg-muted rounded" />
        </div>
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // Main render
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-6">
      {/* Section 1: Global Defaults */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HardDrive className="size-5" />
            Global Recording Defaults
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 sm:grid-cols-2">
            {/* Recording Mode */}
            <div className="space-y-2">
              <Label htmlFor="recording-mode">Recording Mode</Label>
              <Select
                value={config.recording_mode}
                onValueChange={(val) =>
                  setConfig((prev) => ({
                    ...prev,
                    recording_mode: val as GlobalConfig["recording_mode"],
                  }))
                }
              >
                <SelectTrigger id="recording-mode">
                  <SelectValue placeholder="Select mode" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="continuous">Continuous</SelectItem>
                  <SelectItem value="scheduled">Scheduled</SelectItem>
                  <SelectItem value="event_based">Event Based</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Default Retention */}
            <div className="space-y-2">
              <Label htmlFor="retention-days">Default Retention</Label>
              <Select
                value={String(config.retention_days)}
                onValueChange={(val) =>
                  setConfig((prev) => ({
                    ...prev,
                    retention_days: Number(val),
                  }))
                }
              >
                <SelectTrigger id="retention-days">
                  <SelectValue placeholder="Select retention" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">7 days</SelectItem>
                  <SelectItem value="14">14 days</SelectItem>
                  <SelectItem value="30">30 days</SelectItem>
                  <SelectItem value="60">60 days</SelectItem>
                  <SelectItem value="90">90 days</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Auto-purge */}
            <div className="flex items-center justify-between rounded-md border p-3">
              <div className="space-y-0.5">
                <Label htmlFor="auto-purge">Auto-purge</Label>
                <p className="text-xs text-muted-foreground">
                  Automatically delete recordings past retention period
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

            {/* Storage Type */}
            <div className="space-y-2">
              <Label htmlFor="storage-type">Storage Type</Label>
              <Select
                value={config.storage_type}
                onValueChange={(val) =>
                  setConfig((prev) => ({
                    ...prev,
                    storage_type: val as GlobalConfig["storage_type"],
                  }))
                }
              >
                <SelectTrigger id="storage-type">
                  <SelectValue placeholder="Select storage" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="local">Local</SelectItem>
                  <SelectItem value="s3">S3</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Format */}
            <div className="space-y-2">
              <Label htmlFor="format">Format</Label>
              <Select
                value={config.format}
                onValueChange={(val) =>
                  setConfig((prev) => ({
                    ...prev,
                    format: val as GlobalConfig["format"],
                  }))
                }
              >
                <SelectTrigger id="format">
                  <SelectValue placeholder="Select format" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fmp4">fMP4</SelectItem>
                  <SelectItem value="mkv">MKV</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Resolution */}
            <div className="space-y-2">
              <Label htmlFor="resolution">Resolution</Label>
              <Select
                value={config.resolution}
                onValueChange={(val) =>
                  setConfig((prev) => ({
                    ...prev,
                    resolution: val as GlobalConfig["resolution"],
                  }))
                }
              >
                <SelectTrigger id="resolution">
                  <SelectValue placeholder="Select resolution" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="original">Original</SelectItem>
                  <SelectItem value="720p">720p</SelectItem>
                  <SelectItem value="480p">480p</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Max Segment Size */}
            <div className="space-y-2">
              <Label htmlFor="max-segment-size">Max Segment Size (MB)</Label>
              <Input
                id="max-segment-size"
                type="number"
                min={1}
                value={config.max_segment_size_mb}
                onChange={(e) =>
                  setConfig((prev) => ({
                    ...prev,
                    max_segment_size_mb: Number(e.target.value) || 1,
                  }))
                }
              />
            </div>
          </div>

          {/* Save feedback + button */}
          <div className="mt-6 flex items-center gap-3">
            <Button onClick={handleSaveGlobal} disabled={saving}>
              <Save className="mr-2 size-4" />
              {saving ? "Saving..." : "Save Defaults"}
            </Button>
            {saveSuccess && (
              <p className="text-sm text-green-600 dark:text-green-400">
                Configuration saved successfully.
              </p>
            )}
            {saveError && (
              <p className="text-sm text-destructive">{saveError}</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Section 2: Scope Overrides */}
      <Card>
        <CardHeader>
          <CardTitle>Scope Overrides</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs
            value={scopeTab}
            onValueChange={(val) => {
              setScopeTab(val as "site" | "project" | "camera")
              setShowAddForm(false)
            }}
          >
            <TabsList>
              <TabsTrigger value="site">Site</TabsTrigger>
              <TabsTrigger value="project">Project</TabsTrigger>
              <TabsTrigger value="camera">Camera</TabsTrigger>
            </TabsList>

            {(["site", "project", "camera"] as const).map((scope) => (
              <TabsContent key={scope} value={scope} className="space-y-4">
                {renderOverridesList(scope)}

                {/* Add Override Form */}
                {showAddForm && scopeTab === scope ? (
                  <div className="rounded-md border p-4 space-y-4">
                    <p className="text-sm font-medium">
                      Add {scope} override
                    </p>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label>
                          {scope === "site"
                            ? "Site ID"
                            : scope === "project"
                              ? "Project ID"
                              : "Camera ID"}
                        </Label>
                        <Input
                          placeholder={`Enter ${scope} ID`}
                          value={newOverride.scope_id}
                          onChange={(e) =>
                            setNewOverride((prev) => ({
                              ...prev,
                              scope_id: e.target.value,
                            }))
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Recording Mode (optional)</Label>
                        <Select
                          value={newOverride.recording_mode}
                          onValueChange={(val) =>
                            setNewOverride((prev) => ({
                              ...prev,
                              recording_mode: val,
                            }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Inherit default" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="continuous">
                              Continuous
                            </SelectItem>
                            <SelectItem value="scheduled">Scheduled</SelectItem>
                            <SelectItem value="event_based">
                              Event Based
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Retention Days (optional)</Label>
                        <Select
                          value={newOverride.retention_days}
                          onValueChange={(val) =>
                            setNewOverride((prev) => ({
                              ...prev,
                              retention_days: val,
                            }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Inherit default" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="7">7 days</SelectItem>
                            <SelectItem value="14">14 days</SelectItem>
                            <SelectItem value="30">30 days</SelectItem>
                            <SelectItem value="60">60 days</SelectItem>
                            <SelectItem value="90">90 days</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex items-center gap-3 rounded-md border p-3">
                        <Label>Auto-purge</Label>
                        <Switch
                          checked={newOverride.auto_purge ?? false}
                          onCheckedChange={(checked) =>
                            setNewOverride((prev) => ({
                              ...prev,
                              auto_purge: checked,
                            }))
                          }
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button size="sm" onClick={handleAddOverride}>
                        Save Override
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setShowAddForm(false)
                          setNewOverride({
                            scope_id: "",
                            recording_mode: "",
                            retention_days: "",
                            auto_purge: undefined,
                          })
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  scopeTab === scope && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowAddForm(true)}
                    >
                      <Plus className="mr-2 size-4" />
                      Add Override
                    </Button>
                  )
                )}
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>

      {/* Section 3: Storage Usage */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HardDrive className="size-5" />
            Storage Usage
          </CardTitle>
        </CardHeader>
        <CardContent>
          {storageLoading ? (
            <div className="animate-pulse space-y-3">
              <div className="h-6 w-64 bg-muted rounded" />
              <div className="h-32 bg-muted rounded" />
            </div>
          ) : storageUsage ? (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-6">
                <div>
                  <p className="text-sm text-muted-foreground">Total Used</p>
                  <p className="text-2xl font-bold">
                    {formatBytes(storageUsage.total_bytes)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">
                    Total Recordings
                  </p>
                  <p className="text-2xl font-bold">
                    {storageUsage.total_count.toLocaleString()}
                  </p>
                </div>
              </div>

              {storageUsage.top_cameras.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">
                    Top 5 Cameras by Storage
                  </p>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Camera ID</TableHead>
                        <TableHead className="text-right">Size</TableHead>
                        <TableHead className="text-right">
                          Recordings
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {storageUsage.top_cameras.map((cam) => (
                        <TableRow key={cam.camera_id}>
                          <TableCell className="font-mono text-xs">
                            {cam.camera_id}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatBytes(cam.total_bytes)}
                          </TableCell>
                          <TableCell className="text-right">
                            {cam.recording_count.toLocaleString()}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Storage usage data is unavailable.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
