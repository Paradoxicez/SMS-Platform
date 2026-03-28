"use client"

import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface SiteFormData {
  name: string
  address: string
  lat: string
  lng: string
  timezone: string
}

interface SiteDialogProps {
  open: boolean
  onClose: () => void
  onSave: (data: {
    name: string
    address?: string
    lat?: number
    lng?: number
    timezone?: string
  }) => Promise<void>
  initialData?: {
    name?: string
    address?: string
    lat?: number | null
    lng?: number | null
    timezone?: string
  }
  title?: string
}

const TIMEZONES = [
  "UTC",
  "Asia/Bangkok",
  "Asia/Tokyo",
  "Asia/Shanghai",
  "Asia/Singapore",
  "Asia/Kolkata",
  "Europe/London",
  "Europe/Berlin",
  "Europe/Paris",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Australia/Sydney",
  "Pacific/Auckland",
]

export function SiteDialog({
  open,
  onClose,
  onSave,
  initialData,
  title,
}: SiteDialogProps) {
  const [form, setForm] = useState<SiteFormData>({
    name: "",
    address: "",
    lat: "",
    lng: "",
    timezone: "UTC",
  })
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (open) {
      setForm({
        name: initialData?.name ?? "",
        address: initialData?.address ?? "",
        lat: initialData?.lat != null ? String(initialData.lat) : "",
        lng: initialData?.lng != null ? String(initialData.lng) : "",
        timezone: initialData?.timezone ?? "UTC",
      })
    }
  }, [open, initialData])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) return

    setSubmitting(true)
    try {
      await onSave({
        name: form.name.trim(),
        address: form.address.trim() || undefined,
        lat: form.lat ? parseFloat(form.lat) : undefined,
        lng: form.lng ? parseFloat(form.lng) : undefined,
        timezone: form.timezone || undefined,
      })
      onClose()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{title ?? (initialData ? "Edit Site" : "Add Site")}</DialogTitle>
          <DialogDescription>
            {initialData
              ? "Update the site details below."
              : "Create a new site by providing its details."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="site-name">Name *</Label>
            <Input
              id="site-name"
              placeholder="e.g., Main Office Building"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="site-address">Address</Label>
            <Input
              id="site-address"
              placeholder="e.g., 123 Main St, Bangkok 10110"
              value={form.address}
              onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="site-lat">Latitude</Label>
              <Input
                id="site-lat"
                type="number"
                step="any"
                placeholder="e.g., 13.7563"
                value={form.lat}
                onChange={(e) => setForm((f) => ({ ...f, lat: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="site-lng">Longitude</Label>
              <Input
                id="site-lng"
                type="number"
                step="any"
                placeholder="e.g., 100.5018"
                value={form.lng}
                onChange={(e) => setForm((f) => ({ ...f, lng: e.target.value }))}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="site-timezone">Timezone</Label>
            <Select
              value={form.timezone}
              onValueChange={(v) => setForm((f) => ({ ...f, timezone: v }))}
            >
              <SelectTrigger id="site-timezone">
                <SelectValue placeholder="Select timezone" />
              </SelectTrigger>
              <SelectContent>
                {TIMEZONES.map((tz) => (
                  <SelectItem key={tz} value={tz}>
                    {tz}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Saving..." : initialData ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
