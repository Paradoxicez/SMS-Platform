"use client";

import { useEffect, useState } from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/lib/format-date";
import { apiClient } from "../../../../lib/api-client";
import type { Camera } from "@repo/types";

interface ForwardingRule {
  id: string;
  cameraId: string;
  cameraName?: string;
  targetUrl: string;
  status: string;
  createdAt: string;
}

export default function ForwardingPage() {
  const [rules, setRules] = useState<ForwardingRule[]>([]);
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedCameraId, setSelectedCameraId] = useState("");
  const [targetUrl, setTargetUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function fetchRules() {
    try {
      const res = await apiClient.get<{ data: ForwardingRule[] }>(
        "/forwarding",
      );
      setRules(Array.isArray(res.data) ? res.data : []);
    } catch {
      // API unavailable
    }
  }

  async function fetchCameras() {
    try {
      const res = await apiClient.listCameras({ per_page: 100 });
      setCameras(Array.isArray(res.data) ? res.data : []);
    } catch {
      // API unavailable
    }
  }

  useEffect(() => {
    Promise.all([fetchRules(), fetchCameras()]).finally(() =>
      setLoading(false),
    );
  }, []);

  async function handleAdd() {
    if (!selectedCameraId || !targetUrl) {
      toast.error("Please select a camera and enter a target URL");
      return;
    }

    setSubmitting(true);
    try {
      const camera = cameras.find((c) => c.id === selectedCameraId);
      await apiClient.post("/forwarding", {
        cameraId: selectedCameraId,
        cameraName: camera?.name ?? selectedCameraId,
        targetUrl,
      });
      toast.success("Forwarding rule created");
      setDialogOpen(false);
      setSelectedCameraId("");
      setTargetUrl("");
      fetchRules();
    } catch {
      toast.error("Failed to create forwarding rule");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      await apiClient.delete(`/forwarding/${id}`);
      toast.success("Forwarding rule deleted");
      fetchRules();
    } catch {
      toast.error("Failed to delete forwarding rule");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Stream Forwarding</h1>
          <p className="mt-1 text-muted-foreground">
            Forward camera streams to external destinations via RTMP/RTSP.
          </p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>Add Rule</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Forwarding Rule</DialogTitle>
              <DialogDescription>
                Select a camera and provide the target URL to forward the stream
                to (e.g., rtmp://live.example.com/app/key).
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Camera</Label>
                <Select
                  value={selectedCameraId}
                  onValueChange={setSelectedCameraId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a camera" />
                  </SelectTrigger>
                  <SelectContent>
                    {cameras.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Target URL</Label>
                <Input
                  placeholder="rtmp://live.example.com/app/stream-key"
                  value={targetUrl}
                  onChange={(e) => setTargetUrl(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button onClick={handleAdd} disabled={submitting}>
                {submitting ? "Creating..." : "Create Rule"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Forwarding Rules</CardTitle>
          <CardDescription>
            {rules.length} rule(s) configured.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : rules.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-sm text-muted-foreground">
                No forwarding rules configured yet. Click &quot;Add Rule&quot;
                to get started.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Camera</TableHead>
                  <TableHead>Target URL</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created at</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rules.map((rule) => (
                  <TableRow key={rule.id}>
                    <TableCell className="font-medium">
                      {rule.cameraName ?? rule.cameraId}
                    </TableCell>
                    <TableCell className="font-mono text-xs max-w-[300px] truncate">
                      {rule.targetUrl}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          rule.status === "active" ? "default" : "secondary"
                        }
                        className={
                          rule.status === "active"
                            ? "bg-green-100 text-green-700"
                            : ""
                        }
                      >
                        {rule.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {formatDate(rule.createdAt)}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 text-destructive"
                        onClick={() => handleDelete(rule.id)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
