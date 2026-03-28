"use client"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
  const [dialogOpen, setDialogOpen] = useState(false)

  if (selectedCount === 0) return null

  return (
    <>
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
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-destructive hover:text-destructive"
            onClick={() => setDialogOpen(true)}
          >
            <Trash2 className="size-3.5" />
            Delete
          </Button>
          <div className="h-4 w-px bg-border" />
          <Button variant="ghost" size="icon" className="size-7" onClick={onDeselectAll}>
            <X className="size-4" />
          </Button>
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Recordings</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {selectedCount} recording{selectedCount > 1 ? "s" : ""}?
              This will permanently remove the recording files. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                onDelete()
                setDialogOpen(false)
              }}
            >
              Delete {selectedCount} recording{selectedCount > 1 ? "s" : ""}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
