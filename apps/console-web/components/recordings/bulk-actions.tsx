"use client"

import { Button } from "@/components/ui/button"
import { Download, Trash2, X } from "lucide-react"
import { useState } from "react"

interface BulkActionsProps {
  selectedCount: number
  onDownload: () => void
  onDelete: () => void
  onDeselectAll: () => void
}

export function BulkActions({
  selectedCount,
  onDownload,
  onDelete,
  onDeselectAll,
}: BulkActionsProps) {
  const [confirmDelete, setConfirmDelete] = useState(false)

  if (selectedCount === 0) return null

  return (
    <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2">
      <div className="flex items-center gap-3 rounded-lg border bg-background px-4 py-2.5 shadow-lg">
        <span className="text-sm font-medium">
          {selectedCount} selected
        </span>
        <div className="h-4 w-px bg-border" />
        <Button variant="outline" size="sm" className="gap-1.5" onClick={onDownload}>
          <Download className="size-3.5" />
          Download
        </Button>
        {confirmDelete ? (
          <div className="flex items-center gap-1.5">
            <span className="text-sm text-destructive">Confirm?</span>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                onDelete()
                setConfirmDelete(false)
              }}
            >
              Yes, delete
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setConfirmDelete(false)}
            >
              Cancel
            </Button>
          </div>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-destructive hover:text-destructive"
            onClick={() => setConfirmDelete(true)}
          >
            <Trash2 className="size-3.5" />
            Delete
          </Button>
        )}
        <div className="h-4 w-px bg-border" />
        <Button variant="ghost" size="icon" className="size-7" onClick={onDeselectAll}>
          <X className="size-4" />
        </Button>
      </div>
    </div>
  )
}
