"use client"

import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { SortableTableHead, useTableSort } from "@/components/ui/sortable-table-head"
import { formatDateTime } from "@/lib/format-date"
import { Play, Download } from "lucide-react"
import type { Recording } from "./types"

interface RecordingTableProps {
  recordings: Recording[]
  selectedIds: Set<string>
  onSelectChange: (id: string, selected: boolean) => void
  onSelectAll: (selected: boolean) => void
}

function formatDuration(startTime: string, endTime: string | null): string {
  if (!endTime) return "In progress"
  const ms = new Date(endTime).getTime() - new Date(startTime).getTime()
  if (ms < 0) return "-"
  const totalSec = Math.floor(ms / 1000)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  if (h > 0) return `${h}h ${m}m ${s}s`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B"
  const k = 1024
  const sizes = ["B", "KB", "MB", "GB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i] ?? "B"}`
}

export function RecordingTable({
  recordings,
  selectedIds,
  onSelectChange,
  onSelectAll,
}: RecordingTableProps) {
  const router = useRouter()
  const { sortKey, sortDirection, handleSort, sortData } = useTableSort()

  const sortAccessor = (item: Recording, key: string): unknown => {
    switch (key) {
      case "cameraName":
        return item.cameraName ?? ""
      case "startTime":
        return item.startTime
      case "duration": {
        if (!item.endTime) return 0
        return new Date(item.endTime).getTime() - new Date(item.startTime).getTime()
      }
      case "sizeBytes":
        return item.sizeBytes
      default:
        return ""
    }
  }

  const sorted = sortData(recordings, sortAccessor)
  const allSelected = recordings.length > 0 && recordings.every((r) => selectedIds.has(r.id))
  const someSelected = recordings.some((r) => selectedIds.has(r.id)) && !allSelected

  function handleRowClick(rec: Recording) {
    const dateStr = new Date(rec.startTime).toISOString().split("T")[0]!
    router.push(`/recordings/${rec.cameraId}?date=${dateStr}`)
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">
              <Checkbox
                checked={allSelected ? true : someSelected ? "indeterminate" : false}
                onCheckedChange={(checked) => onSelectAll(!!checked)}
              />
            </TableHead>
            <TableHead className="w-20">Thumbnail</TableHead>
            <SortableTableHead
              sortKey="cameraName"
              currentSortKey={sortKey}
              currentDirection={sortDirection}
              onSort={handleSort}
            >
              Camera
            </SortableTableHead>
            <SortableTableHead
              sortKey="startTime"
              currentSortKey={sortKey}
              currentDirection={sortDirection}
              onSort={handleSort}
            >
              Start Time
            </SortableTableHead>
            <SortableTableHead
              sortKey="duration"
              currentSortKey={sortKey}
              currentDirection={sortDirection}
              onSort={handleSort}
            >
              Duration
            </SortableTableHead>
            <SortableTableHead
              sortKey="sizeBytes"
              currentSortKey={sortKey}
              currentDirection={sortDirection}
              onSort={handleSort}
            >
              Size
            </SortableTableHead>
            <TableHead className="w-24">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                No recordings found.
              </TableCell>
            </TableRow>
          ) : (
            sorted.map((rec) => (
              <TableRow
                key={rec.id}
                className="cursor-pointer"
                data-selected={selectedIds.has(rec.id) || undefined}
                onClick={() => handleRowClick(rec)}
              >
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    checked={selectedIds.has(rec.id)}
                    onCheckedChange={(checked) => onSelectChange(rec.id, !!checked)}
                  />
                </TableCell>
                <TableCell>
                  <div className="h-11 w-20 overflow-hidden rounded bg-muted">
                    <img
                      src={`/api/v1/cameras/${rec.cameraId}/thumbnail`}
                      alt=""
                      className="size-full object-cover"
                      onError={(e) => {
                        ;(e.target as HTMLImageElement).style.display = "none"
                      }}
                    />
                  </div>
                </TableCell>
                <TableCell className="text-sm font-medium">
                  {rec.cameraName ?? "Unknown"}
                </TableCell>
                <TableCell className="text-sm">
                  {formatDateTime(rec.startTime)}
                </TableCell>
                <TableCell className="text-sm">
                  {formatDuration(rec.startTime, rec.endTime)}
                </TableCell>
                <TableCell className="text-sm">
                  {formatBytes(rec.sizeBytes)}
                </TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7"
                      onClick={() => handleRowClick(rec)}
                      aria-label="Play recording"
                    >
                      <Play className="size-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7"
                      asChild
                      aria-label="Download recording"
                    >
                      <a
                        href={`/api/v1/recordings/${rec.id}/download`}
                        download
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Download className="size-3.5" />
                      </a>
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}
