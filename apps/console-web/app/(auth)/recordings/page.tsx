"use client"

import { useEffect, useState, useCallback } from "react"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { TablePagination } from "@/components/ui/table-pagination"
import { ViewToggle } from "@/components/recordings/view-toggle"
import { DateRangePicker, type DateRange } from "@/components/recordings/date-range-picker"
import { RecordingCard } from "@/components/recordings/recording-card"
import { RecordingTable } from "@/components/recordings/recording-table"
import { BulkActions } from "@/components/recordings/bulk-actions"
import { apiClient } from "@/lib/api-client"
import { toast } from "sonner"
import type { Recording } from "@/components/recordings/types"
import { FeatureGate } from "@/components/feature-gate"
import { useUserRole } from "@/lib/use-user-role"

interface CameraOption {
  id: string
  name: string
  site_id?: string
  tags?: string[]
}

const PAGE_SIZE = 24

function formatLocalDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

function getDefaultDateRange(): DateRange {
  const to = new Date()
  const from = new Date()
  from.setDate(from.getDate() - 7)
  return { from: formatLocalDate(from), to: formatLocalDate(to) }
}

export default function RecordingsPage() {
  return (
    <FeatureGate feature="recording">
      <RecordingsPageContent />
    </FeatureGate>
  )
}

function RecordingsPageContent() {
  const { canEdit } = useUserRole()
  const [cameras, setCameras] = useState<CameraOption[]>([])
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([])
  const [sites, setSites] = useState<{ id: string; name: string; project_id: string }[]>([])
  const [allTags, setAllTags] = useState<string[]>([])
  const [selectedCamera, setSelectedCamera] = useState<string>("all")
  const [projectFilter, setProjectFilter] = useState<string>("all")
  const [siteFilter, setSiteFilter] = useState<string>("all")
  const [tagFilter, setTagFilter] = useState<string>("all")
  const [dateRange, setDateRange] = useState<DateRange>(getDefaultDateRange)
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid")
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [page, setPage] = useState(1)
  const [recordings, setRecordings] = useState<Recording[]>([])
  const [totalItems, setTotalItems] = useState(0)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    apiClient.listCameras({ per_page: 200 })
      .then((res) => {
        const cams = res.data.map((c: any) => ({ id: c.id, name: c.name, site_id: c.site_id, tags: c.tags ?? [] }))
        setCameras(cams)
        const tags = new Set<string>()
        cams.forEach((c: any) => (c.tags as string[] ?? []).forEach((t: string) => tags.add(t)))
        setAllTags(Array.from(tags).sort())
      })
      .catch(() => {})
    apiClient.listProjects(1, 100)
      .then((res) => setProjects((res.data ?? []).map((p: any) => ({ id: p.id, name: p.name }))))
      .catch(() => {})
    apiClient.get<{ data: { id: string; name: string; project_id: string }[] }>("/sites?per_page=200")
      .then((res) => setSites(res.data ?? []))
      .catch(() => {})
  }, [])

  const fetchRecordings = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (dateRange.from) params.set("from", dateRange.from + "T00:00:00.000Z")
      if (dateRange.to) params.set("to", dateRange.to + "T23:59:59.999Z")
      params.set("page", String(page))
      params.set("per_page", String(PAGE_SIZE))

      const path = selectedCamera && selectedCamera !== "all"
        ? `/cameras/${selectedCamera}/recordings?${params.toString()}`
        : `/recordings?${params.toString()}`

      const res = await apiClient.get<{
        data: Recording[]
        meta?: { total?: number }
      }>(path)

      setRecordings(res.data)
      setTotalItems(res.meta?.total ?? res.data.length)
    } catch {
      setRecordings([])
      setTotalItems(0)
    } finally {
      setLoading(false)
    }
  }, [selectedCamera, dateRange, page])

  useEffect(() => { fetchRecordings() }, [fetchRecordings])
  useEffect(() => { setPage(1) }, [selectedCamera, dateRange, statusFilter, searchQuery, projectFilter, siteFilter, tagFilter])

  // Enrich + filter client-side
  const enrichedRecordings = recordings
    .map((rec) => {
      const cam = cameras.find((c) => c.id === rec.camera_id)
      return { ...rec, camera_name: rec.camera_name ?? cam?.name ?? undefined, _cam: cam }
    })
    .filter((rec) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        if (!(rec.camera_name?.toLowerCase().includes(q))) return false
      }
      if (statusFilter === "complete" && !rec.end_time) return false
      if (statusFilter === "in_progress" && rec.end_time) return false
      if (projectFilter !== "all") {
        const camSite = sites.find((s) => s.id === (rec._cam as any)?.site_id)
        if (!camSite || camSite.project_id !== projectFilter) return false
      }
      if (siteFilter !== "all") {
        if ((rec._cam as any)?.site_id !== siteFilter) return false
      }
      if (tagFilter !== "all") {
        if (!((rec._cam as any)?.tags as string[] ?? []).includes(tagFilter)) return false
      }
      return true
    })

  // Selection
  function handleSelectChange(id: string, selected: boolean) {
    setSelectedIds((prev) => { const n = new Set(prev); selected ? n.add(id) : n.delete(id); return n })
  }
  function handleSelectAll(selected: boolean) {
    setSelectedIds(selected ? new Set(enrichedRecordings.map((r) => r.id)) : new Set())
  }

  async function handleBulkDownload() {
    const selected = enrichedRecordings.filter((r) => selectedIds.has(r.id))
    for (const rec of selected) {
      const link = document.createElement("a")
      link.href = `/api/v1/recordings/${rec.id}/download`
      link.download = `${rec.camera_name ?? rec.camera_id}_${rec.start_time}.mp4`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    }
    toast.success(`Downloading ${selected.length} recording(s)`)
  }

  async function handleBulkDelete() {
    const ids = Array.from(selectedIds)
    try {
      await Promise.all(ids.map((id) => apiClient.delete(`/recordings/${id}`)))
      toast.success(`Deleted ${ids.length} recording(s)`)
      setSelectedIds(new Set())
      fetchRecordings()
    } catch { toast.error("Failed to delete some recordings") }
  }

  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Recordings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Browse and play back recorded camera footage. {totalItems} recording(s) found.
        </p>
      </div>

      <div className="space-y-4">
        {/* Filters row */}
        <div className="flex flex-wrap items-center gap-2">
          <Select value={projectFilter} onValueChange={(v) => { setProjectFilter(v); setSiteFilter("all"); }}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="All Projects" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Projects</SelectItem>
              {projects.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={siteFilter} onValueChange={setSiteFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="All Sites" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sites</SelectItem>
              {sites
                .filter((s) => projectFilter === "all" || s.project_id === projectFilter)
                .map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
            </SelectContent>
          </Select>

          <Select value={selectedCamera} onValueChange={setSelectedCamera}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="All Cameras" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Cameras</SelectItem>
              {cameras
                .filter((c) => {
                  if (siteFilter !== "all") return c.site_id === siteFilter
                  if (projectFilter !== "all") {
                    const camSite = sites.find((s) => s.id === c.site_id)
                    return camSite?.project_id === projectFilter
                  }
                  return true
                })
                .map((cam) => (
                  <SelectItem key={cam.id} value={cam.id}>{cam.name}</SelectItem>
                ))}
            </SelectContent>
          </Select>

          <Select value={tagFilter} onValueChange={setTagFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="All Tags" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Tags</SelectItem>
              {allTags.map((t) => (
                <SelectItem key={t} value={t}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="complete">Complete</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
            </SelectContent>
          </Select>

          <DateRangePicker value={dateRange} onChange={setDateRange} />

          <div className="flex-1" />

          <Input
            placeholder="Search by camera..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-[200px]"
          />

          <ViewToggle view={viewMode} onViewChange={setViewMode} />
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="size-8 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-muted-foreground" />
          </div>
        )}

        {/* Grid view */}
        {!loading && viewMode === "grid" && (
          enrichedRecordings.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
              <p className="text-sm text-muted-foreground">No recordings found.</p>
              <p className="mt-1 text-xs text-muted-foreground">Try adjusting your filters or date range.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {enrichedRecordings.map((rec) => (
                <RecordingCard
                  key={rec.id}
                  recording={rec}
                  selected={selectedIds.has(rec.id)}
                  onSelectChange={handleSelectChange}
                />
              ))}
            </div>
          )
        )}

        {/* Table view */}
        {!loading && viewMode === "table" && (
          <RecordingTable
            recordings={enrichedRecordings}
            selectedIds={selectedIds}
            onSelectChange={handleSelectChange}
            onSelectAll={handleSelectAll}
          />
        )}

        {/* Pagination */}
        {!loading && totalItems > PAGE_SIZE && (
          <TablePagination
            page={page}
            totalPages={totalPages}
            totalItems={totalItems}
            pageSize={PAGE_SIZE}
            onPageChange={setPage}
          />
        )}

        {/* Bulk actions */}
        <BulkActions
          selectedCount={selectedIds.size}
          onDownload={handleBulkDownload}
          onDelete={handleBulkDelete}
          onDeselectAll={() => setSelectedIds(new Set())}
          canDelete={canEdit}
        />
      </div>
    </div>
  )
}
