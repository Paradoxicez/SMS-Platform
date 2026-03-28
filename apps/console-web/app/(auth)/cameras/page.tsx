"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Camera as CameraIcon, Upload, MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
import type { Camera } from "@repo/types";
import { apiClient, type StreamProfile } from "../../../lib/api-client";
import { parseCsv, type CsvParseResult } from "../../../lib/csv-parser";
import { AddCameraDialog } from "../../../components/cameras/add-camera-dialog";
import { CameraDetailSheet } from "../../../components/cameras/camera-detail-sheet";
import { BulkAssignDialog } from "../../../components/cameras/bulk-assign-dialog";
import { CsvDropZone } from "../../../components/cameras/csv-drop-zone";
import { CsvImportDialog } from "../../../components/cameras/csv-import-dialog";
import { EditCameraDialog } from "../../../components/cameras/edit-camera-dialog";
import { SortableTableHead, useTableSort } from "@/components/ui/sortable-table-head";
import { useCameraStatusStream } from "../../../hooks/use-camera-status-stream";

type HealthStatus = Camera["health_status"];

function StatusBadge({ status }: { status: HealthStatus }) {
  switch (status) {
    case "online":
      return (
        <Badge className="bg-green-100 text-green-700 hover:bg-green-200">
          Online
        </Badge>
      );
    case "offline":
      return <Badge variant="destructive">Offline</Badge>;
    case "degraded":
      return (
        <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-200">
          Degraded
        </Badge>
      );
    case "connecting":
      return (
        <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-200">
          Connecting
        </Badge>
      );
    case "reconnecting":
      return (
        <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-200">
          Reconnecting
        </Badge>
      );
    case "stopping":
      return (
        <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-200 animate-pulse">
          Stopping
        </Badge>
      );
    case "stopped":
      return <Badge variant="secondary">Stopped</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

export default function CamerasPage() {
  const searchParams = useSearchParams();
  const importParam = searchParams.get("import");
  const preselectedProfileParam = searchParams.get("profile");
  const tagParam = searchParams.get("tag");

  const [cameras, setCameras] = useState<Camera[]>([]);
  const [loading, setLoading] = useState(true);
  const { sortKey, sortDirection, handleSort, sortData } = useTableSort();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [siteFilter, setSiteFilter] = useState<string>("all");
  const [tagFilter, setTagFilter] = useState<string>(tagParam ?? "all");
  const [allTags, setAllTags] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedCamera, setSelectedCamera] = useState<Camera | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editCamera, setEditCamera] = useState<Camera | null>(null);
  const [profiles, setProfiles] = useState<StreamProfile[]>([]);
  const [siteNames, setSiteNames] = useState<Record<string, string>>({});
  const [projectFilter, setProjectFilter] = useState<string>("all");
  const [projectsList, setProjectsList] = useState<{ id: string; name: string }[]>([]);
  const [sitesList, setSitesList] = useState<{ id: string; name: string; project_id: string }[]>([]);

  // T214: Bulk selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // T215: Bulk assign dialog
  const [bulkAssignOpen, setBulkAssignOpen] = useState(false);

  // T222: CSV import state
  const [csvDropZoneOpen, setCsvDropZoneOpen] = useState(false);
  const [csvDialogOpen, setCsvDialogOpen] = useState(false);
  const [csvParseResult, setCsvParseResult] = useState<CsvParseResult | null>(
    null,
  );

  // Real-time camera status updates via SSE
  useCameraStatusStream((event) => {
    setCameras((prev) =>
      prev.map((cam) =>
        cam.id === event.camera_id
          ? { ...cam, health_status: event.new_state as HealthStatus }
          : cam,
      ),
    );
  });

  useEffect(() => {
    apiClient
      .listProfiles()
      .then((res) => setProfiles(res.data ?? []))
      .catch(() => setProfiles([]));

    // Collect unique tags from all cameras
    apiClient
      .listCameras({ per_page: 500 })
      .then((res) => {
        const tags = new Set<string>();
        for (const cam of res.data ?? []) {
          for (const tag of ((cam as any).tags ?? []) as string[]) {
            tags.add(tag);
          }
        }
        setAllTags(Array.from(tags).sort());
      })
      .catch(() => {});

    // Fetch all projects and sites for filters + name lookup
    apiClient
      .listProjects(1, 100)
      .then(async (projectsRes) => {
        const projects = projectsRes.data ?? [];
        setProjectsList(projects.map((p: any) => ({ id: p.id, name: p.name })));

        const lookup: Record<string, string> = {};
        const allSites: { id: string; name: string; project_id: string }[] = [];
        for (const project of projects) {
          try {
            const sitesRes = await apiClient.listSites(project.id, 1, 100);
            for (const site of sitesRes.data ?? []) {
              lookup[site.id] = site.name;
              allSites.push({ id: site.id, name: site.name, project_id: project.id });
            }
          } catch { /* skip */ }
        }
        setSiteNames(lookup);
        setSitesList(allSites);
      })
      .catch(() => {});
  }, []);

  // T222: Auto-open CSV import if navigated with ?import=true
  useEffect(() => {
    if (importParam === "true") {
      setCsvDropZoneOpen(true);
    }
  }, [importParam]);

  const fetchCameras = useCallback(async () => {
    setLoading(true);
    try {
      const response = await apiClient.listCameras({
        status: statusFilter !== "all" ? statusFilter : undefined,
        search: searchQuery || undefined,
        site_id: siteFilter !== "all" ? siteFilter : undefined,
        tags: tagFilter !== "all" ? tagFilter : undefined,
        page,
        per_page: 20,
      });
      let filtered = response.data ?? [];

      // Client-side project filter: if project selected but site is "all",
      // filter cameras whose site_id belongs to the selected project
      if (projectFilter !== "all" && siteFilter === "all") {
        const projectSiteIds = new Set(
          sitesList.filter((s) => s.project_id === projectFilter).map((s) => s.id)
        );
        filtered = filtered.filter((c: any) => projectSiteIds.has(c.site_id));
      }

      setCameras(filtered);
      setTotalPages(response.pagination?.total_pages ?? 1);
      setTotal(response.pagination?.total ?? 0);
    } catch {
      setCameras([]);
      setTotalPages(1);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, searchQuery, siteFilter, tagFilter, page, projectFilter]);

  useEffect(() => {
    fetchCameras();
  }, [fetchCameras]);

  const handleAssignProfile = async (cameraId: string, profileId: string) => {
    try {
      await apiClient.assignProfileToCamera(cameraId, profileId);
      await fetchCameras();
    } catch {
      // Error handled by api client
    }
  };

  const handleStartCamera = async (id: string) => {
    try {
      await apiClient.startCamera(id);
      await fetchCameras();
    } catch {
      // Error handled by api client
    }
  };

  const handleStopCamera = async (id: string) => {
    try {
      await apiClient.stopCamera(id);
      await fetchCameras();
    } catch {
      // Error handled by api client
    }
  };

  const handleDeleteCamera = async (id: string) => {
    try {
      await apiClient.deleteCamera(id);
      await fetchCameras();
    } catch {
      // Error handled by api client
    }
  };

  // T214: Checkbox helpers
  const allSelected =
    cameras.length > 0 && cameras.every((c) => selectedIds.has(c.id));

  const toggleAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(cameras.map((c) => c.id)));
    }
  };

  const toggleCamera = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // T215: Bulk action handlers
  const handleBulkAssign = async (profileId: string) => {
    try {
      const ids = Array.from(selectedIds);
      const res = await apiClient.bulkAssignProfile(ids, profileId);
      toast.success(`Profile assigned to ${res.data.updated_count} camera(s)`);
      setBulkAssignOpen(false);
      setSelectedIds(new Set());
      await fetchCameras();
    } catch {
      toast.error("Failed to assign profile");
    }
  };

  const handleBulkStart = async () => {
    try {
      for (const id of selectedIds) {
        await apiClient.startCamera(id);
      }
      toast.success(`Started ${selectedIds.size} camera(s)`);
      setSelectedIds(new Set());
      await fetchCameras();
    } catch {
      toast.error("Failed to start cameras");
    }
  };

  const handleBulkStop = async () => {
    try {
      for (const id of selectedIds) {
        await apiClient.stopCamera(id);
      }
      toast.success(`Stopped ${selectedIds.size} camera(s)`);
      setSelectedIds(new Set());
      await fetchCameras();
    } catch {
      toast.error("Failed to stop cameras");
    }
  };

  // T222: CSV file handling
  const handleCsvFileSelected = async (file: File) => {
    try {
      const text = await file.text();
      const result = parseCsv(text);
      setCsvParseResult(result);
      setCsvDropZoneOpen(false);
      setCsvDialogOpen(true);
    } catch {
      toast.error("Failed to parse CSV file");
    }
  };

  const handleCsvImport = async (data: {
    mode: "add-cameras" | "assign-profiles";
    rows: Record<string, string>[];
  }) => {
    try {
      if (data.mode === "add-cameras") {
        const camerasData = data.rows.map((row) => ({
          name: row["name"] ?? "",
          rtsp_url: row["rtsp_url"] ?? "",
          site_id: row["site_id"] ?? row["site"] ?? "",
          profile_id: row["__profileId"] || undefined,
          lat: row["lat"] ? parseFloat(row["lat"]) : undefined,
          lng: row["lng"] ? parseFloat(row["lng"]) : undefined,
        }));

        const res = await apiClient.importCameras(camerasData);
        toast.success(
          `Imported ${res.data.imported} camera(s), skipped ${res.data.skipped}`,
        );
      } else {
        const mappings = data.rows.map((row) => ({
          camera_name: row["camera_name"] ?? row["name"] ?? "",
          profile_name: row["profile_name"] ?? row["profile"] ?? "",
        }));

        const res = await apiClient.importProfiles(mappings);
        toast.success(
          `Updated ${res.data.updated} camera(s), ${res.data.not_found} not found`,
        );
      }

      setCsvDialogOpen(false);
      setCsvParseResult(null);
      await fetchCameras();
    } catch {
      toast.error("Import failed");
    }
  };

  function formatUptime(createdAt: string) {
    if (!createdAt) return "-";
    const diff = Date.now() - new Date(createdAt).getTime();
    if (diff < 0) return "-";
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  }

  function formatLastSeen(lastSeenAt: string | null | undefined) {
    if (!lastSeenAt) return "Never";
    const diff = Date.now() - new Date(lastSeenAt).getTime();
    if (diff < 0) return "Just now";
    const minutes = Math.floor(diff / (1000 * 60));
    if (minutes < 1) return "Just now";
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours < 1) return `${minutes}m ago`;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days < 1) return `${hours}h ago`;
    return `${days}d ago`;
  }

  function maskRtspUrl(url: string) {
    try {
      const parsed = new URL(url);
      return `rtsp://***@${parsed.hostname}:***`;
    } catch {
      return "***";
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Cameras</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage and monitor your CCTV cameras. {total} camera(s) total.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setCsvDropZoneOpen(!csvDropZoneOpen)}
          >
            <Upload className="mr-2 size-4" />
            Import
          </Button>
          <Button onClick={() => setDialogOpen(true)}>Add Camera</Button>
        </div>
      </div>

      {/* CSV Drop Zone */}
      {csvDropZoneOpen && (
        <CsvDropZone onFileSelected={handleCsvFileSelected} />
      )}

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="online">Online</SelectItem>
            <SelectItem value="offline">Offline</SelectItem>
            <SelectItem value="degraded">Degraded</SelectItem>
            <SelectItem value="connecting">Connecting</SelectItem>
            <SelectItem value="stopping">Stopping</SelectItem>
            <SelectItem value="stopped">Stopped</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={projectFilter}
          onValueChange={(v) => {
            setProjectFilter(v);
            setSiteFilter("all"); // reset site when project changes
          }}
        >
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Project" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Projects</SelectItem>
            {projectsList.map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={siteFilter} onValueChange={setSiteFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Site" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sites</SelectItem>
            {(projectFilter === "all"
              ? sitesList
              : sitesList.filter((s) => s.project_id === projectFilter)
            ).map((s) => (
              <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {allTags.length > 0 && (
          <Select value={tagFilter} onValueChange={setTagFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Tag" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Tags</SelectItem>
              {allTags.map((tag) => (
                <SelectItem key={tag} value={tag}>{tag}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <div className="flex-1" />

        <Input
          placeholder="Search by name..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-[250px]"
        />
      </div>

      {/* T215: Bulk Action Toolbar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 rounded-lg border bg-muted/50 px-4 py-2">
          <span className="text-sm font-medium">
            {selectedIds.size} selected
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setBulkAssignOpen(true)}
          >
            Assign Profile
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleBulkStart()}>
            Start All
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleBulkStop()}>
            Stop All
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSelectedIds(new Set())}
          >
            Clear
          </Button>
        </div>
      )}

      {/* Data Table */}
      {loading ? (
        <div className="flex h-32 items-center justify-center text-muted-foreground">
          Loading cameras...
        </div>
      ) : cameras.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16">
          <div className="flex size-12 items-center justify-center rounded-full bg-muted">
            <CameraIcon className="size-6 text-muted-foreground" />
          </div>
          {statusFilter !== "all" || searchQuery || siteFilter !== "all" || projectFilter !== "all" ? (
            <>
              <h3 className="mt-4 text-lg font-semibold">No cameras found</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                No cameras match the current filters. Try adjusting your search.
              </p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => {
                  setStatusFilter("all");
                  setSearchQuery("");
                  setSiteFilter("all");
                  setProjectFilter("all");
                }}
              >
                Clear Filters
              </Button>
            </>
          ) : (
            <>
              <h3 className="mt-4 text-lg font-semibold">No cameras yet</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Add your first camera to start monitoring.
              </p>
              <Button className="mt-4" onClick={() => setDialogOpen(true)}>
                Add Camera
              </Button>
            </>
          )}
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={toggleAll}
                  />
                </TableHead>
                <SortableTableHead sortKey="name" currentSortKey={sortKey} currentDirection={sortDirection} onSort={handleSort}>Name</SortableTableHead>
                <SortableTableHead sortKey="site" currentSortKey={sortKey} currentDirection={sortDirection} onSort={handleSort}>Site</SortableTableHead>
                <SortableTableHead sortKey="status" currentSortKey={sortKey} currentDirection={sortDirection} onSort={handleSort}>Status</SortableTableHead>
                <TableHead>RTSP URL</TableHead>
                <TableHead>Profile</TableHead>
                <TableHead>Tags</TableHead>
                <TableHead>Uptime</TableHead>
                <TableHead>Last Seen</TableHead>
                <TableHead className="w-[50px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortData(cameras, (c: Camera, key: string) => {
                if (key === "name") return c.name
                if (key === "site") return siteNames[(c as any).site_id ?? (c as any).siteId] ?? ""
                if (key === "status") return c.health_status
                return null
              }).map((camera) => (
                <TableRow key={camera.id}>
                  <TableCell>
                    <Checkbox
                      checked={selectedIds.has(camera.id)}
                      onCheckedChange={() => toggleCamera(camera.id)}
                    />
                  </TableCell>
                  <TableCell>
                    <button
                      className="text-left font-medium text-blue-600 hover:underline"
                      onClick={() => {
                        setSelectedCamera(camera);
                        setSheetOpen(true);
                      }}
                    >
                      {camera.name}
                    </button>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-muted-foreground">
                      {siteNames[(camera as any).site_id ?? (camera as any).siteId] ?? (camera as any).site_id ?? "-"}
                    </span>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={camera.health_status} />
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-muted-foreground">
                      {maskRtspUrl(camera.rtsp_url)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-muted-foreground">
                      {profiles.find((p) => p.id === (camera as any).profile_id)?.name ?? "Default"}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {((camera as any).tags as string[] ?? []).map((tag: string) => (
                        <Badge
                          key={tag}
                          variant="outline"
                          className="text-xs cursor-pointer hover:bg-accent"
                          onClick={() => setTagFilter(tag)}
                        >
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-muted-foreground">
                      {formatUptime(camera.created_at)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-muted-foreground">
                      {formatLastSeen((camera as any).last_seen_at)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="size-8">
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => {
                            setSelectedCamera(camera);
                            setSheetOpen(true);
                          }}
                        >
                          View Details
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            setEditCamera(camera);
                            setEditDialogOpen(true);
                          }}
                        >
                          Edit
                        </DropdownMenuItem>
                        {camera.health_status === "stopped" ||
                        camera.health_status === "offline" ? (
                          <DropdownMenuItem
                            onClick={() => handleStartCamera(camera.id)}
                          >
                            Start Stream
                          </DropdownMenuItem>
                        ) : camera.health_status === "stopping" ? (
                          <DropdownMenuItem disabled>
                            Stopping...
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem
                            onClick={() => handleStopCamera(camera.id)}
                          >
                            Stop Stream
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSub>
                          <DropdownMenuSubTrigger>
                            Assign Profile
                          </DropdownMenuSubTrigger>
                          <DropdownMenuSubContent>
                            {profiles.map((profile) => (
                              <DropdownMenuItem
                                key={profile.id}
                                onClick={() =>
                                  handleAssignProfile(camera.id, profile.id)
                                }
                              >
                                {profile.name}
                                {profile.is_default && " (Default)"}
                              </DropdownMenuItem>
                            ))}
                            {profiles.length === 0 && (
                              <DropdownMenuItem disabled>
                                No profiles available
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuSubContent>
                        </DropdownMenuSub>
                        <DropdownMenuItem
                          className="text-red-600"
                          onClick={() => handleDeleteCamera(camera.id)}
                        >
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
          >
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
          >
            Next
          </Button>
        </div>
      )}

      {/* Add Camera Dialog */}
      <AddCameraDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSuccess={() => {
          setDialogOpen(false);
          fetchCameras();
        }}
      />

      {/* Camera Detail Sheet */}
      {selectedCamera && (
        <CameraDetailSheet
          camera={selectedCamera}
          open={sheetOpen}
          onOpenChange={setSheetOpen}
          onStart={handleStartCamera}
          onStop={handleStopCamera}
          onUpdated={fetchCameras}
        />
      )}

      {/* Edit Camera Dialog */}
      {editCamera && (
        <EditCameraDialog
          camera={editCamera}
          open={editDialogOpen}
          onOpenChange={(open) => {
            setEditDialogOpen(open);
            if (!open) setEditCamera(null);
          }}
          onSuccess={fetchCameras}
        />
      )}

      {/* T216: Bulk Assign Dialog */}
      <BulkAssignDialog
        open={bulkAssignOpen}
        onClose={() => setBulkAssignOpen(false)}
        selectedCount={selectedIds.size}
        onAssign={handleBulkAssign}
      />

      {/* T220/T221: CSV Import Dialog */}
      <CsvImportDialog
        open={csvDialogOpen}
        onClose={() => {
          setCsvDialogOpen(false);
          setCsvParseResult(null);
        }}
        parseResult={csvParseResult}
        onImport={handleCsvImport}
        existingCameras={cameras}
        preselectedProfileId={preselectedProfileParam ?? undefined}
      />
    </div>
  );
}
