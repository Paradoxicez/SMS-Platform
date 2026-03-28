"use client";

import { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { apiClient } from "../../../../lib/api-client";

const EVENT_TYPES = [
  "camera.online",
  "camera.offline",
  "camera.degraded",
  "camera.reconnecting",
  "webhook.test",
  "ai.*",
];

interface Webhook {
  id: string;
  url: string;
  events: string[];
  secret: string;
  isActive: boolean;
  createdAt: string;
}

interface Delivery {
  id: string;
  eventType: string;
  responseStatus: number | null;
  attempt: number;
  deliveredAt: string | null;
  failedAt: string | null;
  createdAt: string;
}

export default function WebhooksPage() {
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [selectedEvents, setSelectedEvents] = useState<string[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [selectedWebhookId, setSelectedWebhookId] = useState<string | null>(null);

  async function fetchWebhooks() {
    try {
      const res = await apiClient.get<{ data: Webhook[] }>("/webhooks");
      setWebhooks(res.data);
    } catch {
      // Error fetching webhooks
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchWebhooks();
  }, []);

  async function handleAdd() {
    try {
      await apiClient.post("/webhooks", { url, events: selectedEvents });
      setUrl("");
      setSelectedEvents([]);
      setAddOpen(false);
      fetchWebhooks();
    } catch {
      // Error adding webhook
    }
  }

  async function handleDelete(id: string) {
    try {
      await apiClient.delete(`/webhooks/${id}`);
      fetchWebhooks();
    } catch {
      // Error deleting webhook
    }
  }

  async function handleTest(id: string) {
    try {
      await apiClient.post(`/webhooks/${id}/test`, {});
    } catch {
      // Error testing webhook
    }
  }

  async function fetchDeliveries(webhookId: string) {
    try {
      const res = await apiClient.get<{ data: Delivery[] }>(`/webhooks/${webhookId}/deliveries`);
      setDeliveries(res.data);
      setSelectedWebhookId(webhookId);
    } catch {
      // Error fetching deliveries
    }
  }

  function toggleEvent(event: string) {
    setSelectedEvents((prev) =>
      prev.includes(event)
        ? prev.filter((e) => e !== event)
        : [...prev, event],
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Webhooks</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Configure HTTP webhooks to receive real-time event notifications.
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Webhook Endpoints</CardTitle>
            <CardDescription>
              Manage endpoints that receive event notifications.
            </CardDescription>
          </div>
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button>Add Webhook</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Webhook</DialogTitle>
                <DialogDescription>
                  Configure a URL to receive event notifications via HTTP POST.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="webhook-url">Endpoint URL</Label>
                  <Input
                    id="webhook-url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://example.com/webhook"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Event Types</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {EVENT_TYPES.map((event) => (
                      <div key={event} className="flex items-center gap-2">
                        <Checkbox
                          id={`event-${event}`}
                          checked={selectedEvents.includes(event)}
                          onCheckedChange={() => toggleEvent(event)}
                        />
                        <Label htmlFor={`event-${event}`} className="text-sm font-normal">
                          {event}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setAddOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleAdd}
                  disabled={!url.trim() || selectedEvents.length === 0}
                >
                  Add Webhook
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : webhooks.length === 0 ? (
            <p className="text-sm text-muted-foreground">No webhooks configured yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>URL</TableHead>
                  <TableHead>Events</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {webhooks.map((wh) => (
                  <TableRow key={wh.id}>
                    <TableCell className="font-mono text-xs max-w-[300px] truncate">
                      {wh.url}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {(wh.events as string[]).map((e) => (
                          <Badge key={e} variant="secondary" className="text-xs">
                            {e}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      {wh.isActive ? (
                        <Badge className="bg-green-100 text-green-700">Active</Badge>
                      ) : (
                        <Badge variant="secondary">Inactive</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => handleTest(wh.id)}>
                          Test
                        </Button>
                        <Sheet>
                          <SheetTrigger asChild>
                            <Button size="sm" variant="outline" onClick={() => fetchDeliveries(wh.id)}>
                              Logs
                            </Button>
                          </SheetTrigger>
                          <SheetContent className="w-[500px] sm:w-[600px]">
                            <SheetHeader>
                              <SheetTitle>Delivery Logs</SheetTitle>
                            </SheetHeader>
                            <div className="mt-4 space-y-2 max-h-[70vh] overflow-y-auto">
                              {deliveries.length === 0 ? (
                                <p className="text-sm text-muted-foreground">No deliveries yet.</p>
                              ) : (
                                deliveries.map((d) => (
                                  <div key={d.id} className="rounded border p-3 text-sm space-y-1">
                                    <div className="flex justify-between">
                                      <span className="font-medium">{d.eventType}</span>
                                      <span className="text-xs text-muted-foreground">
                                        Attempt {d.attempt}
                                      </span>
                                    </div>
                                    <div className="flex justify-between">
                                      {d.deliveredAt ? (
                                        <Badge className="bg-green-100 text-green-700">
                                          {d.responseStatus}
                                        </Badge>
                                      ) : (
                                        <Badge variant="destructive">Failed</Badge>
                                      )}
                                      <span className="text-xs text-muted-foreground">
                                        {new Date(d.createdAt).toLocaleString()}
                                      </span>
                                    </div>
                                  </div>
                                ))
                              )}
                            </div>
                          </SheetContent>
                        </Sheet>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleDelete(wh.id)}
                        >
                          Delete
                        </Button>
                      </div>
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
