"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import dynamic from "next/dynamic";

/**
 * T086: Public map page
 *
 * Fetches camera pins from GET /map/cameras?project_key={projectKey}
 * and renders a Leaflet map with color-coded markers.
 * No autoplay — thumbnails only via hover cards.
 */

// Dynamic import for Leaflet (SSR-incompatible)
const MapView = dynamic(
  () => import("../../../../components/map/map-view"),
  { ssr: false, loading: () => <MapLoadingSkeleton /> },
);

export interface MapCamera {
  id: string;
  name: string;
  lat: number | null;
  lng: number | null;
  status: string;
  thumbnail_url: string | null;
  tags?: string[];
  site_name?: string;
  created_at?: string;
}

function MapLoadingSkeleton() {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-gray-100">
      <p className="text-muted-foreground">Loading map...</p>
    </div>
  );
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export default function PublicMapPage() {
  const params = useParams<{ projectKey: string }>();
  const projectKey = params.projectKey;

  const [cameras, setCameras] = useState<MapCamera[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchCameras() {
      try {
        setLoading(true);
        const res = await fetch(
          `${API_BASE_URL}/map/cameras?project_key=${encodeURIComponent(projectKey)}`,
        );

        if (!res.ok) {
          const data = await res.json().catch(() => null);
          throw new Error(data?.error?.message ?? `HTTP ${res.status}`);
        }

        const data = await res.json();
        setCameras(data.data ?? []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load cameras");
      } finally {
        setLoading(false);
      }
    }

    fetchCameras();
  }, [projectKey]);

  if (loading) {
    return <MapLoadingSkeleton />;
  }

  if (error) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-gray-100">
        <div className="text-center">
          <h2 className="text-lg font-semibold text-red-600">Error</h2>
          <p className="mt-1 text-sm text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-full">
      <MapView cameras={cameras} isPublic={true} projectKey={projectKey} />
    </div>
  );
}
