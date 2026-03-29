"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { apiClient } from "@/lib/api-client"
import { Save, Trash2 } from "lucide-react"

export type ScopeType = "global" | "site" | "project" | "camera"

interface RecordingSettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  scopeType: ScopeType
  scopeId: string
  scopeName: string
  onSaved?: () => void
}

interface ConfigData {
  mode: string
  retentionDays: number
  autoPurge: boolean
  storageType: string
  format: string
  resolution: string
  maxSegmentSizeMb: number
  enabled: boolean
  inheritedFrom: string
}

const DEFAULT_CONFIG: ConfigData = {
  mode: "continuous",
  retentionDays: 30,
  autoPurge: true,
  storageType: "local",
  format: "fmp4",
  resolution: "original",
  maxSegmentSizeMb: 1024,
  enabled: true,
  inheritedFrom: "default",
}

export function RecordingSettingsDialog({
  open,
  onOpenChange,
  scopeType,
  scopeId,
  scopeName,
  onSaved,
}: RecordingSettingsDialogProps) {
  const [hasOverride, setHasOverride] = useState(false)
  const [config, setConfig] = useState<ConfigData>(DEFAULT_CONFIG)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return

    async function fetchConfig() {
      setLoading(true)
      try {
        const res = await apiClient.get<{
          data: {
            mode?: string
            retentionDays?: number
            retention_days?: number
            autoPurge?: boolean
            auto_purge?: boolean
            storageType?: string
            storage_type?: string
            format?: string
            resolution?: string
            maxSegmentSizeMb?: number
            max_segment_size_mb?: number
            enabled?: boolean
            inheritedFrom?: string
            inherited_from?: string
          }
        }>(`/recording-config/${scopeType}/${scopeId}`)

        const d = res.data
        const inherited = d.inheritedFrom ?? d.inherited_from ?? "default"
        setConfig({
          mode: d.mode ?? "continuous",
          retentionDays: d.retentionDays ?? d.retention_days ?? 30,
          autoPurge: d.autoPurge ?? d.auto_purge ?? true,
          storageType: d.storageType ?? d.storage_type ?? "local",
          format: d.format ?? "fmp4",
          resolution: d.resolution ?? "original",
          maxSegmentSizeMb: d.maxSegmentSizeMb ?? d.max_segment_size_mb ?? 1024,
          enabled: d.enabled ?? true,
          inheritedFrom: inherited,
        })
        // Has override if inherited from this scope type
        setHasOverride(inherited === scopeType)
      } catch {
        setConfig(DEFAULT_CONFIG)
        setHasOverride(false)
      } finally {
        setLoading(false)
      }
    }

    fetchConfig()
  }, [open, scopeType, scopeId])

  async function handleSave() {
    setSaving(true)
    try {
      await apiClient.put(`/recording-config/${scopeType}/${scopeId}`, {
        mode: config.mode,
        retentionDays: config.retentionDays,
        autoPurge: config.autoPurge,
        storageType: config.storageType,
        format: config.format,
        resolution: config.resolution,
        maxSegmentSizeMb: config.maxSegmentSizeMb,
        enabled: config.enabled,
      })
      setHasOverride(true)
      onSaved?.()
      onOpenChange(false)
    } catch {
      // Error
    } finally {
      setSaving(false)
    }
  }

  async function handleRemoveOverride() {
    setSaving(true)
    try {
      await apiClient.delete(`/recording-config/${scopeType}/${scopeId}`)
      setHasOverride(false)
      onSaved?.()
      onOpenChange(false)
    } catch {
      // Error
    } finally {
      setSaving(false)
    }
  }

  const scopeLabel =
    scopeType === "site" ? "Site" :
    scopeType === "project" ? "Project" :
    scopeType === "camera" ? "Camera" : "Global"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Recording Settings
            <Badge variant="outline" className="font-normal">{scopeLabel}</Badge>
          </DialogTitle>
          <DialogDescription>
            {scopeName}
            {config.inheritedFrom !== scopeType && config.inheritedFrom !== "default" && (
              <span className="block mt-1 text-xs">
                Currently inheriting from: <strong>{config.inheritedFrom}</strong>
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-8 flex justify-center">
            <div className="size-6 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Override toggle */}
            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <p className="text-sm font-medium">Override settings</p>
                <p className="text-xs text-muted-foreground">
                  Customize recording config for this {scopeLabel.toLowerCase()}
                </p>
              </div>
              <Switch
                checked={hasOverride}
                onCheckedChange={(checked) => {
                  setHasOverride(checked)
                  if (!checked) handleRemoveOverride()
                }}
              />
            </div>

            {hasOverride && (
              <>
                {/* Mode */}
                <div className="space-y-1.5">
                  <Label className="text-xs">Recording Mode</Label>
                  <Select value={config.mode} onValueChange={(v) => setConfig((c) => ({ ...c, mode: v }))}>
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="continuous">Continuous (24/7)</SelectItem>
                      <SelectItem value="scheduled">Scheduled</SelectItem>
                      <SelectItem value="event_based">Event-based</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Retention */}
                <div className="space-y-1.5">
                  <Label className="text-xs">Retention</Label>
                  <Select
                    value={String(config.retentionDays)}
                    onValueChange={(v) => setConfig((c) => ({ ...c, retentionDays: Number(v) }))}
                  >
                    <SelectTrigger className="h-9">
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
                </div>

                {/* Auto-purge */}
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Auto-purge expired recordings</Label>
                  <Switch
                    checked={config.autoPurge}
                    onCheckedChange={(v) => setConfig((c) => ({ ...c, autoPurge: v }))}
                  />
                </div>

                {/* Storage */}
                <div className="space-y-1.5">
                  <Label className="text-xs">Storage Type</Label>
                  <Select value={config.storageType} onValueChange={(v) => setConfig((c) => ({ ...c, storageType: v }))}>
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="local">Local Disk</SelectItem>
                      <SelectItem value="s3">S3 Compatible</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Format + Resolution in row */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Format</Label>
                    <Select value={config.format} onValueChange={(v) => setConfig((c) => ({ ...c, format: v }))}>
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="fmp4">fMP4</SelectItem>
                        <SelectItem value="mkv">MKV</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Resolution</Label>
                    <Select value={config.resolution} onValueChange={(v) => setConfig((c) => ({ ...c, resolution: v }))}>
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="original">Original</SelectItem>
                        <SelectItem value="720p">720p</SelectItem>
                        <SelectItem value="480p">480p</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Max segment */}
                <div className="space-y-1.5">
                  <Label className="text-xs">Max Segment Size (MB)</Label>
                  <Input
                    type="number"
                    className="h-9"
                    value={config.maxSegmentSizeMb}
                    onChange={(e) => setConfig((c) => ({ ...c, maxSegmentSizeMb: Number(e.target.value) || 1024 }))}
                  />
                </div>
              </>
            )}

            {/* Inherit info */}
            {!hasOverride && (
              <p className="text-xs text-muted-foreground bg-muted p-3 rounded-md">
                This {scopeLabel.toLowerCase()} inherits recording settings from{" "}
                <strong>{config.inheritedFrom === "default" ? "global defaults" : config.inheritedFrom}</strong>
                : {config.mode}, {config.retentionDays} days retention, {config.storageType} storage.
              </p>
            )}
          </div>
        )}

        <DialogFooter className="gap-2">
          {hasOverride && (
            <Button
              variant="ghost"
              size="sm"
              className="mr-auto text-destructive hover:text-destructive"
              onClick={handleRemoveOverride}
              disabled={saving}
            >
              <Trash2 className="size-3.5 mr-1" />
              Remove Override
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          {hasOverride && (
            <Button onClick={handleSave} disabled={saving} className="gap-1">
              <Save className="size-3.5" />
              {saving ? "Saving..." : "Save"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
