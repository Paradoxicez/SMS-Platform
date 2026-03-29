"use client"

import { useEffect, useState, useCallback } from "react"
import { useParams } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { useCameraStatusStream } from "@/hooks/use-camera-status-stream"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { MoreHorizontal, Camera as CameraIcon, MapPin, RefreshCw, Video } from "lucide-react"
import { BreadcrumbNav } from "@/components/breadcrumb-nav"
import { SiteDialog } from "@/components/sites/site-dialog"
import { RecordingSettingsDialog } from "@/components/recordings/recording-settings-dialog"
import { AddCameraDialog } from "@/components/cameras/add-camera-dialog"
import { apiClient, type StreamProfile } from "@/lib/api-client"
import { toast } from "sonner"
import { formatDate } from "@/lib/format-date"
import type { Site, Camera } from "@repo/types"

type HealthStatus = Camera["health_status"]

function StatusBadge({ status }: { status: HealthStatus }) {
  switch (status) {
    case "online":
      return (
        <Badge className="bg-green-100 text-green-700 hover:bg-green-200">
          Online
        </Badge>
      )
    case "offline":
      return <Badge variant="destructive">Offline</Badge>
    case "degraded":
      return (
        <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-200">
          Degraded
        </Badge>
      )
    case "connecting":
      return (
        <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-200">
          Connecting
        </Badge>
      )
    case "stopping":
      return (
        <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-200 animate-pulse">
          Stopping
        </Badge>
      )
    case "stopped":
      return <Badge variant="secondary">Stopped</Badge>
    default:
      return <Badge variant="outline">{status}</Badge>
  }
}

export default function SiteDetailPage() {
  const params = useParams()
  const siteId = params.id as string

  const [site, setSite] = useState<Site | null>(null)
  const [cameras, setCameras] = useState<Camera[]>([])
  const [loading, setLoading] = useState(true)
  const [projectName, setProjectName] = useState("")

  // Stream profiles
  const [profiles, setProfiles] = useState<StreamProfile[]>([])
  const [selectedProfileId, setSelectedProfileId] = useState("")
  const [applyingProfile, setApplyingProfile] = useState(false)

  // Edit site dialog
  const [editOpen, setEditOpen] = useState(false)

  // Add camera dialog
  const [cameraDialogOpen, setCameraDialogOpen] = useState(false)

  // Recording settings
  const [recordingSettingsOpen, setRecordingSettingsOpen] = useState(false)

  // Real-time camera status updates
  useCameraStatusStream((event) => {
    setCameras((prev) =>
      prev.map((cam) =>
        cam.id === event.camera_id
          ? { ...cam, health_status: event.new_state as Camera["health_status"] }
          : cam,
      ),
    )
  })

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const siteRes = await apiClient.getSite(siteId)
      setSite(siteRes.data)
      setSelectedProfileId(siteRes.data.default_profile_id ?? "")

      // Fetch cameras for this site
      const camerasRes = await apiClient.listCameras({ site_id: siteId, per_page: 100 })
      setCameras(camerasRes.data ?? [])

      // Fetch parent project name
      if (siteRes.data.project_id) {
        try {
          const projectRes = await apiClient.getProject(siteRes.data.project_id)
          setProjectName(projectRes.data.name)
        } catch {
          setProjectName("Unknown Project")
        }
      }
    } catch {
      setSite(null)
      setCameras([])
    } finally {
      setLoading(false)
    }
  }, [siteId])

  // Fetch profiles on mount
  useEffect(() => {
    apiClient.listProfiles().then((res) => {
      setProfiles(res.data ?? [])
    }).catch(() => {})
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  async function handleEditSite(data: {
    name: string
    address?: string
    lat?: number
    lng?: number
    timezone?: string
  }) {
    await apiClient.updateSite(siteId, data)
    toast.success("Site Updated")
    fetchData()
  }

  async function handleProfileChange(profileId: string) {
    setSelectedProfileId(profileId)
    try {
      await apiClient.updateSite(siteId, {
        default_profile_id: profileId || null,
      })
      toast.success("Default profile updated")
      fetchData()
    } catch (err) {
      toast.error("Error", {
        description: err instanceof Error ? err.message : "Failed to update default profile.",
      })
    }
  }

  async function handleApplyProfile() {
    const cameraCount = cameras.length
    if (cameraCount === 0) {
      toast.error("No cameras in this site")
      return
    }
    const profileName = profiles.find((p) => p.id === selectedProfileId)?.name ?? "selected profile"
    if (
      !confirm(
        `This will change the profile for ${cameraCount} camera${cameraCount !== 1 ? "s" : ""} in this site. Continue?`,
      )
    )
      return

    setApplyingProfile(true)
    try {
      const res = await apiClient.applySiteProfile(siteId)
      toast.success(`${res.data.cameras_updated} camera${res.data.cameras_updated !== 1 ? "s" : ""} updated to ${profileName}`)
      fetchData()
    } catch (err) {
      toast.error("Error", {
        description: err instanceof Error ? err.message : "Failed to apply profile.",
      })
    } finally {
      setApplyingProfile(false)
    }
  }

  async function handleDeleteCamera(id: string) {
    if (!confirm("Delete this camera?")) return
    try {
      await apiClient.deleteCamera(id)
      toast.success("Camera Deleted")
      fetchData()
    } catch (err) {
      toast.error("Error", {
        description: err instanceof Error ? err.message : "Failed to delete camera.",
      })
    }
  }

  function maskRtspUrl(url: string) {
    try {
      const parsed = new URL(url)
      return `rtsp://***@${parsed.hostname}:***`
    } catch {
      return "***"
    }
  }

  if (loading) {
    return (
      <div className="flex h-32 items-center justify-center text-muted-foreground">
        Loading site...
      </div>
    )
  }

  if (!site) {
    return (
      <div className="flex h-32 items-center justify-center text-muted-foreground">
        Site not found.
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <BreadcrumbNav
        items={[
          { label: "Projects", href: "/projects" },
          { label: projectName || "Project", href: site.project_id ? `/projects/${site.project_id}` : "/projects" },
          { label: "Sites" },
          { label: site.name },
        ]}
      />

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">{site.name}</h1>
          <div className="mt-2 space-y-1 text-sm text-muted-foreground">
            {site.address && (
              <p className="flex items-center gap-1">
                <MapPin className="size-3.5" /> {site.address}
              </p>
            )}
            {site.lat != null && site.lng != null && (
              <p>
                Coordinates: {site.lat}, {site.lng}
              </p>
            )}
            <p>Timezone: {site.timezone ?? "UTC"}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setRecordingSettingsOpen(true)}>
            <Video className="mr-1.5 size-4" />
            Recording Settings
          </Button>
          <Button variant="outline" onClick={() => setEditOpen(true)}>
            Edit
          </Button>
        </div>
      </div>

      {/* Default Stream Profile */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Default Stream Profile</h2>
        <div className="flex items-end gap-3">
          <div className="w-[280px] space-y-1.5">
            <Label>Profile</Label>
            <Select value={selectedProfileId} onValueChange={handleProfileChange}>
              <SelectTrigger>
                <SelectValue placeholder="None (use tenant default)" />
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
          <Button
            variant="outline"
            size="sm"
            disabled={!selectedProfileId || applyingProfile}
            onClick={handleApplyProfile}
          >
            <RefreshCw className={`mr-1.5 size-3.5 ${applyingProfile ? "animate-spin" : ""}`} />
            {applyingProfile ? "Applying..." : "Apply to All Cameras"}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          New cameras added to this site will use this profile by default.
        </p>
      </div>

      {/* Cameras Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Cameras</h2>
          <Button size="sm" onClick={() => setCameraDialogOpen(true)}>
            Add Camera
          </Button>
        </div>

        {cameras.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12">
            <div className="flex size-10 items-center justify-center rounded-full bg-muted">
              <CameraIcon className="size-5 text-muted-foreground" />
            </div>
            <h3 className="mt-3 text-base font-semibold">No cameras yet</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Add a camera to start monitoring this site.
            </p>
            <Button className="mt-3" size="sm" onClick={() => setCameraDialogOpen(true)}>
              Add Camera
            </Button>
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>RTSP URL</TableHead>
                  <TableHead>Created at</TableHead>
                  <TableHead className="w-[60px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cameras.map((camera) => (
                  <TableRow key={camera.id}>
                    <TableCell className="font-medium">{camera.name}</TableCell>
                    <TableCell>
                      <StatusBadge status={camera.health_status} />
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {maskRtspUrl(camera.rtsp_url)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(camera.created_at instanceof Date ? camera.created_at.toISOString() : camera.created_at)}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="size-8">
                            <MoreHorizontal className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            className="text-red-600"
                            onClick={() => handleDeleteCamera(camera.id)}
                          >
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Edit Site Dialog */}
      <SiteDialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
        onSave={handleEditSite}
        initialData={{
          name: site.name,
          address: site.address ?? undefined,
          lat: site.lat,
          lng: site.lng,
          timezone: site.timezone ?? "UTC",
        }}
      />

      {/* Add Camera Dialog */}
      <AddCameraDialog
        open={cameraDialogOpen}
        onOpenChange={setCameraDialogOpen}
        onSuccess={() => {
          setCameraDialogOpen(false)
          fetchData()
        }}
        siteId={siteId}
      />

      {/* Recording Settings Dialog */}
      {site && (
        <RecordingSettingsDialog
          open={recordingSettingsOpen}
          onOpenChange={setRecordingSettingsOpen}
          scopeType="site"
          scopeId={site.id}
          scopeName={site.name}
        />
      )}
    </div>
  )
}
