"use client";

import { useEffect, useRef, useState, useCallback, useImperativeHandle, forwardRef } from "react";
import type { MapCamera } from "../../app/(public)/map/[projectKey]/page";
import { CameraPinHover } from "./camera-pin-hover";
import { PlayerDialog } from "./player-dialog";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface MapViewProps {
  cameras: MapCamera[];
  isPublic?: boolean;
  projectKey?: string;
  pinMode?: boolean;
  onMapClick?: (lat: number, lng: number) => void;
}

export interface MapViewHandle {
  focusCamera: (camera: MapCamera) => void;
}

function getMarkerColor(status: string): string {
  switch (status) {
    case "online":
      return "#22c55e";
    case "offline":
    case "stopped":
      return "#ef4444";
    case "degraded":
      return "#eab308";
    case "connecting":
    case "reconnecting":
      return "#3b82f6";
    case "stopping":
      return "#f97316";
    default:
      return "#6b7280";
  }
}

const LABEL_ZOOM_THRESHOLD = 15;

function createDotIcon(color: string, highlight = false): L.DivIcon {
  const size = highlight ? 18 : 14;
  return L.divIcon({
    className: "custom-marker",
    html: `<div style="
      width: ${size}px;
      height: ${size}px;
      border-radius: 50%;
      background-color: ${color};
      border: 2px solid white;
      box-shadow: 0 1px 4px rgba(0,0,0,0.3);
      transition: all 0.2s ease;
    "></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -(size / 2)],
  });
}

function createLabelIcon(color: string, name: string, highlight = false): L.DivIcon {
  const dotSize = highlight ? 12 : 10;
  const fontSize = highlight ? 13 : 12;
  const fontWeight = highlight ? 600 : 500;
  return L.divIcon({
    className: "custom-marker-label",
    html: `<div style="
      display: flex;
      align-items: center;
      gap: 6px;
      background: rgba(255,255,255,0.92);
      backdrop-filter: blur(4px);
      border: 1px solid rgba(0,0,0,0.08);
      border-radius: 6px;
      padding: 4px 10px 4px 8px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.12);
      white-space: nowrap;
      transition: all 0.2s ease;
      ${highlight ? "transform: scale(1.05);" : ""}
    ">
      <span style="
        width: ${dotSize}px;
        height: ${dotSize}px;
        border-radius: 50%;
        background-color: ${color};
        flex-shrink: 0;
      "></span>
      <span style="
        font-size: ${fontSize}px;
        font-weight: ${fontWeight};
        color: #1a1a1a;
        max-width: 140px;
        overflow: hidden;
        text-overflow: ellipsis;
      ">${name}</span>
    </div>`,
    iconSize: [160, 32],
    iconAnchor: [0, 16],
    popupAnchor: [0, -20],
  });
}

function createMarkerIcon(color: string, name: string, zoom: number, highlight = false): L.DivIcon {
  if (zoom >= LABEL_ZOOM_THRESHOLD) {
    return createLabelIcon(color, name, highlight);
  }
  return createDotIcon(color, highlight);
}

const MapViewInner = forwardRef<MapViewHandle, MapViewProps>(
  function MapViewInner({ cameras, isPublic = false, projectKey, pinMode = false, onMapClick }, ref) {
    const mapRef = useRef<HTMLDivElement>(null);
    const mapInstanceRef = useRef<L.Map | null>(null);
    const markersRef = useRef<Map<string, L.Marker>>(new Map());
    const [hoveredCamera, setHoveredCamera] = useState<MapCamera | null>(null);
    const [hoverPosition, setHoverPosition] = useState<{ x: number; y: number } | null>(null);
    const [selectedCamera, setSelectedCamera] = useState<MapCamera | null>(null);
    const [dialogOpen, setDialogOpen] = useState(false);

    const focusCamera = useCallback((camera: MapCamera) => {
      const map = mapInstanceRef.current;
      if (!map || camera.lat == null || camera.lng == null) return;
      map.flyTo([camera.lat, camera.lng], 17, { duration: 0.8 });
      const marker = markersRef.current.get(camera.id);
      if (marker) {
        const color = getMarkerColor(camera.status);
        const zoom = map.getZoom();
        marker.setIcon(createMarkerIcon(color, camera.name, zoom, true));
        setTimeout(() => {
          marker.setIcon(createMarkerIcon(color, camera.name, map.getZoom(), false));
        }, 1500);
      }
    }, []);

    useImperativeHandle(ref, () => ({ focusCamera }), [focusCamera]);

    // Init map
    useEffect(() => {
      if (!mapRef.current || mapInstanceRef.current) return;
      const map = L.map(mapRef.current, { zoomControl: false }).setView([13.7563, 100.5018], 12);
      L.control.zoom({ position: "bottomright" }).addTo(map);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);
      mapInstanceRef.current = map;
      return () => {
        map.remove();
        mapInstanceRef.current = null;
      };
    }, []);

    // Pin mode click handler
    useEffect(() => {
      const map = mapInstanceRef.current;
      if (!map) return;

      function handleClick(e: L.LeafletMouseEvent) {
        if (pinMode && onMapClick) {
          onMapClick(e.latlng.lat, e.latlng.lng);
        }
      }

      map.on("click", handleClick);
      return () => {
        map.off("click", handleClick);
      };
    }, [pinMode, onMapClick]);

    // Cursor style for pin mode
    useEffect(() => {
      const container = mapRef.current;
      if (!container) return;
      if (pinMode) {
        container.style.cursor = "crosshair";
      } else {
        container.style.cursor = "";
      }
    }, [pinMode]);

    // Render markers
    useEffect(() => {
      const map = mapInstanceRef.current;
      if (!map) return;

      markersRef.current.forEach((marker) => map.removeLayer(marker));
      markersRef.current.clear();

      const validCameras = cameras.filter((cam) => cam.lat != null && cam.lng != null);
      if (validCameras.length === 0) return;

      const bounds = L.latLngBounds([]);

      const currentZoom = map.getZoom();

      validCameras.forEach((camera) => {
        const color = getMarkerColor(camera.status);
        const icon = createMarkerIcon(color, camera.name, currentZoom);
        const marker = L.marker([camera.lat!, camera.lng!], { icon }).addTo(map);
        markersRef.current.set(camera.id, marker);

        marker.on("mouseover", (e) => {
          const containerPoint = map.latLngToContainerPoint(e.latlng);
          setHoveredCamera(camera);
          setHoverPosition({ x: containerPoint.x, y: containerPoint.y });
        });
        marker.on("mouseout", () => {
          setHoveredCamera(null);
          setHoverPosition(null);
        });
        marker.on("click", () => {
          if (!pinMode) {
            setSelectedCamera(camera);
            setDialogOpen(true);
          }
        });
        bounds.extend([camera.lat!, camera.lng!]);
      });

      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
      }

      // Update icons on zoom change (dot vs label)
      function handleZoom() {
        const zoom = map.getZoom();
        validCameras.forEach((camera) => {
          const marker = markersRef.current.get(camera.id);
          if (marker) {
            const color = getMarkerColor(camera.status);
            marker.setIcon(createMarkerIcon(color, camera.name, zoom));
          }
        });
      }

      map.on("zoomend", handleZoom);
      return () => {
        map.off("zoomend", handleZoom);
      };
    }, [cameras, pinMode]);

    return (
      <div className="relative h-full w-full">
        <div ref={mapRef} className="h-full w-full" />

        {hoveredCamera && hoverPosition && (
          <div
            className="pointer-events-none absolute z-[1000]"
            style={{ left: hoverPosition.x + 16, top: hoverPosition.y - 60 }}
          >
            <CameraPinHover camera={hoveredCamera} />
          </div>
        )}

        {selectedCamera && (
          <PlayerDialog
            camera={selectedCamera}
            projectKey={projectKey}
            open={dialogOpen}
            onOpenChange={(open) => {
              setDialogOpen(open);
              if (!open) setSelectedCamera(null);
            }}
          />
        )}
      </div>
    );
  },
);

export default MapViewInner;
