"use client"

import { Button } from "@/components/ui/button"
import { LayoutGrid, List } from "lucide-react"

interface ViewToggleProps {
  view: "grid" | "table"
  onViewChange: (view: "grid" | "table") => void
}

export function ViewToggle({ view, onViewChange }: ViewToggleProps) {
  return (
    <div className="flex items-center rounded-lg border border-input p-0.5">
      <Button
        variant={view === "grid" ? "default" : "ghost"}
        size="icon"
        className="size-7"
        onClick={() => onViewChange("grid")}
        aria-label="Grid view"
      >
        <LayoutGrid className="size-4" />
      </Button>
      <Button
        variant={view === "table" ? "default" : "ghost"}
        size="icon"
        className="size-7"
        onClick={() => onViewChange("table")}
        aria-label="Table view"
      >
        <List className="size-4" />
      </Button>
    </div>
  )
}
