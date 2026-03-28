"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { formatDateTime } from "@/lib/format-date";
import { apiClient } from "../../../../lib/api-client";

interface AiIntegration {
  id: string;
  name: string;
  endpointUrl: string;
  cameras: string[];
  intervalSeconds: number;
  isActive: boolean;
  createdAt: string;
}

interface AiEvent {
  id: string;
  cameraId: string;
  eventType: string;
  confidence: number | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export default function AiIntegrationsPage() {
  const [integrations, setIntegrations] = useState<AiIntegration[]>([]);
  const [events, setEvents] = useState<AiEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [formName, setFormName] = useState("");
  const [formUrl, setFormUrl] = useState("");
  const [formApiKey, setFormApiKey] = useState("");
  const [formCameras, setFormCameras] = useState("");
  const [formInterval, setFormInterval] = useState("30");

  async function fetchIntegrations() {
    try {
      const res = await apiClient.get<{ data: AiIntegration[] }>("/ai-integrations");
      setIntegrations(res.data);
    } catch {
      // Error
    } finally {
      setLoading(false);
    }
  }

  async function fetchEvents() {
    try {
      const res = await apiClient.get<{ data: AiEvent[] }>("/ai-integrations/events?limit=50");
      setEvents(Array.isArray(res.data) ? res.data : []);
    } catch {
      // Error
    }
  }

  useEffect(() => {
    fetchIntegrations();
    fetchEvents();
  }, []);

  async function handleAdd() {
    try {
      await apiClient.post("/ai-integrations", {
        name: formName,
        endpoint_url: formUrl,
        api_key: formApiKey || undefined,
        event_types: ["detection", "classification"],
        cameras: formCameras.split(",").map((s) => s.trim()).filter(Boolean),
        interval_seconds: parseInt(formInterval, 10),
      });
      setFormName("");
      setFormUrl("");
      setFormApiKey("");
      setFormCameras("");
      setFormInterval("30");
      setAddOpen(false);
      fetchIntegrations();
    } catch {
      // Error
    }
  }

  async function handleDelete(id: string) {
    try {
      await apiClient.delete(`/ai-integrations/${id}`);
      fetchIntegrations();
    } catch {
      // Error
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">AI Integrations</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Connect external AI/ML services to analyze camera feeds.
        </p>
      </div>

      <Tabs defaultValue="integrations" className="space-y-4">
        <TabsList>
          <TabsTrigger value="integrations">Integrations</TabsTrigger>
          <TabsTrigger value="events">Events Log</TabsTrigger>
        </TabsList>

        <TabsContent value="integrations">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-lg font-semibold">AI Endpoints</h2>
                <p className="text-sm text-muted-foreground">
                  Manage AI service integrations that receive camera snapshots.
                </p>
              </div>
              <Dialog open={addOpen} onOpenChange={setAddOpen}>
                <DialogTrigger asChild>
                  <Button>Add Integration</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add AI Integration</DialogTitle>
                    <DialogDescription>
                      Configure an AI endpoint to receive periodic camera snapshots.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="ai-name">Name</Label>
                      <Input
                        id="ai-name"
                        value={formName}
                        onChange={(e) => setFormName(e.target.value)}
                        placeholder="e.g. Person Detection Service"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="ai-url">Endpoint URL</Label>
                      <Input
                        id="ai-url"
                        value={formUrl}
                        onChange={(e) => setFormUrl(e.target.value)}
                        placeholder="https://ai.example.com/analyze"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="ai-key">API Key (optional)</Label>
                      <Input
                        id="ai-key"
                        type="password"
                        value={formApiKey}
                        onChange={(e) => setFormApiKey(e.target.value)}
                        placeholder="Bearer token for the AI endpoint"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="ai-cameras">Camera IDs (comma-separated)</Label>
                      <Input
                        id="ai-cameras"
                        value={formCameras}
                        onChange={(e) => setFormCameras(e.target.value)}
                        placeholder="camera-uuid-1, camera-uuid-2"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="ai-interval">Interval (seconds)</Label>
                      <Input
                        id="ai-interval"
                        type="number"
                        value={formInterval}
                        onChange={(e) => setFormInterval(e.target.value)}
                        min={5}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setAddOpen(false)}>
                      Cancel
                    </Button>
                    <Button
                      onClick={handleAdd}
                      disabled={!formName.trim() || !formUrl.trim()}
                    >
                      Add
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
            <div className="rounded-md border">
              {loading ? (
                <p className="p-4 text-sm text-muted-foreground">Loading...</p>
              ) : integrations.length === 0 ? (
                <p className="p-4 text-sm text-muted-foreground">No AI integrations configured yet.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Endpoint</TableHead>
                      <TableHead>Cameras</TableHead>
                      <TableHead>Interval</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {integrations.map((intg) => (
                      <TableRow key={intg.id}>
                        <TableCell className="font-medium">{intg.name}</TableCell>
                        <TableCell className="font-mono text-xs max-w-[200px] truncate">
                          {intg.endpointUrl}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">
                            {(intg.cameras as string[]).length} cameras
                          </Badge>
                        </TableCell>
                        <TableCell>{intg.intervalSeconds}s</TableCell>
                        <TableCell>
                          {intg.isActive ? (
                            <Badge className="bg-green-100 text-green-700">Active</Badge>
                          ) : (
                            <Badge variant="secondary">Inactive</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleDelete(intg.id)}
                          >
                            Delete
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="events">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-lg font-semibold">AI Events</h2>
                <p className="text-sm text-muted-foreground">
                  Recent events detected by AI integrations.
                </p>
              </div>
            </div>
            <div className="rounded-md border">
              {events.length === 0 ? (
                <p className="p-4 text-sm text-muted-foreground">No AI events recorded yet.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Event Type</TableHead>
                      <TableHead>Camera</TableHead>
                      <TableHead>Confidence</TableHead>
                      <TableHead>Created at</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {events.map((evt) => (
                      <TableRow key={evt.id}>
                        <TableCell>
                          <Badge variant="outline">{evt.eventType}</Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {evt.cameraId.slice(0, 8)}...
                        </TableCell>
                        <TableCell>
                          {evt.confidence !== null
                            ? `${(evt.confidence * 100).toFixed(1)}%`
                            : "-"}
                        </TableCell>
                        <TableCell className="text-xs">
                          {formatDateTime(evt.createdAt)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
