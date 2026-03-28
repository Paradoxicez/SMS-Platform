"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { CalendarDays } from "lucide-react"

export interface DateRange {
  from: string
  to: string
}

interface DateRangePickerProps {
  value: DateRange
  onChange: (range: DateRange) => void
}

function formatRangeLabel(range: DateRange): string {
  if (!range.from && !range.to) return "Select date range"
  const fmt = (dateStr: string) => {
    const d = new Date(dateStr + "T00:00:00")
    if (isNaN(d.getTime())) return dateStr
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
  }
  if (range.from && range.to) {
    const fromDate = new Date(range.from + "T00:00:00")
    const toDate = new Date(range.to + "T00:00:00")
    const sameYear = fromDate.getFullYear() === toDate.getFullYear()
    if (sameYear) {
      return `${fmt(range.from)} - ${fmt(range.to)}`
    }
    return `${fmt(range.from)}, ${fromDate.getFullYear()} - ${fmt(range.to)}, ${toDate.getFullYear()}`
  }
  if (range.from) return `${fmt(range.from)} - ...`
  return `... - ${fmt(range.to)}`
}

export function DateRangePicker({ value, onChange }: DateRangePickerProps) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<DateRange>(value)

  function handleOpen(isOpen: boolean) {
    if (isOpen) {
      setDraft(value)
    }
    setOpen(isOpen)
  }

  function handleApply() {
    onChange(draft)
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={handleOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="h-8 gap-2 text-sm font-normal">
          <CalendarDays className="size-4 text-muted-foreground" />
          {formatRangeLabel(value)}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-4">
        <div className="flex items-end gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">From</Label>
            <Input
              type="date"
              value={draft.from}
              onChange={(e) => setDraft((prev) => ({ ...prev, from: e.target.value }))}
              className="h-8 w-[150px] text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">To</Label>
            <Input
              type="date"
              value={draft.to}
              onChange={(e) => setDraft((prev) => ({ ...prev, to: e.target.value }))}
              className="h-8 w-[150px] text-sm"
            />
          </div>
          <Button size="sm" className="h-8" onClick={handleApply}>
            Apply
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
