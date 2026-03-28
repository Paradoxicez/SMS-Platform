"use client"

import { useEffect, useState, useCallback } from "react"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
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

interface CameraOption {
  id: string
  name: string
}

const PAGE_SIZE = 24

function getDefaultDateRange(): DateRange {
  const to = new Date()
  const from = new Date()
  from.setDate(from.getDate() - 7)
  return {
    from: from.toISOString().split("T")[0],
    to: to.toISOString().split("T")[0],
  }
}

export default function RecordingsPage() {
  const [cameras, setCameras] = useState<CameraOption[]>([])
  const [selectedCamera, setSelectedCamera] = useState<string>("all")
  const [dateRange, setDateRange] = useState<DateRange>(getDefaultDateRange)
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid")
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [page, setPage] = useState(1)
  const [recordings, setRecordings] = useState<Recording[]>([])
  const [totalItems, setTotalItems] = useState(0)
  const [loading, setLoading] = useState(false)

  // Fetch camera list
  useEffect(() => {
    async function fetchCameras() {
      try {
        const res = await apiClient.listCameras({ per_page: 200 })
        setCameras(res.data.map((c: any) => ({ id: c.id, name: c.name })))
      } catch {
        // Silent fail - cameras dropdown will be empty
      }
    }
    fetchCameras()
  }, [])

  // Fetch recordings when filters change
  const fetchRecordings = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (dateRange.from) params.set("from", new Date(dateRange.from).toISOString())
      if (dateRange.to) params.set("to", new Date(dateRange.to + "T23:59:59").toISOString())
      params.set("page", String(page))
      params.set("per_page", String(PAGE_SIZE))

      let path: string
      if (selectedCamera && selectedCamera !== "all") {
        path = `/cameras/${selectedCamera}/recordings?${params.toString()}`
      } else {
        path = `/recordings?${params.toString()}`
      }

      const res = await apiClient.get<{
        data: Recording[]
        pagination?: { total: number; total_pages: number }
      }>(path)

      setRecordings(res.data)
      setTotalItems(res.pagination?.total ?? res.data.length)
    } catch {
      setRecordings([])
      setTotalItems(0)
    } finally {
      setLoading(false)
    }
  }, [selectedCamera, dateRange, page])

  useEffect(() => {
    fetchRecordings()
  }, [fetchRecordings])

  // Reset page when filters change
  useEffect(() => {
    setPage(1)
  }, [selectedCamera, dateRange])

  // Enrich recordings with camera names
  const enrichedRecordings = recordings.map((rec) => {
    if (rec.cameraName) return rec
    const cam = cameras.find((c) => c.id === rec.cameraId)
    return { ...rec, cameraName: cam?.name ?? undefined }
  })

  // Selection handlers
  function handleSelectChange(id: string, selected: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (selected) next.add(id)
      else next.delete(id)
      return next
    })
  }

  function handleSelectAll(selected: boolean) {
    if (selected) {
      setSelectedIds(new Set(enrichedRecordings.map((r) => r.id)))
    } else {
      setSelectedIds(new Set())
    }
  }

  function handleDeselectAll() {
    setSelectedIds(new Set())
  }

  async function handleBulkDownload() {
    const selected = enrichedRecordings.filter((r) => selectedIds.has(r.id))
    for (const rec of selected) {
      const link = document.createElement("a")
      link.href = `/api/v1/recordings/${rec.id}/download`
      link.download = `${rec.cameraName ?? rec.cameraId}_${rec.startTime}.mp4`
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
    } catch {
      toast.error("Failed to delete some recordings")
    }
  }

  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Recordings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Browse and play back recorded camera footage.
        </p>
      </div>

      <Tabs defaultValue="browse">
        <TabsList>
          <TabsTrigger value="browse">Browse</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="browse" className="space-y-4">
          {/* Filters bar */}
          <div className="flex flex-wrap items-center gap-3">
            <Select value={selectedCamera} onValueChange={setSelectedCamera}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="All cameras" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All cameras</SelectItem>
                {cameras.map((cam) => (
                  <SelectItem key={cam.id} value={cam.id}>
                    {cam.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <DateRangePicker value={dateRange} onChange={setDateRange} />

            <div className="ml-auto">
              <ViewToggle view={viewMode} onViewChange={setViewMode} />
            </div>
          </div>

          {/* Loading state */}
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="size-8 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-muted-foreground" />
            </div>
          )}

          {/* Content */}
          {!loading && viewMode === "grid" && (
            <>
              {enrichedRecordings.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
                  <p className="text-sm text-muted-foreground">No recordings found.</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Try adjusting your filters or date range.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {enrichedRecordings.map((rec) => (
                    <RecordingCard
                      key={rec.id}
                      recording={rec}
                      selected={selectedIds.has(rec.id)}
                      onSelectChange={handleSelectChange}
                    />
                  ))}
                </div>
              )}
            </>
          )}

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
            onDeselectAll={handleDeselectAll}
          />
        </TabsContent>

        <TabsContent value="settings">
          <div>Settings tab coming soon</div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
