"use client";

import { useEffect, useState, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SortableTableHead, useTableSort } from "@/components/ui/sortable-table-head";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { formatDateTime } from "@/lib/format-date";
import { apiClient } from "../../../lib/api-client";
import { toast } from "sonner";
import { FeatureGate } from "@/components/feature-gate";

// ── Types ───────────────────────────────────────────────────────────────────

interface AuditEvent {
  id: string;
  timestamp: string;
  actor_type: string;
  actor_id: string | null;
  event_type: string;
  resource_type: string | null;
  resource_id: string | null;
  source_ip: string | null;
  details: any;
}

// ── Hidden event types (system noise) ───────────────────────────────────────

const HIDDEN_EVENTS = new Set([
  "camera.status_changed",
  "forwarding.rule_created",
  "forwarding.rule_updated",
  "forwarding.rule_deleted",
]);

// ── Event type display ──────────────────────────────────────────────────────

const EVENT_LABELS: Record<string, string> = {
  "session.issued": "Session Created",
  "session.denied": "Session Denied",
  "session.revoked": "Session Revoked",
  "session.refreshed": "Session Refreshed",
  "camera.created": "Camera Created",
  "camera.updated": "Camera Updated",
  "camera.deleted": "Camera Deleted",
  "user.updated": "User Updated",
  "user.role_changed": "Role Changed",
  "policy.created": "Policy Created",
  "policy.updated": "Policy Updated",
  "policy.deleted": "Policy Deleted",
  "api_key.created": "API Key Created",
  "api_key.revoked": "API Key Revoked",
  "api_key.deleted": "API Key Deleted",
  "project.created": "Project Created",
  "project.updated": "Project Updated",
  "project.deleted": "Project Deleted",
  "site.created": "Site Created",
  "site.updated": "Site Updated",
  "stream_profile.created": "Profile Created",
  "stream_profile.updated": "Profile Updated",
  "stream_profile.deleted": "Profile Deleted",
  "mediamtx.config_changed": "Stream Engine Changed",
  "auth.access_denied": "Access Denied",
};

function eventBadgeColor(eventType: string): string {
  if (eventType.includes("denied") || eventType.includes("access_denied")) return "bg-red-100 text-red-700";
  if (eventType.startsWith("session.")) return "bg-blue-100 text-blue-700";
  if (eventType.startsWith("camera.")) return "bg-green-100 text-green-700";
  if (eventType.startsWith("user.")) return "bg-purple-100 text-purple-700";
  if (eventType.startsWith("policy.")) return "bg-orange-100 text-orange-700";
  if (eventType.startsWith("api_key.")) return "bg-yellow-100 text-yellow-700";
  if (eventType.startsWith("stream_profile.") || eventType.startsWith("mediamtx.")) return "bg-cyan-100 text-cyan-700";
  if (eventType.startsWith("project.") || eventType.startsWith("site.")) return "bg-indigo-100 text-indigo-700";
  return "bg-gray-100 text-gray-700";
}

// ── Date range presets ──────────────────────────────────────────────────────

function getDateRange(preset: string): { from: string; to: string } {
  const now = new Date();
  const to = now.toISOString();
  switch (preset) {
    case "1h": return { from: new Date(now.getTime() - 3600000).toISOString(), to };
    case "24h": return { from: new Date(now.getTime() - 86400000).toISOString(), to };
    case "7d": return { from: new Date(now.getTime() - 7 * 86400000).toISOString(), to };
    case "30d": return { from: new Date(now.getTime() - 30 * 86400000).toISOString(), to };
    default: return { from: "", to: "" };
  }
}

// ── Name caches ─────────────────────────────────────────────────────────────

const nameCache = new Map<string, string>();

async function resolveNames(events: AuditEvent[]): Promise<Map<string, string>> {
  const ids = new Set<string>();
  for (const e of events) {
    if (e.actor_id) ids.add(e.actor_id);
    if (e.resource_id && e.resource_type !== "playback_session") ids.add(e.resource_id);
    const details = e.details as Record<string, unknown> | null;
    if (details?.camera_id && typeof details.camera_id === "string") ids.add(details.camera_id);
  }

  const toFetch = [...ids].filter((id) => !nameCache.has(id));
  if (toFetch.length === 0) return nameCache;

  // Batch lookup: try cameras, users, policies, profiles, projects, sites
  const lookups = [
    apiClient.get<{ data: any[] }>("/cameras?per_page=200").catch(() => ({ data: [] })),
    apiClient.get<{ data: any[] }>("/users?per_page=200").catch(() => ({ data: [] })),
    apiClient.get<{ data: any[] }>("/policies").catch(() => ({ data: [] })),
    apiClient.get<{ data: any[] }>("/stream-profiles").catch(() => ({ data: [] })),
    apiClient.get<{ data: any[] }>("/projects?per_page=200").catch(() => ({ data: [] })),
  ];

  const results = await Promise.all(lookups);

  for (const item of results.flatMap((r) => r.data ?? [])) {
    const id = item.id;
    const name = item.name ?? item.email ?? item.label ?? id;
    if (id) nameCache.set(id, name);
  }

  return nameCache;
}

function getName(id: string | null): string {
  if (!id) return "-";
  return nameCache.get(id) ?? id.slice(0, 8) + "...";
}

// ── Event type filter options ───────────────────────────────────────────────

const EVENT_TYPE_OPTIONS = Object.entries(EVENT_LABELS)
  .filter(([key]) => !HIDDEN_EVENTS.has(key))
  .map(([value, label]) => ({ value, label }));

// ── Page Component ──────────────────────────────────────────────────────────

export default function AuditPage() {
  return (
    <FeatureGate feature="audit_log">
      <AuditPageContent />
    </FeatureGate>
  );
}

function AuditPageContent() {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const { sortKey, sortDirection, handleSort, sortData } = useTableSort();
  const [selectedEvent, setSelectedEvent] = useState<AuditEvent | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [datePreset, setDatePreset] = useState("24h");
  const [eventTypeFilter, setEventTypeFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [pagination, setPagination] = useState({ page: 1, perPage: 50, total: 0, totalPages: 0 });

  const fetchEvents = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("per_page", "50");

      const range = getDateRange(datePreset);
      if (range.from) params.set("from", range.from);
      if (range.to) params.set("to", range.to);
      if (eventTypeFilter !== "all") params.set("event_type", eventTypeFilter);
      // Only send as actor_id if it looks like a UUID
      if (search && /^[0-9a-f-]{8,}$/i.test(search)) {
        params.set("actor_id", search);
      }

      const res = await apiClient.get<{
        data: AuditEvent[];
        pagination: { page: number; per_page: number; total: number; total_pages: number };
      }>(`/audit/events?${params.toString()}`);

      const allEvents = Array.isArray(res.data) ? res.data : [];
      const filtered = allEvents.filter((e) => !HIDDEN_EVENTS.has(e.event_type));

      // Resolve names for display
      await resolveNames(filtered);

      setEvents(filtered);
      setPagination({
        page: res.pagination.page,
        perPage: res.pagination.per_page,
        total: res.pagination.total,
        totalPages: res.pagination.total_pages,
      });
    } catch {
      toast.error("Failed to load audit events");
    } finally {
      setLoading(false);
    }
  }, [datePreset, eventTypeFilter, search]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  function formatActor(event: AuditEvent): string {
    const type = event.actor_type;
    const name = getName(event.actor_id);
    if (type === "user") return name;
    if (type === "api_client") return `API: ${name}`;
    if (type === "system") return "System";
    return name;
  }

  function formatResource(event: AuditEvent): string {
    const type = event.resource_type;
    const id = event.resource_id;
    if (!type || !id) return "-";

    if (type === "playback_session") {
      const details = event.details as Record<string, unknown> | null;
      const camId = details?.camera_id as string | undefined;
      return camId ? getName(camId) : id.slice(0, 8) + "...";
    }

    return getName(id);
  }

  function formatDetails(event: AuditEvent): { label: string; value: string }[] {
    const details = event.details as Record<string, unknown> | null;
    if (!details) return [];
    const items: { label: string; value: string }[] = [];

    if (details.camera_id) items.push({ label: "Camera", value: getName(details.camera_id as string) });
    if (details.ttl) items.push({ label: "TTL", value: `${details.ttl}s` });
    if (details.internal === true) items.push({ label: "Source", value: "Console (internal)" });
    if (details.internal === false || details.embed_origin) items.push({ label: "Source", value: "API (external)" });
    if (details.embed_origin) items.push({ label: "Origin", value: String(details.embed_origin) });
    if (details.reason) items.push({ label: "Reason", value: String(details.reason) });
    if (details.name) items.push({ label: "Name", value: String(details.name) });
    if (details.changes) items.push({ label: "Changes", value: JSON.stringify(details.changes, null, 2) });
    if (details.from_version) items.push({ label: "Version", value: `${details.from_version} → ${details.to_version}` });

    return items;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Audit Log</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Track all actions and events in your organization.
        </p>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <Select value={datePreset} onValueChange={setDatePreset}>
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1h">Last hour</SelectItem>
            <SelectItem value="24h">Last 24 hours</SelectItem>
            <SelectItem value="7d">Last 7 days</SelectItem>
            <SelectItem value="30d">Last 30 days</SelectItem>
            <SelectItem value="all">All time</SelectItem>
          </SelectContent>
        </Select>

        <Select value={eventTypeFilter} onValueChange={setEventTypeFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Events</SelectItem>
            {EVENT_TYPE_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex-1" />

        <Input
          placeholder="Search by name or ID..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && fetchEvents(1)}
          className="w-[250px]"
        />
      </div>

      {/* Table */}
      <div>
        <p className="text-xs text-muted-foreground mb-2">
          {pagination.total} event(s)
        </p>
        {loading ? (
          <p className="text-sm text-muted-foreground py-8 text-center">Loading...</p>
        ) : events.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">No events found.</p>
        ) : (
          <>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortableTableHead sortKey="timestamp" currentSortKey={sortKey} currentDirection={sortDirection} onSort={handleSort}>Time</SortableTableHead>
                    <SortableTableHead sortKey="event_type" currentSortKey={sortKey} currentDirection={sortDirection} onSort={handleSort}>Event</SortableTableHead>
                    <TableHead>Actor</TableHead>
                    <TableHead>Resource</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortData(events, (e: AuditEvent, key: string) => {
                    if (key === "timestamp") return e.timestamp;
                    if (key === "event_type") return e.event_type;
                    return null;
                  }).map((event) => (
                    <TableRow
                      key={event.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => { setSelectedEvent(event); setSheetOpen(true); }}
                    >
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {formatDateTime(event.timestamp)}
                      </TableCell>
                      <TableCell>
                        <Badge className={`${eventBadgeColor(event.event_type)} text-xs font-medium`}>
                          {EVENT_LABELS[event.event_type] ?? event.event_type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {formatActor(event)}
                      </TableCell>
                      <TableCell className="text-sm">
                        {formatResource(event)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="mt-4 flex items-center justify-end gap-2">
              <span className="text-xs text-muted-foreground">
                Page {pagination.page} of {pagination.totalPages || 1}
              </span>
              <Button variant="outline" size="sm" disabled={pagination.page <= 1} onClick={() => fetchEvents(pagination.page - 1)}>
                Previous
              </Button>
              <Button variant="outline" size="sm" disabled={pagination.page >= pagination.totalPages} onClick={() => fetchEvents(pagination.page + 1)}>
                Next
              </Button>
            </div>
          </>
        )}
      </div>

      {/* Event Detail Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Event Details</SheetTitle>
            <SheetDescription>
              {selectedEvent && (EVENT_LABELS[selectedEvent.event_type] ?? selectedEvent.event_type)}
            </SheetDescription>
          </SheetHeader>
          {selectedEvent && (
            <div className="mt-6 space-y-4">
              <div className="grid grid-cols-[80px_1fr] gap-y-3 gap-x-3 text-sm">
                <span className="text-muted-foreground">Time</span>
                <span>{formatDateTime(selectedEvent.timestamp)}</span>

                <span className="text-muted-foreground">Event</span>
                <Badge className={`${eventBadgeColor(selectedEvent.event_type)} text-xs font-medium w-fit`}>
                  {EVENT_LABELS[selectedEvent.event_type] ?? selectedEvent.event_type}
                </Badge>

                <span className="text-muted-foreground">Actor</span>
                <span>{formatActor(selectedEvent)}</span>

                <span className="text-muted-foreground">Resource</span>
                <span>{formatResource(selectedEvent)}</span>
              </div>

              {/* Formatted details */}
              {formatDetails(selectedEvent).length > 0 && (
                <div className="border-t pt-4">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Details</span>
                  <div className="mt-2 grid grid-cols-[80px_1fr] gap-y-2 gap-x-3 text-sm">
                    {formatDetails(selectedEvent).map((item, i) => (
                      <div key={i} className="contents">
                        <span className="text-muted-foreground">{item.label}</span>
                        {item.value.includes("\n") ? (
                          <pre className="text-xs bg-muted rounded p-2 overflow-auto">{item.value}</pre>
                        ) : (
                          <span>{item.value}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Raw JSON (collapsed) */}
              <details className="border-t pt-4">
                <summary className="text-xs text-muted-foreground cursor-pointer">Raw JSON</summary>
                <pre className="mt-2 max-h-48 overflow-auto rounded bg-muted p-3 text-[10px] font-mono">
                  {JSON.stringify(selectedEvent, null, 2)}
                </pre>
              </details>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
