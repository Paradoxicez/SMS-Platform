"use client";

import { useEffect, useState, useCallback } from "react";
// Badge unused but kept for future use

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  ChevronRight,
  MapPin,
  Crosshair,
  FolderKanban,
  Building2,
  Camera,
} from "lucide-react";
import { apiClient } from "../../lib/api-client";
import type { MapCamera } from "../../app/(public)/map/[projectKey]/page";

interface Project {
  id: string;
  name: string;
}

interface Site {
  id: string;
  name: string;
  project_id: string;
  lat: number | null;
  lng: number | null;
}

interface CameraItem {
  id: string;
  name: string;
  lat: number | null;
  lng: number | null;
  health_status: string;
  thumbnail_url: string | null;
  site_id: string;
}

interface SiteCameraPanelProps {
  onFocusCamera: (camera: MapCamera) => void;
  onPinCamera: (camera: MapCamera) => void;
  onStartPinMode: (cameraId: string, cameraName: string) => void;
  pinModeTarget: string | null;
  cameras: MapCamera[];
}

function statusColor(status: string) {
  switch (status) {
    case "online":
      return "bg-green-500";
    case "offline":
    case "stopped":
      return "bg-red-500";
    case "degraded":
      return "bg-yellow-500";
    case "stopping":
      return "bg-orange-500";
    default:
      return "bg-gray-400";
  }
}

export function SiteCameraPanel({
  onFocusCamera,
  onPinCamera: _onPinCamera,
  onStartPinMode,
  pinModeTarget,
  cameras: _cameras,
}: SiteCameraPanelProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [sitesByProject, setSitesByProject] = useState<
    Record<string, Site[]>
  >({});
  const [camerasBySite, setCamerasBySite] = useState<
    Record<string, CameraItem[]>
  >({});
  const [openProjects, setOpenProjects] = useState<Set<string>>(new Set());
  const [openSites, setOpenSites] = useState<Set<string>>(new Set());
  const [loadingSites, setLoadingSites] = useState<Set<string>>(new Set());
  const [loadingCameras, setLoadingCameras] = useState<Set<string>>(
    new Set(),
  );

  useEffect(() => {
    async function fetchProjects() {
      try {
        const res = await apiClient.listProjects(1, 100);
        setProjects(
          res.data.map((p: Record<string, unknown>) => ({
            id: p.id as string,
            name: p.name as string,
          })),
        );
      } catch {
        // Ignore
      }
    }
    fetchProjects();
  }, []);

  const toggleProject = useCallback(
    async (projectId: string) => {
      setOpenProjects((prev) => {
        const next = new Set(prev);
        if (next.has(projectId)) {
          next.delete(projectId);
        } else {
          next.add(projectId);
        }
        return next;
      });

      // Load sites if not already loaded
      if (!sitesByProject[projectId]) {
        setLoadingSites((prev) => new Set(prev).add(projectId));
        try {
          const res = await apiClient.listSites(projectId, 1, 100);
          setSitesByProject((prev) => ({
            ...prev,
            [projectId]: res.data.map((s: Record<string, unknown>) => ({
              id: s.id as string,
              name: s.name as string,
              project_id: s.project_id as string,
              lat: s.lat as number | null,
              lng: s.lng as number | null,
            })),
          }));
        } catch {
          setSitesByProject((prev) => ({ ...prev, [projectId]: [] }));
        } finally {
          setLoadingSites((prev) => {
            const next = new Set(prev);
            next.delete(projectId);
            return next;
          });
        }
      }
    },
    [sitesByProject],
  );

  const toggleSite = useCallback(
    async (siteId: string) => {
      setOpenSites((prev) => {
        const next = new Set(prev);
        if (next.has(siteId)) {
          next.delete(siteId);
        } else {
          next.add(siteId);
        }
        return next;
      });

      // Load cameras if not already loaded
      if (!camerasBySite[siteId]) {
        setLoadingCameras((prev) => new Set(prev).add(siteId));
        try {
          const res = await apiClient.listCameras({
            site_id: siteId,
            per_page: 100,
          });
          setCamerasBySite((prev) => ({
            ...prev,
            [siteId]: res.data.map((c: Record<string, unknown>) => ({
              id: c.id as string,
              name: c.name as string,
              lat: c.lat as number | null,
              lng: c.lng as number | null,
              health_status: c.health_status as string,
              thumbnail_url: c.thumbnail_url as string | null,
              site_id: siteId,
            })),
          }));
        } catch {
          setCamerasBySite((prev) => ({ ...prev, [siteId]: [] }));
        } finally {
          setLoadingCameras((prev) => {
            const next = new Set(prev);
            next.delete(siteId);
            return next;
          });
        }
      }
    },
    [camerasBySite],
  );

  function toMapCamera(cam: CameraItem): MapCamera {
    return {
      id: cam.id,
      name: cam.name,
      lat: cam.lat,
      lng: cam.lng,
      status: cam.health_status,
      thumbnail_url: cam.thumbnail_url,
    };
  }

  return (
    <div className="flex h-full w-72 flex-col rounded-r-lg bg-background/40 backdrop-blur-md shadow-lg">
      <div className="border-b px-4 py-3">
        <h3 className="text-sm font-semibold">Sites & Cameras</h3>
        <p className="text-xs text-muted-foreground">
          Browse by project to pin cameras on the map.
        </p>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2">
          {projects.length === 0 ? (
            <p className="px-2 py-4 text-xs text-muted-foreground">
              No projects found.
            </p>
          ) : (
            projects.map((project) => (
              <Collapsible
                key={project.id}
                open={openProjects.has(project.id)}
                onOpenChange={() => toggleProject(project.id)}
              >
                <CollapsibleTrigger className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent">
                  <ChevronRight
                    className={`size-3.5 shrink-0 transition-transform ${
                      openProjects.has(project.id) ? "rotate-90" : ""
                    }`}
                  />
                  <FolderKanban className="size-3.5 shrink-0 text-muted-foreground" />
                  <span className="truncate font-medium">{project.name}</span>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="ml-3 border-l pl-2">
                    {loadingSites.has(project.id) ? (
                      <p className="px-2 py-1.5 text-xs text-muted-foreground">
                        Loading sites...
                      </p>
                    ) : (sitesByProject[project.id] ?? []).length === 0 ? (
                      <p className="px-2 py-1.5 text-xs text-muted-foreground">
                        No sites.
                      </p>
                    ) : (
                      (sitesByProject[project.id] ?? []).map((site) => (
                        <Collapsible
                          key={site.id}
                          open={openSites.has(site.id)}
                          onOpenChange={() => toggleSite(site.id)}
                        >
                          <CollapsibleTrigger className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent">
                            <ChevronRight
                              className={`size-3 shrink-0 transition-transform ${
                                openSites.has(site.id) ? "rotate-90" : ""
                              }`}
                            />
                            <Building2 className="size-3.5 shrink-0 text-muted-foreground" />
                            <span className="truncate">{site.name}</span>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <div className="ml-3 border-l pl-2">
                              {loadingCameras.has(site.id) ? (
                                <p className="px-2 py-1.5 text-xs text-muted-foreground">
                                  Loading cameras...
                                </p>
                              ) : (camerasBySite[site.id] ?? []).length ===
                                0 ? (
                                <p className="px-2 py-1.5 text-xs text-muted-foreground">
                                  No cameras.
                                </p>
                              ) : (
                                (camerasBySite[site.id] ?? []).map((cam) => {
                                  const hasCoords =
                                    cam.lat != null && cam.lng != null;
                                  const isPinTarget =
                                    pinModeTarget === cam.id;

                                  return (
                                    <div
                                      key={cam.id}
                                      className={`group flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent ${
                                        isPinTarget
                                          ? "bg-blue-500/10 ring-1 ring-blue-500/30"
                                          : ""
                                      }`}
                                    >
                                      <div
                                        className={`size-2 shrink-0 rounded-full ${statusColor(cam.health_status)}`}
                                      />
                                      <Camera className="size-3.5 shrink-0 text-muted-foreground" />
                                      <span className="flex-1 truncate">
                                        {cam.name}
                                      </span>
                                      <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                                        {hasCoords ? (
                                          <>
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              className="h-6 w-6 p-0"
                                              title="Focus on map"
                                              onClick={() =>
                                                onFocusCamera(
                                                  toMapCamera(cam),
                                                )
                                              }
                                            >
                                              <MapPin className="size-3.5" />
                                            </Button>
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              className="h-6 w-6 p-0"
                                              title="Change location"
                                              onClick={() =>
                                                onStartPinMode(
                                                  cam.id,
                                                  cam.name,
                                                )
                                              }
                                            >
                                              <Crosshair className="size-3.5" />
                                            </Button>
                                          </>
                                        ) : (
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            className={`h-6 px-1.5 text-xs gap-1 ${
                                              isPinTarget
                                                ? "text-blue-600"
                                                : ""
                                            }`}
                                            title="Click map to set location"
                                            onClick={() =>
                                              onStartPinMode(
                                                cam.id,
                                                cam.name,
                                              )
                                            }
                                          >
                                            <Crosshair className="size-3" />
                                            <span>Pin</span>
                                          </Button>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })
                              )}
                            </div>
                          </CollapsibleContent>
                        </Collapsible>
                      ))
                    )}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
