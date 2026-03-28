"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { useCameraStatusStream } from "@/hooks/use-camera-status-stream";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useRouter } from "next/navigation";
import { ArrowLeft, Pencil, Copy, Upload } from "lucide-react";
import {
  apiClient,
  type StreamProfile,
  type CreateStreamProfileInput,
} from "../../../../lib/api-client";
import { ProfileFormDialog } from "../../../../components/profiles/profile-form-dialog";
import type { Camera } from "@repo/types";

export default function ProfileDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const profileId = params.id;

  const [profile, setProfile] = useState<StreamProfile | null>(null);
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);

  // Real-time camera status updates
  useCameraStatusStream((event) => {
    setCameras((prev) =>
      prev.map((cam) =>
        cam.id === event.camera_id
          ? { ...cam, health_status: event.new_state as Camera["health_status"] }
          : cam,
      ),
    );
  });

  const fetchProfile = useCallback(async () => {
    setLoading(true);
    try {
      const [profileRes, camerasRes] = await Promise.all([
        apiClient.getProfile(profileId),
        apiClient.getProfileCameras(profileId),
      ]);
      setProfile(profileRes.data);
      setCameras(camerasRes.data ?? []);
    } catch {
      setProfile(null);
      setCameras([]);
    } finally {
      setLoading(false);
    }
  }, [profileId]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  async function handleSave(data: CreateStreamProfileInput) {
    try {
      await apiClient.updateStreamProfile(profileId, data);
      setEditOpen(false);
      fetchProfile();
    } catch {
      // Error handled by api client
    }
  }

  async function handleClone() {
    try {
      await apiClient.cloneProfile(profileId);
      // Could navigate to the new profile, for now just refresh
      fetchProfile();
    } catch {
      // Error handled by api client
    }
  }

  function formatFramerate(fps: number | null): string {
    return fps === null ? "Original" : `${fps} fps`;
  }

  function formatAudioMode(mode: string): string {
    switch (mode) {
      case "include":
        return "Include";
      case "strip":
        return "Strip";
      case "mute":
        return "Mute";
      default:
        return mode;
    }
  }

  function formatProtocol(p: string): string {
    switch (p) {
      case "hls":
        return "HLS";
      case "webrtc":
        return "WebRTC";
      case "both":
        return "Both (HLS + WebRTC)";
      default:
        return p;
    }
  }

  if (loading) {
    return (
      <div className="flex h-32 items-center justify-center text-muted-foreground">
        Loading profile...
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="space-y-4">
        <a
          href="/profiles"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Back to Profiles
        </a>
        <p className="text-muted-foreground">Profile not found.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <a href="/profiles" className="hover:text-foreground">
          Profiles
        </a>
        <span>/</span>
        <span className="text-foreground">{profile.name}</span>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            {profile.name}
            {profile.is_default && (
              <Badge variant="secondary" className="ml-2 align-middle">
                Default
              </Badge>
            )}
          </h1>
          {profile.description && (
            <p className="mt-1 text-sm text-muted-foreground">
              {profile.description}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() =>
              router.push(
                `/cameras?import=true&profile=${profileId}`,
              )
            }
          >
            <Upload className="mr-2 size-4" />
            Import from CSV
          </Button>
          <Button variant="outline" onClick={handleClone}>
            <Copy className="mr-2 size-4" />
            Clone
          </Button>
          <Button onClick={() => setEditOpen(true)}>
            <Pencil className="mr-2 size-4" />
            Edit
          </Button>
        </div>
      </div>

      {/* Profile Details */}
      <div className="rounded-lg border p-6 space-y-4">
        <h2 className="text-lg font-semibold">Profile Settings</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <span className="text-sm font-medium text-muted-foreground">
              Protocol
            </span>
            <p className="text-sm mt-1">{formatProtocol(profile.protocol)}</p>
          </div>
          <div>
            <span className="text-sm font-medium text-muted-foreground">
              Audio Mode
            </span>
            <p className="text-sm mt-1">{formatAudioMode(profile.audio_mode)}</p>
          </div>
          <div>
            <span className="text-sm font-medium text-muted-foreground">
              Max Framerate
            </span>
            <p className="text-sm mt-1">
              {formatFramerate(profile.max_framerate)}
            </p>
          </div>
          <div>
            <span className="text-sm font-medium text-muted-foreground">
              Cameras Using Profile
            </span>
            <p className="text-sm mt-1">{profile.camera_count}</p>
          </div>
        </div>
      </div>

      {/* Cameras using this profile */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Cameras using this profile</h2>
        {cameras.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No cameras are using this profile yet.
          </p>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Site</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cameras.map((camera) => (
                  <TableRow key={camera.id}>
                    <TableCell>
                      <a
                        href={`/cameras`}
                        className="font-medium text-blue-600 hover:underline"
                      >
                        {camera.name}
                      </a>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {camera.site_id}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          camera.health_status === "online"
                            ? "default"
                            : camera.health_status === "offline"
                              ? "destructive"
                              : "secondary"
                        }
                        className={
                          camera.health_status === "online"
                            ? "bg-green-100 text-green-700"
                            : undefined
                        }
                      >
                        {camera.health_status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Edit Dialog */}
      <ProfileFormDialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
        onSave={handleSave}
        initialData={profile}
        mode="edit"
      />
    </div>
  );
}
