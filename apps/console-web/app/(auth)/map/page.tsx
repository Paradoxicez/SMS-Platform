"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import { useCameraStatusStream } from "@/hooks/use-camera-status-stream";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { ChevronsLeft, ChevronsRight, X } from "lucide-react";
import { apiClient } from "../../../lib/api-client";
import { SiteCameraPanel } from "../../../components/map/site-camera-panel";
import type { MapCamera } from "../../(public)/map/[projectKey]/page";
import type { MapViewHandle } from "../../../components/map/map-view";

const MapView = dynamic(
  () => import("../../../components/map/map-view"),
  { ssr: false, loading: () => <MapLoadingSkeleton /> },
);

function MapLoadingSkeleton() {
  return (
    <div className="flex h-full items-center justify-center bg-gray-50">
      <p className="text-muted-foreground">Loading map...</p>
    </div>
  );
}

export default function AdminMapPage() {
  const [cameras, setCameras] = useState<MapCamera[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [projectFilter, setProjectFilter] = useState<string>("all");
  const [siteFilter, setSiteFilter] = useState<string>("all");
  const [tagFilter, setTagFilter] = useState<string>("all");
  const [allTags, setAllTags] = useState<string[]>([]);
  const [projectsList, setProjectsList] = useState<{ id: string; name: string }[]>([]);
  const [sitesList, setSitesList] = useState<{ id: string; name: string; project_id: string }[]>([]);
  const [panelOpen, setPanelOpen] = useState(true);
  const mapViewRef = useRef<MapViewHandle>(null);

  // Pin mode state
  const [pinModeTarget, setPinModeTarget] = useState<string | null>(null);
  const [pinModeName, setPinModeName] = useState<string>("");

  // Load all projects + sites once
  useEffect(() => {
    apiClient
      .listProjects(1, 100)
      .then(async (projectsRes) => {
        const projects = projectsRes.data ?? [];
        setProjectsList(projects.map((p: any) => ({ id: p.id, name: p.name })));

        const allSites: { id: string; name: string; project_id: string }[] = [];
        for (const project of projects) {
          try {
            const sitesRes = await apiClient.listSites(project.id, 1, 100);
            for (const site of sitesRes.data ?? []) {
              allSites.push({ id: site.id, name: site.name, project_id: project.id });
            }
          } catch { /* skip */ }
        }
        setSitesList(allSites);
      })
      .catch(() => {});

    // Collect unique tags
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
  }, []);

  // Filtered sites based on selected project
  const filteredSites =
    projectFilter === "all"
      ? sitesList
      : sitesList.filter((s) => s.project_id === projectFilter);

  // Real-time camera status updates
  useCameraStatusStream((event) => {
    setCameras((prev) =>
      prev.map((cam) =>
        cam.id === event.camera_id
          ? { ...cam, status: event.new_state }
          : cam,
      ),
    );
  });

  const fetchCameras = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.listCameras({
        status: statusFilter !== "all" ? statusFilter : undefined,
        site_id: siteFilter !== "all" ? siteFilter : undefined,
        tags: tagFilter !== "all" ? tagFilter : undefined,
        per_page: 500,
      });

      let filtered = res.data ?? [];

      // Client-side project filter when site is "all"
      if (projectFilter !== "all" && siteFilter === "all") {
        const projectSiteIds = new Set(
          sitesList.filter((s) => s.project_id === projectFilter).map((s) => s.id),
        );
        filtered = filtered.filter((c: any) => projectSiteIds.has(c.site_id));
      }

      const mapCameras: MapCamera[] = filtered.map(
        (cam: Record<string, unknown>) => ({
          id: cam.id as string,
          name: cam.name as string,
          lat: cam.lat as number | null,
          lng: cam.lng as number | null,
          status: cam.health_status as string,
          thumbnail_url: cam.thumbnail_url as string | null,
          tags: (cam.tags as string[]) ?? [],
          site_name: cam.site_name as string | undefined,
          created_at: cam.created_at as string | undefined,
        }),
      );

      setCameras(mapCameras);
    } catch {
      setCameras([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, siteFilter, tagFilter, projectFilter, sitesList]);

  useEffect(() => {
    fetchCameras();
  }, [fetchCameras]);

  function handleFocusCamera(camera: MapCamera) {
    mapViewRef.current?.focusCamera(camera);
  }

  function handlePinCamera(camera: MapCamera) {
    if (cameras.some((c) => c.id === camera.id)) return;
    setCameras((prev) => [...prev, camera]);
    setTimeout(() => {
      mapViewRef.current?.focusCamera(camera);
    }, 100);
  }

  function handleStartPinMode(cameraId: string, cameraName: string) {
    setPinModeTarget(cameraId);
    setPinModeName(cameraName);
  }

  function handleCancelPinMode() {
    setPinModeTarget(null);
    setPinModeName("");
  }

  async function handleMapClick(lat: number, lng: number) {
    if (!pinModeTarget) return;

    try {
      // Fetch current camera version for OCC
      const camRes = await apiClient.get<{ data: { version: number } }>(
        `/cameras/${pinModeTarget}`,
      );
      const version = camRes.data.version;
      await apiClient.patch(`/cameras/${pinModeTarget}`, { lat, lng, version });

      // Update local camera data or add it
      setCameras((prev) => {
        const exists = prev.find((c) => c.id === pinModeTarget);
        if (exists) {
          return prev.map((c) =>
            c.id === pinModeTarget ? { ...c, lat, lng } : c,
          );
        }
        return [
          ...prev,
          {
            id: pinModeTarget,
            name: pinModeName,
            lat,
            lng,
            status: "online",
            thumbnail_url: null,
          },
        ];
      });

      // Focus on the newly pinned camera
      setTimeout(() => {
        mapViewRef.current?.focusCamera({
          id: pinModeTarget,
          name: pinModeName,
          lat,
          lng,
          status: "online",
          thumbnail_url: null,
        });
      }, 100);
    } catch {
      // Handle error
    } finally {
      setPinModeTarget(null);
      setPinModeName("");
    }
  }

  return (
    <div
      className="relative h-[calc(100vh-3rem)] w-full overflow-hidden -m-6 -mt-6"
      style={{ width: "calc(100% + 3rem)", height: "calc(100vh - 3rem)" }}
    >
      {/* Map — full size background */}
      <div className="absolute inset-0">
        {loading ? (
          <MapLoadingSkeleton />
        ) : (
          <MapView
            ref={mapViewRef}
            cameras={cameras}
            isPublic={false}
            pinMode={!!pinModeTarget}
            onMapClick={handleMapClick}
          />
        )}
      </div>

      {/* Pin mode banner */}
      {pinModeTarget && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[600] flex items-center gap-3 rounded-lg bg-blue-600 text-white px-4 py-2 shadow-lg">
          <span className="text-sm font-medium">
            Click on the map to set location for{" "}
            <strong>{pinModeName}</strong>
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 text-white hover:bg-blue-700 hover:text-white"
            onClick={handleCancelPinMode}
          >
            <X className="size-4" />
          </Button>
        </div>
      )}

      {/* Side panel — slide in/out */}
      <div
        className={`absolute left-0 top-0 bottom-0 z-[500] flex transition-transform duration-300 ease-in-out ${
          panelOpen ? "translate-x-0" : "-translate-x-72"
        }`}
      >
        <SiteCameraPanel
          cameras={cameras}
          onFocusCamera={handleFocusCamera}
          onPinCamera={handlePinCamera}
          onStartPinMode={handleStartPinMode}
          pinModeTarget={pinModeTarget}
        />
        <button
          onClick={() => setPanelOpen(!panelOpen)}
          className="absolute -right-8 top-3 z-[501] flex h-8 w-8 items-center justify-center rounded-r-lg bg-background/40 backdrop-blur-md border border-l-0 shadow-md hover:bg-background/60 transition-colors"
          title={panelOpen ? "Hide panel" : "Show panel"}
        >
          {panelOpen ? (
            <ChevronsLeft className="size-4" />
          ) : (
            <ChevronsRight className="size-4" />
          )}
        </button>
      </div>

      {/* Filter bar — top right floating */}
      <div className="absolute top-3 right-3 z-[1001] flex items-center gap-2 rounded-lg bg-background/40 backdrop-blur-md border shadow-md px-2 py-1.5">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-7 w-[120px] text-xs border-0 bg-transparent shadow-none">
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

        <div className="h-4 w-px bg-border" />

        <Select
          value={projectFilter}
          onValueChange={(v) => {
            setProjectFilter(v);
            setSiteFilter("all");
          }}
        >
          <SelectTrigger className="h-7 w-[130px] text-xs border-0 bg-transparent shadow-none">
            <SelectValue placeholder="Project" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Projects</SelectItem>
            {projectsList.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="h-4 w-px bg-border" />

        <Select value={siteFilter} onValueChange={setSiteFilter}>
          <SelectTrigger className="h-7 w-[130px] text-xs border-0 bg-transparent shadow-none">
            <SelectValue placeholder="Site" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sites</SelectItem>
            {filteredSites.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {allTags.length > 0 && (
          <>
            <div className="h-4 w-px bg-border" />
            <Select value={tagFilter} onValueChange={setTagFilter}>
              <SelectTrigger className="h-7 w-[120px] text-xs border-0 bg-transparent shadow-none">
                <SelectValue placeholder="Tag" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Tags</SelectItem>
                {allTags.map((tag) => (
                  <SelectItem key={tag} value={tag}>
                    {tag}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        )}
      </div>
    </div>
  );
}
