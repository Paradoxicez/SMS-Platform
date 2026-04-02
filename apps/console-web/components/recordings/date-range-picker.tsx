"use client"

import { useState } from "react"
import { format } from "date-fns"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { CalendarDays } from "lucide-react"
import type { DateRange as RDPDateRange } from "react-day-picker"

export interface DateRange {
  from: string
  to: string
}

interface DateRangePickerProps {
  value: DateRange
  onChange: (range: DateRange) => void
}

function toDate(str: string): Date | undefined {
  if (!str) return undefined
  const d = new Date(str + "T00:00:00")
  return isNaN(d.getTime()) ? undefined : d
}

function toStr(d: Date | undefined): string {
  if (!d) return ""
  return format(d, "yyyy-MM-dd")
}

function formatRangeLabel(range: DateRange): string {
  if (!range.from && !range.to) return "Select date range"
  const fmt = (dateStr: string) => {
    const d = new Date(dateStr + "T00:00:00")
    if (isNaN(d.getTime())) return dateStr
    return format(d, "MMM d")
  }
  if (range.from && range.to) {
    const fromDate = new Date(range.from + "T00:00:00")
    const toDate = new Date(range.to + "T00:00:00")
    if (fromDate.getFullYear() === toDate.getFullYear()) {
      return `${fmt(range.from)} – ${fmt(range.to)}`
    }
    return `${fmt(range.from)}, ${fromDate.getFullYear()} – ${fmt(range.to)}, ${toDate.getFullYear()}`
  }
  if (range.from) return `${fmt(range.from)} – ...`
  return `... – ${fmt(range.to)}`
}

export function DateRangePicker({ value, onChange }: DateRangePickerProps) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<RDPDateRange | undefined>({
    from: toDate(value.from),
    to: toDate(value.to),
  })

  function handleOpen(isOpen: boolean) {
    if (isOpen) {
      setDraft({ from: toDate(value.from), to: toDate(value.to) })
    }
    setOpen(isOpen)
  }

  function handleApply() {
    onChange({ from: toStr(draft?.from), to: toStr(draft?.to) })
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
      <PopoverContent align="start" className="w-auto p-0">
        <Calendar
          mode="range"
          selected={draft}
          onSelect={setDraft}
          numberOfMonths={2}
          defaultMonth={toDate(value.from)}
        />
        <div className="flex items-center justify-between border-t px-4 py-3">
          <p className="text-xs text-muted-foreground">
            {draft?.from && draft?.to
              ? `${format(draft.from, "MMM d, yyyy")} – ${format(draft.to, "MMM d, yyyy")}`
              : "Pick start and end dates"}
          </p>
          <Button size="sm" className="h-7" onClick={handleApply} disabled={!draft?.from || !draft?.to}>
            Apply
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
