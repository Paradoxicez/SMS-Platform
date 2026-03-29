"use client"

import { useEffect, useState, useCallback } from "react"
import { useCameraStatusStream } from "@/hooks/use-camera-status-stream"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  FolderKanban,
  MoreHorizontal,
  ChevronRight,
  Building2,
  Camera,
  Plus,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react"
import { apiClient } from "@/lib/api-client"
import { toast } from "sonner"
import { SiteDialog } from "@/components/sites/site-dialog"
import { AddCameraDialog } from "@/components/cameras/add-camera-dialog"
import { EditCameraDialog } from "@/components/cameras/edit-camera-dialog"
import { RecordingSettingsDialog } from "@/components/recordings/recording-settings-dialog"
import { SortableTableHead, useTableSort } from "@/components/ui/sortable-table-head"
import { TablePagination, useClientPagination } from "@/components/ui/table-pagination"
import { formatDate } from "@/lib/format-date"
import type { Project, Site, Camera as CameraType } from "@repo/types"

// ─── Types ─────────────────────────────────────────────────────────────────────

interface TreeProject {
  id: string
  name: string
}

interface TreeSite {
  id: string
  name: string
  project_id: string
}

interface CameraItem {
  id: string
  name: string
  health_status: string
  rtsp_url?: string
  lat?: number | null
  lng?: number | null
  tags?: string[]
  profile_id?: string
  site_id?: string
  created_at?: string
}

type Selection =
  | { level: "projects" }
  | { level: "project"; projectId: string; projectName: string }
  | { level: "site"; projectId: string; projectName: string; siteId: string; siteName: string }

// ─── StatusDot ─────────────────────────────────────────────────────────────────

function StatusDot({ status }: { status: string }) {
  const color =
    status === "online"
      ? "bg-green-500"
      : status === "degraded"
        ? "bg-yellow-500"
        : status === "offline" || status === "stopped"
          ? "bg-red-500"
          : status === "stopping"
            ? "bg-orange-500"
            : "bg-gray-400"
  return <span className={`inline-block size-2 rounded-full ${color}`} />
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case "online":
      return <Badge className="bg-green-100 text-green-700 hover:bg-green-200">Online</Badge>
    case "offline":
      return <Badge variant="destructive">Offline</Badge>
    case "degraded":
      return <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-200">Degraded</Badge>
    case "stopping":
      return <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-200 animate-pulse">Stopping</Badge>
    case "stopped":
      return <Badge variant="secondary">Stopped</Badge>
    default:
      return <Badge variant="outline">{status}</Badge>
  }
}

// ─── Tree Panel (Left) ─────────────────────────────────────────────────────────

function TreePanel({
  projects,
  selection,
  onSelect,
}: {
  projects: TreeProject[]
  selection: Selection
  onSelect: (sel: Selection) => void
}) {
  const [sitesByProject, setSitesByProject] = useState<Record<string, TreeSite[]>>({})
  const [camerasBySite, setCamerasBySite] = useState<Record<string, CameraItem[]>>({})
  const [openProjects, setOpenProjects] = useState<Set<string>>(new Set())
  const [openSites, setOpenSites] = useState<Set<string>>(new Set())

  // Real-time camera status updates in tree
  useCameraStatusStream((event) => {
    setCamerasBySite((prev) => {
      const next = { ...prev }
      for (const siteId of Object.keys(next)) {
        next[siteId] = next[siteId]!.map((cam) =>
          cam.id === event.camera_id
            ? { ...cam, health_status: event.new_state }
            : cam,
        )
      }
      return next
    })
  })

  const toggleProject = useCallback(
    async (projectId: string) => {
      setOpenProjects((prev) => {
        const next = new Set(prev)
        if (next.has(projectId)) next.delete(projectId)
        else next.add(projectId)
        return next
      })
      if (!sitesByProject[projectId]) {
        try {
          const res = await apiClient.listSites(projectId, 1, 100)
          setSitesByProject((prev) => ({
            ...prev,
            [projectId]: (res.data ?? []).map((s: any) => ({
              id: s.id,
              name: s.name,
              project_id: projectId,
            })),
          }))
        } catch {
          setSitesByProject((prev) => ({ ...prev, [projectId]: [] }))
        }
      }
    },
    [sitesByProject],
  )

  const toggleSite = useCallback(
    async (siteId: string) => {
      setOpenSites((prev) => {
        const next = new Set(prev)
        if (next.has(siteId)) next.delete(siteId)
        else next.add(siteId)
        return next
      })
      if (!camerasBySite[siteId]) {
        try {
          const res = await apiClient.listCameras({ site_id: siteId, per_page: 100 })
          setCamerasBySite((prev) => ({
            ...prev,
            [siteId]: (res.data ?? []).map((c: any) => ({
              id: c.id,
              name: c.name,
              health_status: c.health_status,
              site_id: siteId,
            })),
          }))
        } catch {
          setCamerasBySite((prev) => ({ ...prev, [siteId]: [] }))
        }
      }
    },
    [camerasBySite],
  )

  // Refresh sites when a project is selected (for after add/delete site)
  const refreshSites = useCallback(
    async (projectId: string) => {
      try {
        const res = await apiClient.listSites(projectId, 1, 100)
        setSitesByProject((prev) => ({
          ...prev,
          [projectId]: (res.data ?? []).map((s: any) => ({
            id: s.id,
            name: s.name,
            project_id: projectId,
          })),
        }))
      } catch { /* ignore */ }
    },
    [],
  )

  // Refresh cameras for a site
  const refreshCameras = useCallback(
    async (siteId: string) => {
      try {
        const res = await apiClient.listCameras({ site_id: siteId, per_page: 100 })
        setCamerasBySite((prev) => ({
          ...prev,
          [siteId]: (res.data ?? []).map((c: any) => ({
            id: c.id,
            name: c.name,
            health_status: c.health_status,
            site_id: siteId,
          })),
        }))
      } catch { /* ignore */ }
    },
    [],
  )

  // Auto-refresh tree when selection changes
  useEffect(() => {
    if (selection.level === "project") {
      refreshSites(selection.projectId)
    } else if (selection.level === "site") {
      refreshCameras(selection.siteId)
    }
  }, [selection, refreshSites, refreshCameras])

  function isProjectSelected(id: string) {
    return selection.level === "project" && selection.projectId === id
  }

  function isSiteSelected(id: string) {
    return selection.level === "site" && selection.siteId === id
  }

  // Shared styles
  const itemBase = "flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-sm transition-colors"
  const itemHover = "hover:bg-accent hover:text-accent-foreground"
  const itemActive = "bg-primary/10 text-primary font-medium"
  const chevronBase = "size-4 text-muted-foreground transition-transform shrink-0"
  const iconBase = "size-4 shrink-0 text-muted-foreground"

  return (
    <ScrollArea className="flex-1">
      <div className="p-2 space-y-0.5">
        {/* Root: Projects level */}
        <button
          onClick={() => onSelect({ level: "projects" })}
          className={`${itemBase} ${itemHover} ${selection.level === "projects" ? itemActive : ""}`}
        >
          <FolderKanban className={iconBase} />
          <span>All Projects</span>
        </button>

        {projects.map((project) => (
          <Collapsible
            key={project.id}
            open={openProjects.has(project.id)}
            onOpenChange={() => toggleProject(project.id)}
          >
            <div className="flex items-center gap-0.5">
              <CollapsibleTrigger className="shrink-0 p-1.5 rounded-md hover:bg-accent">
                <ChevronRight
                  className={`${chevronBase} ${openProjects.has(project.id) ? "rotate-90" : ""}`}
                />
              </CollapsibleTrigger>
              <button
                onClick={() => {
                  onSelect({
                    level: "project",
                    projectId: project.id,
                    projectName: project.name,
                  })
                  if (!openProjects.has(project.id)) toggleProject(project.id)
                }}
                className={`${itemBase} flex-1 ${itemHover} ${isProjectSelected(project.id) ? itemActive : ""}`}
              >
                <FolderKanban className={iconBase} />
                <span className="truncate">{project.name}</span>
              </button>
            </div>

            <CollapsibleContent>
              <div className="ml-5 border-l-2 border-border/50 pl-1 space-y-0.5">
                {(sitesByProject[project.id] ?? []).length === 0 ? (
                  <p className="px-3 py-2 text-xs text-muted-foreground">No sites</p>
                ) : (
                  (sitesByProject[project.id] ?? []).map((site) => (
                    <Collapsible
                      key={site.id}
                      open={openSites.has(site.id)}
                      onOpenChange={() => toggleSite(site.id)}
                    >
                      <div className="flex items-center gap-0.5">
                        <CollapsibleTrigger className="shrink-0 p-1.5 rounded-md hover:bg-accent">
                          <ChevronRight
                            className={`${chevronBase} ${openSites.has(site.id) ? "rotate-90" : ""}`}
                          />
                        </CollapsibleTrigger>
                        <button
                          onClick={() => {
                            onSelect({
                              level: "site",
                              projectId: project.id,
                              projectName: project.name,
                              siteId: site.id,
                              siteName: site.name,
                            })
                            if (!openSites.has(site.id)) toggleSite(site.id)
                          }}
                          className={`${itemBase} flex-1 ${itemHover} ${isSiteSelected(site.id) ? itemActive : ""}`}
                        >
                          <Building2 className={iconBase} />
                          <span className="truncate">{site.name}</span>
                        </button>
                      </div>

                      <CollapsibleContent>
                        <div className="ml-5 border-l-2 border-border/50 pl-1 space-y-0.5">
                          {(camerasBySite[site.id] ?? []).length === 0 ? (
                            <p className="px-3 py-2 text-xs text-muted-foreground">
                              No cameras
                            </p>
                          ) : (
                            (camerasBySite[site.id] ?? []).map((cam) => (
                              <div
                                key={cam.id}
                                className={`${itemBase} text-muted-foreground`}
                              >
                                <StatusDot status={cam.health_status} />
                                <Camera className={iconBase} />
                                <span className="truncate">{cam.name}</span>
                              </div>
                            ))
                          )}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  ))
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>
        ))}
      </div>
    </ScrollArea>
  )
}

// ─── Content Panel (Right) ─────────────────────────────────────────────────────

function Breadcrumb({
  selection,
  onNavigate,
}: {
  selection: Selection
  onNavigate: (sel: Selection) => void
}) {
  return (
    <div className="flex items-center gap-1 text-sm text-muted-foreground">
      <button
        onClick={() => onNavigate({ level: "projects" })}
        className="hover:text-foreground transition-colors"
      >
        Projects
      </button>
      {(selection.level === "project" || selection.level === "site") && (
        <>
          <ChevronRight className="size-3" />
          <button
            onClick={() =>
              onNavigate({
                level: "project",
                projectId: selection.projectId,
                projectName: selection.projectName,
              })
            }
            className="hover:text-foreground transition-colors"
          >
            {selection.projectName}
          </button>
        </>
      )}
      {selection.level === "site" && (
        <>
          <ChevronRight className="size-3" />
          <span className="text-foreground font-medium">{selection.siteName}</span>
        </>
      )}
    </div>
  )
}

// ── Projects Table ──

function ProjectsTable({
  onSelect,
}: {
  onSelect: (sel: Selection) => void
}) {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const { sortKey, sortDirection, handleSort, sortData } = useTableSort()
  const sortedProjects = sortData(projects, (p: Project, key: string) => {
    if (key === "name") return p.name
    if (key === "created") return (p as any).createdAt ?? p.created_at
    return null
  })
  const projectsPagination = useClientPagination(sortedProjects, 20)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Project | null>(null)
  const [name, setName] = useState("")
  const [desc, setDesc] = useState("")
  const [saving, setSaving] = useState(false)
  const [recordingSettingsProject, setRecordingSettingsProject] = useState<{ id: string; name: string } | null>(null)

  const fetch = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiClient.listProjects(1, 100)
      setProjects(res.data ?? [])
    } catch {
      setProjects([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetch() }, [fetch])

  function openCreate() {
    setEditing(null)
    setName("")
    setDesc("")
    setDialogOpen(true)
  }

  function openEdit(p: Project) {
    setEditing(p)
    setName(p.name)
    setDesc(p.description ?? "")
    setDialogOpen(true)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    try {
      if (editing) {
        await apiClient.updateProject(editing.id, {
          name: name.trim(),
          description: desc.trim() || undefined,
        })
        toast.success("Project Updated")
      } else {
        await apiClient.createProject({
          name: name.trim(),
          description: desc.trim() || undefined,
        })
        toast.success("Project Created")
      }
      setDialogOpen(false)
      fetch()
    } catch (err) {
      toast.error("Error", {
        description: err instanceof Error ? err.message : "Failed to save project.",
      })
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(p: Project) {
    if (!confirm(`Delete project "${p.name}"? This cannot be undone.`)) return
    try {
      await apiClient.deleteProject(p.id)
      toast.success("Project Deleted")
      fetch()
    } catch (err) {
      toast.error("Error", {
        description: err instanceof Error ? err.message : "Failed to delete project.",
      })
    }
  }

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Projects</h2>
        <Button onClick={openCreate}>
          <Plus className="mr-1.5 size-4" />
          Add Project
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground py-8 text-center">Loading...</p>
      ) : projects.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-center">
          <FolderKanban className="size-8 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">No projects yet.</p>
          <Button className="mt-3" onClick={openCreate}>
            Create Project
          </Button>
        </div>
      ) : (
        <>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <SortableTableHead sortKey="name" currentSortKey={sortKey} currentDirection={sortDirection} onSort={handleSort}>Name</SortableTableHead>
                <TableHead>Description</TableHead>
                <TableHead>Public Key</TableHead>
                <SortableTableHead sortKey="created" currentSortKey={sortKey} currentDirection={sortDirection} onSort={handleSort}>Created at</SortableTableHead>
                <TableHead className="w-[50px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {projectsPagination.paginatedData.map((p) => (
                <TableRow
                  key={p.id}
                  className="cursor-pointer"
                  onClick={() =>
                    onSelect({ level: "project", projectId: p.id, projectName: p.name })
                  }
                >
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                    {p.description || "—"}
                  </TableCell>
                  <TableCell>
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                      {(p as any).publicKey ?? p.public_key}
                    </code>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate((p as any).createdAt ?? p.created_at)}
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="size-8">
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEdit(p)}>Edit</DropdownMenuItem>
                        <DropdownMenuItem className="whitespace-nowrap" onClick={() => setRecordingSettingsProject({ id: p.id, name: p.name })}>
                          Recording Settings
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-red-600" onClick={() => handleDelete(p)}>
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
        <TablePagination page={projectsPagination.page} totalPages={projectsPagination.totalPages} totalItems={projectsPagination.totalItems} pageSize={projectsPagination.pageSize} onPageChange={projectsPagination.onPageChange} />
        </>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Project" : "Create Project"}</DialogTitle>
            <DialogDescription>
              {editing ? "Update project details." : "Create a new project."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input value={desc} onChange={(e) => setDesc(e.target.value)} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving..." : editing ? "Save" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {recordingSettingsProject && (
        <RecordingSettingsDialog
          open={true}
          onOpenChange={(open) => { if (!open) setRecordingSettingsProject(null) }}
          scopeType="project"
          scopeId={recordingSettingsProject.id}
          scopeName={recordingSettingsProject.name}
        />
      )}
    </>
  )
}

// ── Sites Table ──

function SitesTable({
  projectId,
  projectName,
  onSelect,
}: {
  projectId: string
  projectName: string
  onSelect: (sel: Selection) => void
}) {
  const [sites, setSites] = useState<Site[]>([])
  const [loading, setLoading] = useState(true)
  const [siteDialogOpen, setSiteDialogOpen] = useState(false)
  const [editingSite, setEditingSite] = useState<Site | null>(null)
  const [recordingSettingsSite, setRecordingSettingsSite] = useState<{ id: string; name: string } | null>(null)
  const sitesSort = useTableSort()
  const sortedSites = sitesSort.sortData(sites, (s: Site, key: string) => {
    if (key === "name") return s.name
    if (key === "created") return s.created_at
    return null
  })
  const sitesPagination = useClientPagination(sortedSites, 20)

  const fetch = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiClient.listSites(projectId, 1, 100)
      setSites(res.data ?? [])
    } catch {
      setSites([])
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => { fetch() }, [fetch])

  async function handleAddSite(data: {
    name: string
    address?: string
    lat?: number
    lng?: number
    timezone?: string
  }) {
    await apiClient.createSite(projectId, data)
    toast.success("Site Created")
    fetch()
  }

  async function handleEditSite(data: {
    name: string
    address?: string
    lat?: number
    lng?: number
    timezone?: string
  }) {
    if (!editingSite) return
    await apiClient.updateSite(editingSite.id, data)
    toast.success("Site Updated")
    setEditingSite(null)
    fetch()
  }

  async function handleDelete(site: Site) {
    if (!confirm(`Delete site "${site.name}"? All cameras will also be deleted.`)) return
    try {
      await apiClient.deleteSite(site.id)
      toast.success("Site Deleted")
      fetch()
    } catch (err) {
      toast.error("Error", {
        description: err instanceof Error ? err.message : "Failed to delete site.",
      })
    }
  }

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Sites</h2>
        <Button
          onClick={() => {
            setEditingSite(null)
            setSiteDialogOpen(true)
          }}
        >
          <Plus className="mr-1.5 size-4" />
          Add Site
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground py-8 text-center">Loading...</p>
      ) : sites.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-center">
          <Building2 className="size-8 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">No sites in this project.</p>
          <Button
            className="mt-3"
            onClick={() => {
              setEditingSite(null)
              setSiteDialogOpen(true)
            }}
          >
            Add Site
          </Button>
        </div>
      ) : (
        <>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <SortableTableHead sortKey="name" currentSortKey={sitesSort.sortKey} currentDirection={sitesSort.sortDirection} onSort={sitesSort.handleSort}>Name</SortableTableHead>
                <TableHead>Address</TableHead>
                <TableHead>Timezone</TableHead>
                <SortableTableHead sortKey="created" currentSortKey={sitesSort.sortKey} currentDirection={sitesSort.sortDirection} onSort={sitesSort.handleSort}>Created at</SortableTableHead>
                <TableHead className="w-[50px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {sitesPagination.paginatedData.map((site) => (
                <TableRow
                  key={site.id}
                  className="cursor-pointer"
                  onClick={() =>
                    onSelect({
                      level: "site",
                      projectId,
                      projectName,
                      siteId: site.id,
                      siteName: site.name,
                    })
                  }
                >
                  <TableCell className="font-medium">{site.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {site.address || "—"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {site.timezone ?? "UTC"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(site.created_at instanceof Date ? site.created_at.toISOString() : site.created_at)}
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="size-8">
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => {
                            setEditingSite(site)
                            setSiteDialogOpen(true)
                          }}
                        >
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem className="whitespace-nowrap" onClick={() => setRecordingSettingsSite({ id: site.id, name: site.name })}>
                          Recording Settings
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-red-600"
                          onClick={() => handleDelete(site)}
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
        <TablePagination page={sitesPagination.page} totalPages={sitesPagination.totalPages} totalItems={sitesPagination.totalItems} pageSize={sitesPagination.pageSize} onPageChange={sitesPagination.onPageChange} />
        </>
      )}

      <SiteDialog
        open={siteDialogOpen}
        onClose={() => {
          setSiteDialogOpen(false)
          setEditingSite(null)
        }}
        onSave={editingSite ? handleEditSite : handleAddSite}
        initialData={
          editingSite
            ? {
                name: editingSite.name,
                address: editingSite.address ?? undefined,
                lat: (editingSite as any).lat,
                lng: (editingSite as any).lng,
                timezone: editingSite.timezone ?? undefined,
              }
            : undefined
        }
        title={editingSite ? "Edit Site" : "Add Site"}
      />

      {recordingSettingsSite && (
        <RecordingSettingsDialog
          open={true}
          onOpenChange={(open) => { if (!open) setRecordingSettingsSite(null) }}
          scopeType="site"
          scopeId={recordingSettingsSite.id}
          scopeName={recordingSettingsSite.name}
        />
      )}
    </>
  )
}

// ── Cameras Table ──

function CamerasTable({ siteId }: { siteId: string }) {
  const [cameras, setCameras] = useState<CameraItem[]>([])
  const [loading, setLoading] = useState(true)
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [editingCamera, setEditingCamera] = useState<CameraItem | null>(null)

  // Real-time camera status updates
  useCameraStatusStream((event) => {
    setCameras((prev) =>
      prev.map((cam) =>
        cam.id === event.camera_id
          ? { ...cam, health_status: event.new_state }
          : cam,
      ),
    )
  })
  const camerasSort = useTableSort()
  const pagination = useClientPagination(
    camerasSort.sortData(cameras, (c: CameraItem, key: string) => {
      if (key === "name") return c.name
      if (key === "status") return c.health_status
      return null
    }),
    20,
  )

  const fetch = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiClient.listCameras({ site_id: siteId, per_page: 100 })
      setCameras(
        (res.data ?? []).map((c: any) => ({
          id: c.id,
          name: c.name,
          health_status: c.health_status,
          rtsp_url: c.rtsp_url,
          lat: c.lat,
          lng: c.lng,
          tags: c.tags,
          profile_id: c.profile_id,
          site_id: siteId,
          created_at: c.created_at,
        })),
      )
    } catch {
      setCameras([])
    } finally {
      setLoading(false)
    }
  }, [siteId])

  useEffect(() => { fetch() }, [fetch])

  function maskRtsp(url?: string) {
    if (!url) return "—"
    try {
      const parsed = new URL(url)
      return `rtsp://***@${parsed.hostname}:${parsed.port || "554"}${parsed.pathname}`
    } catch {
      return "rtsp://***"
    }
  }

  async function handleDelete(cam: CameraItem) {
    if (!confirm(`Delete camera "${cam.name}"?`)) return
    try {
      await apiClient.deleteCamera(cam.id)
      toast.success("Camera Deleted")
      fetch()
    } catch (err) {
      toast.error("Error", {
        description: err instanceof Error ? err.message : "Failed to delete camera.",
      })
    }
  }

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Cameras</h2>
        <Button onClick={() => setAddDialogOpen(true)}>
          <Plus className="mr-1.5 size-4" />
          Add Camera
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground py-8 text-center">Loading...</p>
      ) : cameras.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-center">
          <Camera className="size-8 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">No cameras in this site.</p>
          <Button className="mt-3" onClick={() => setAddDialogOpen(true)}>
            Add Camera
          </Button>
        </div>
      ) : (
        <>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableTableHead sortKey="name" currentSortKey={camerasSort.sortKey} currentDirection={camerasSort.sortDirection} onSort={camerasSort.handleSort}>Name</SortableTableHead>
                  <SortableTableHead sortKey="status" currentSortKey={camerasSort.sortKey} currentDirection={camerasSort.sortDirection} onSort={camerasSort.handleSort}>Status</SortableTableHead>
                  <TableHead>Stream URL</TableHead>
                  <TableHead className="w-[50px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagination.paginatedData.map((cam) => (
                  <TableRow key={cam.id}>
                    <TableCell className="font-medium">{cam.name}</TableCell>
                    <TableCell>
                      <StatusBadge status={cam.health_status} />
                    </TableCell>
                    <TableCell className="text-sm font-mono text-muted-foreground max-w-[200px] truncate">
                      {maskRtsp(cam.rtsp_url)}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="size-8">
                            <MoreHorizontal className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setEditingCamera(cam)}>
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-red-600"
                            onClick={() => handleDelete(cam)}
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
          <TablePagination
            page={pagination.page}
            totalPages={pagination.totalPages}
            totalItems={pagination.totalItems}
            pageSize={pagination.pageSize}
            onPageChange={pagination.onPageChange}
          />
        </>
      )}

      <AddCameraDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        onSuccess={() => {
          setAddDialogOpen(false)
          fetch()
        }}
        siteId={siteId}
      />

      {editingCamera && (
        <EditCameraDialog
          camera={editingCamera as unknown as CameraType}
          open={true}
          onOpenChange={(open) => {
            if (!open) setEditingCamera(null)
          }}
          onSuccess={() => {
            setEditingCamera(null)
            fetch()
          }}
        />
      )}
    </>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function ProjectsPage() {
  const [projects, setProjects] = useState<TreeProject[]>([])
  const [selection, setSelection] = useState<Selection>({ level: "projects" })
  const [panelOpen, setPanelOpen] = useState(true)

  useEffect(() => {
    apiClient
      .listProjects(1, 100)
      .then((res) =>
        setProjects(
          (res.data ?? []).map((p: any) => ({ id: p.id, name: p.name })),
        ),
      )
      .catch(() => setProjects([]))
  }, [])

  // Refresh tree projects when returning to projects level
  const refreshTreeProjects = useCallback(() => {
    apiClient
      .listProjects(1, 100)
      .then((res) =>
        setProjects(
          (res.data ?? []).map((p: any) => ({ id: p.id, name: p.name })),
        ),
      )
      .catch(() => {})
  }, [])

  function handleSelect(sel: Selection) {
    setSelection(sel)
    if (sel.level === "projects") refreshTreeProjects()
  }

  return (
    <div
      className="relative flex h-[calc(100vh-3rem)] -m-6"
      style={{ width: "calc(100% + 3rem)", height: "calc(100vh - 3rem)" }}
    >
      {/* ── Left: Tree Panel ── */}
      <div
        className={`relative flex shrink-0 transition-all duration-300 ease-in-out ${
          panelOpen ? "w-64" : "w-0"
        }`}
      >
        <div
          className={`flex h-full w-64 flex-col border-r bg-background overflow-hidden ${
            panelOpen ? "" : "invisible"
          }`}
        >
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div>
              <h3 className="text-sm font-semibold">Projects</h3>
              <p className="text-xs text-muted-foreground">Browse hierarchy</p>
            </div>
            <button
              onClick={() => setPanelOpen(false)}
              className="flex h-7 w-7 items-center justify-center rounded-md hover:bg-accent transition-colors"
              title="Hide panel"
            >
              <ChevronsLeft className="size-4" />
            </button>
          </div>
          <TreePanel
            projects={projects}
            selection={selection}
            onSelect={handleSelect}
          />
        </div>

      </div>

      {/* ── Right: Content Panel ── */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="flex items-center gap-2 mb-4">
          {!panelOpen && (
            <button
              onClick={() => setPanelOpen(true)}
              className="flex h-8 w-8 items-center justify-center rounded-md border hover:bg-accent transition-colors shrink-0"
              title="Show panel"
            >
              <ChevronsRight className="size-4" />
            </button>
          )}
          <div className="flex-1">
            <Breadcrumb selection={selection} onNavigate={handleSelect} />
          </div>
        </div>

        {selection.level === "projects" && (
          <ProjectsTable onSelect={handleSelect} />
        )}

        {selection.level === "project" && (
          <SitesTable
            projectId={selection.projectId}
            projectName={selection.projectName}
            onSelect={handleSelect}
          />
        )}

        {selection.level === "site" && (
          <CamerasTable siteId={selection.siteId} />
        )}
      </div>
    </div>
  )
}
