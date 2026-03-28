"use client"

import { useEffect, useState, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { MoreHorizontal, MapPin } from "lucide-react"
import { BreadcrumbNav } from "@/components/breadcrumb-nav"
import { SiteDialog } from "@/components/sites/site-dialog"
import { apiClient } from "@/lib/api-client"
import { toast } from "sonner"
import { formatDate } from "@/lib/format-date"
import type { Project, Site } from "@repo/types"

export default function ProjectDetailPage() {
  const params = useParams()
  const router = useRouter()
  const projectId = params.id as string

  const [project, setProject] = useState<Project | null>(null)
  const [sites, setSites] = useState<Site[]>([])
  const [loading, setLoading] = useState(true)

  // Edit project dialog
  const [editOpen, setEditOpen] = useState(false)
  const [editName, setEditName] = useState("")
  const [editDesc, setEditDesc] = useState("")
  const [saving, setSaving] = useState(false)

  // Add site dialog
  const [siteDialogOpen, setSiteDialogOpen] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [projectRes, sitesRes] = await Promise.all([
        apiClient.getProject(projectId),
        apiClient.listSites(projectId, 1, 100),
      ])
      setProject(projectRes.data)
      setSites(sitesRes.data ?? [])
    } catch {
      setProject(null)
      setSites([])
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  function openEditDialog() {
    if (!project) return
    setEditName(project.name)
    setEditDesc(project.description ?? "")
    setEditOpen(true)
  }
  void openEditDialog;

  async function handleEditSave(e: React.FormEvent) {
    e.preventDefault()
    if (!editName.trim()) return

    setSaving(true)
    try {
      await apiClient.updateProject(projectId, {
        name: editName.trim(),
        description: editDesc.trim() || undefined,
      })
      toast.success("Project Updated")
      setEditOpen(false)
      fetchData()
    } catch (err) {
      toast.error("Error", {
        description: err instanceof Error ? err.message : "Failed to update project.",
      })
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!project) return
    if (!confirm(`Delete project "${project.name}"? This cannot be undone.`)) return
    try {
      await apiClient.deleteProject(projectId)
      toast.success("Project Deleted")
      router.push("/projects")
    } catch (err) {
      toast.error("Error", {
        description: err instanceof Error ? err.message : "Failed to delete project.",
      })
    }
  }
  void handleDelete;

  async function handleAddSite(data: {
    name: string
    address?: string
    lat?: number
    lng?: number
    timezone?: string
  }) {
    await apiClient.createSite(projectId, data)
    toast.success("Site Created", {
      description: `Site "${data.name}" has been created.`,
    })
    fetchData()
  }

  async function handleDeleteSite(site: Site) {
    if (!confirm(`Delete site "${site.name}"? This cannot be undone.`)) return
    try {
      await apiClient.deleteSite(site.id)
      toast.success("Site Deleted")
      fetchData()
    } catch (err) {
      toast.error("Error", {
        description: err instanceof Error ? err.message : "Failed to delete site.",
      })
    }
  }

  if (loading) {
    return (
      <div className="flex h-32 items-center justify-center text-muted-foreground">
        Loading project...
      </div>
    )
  }

  if (!project) {
    return (
      <div className="flex h-32 items-center justify-center text-muted-foreground">
        Project not found.
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <BreadcrumbNav
        items={[
          { label: "Projects", href: "/projects" },
          { label: project.name },
        ]}
      />

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">{project.name}</h1>
          {project.description && (
            <p className="mt-1 text-sm text-muted-foreground">{project.description}</p>
          )}
          <div className="mt-2 flex items-center gap-4 text-sm text-muted-foreground">
            <span>
              Public Key:{" "}
              <code className="bg-muted px-1.5 py-0.5 rounded text-xs">
                {(project as any).publicKey ?? project.public_key}
              </code>
            </span>
          </div>
        </div>
        <div className="flex gap-2">
        </div>
      </div>

      {/* Sites Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Sites</h2>
          <Button size="sm" onClick={() => setSiteDialogOpen(true)}>
            Add Site
          </Button>
        </div>

        {sites.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12">
            <div className="flex size-10 items-center justify-center rounded-full bg-muted">
              <MapPin className="size-5 text-muted-foreground" />
            </div>
            <h3 className="mt-3 text-base font-semibold">No sites yet</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Add a site to start organizing cameras by location.
            </p>
            <Button className="mt-3" size="sm" onClick={() => setSiteDialogOpen(true)}>
              Add Site
            </Button>
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Address</TableHead>
                  <TableHead>Timezone</TableHead>
                  <TableHead>Created at</TableHead>
                  <TableHead className="w-[60px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sites.map((site) => (
                  <TableRow key={site.id}>
                    <TableCell>
                      <a
                        href={`/sites/${site.id}`}
                        className="font-medium text-blue-600 hover:underline"
                      >
                        {site.name}
                      </a>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {site.address || "-"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {site.timezone ?? "UTC"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(site.created_at instanceof Date ? site.created_at.toISOString() : site.created_at)}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="size-8">
                            <MoreHorizontal className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <a href={`/sites/${site.id}`}>View Details</a>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-red-600"
                            onClick={() => handleDeleteSite(site)}
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

      {/* Edit Project Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>Edit Project</DialogTitle>
            <DialogDescription>Update project details.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditSave} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Name *</Label>
              <Input
                id="edit-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-desc">Description</Label>
              <Input
                id="edit-desc"
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving..." : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add Site Dialog */}
      <SiteDialog
        open={siteDialogOpen}
        onClose={() => setSiteDialogOpen(false)}
        onSave={handleAddSite}
      />
    </div>
  )
}
