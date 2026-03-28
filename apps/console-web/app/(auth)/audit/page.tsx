"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SortableTableHead, useTableSort } from "@/components/ui/sortable-table-head";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { ExportButton } from "../../../components/audit/export-button";
import { formatDateTime } from "@/lib/format-date";
import { apiClient } from "../../../lib/api-client";

interface AuditEvent {
  id: string;
  timestamp: string;
  actor_type: string;
  actor_id: string | null;
  event_type: string;
  resource_type: string | null;
  resource_id: string | null;
  source_ip: string | null;
  details: unknown;
  // camelCase aliases (in case API format varies)
  actorType?: string;
  actorId?: string | null;
  eventType?: string;
  resourceType?: string | null;
  resourceId?: string | null;
  sourceIp?: string | null;
}

interface AuditFilters {
  from: string;
  to: string;
  eventType: string;
  search: string;
}

function eventBadgeVariant(eventType?: string) {
  if (!eventType) return "secondary" as const;
  if (eventType.startsWith("session.")) return "default" as const;
  if (eventType.startsWith("camera.")) return "secondary" as const;
  if (eventType.startsWith("user.")) return "outline" as const;
  if (eventType.includes("denied")) return "destructive" as const;
  return "secondary" as const;
}

export default function AuditPage() {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const { sortKey, sortDirection, handleSort, sortData } = useTableSort();
  const [selectedEvent, setSelectedEvent] = useState<AuditEvent | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [filters, setFilters] = useState<AuditFilters>({
    from: "",
    to: "",
    eventType: "",
    search: "",
  });
  const [pagination, setPagination] = useState({
    page: 1,
    perPage: 50,
    total: 0,
    totalPages: 0,
  });

  async function fetchEvents(page = 1) {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("per_page", "50");
      if (filters.from) params.set("from", filters.from);
      if (filters.to) params.set("to", filters.to);
      if (filters.eventType) params.set("event_type", filters.eventType);
      if (filters.search) {
        // Search across actor_id, camera_id, session_id
        params.set("actor_id", filters.search);
      }

      const res = await apiClient.get<{
        data: AuditEvent[];
        pagination: {
          page: number;
          per_page: number;
          total: number;
          total_pages: number;
        };
      }>(`/audit/events?${params.toString()}`);

      setEvents(Array.isArray(res.data) ? res.data : []);
      setPagination({
        page: res.pagination.page,
        perPage: res.pagination.per_page,
        total: res.pagination.total,
        totalPages: res.pagination.total_pages,
      });
    } catch {
      // Could not fetch events
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchEvents();
  }, []);

  function handleSearch() {
    fetchEvents(1);
  }

  function handleRowClick(event: AuditEvent) {
    setSelectedEvent(event);
    setSheetOpen(true);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Audit Logs</h1>
          <p className="mt-1 text-gray-600">
            Review all actions and events in your organization.
          </p>
        </div>
        <ExportButton filters={filters} />
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4">
            <div className="space-y-1">
              <Label htmlFor="from">From</Label>
              <Input
                id="from"
                type="datetime-local"
                value={filters.from}
                onChange={(e) =>
                  setFilters({ ...filters, from: e.target.value })
                }
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="to">To</Label>
              <Input
                id="to"
                type="datetime-local"
                value={filters.to}
                onChange={(e) =>
                  setFilters({ ...filters, to: e.target.value })
                }
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="event-type">Event Type</Label>
              <Input
                id="event-type"
                value={filters.eventType}
                onChange={(e) =>
                  setFilters({ ...filters, eventType: e.target.value })
                }
                placeholder="e.g. session.issued"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="search">Search (ID)</Label>
              <Input
                id="search"
                value={filters.search}
                onChange={(e) =>
                  setFilters({ ...filters, search: e.target.value })
                }
                placeholder="Session / Camera / Actor ID"
              />
            </div>
            <div className="flex items-end">
              <Button onClick={handleSearch}>Search</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Events Table */}
      <div>
        <p className="text-sm text-muted-foreground mb-3">
          {pagination.total} event(s) found.
        </p>
        {loading ? (
          <p className="text-sm text-muted-foreground py-8 text-center">Loading...</p>
        ) : (
          <>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortableTableHead sortKey="timestamp" currentSortKey={sortKey} currentDirection={sortDirection} onSort={handleSort}>Timestamp</SortableTableHead>
                    <SortableTableHead sortKey="event_type" currentSortKey={sortKey} currentDirection={sortDirection} onSort={handleSort}>Event Type</SortableTableHead>
                    <TableHead>Actor</TableHead>
                    <TableHead>Resource</TableHead>
                    <TableHead>Source IP</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortData(events, (e: AuditEvent, key: string) => {
                    if (key === "timestamp") return e.timestamp
                    if (key === "event_type") return e.event_type
                    return null
                  }).map((event) => (
                    <TableRow
                      key={event.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleRowClick(event)}
                    >
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDateTime(event.timestamp)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={eventBadgeVariant(event.event_type ?? event.eventType)}>
                          {event.event_type ?? event.eventType}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm font-mono text-muted-foreground">
                        {(event.actor_id ?? event.actorId)
                          ? `${event.actor_type ?? event.actorType}:${(event.actor_id ?? event.actorId)!.slice(0, 8)}...`
                          : (event.actor_type ?? event.actorType)}
                      </TableCell>
                      <TableCell className="text-sm font-mono text-muted-foreground">
                        {(event.resource_type ?? event.resourceType) && (event.resource_id ?? event.resourceId)
                          ? `${event.resource_type ?? event.resourceType}:${(event.resource_id ?? event.resourceId)!.slice(0, 8)}...`
                          : "-"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {event.source_ip ?? event.sourceIp ?? "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="mt-4 flex items-center justify-end gap-2">
              <span className="text-sm text-muted-foreground">
                Page {pagination.page} of {pagination.totalPages || 1}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={pagination.page <= 1}
                onClick={() => fetchEvents(pagination.page - 1)}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => fetchEvents(pagination.page + 1)}
              >
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
              Full audit event information.
            </SheetDescription>
          </SheetHeader>
          {selectedEvent && (
            <div className="mt-6 space-y-4">
              <div>
                <Label className="text-xs text-muted-foreground">
                  Event ID
                </Label>
                <p className="font-mono text-sm">{selectedEvent.id}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">
                  Timestamp
                </Label>
                <p className="text-sm">
                  {formatDateTime(selectedEvent.timestamp)}
                </p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">
                  Event Type
                </Label>
                <p className="text-sm">{selectedEvent.eventType}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Actor</Label>
                <p className="text-sm">
                  {selectedEvent.actorType}
                  {selectedEvent.actorId
                    ? ` (${selectedEvent.actorId})`
                    : ""}
                </p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">
                  Resource
                </Label>
                <p className="text-sm">
                  {selectedEvent.resourceType ?? "N/A"}
                  {selectedEvent.resourceId
                    ? ` (${selectedEvent.resourceId})`
                    : ""}
                </p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">
                  Source IP
                </Label>
                <p className="text-sm">{selectedEvent.sourceIp ?? "N/A"}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">
                  Details
                </Label>
                <pre className="mt-1 max-h-64 overflow-auto rounded bg-muted p-3 text-xs">
                  {JSON.stringify(selectedEvent.details, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
