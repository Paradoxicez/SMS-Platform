"use client";

import { useEffect, useState, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sliders, MoreHorizontal, Pencil, Copy, Trash2 } from "lucide-react";
import { SortableTableHead, useTableSort } from "@/components/ui/sortable-table-head";
import { TablePagination, useClientPagination } from "@/components/ui/table-pagination";
import {
  apiClient,
  type StreamProfile,
  type CreateStreamProfileInput,
} from "../../../lib/api-client";
import { ProfileFormDialog } from "../../../components/profiles/profile-form-dialog";

function ProtocolBadge({ protocol }: { protocol: StreamProfile["protocol"] }) {
  switch (protocol) {
    case "hls":
      return <Badge variant="outline">HLS</Badge>;
    case "webrtc":
      return (
        <Badge className="bg-purple-100 text-purple-700 hover:bg-purple-200">
          WebRTC
        </Badge>
      );
    case "both":
      return (
        <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-200">
          Both
        </Badge>
      );
  }
}

function AudioBadge({ mode }: { mode: StreamProfile["audio_mode"] }) {
  switch (mode) {
    case "include":
      return (
        <Badge className="bg-green-100 text-green-700 hover:bg-green-200">
          Include
        </Badge>
      );
    case "strip":
      return <Badge variant="secondary">Strip</Badge>;
    case "mute":
      return (
        <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-200">
          Mute
        </Badge>
      );
  }
}

export default function ProfilesPage() {
  const [profiles, setProfiles] = useState<StreamProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const { sortKey, sortDirection, handleSort, sortData } = useTableSort();
  const sortedProfiles = sortData(profiles, (p: StreamProfile, key: string) => {
    if (key === "name") return p.name
    if (key === "protocol") return p.protocol
    if (key === "resolution") return p.resolution
    if (key === "fps") return p.max_fps
    return null
  })
  const profilesPagination = useClientPagination(sortedProfiles, 20);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<StreamProfile | undefined>(
    undefined
  );
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create");

  const fetchProfiles = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.listProfiles();
      setProfiles(res.data ?? []);
    } catch {
      setProfiles([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfiles();
  }, [fetchProfiles]);

  function openCreate() {
    setEditingProfile(undefined);
    setDialogMode("create");
    setDialogOpen(true);
  }

  function openEdit(profile: StreamProfile) {
    setEditingProfile(profile);
    setDialogMode("edit");
    setDialogOpen(true);
  }

  async function handleSave(data: CreateStreamProfileInput) {
    try {
      if (dialogMode === "edit" && editingProfile) {
        await apiClient.updateStreamProfile(editingProfile.id, {
          ...data,
          version: (editingProfile as any).version ?? 1,
        });
      } else {
        await apiClient.createStreamProfile(data);
      }
      setDialogOpen(false);
      fetchProfiles();
    } catch {
      // Error handled by api client
    }
  }

  async function handleClone(id: string) {
    try {
      await apiClient.cloneProfile(id);
      fetchProfiles();
    } catch {
      // Error handled by api client
    }
  }

  async function handleDelete(id: string) {
    try {
      await apiClient.deleteStreamProfile(id);
      fetchProfiles();
    } catch {
      // Error handled by api client
    }
  }

  function formatFramerate(fps: number | null): string {
    return fps === null ? "Original" : `${fps} fps`;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Stream Profiles</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage reusable output configurations for your camera streams.
          </p>
        </div>
        <Button onClick={openCreate}>Create Profile</Button>
      </div>

      {loading ? (
        <div className="flex h-32 items-center justify-center text-muted-foreground">
          Loading profiles...
        </div>
      ) : profiles.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16">
          <div className="flex size-12 items-center justify-center rounded-full bg-muted">
            <Sliders className="size-6 text-muted-foreground" />
          </div>
          <h3 className="mt-4 text-lg font-semibold">
            Create your first stream profile
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Stream profiles define reusable output settings for your cameras.
          </p>
          <Button className="mt-4" onClick={openCreate}>
            Create Profile
          </Button>
        </div>
      ) : (
        <>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <SortableTableHead sortKey="name" currentSortKey={sortKey} currentDirection={sortDirection} onSort={handleSort}>Name</SortableTableHead>
                <SortableTableHead sortKey="protocol" currentSortKey={sortKey} currentDirection={sortDirection} onSort={handleSort}>Protocol</SortableTableHead>
                <TableHead>Audio</TableHead>
                <SortableTableHead sortKey="resolution" currentSortKey={sortKey} currentDirection={sortDirection} onSort={handleSort}>Resolution</SortableTableHead>
                <TableHead>Codec</TableHead>
                <SortableTableHead sortKey="fps" currentSortKey={sortKey} currentDirection={sortDirection} onSort={handleSort}>Max FPS</SortableTableHead>
                <TableHead className="w-[50px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {profilesPagination.paginatedData.map((profile) => (
                <TableRow key={profile.id}>
                  <TableCell>
                    <span className="font-medium">{profile.name}</span>
                    {(profile as any).is_default && (
                      <Badge variant="secondary" className="ml-2">
                        Default
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <ProtocolBadge protocol={(profile as any).output_protocol ?? (profile as any).protocol} />
                  </TableCell>
                  <TableCell>
                    <AudioBadge mode={(profile as any).audio_mode} />
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {((profile as any).output_resolution ?? "original").toUpperCase()}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {((profile as any).output_codec ?? "h264").toUpperCase()}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatFramerate((profile as any).max_framerate)}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="size-8">
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEdit(profile)}>
                          <Pencil className="mr-2 size-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleClone(profile.id)}>
                          <Copy className="mr-2 size-4" />
                          Clone
                        </DropdownMenuItem>
                        {!profile.is_default && (
                          <DropdownMenuItem
                            className="text-red-600"
                            onClick={() => handleDelete(profile.id)}
                          >
                            <Trash2 className="mr-2 size-4" />
                            Delete
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <TablePagination page={profilesPagination.page} totalPages={profilesPagination.totalPages} totalItems={profilesPagination.totalItems} pageSize={profilesPagination.pageSize} onPageChange={profilesPagination.onPageChange} />
        </>
      )}

      <ProfileFormDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSave={handleSave}
        initialData={editingProfile}
        mode={dialogMode}
      />
    </div>
  );
}
