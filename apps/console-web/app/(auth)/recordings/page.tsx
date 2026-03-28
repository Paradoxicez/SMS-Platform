"use client";

import { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateTime } from "@/lib/format-date";
import { apiClient } from "../../../lib/api-client";

interface Camera {
  id: string;
  name: string;
}

interface Recording {
  id: string;
  cameraId: string;
  startTime: string;
  endTime: string | null;
  fileFormat: string;
  sizeBytes: number;
  retentionDays: number;
  storageType: string;
}

export default function RecordingsPage() {
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [selectedCamera, setSelectedCamera] = useState<string>("");
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [loading, setLoading] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [playbackUrl, setPlaybackUrl] = useState<string | null>(null);

  useEffect(() => {
    async function fetchCameras() {
      try {
        const res = await apiClient.listCameras({ per_page: 100 });
        setCameras(res.data.map((c: any) => ({ id: c.id, name: c.name })));
      } catch {
        // Error fetching cameras
      }
    }
    fetchCameras();
  }, []);

  async function fetchRecordings() {
    if (!selectedCamera) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (dateFrom) params.set("from", new Date(dateFrom).toISOString());
      if (dateTo) params.set("to", new Date(dateTo).toISOString());

      const res = await apiClient.get<{ data: Recording[] }>(
        `/cameras/${selectedCamera}/recordings?${params.toString()}`,
      );
      setRecordings(res.data);
    } catch {
      // Error fetching recordings
    } finally {
      setLoading(false);
    }
  }

  async function handlePlayback(recordingId: string) {
    try {
      const res = await apiClient.post<{ data: { playback_url: string } }>(
        `/recordings/${recordingId}/playback`,
        {},
      );
      setPlaybackUrl(res.data.playback_url);
    } catch {
      // Error creating playback session
    }
  }

  function formatBytes(bytes: number): string {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Recordings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Browse and play back recorded camera footage.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Search Recordings</CardTitle>
          <CardDescription>
            Select a camera and date range to find recordings.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 items-end">
            <div className="space-y-2">
              <Label>Camera</Label>
              <select
                className="flex h-9 w-[250px] rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                value={selectedCamera}
                onChange={(e) => setSelectedCamera(e.target.value)}
              >
                <option value="">Select a camera</option>
                {cameras.map((cam) => (
                  <option key={cam.id} value={cam.id}>
                    {cam.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>From</Label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-[180px]"
              />
            </div>
            <div className="space-y-2">
              <Label>To</Label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-[180px]"
              />
            </div>
            <Button onClick={fetchRecordings} disabled={!selectedCamera || loading}>
              {loading ? "Searching..." : "Search"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {recordings.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-lg font-semibold">Results</h2>
              <p className="text-sm text-muted-foreground">{recordings.length} recording(s) found</p>
            </div>
          </div>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Start Time</TableHead>
                  <TableHead>End Time</TableHead>
                  <TableHead>Format</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead>Storage</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recordings.map((rec) => (
                  <TableRow key={rec.id}>
                    <TableCell className="text-sm">
                      {formatDateTime(rec.startTime)}
                    </TableCell>
                    <TableCell className="text-sm">
                      {rec.endTime ? formatDateTime(rec.endTime) : "In progress"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{rec.fileFormat}</Badge>
                    </TableCell>
                    <TableCell className="text-sm">{formatBytes(rec.sizeBytes)}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{rec.storageType}</Badge>
                    </TableCell>
                    <TableCell>
                      <Button size="sm" onClick={() => handlePlayback(rec.id)}>
                        Play
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {playbackUrl && (
        <Card>
          <CardHeader>
            <CardTitle>Playback</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="aspect-video bg-black rounded-lg flex items-center justify-center">
              <video
                src={playbackUrl}
                controls
                autoPlay
                className="w-full h-full rounded-lg"
              />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
