"use client";

import { useEffect, useState, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Globe,
  MoreHorizontal,
  Pencil,
  Trash2,
  Send,
  ScrollText,
  Plus,
} from "lucide-react";
import { toast } from "sonner";
import { apiClient } from "@/lib/api-client";
import { FeatureGate } from "@/components/feature-gate";

const EVENT_TYPES = [
  "camera.online",
  "camera.offline",
  "camera.degraded",
  "camera.reconnecting",
  "webhook.test",
];

interface Webhook {
  id: string;
  url: string;
  events: string[];
  secret: string;
  is_active: boolean;
  created_at: string;
}

interface Delivery {
  id: string;
  event_type: string;
  response_status: number | null;
  attempt: number;
  delivered_at: string | null;
  failed_at: string | null;
  created_at: string;
}

export default function WebhooksPage() {
  return (
    <FeatureGate feature="webhooks">
      <WebhooksPageContent />
    </FeatureGate>
  );
}

function WebhooksPageContent() {
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create");
  const [editingWebhook, setEditingWebhook] = useState<Webhook | undefined>();

  // Form state
  const [url, setUrl] = useState("");
  const [selectedEvents, setSelectedEvents] = useState<string[]>([]);

  // Delivery logs
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);

  const fetchWebhooks = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get<{ data: Webhook[] }>("/webhooks");
      setWebhooks(res.data);
    } catch {
      setWebhooks([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWebhooks();
  }, [fetchWebhooks]);

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (dialogOpen && editingWebhook) {
      setUrl(editingWebhook.url);
      setSelectedEvents([...(editingWebhook.events as string[])]);
    } else if (dialogOpen) {
      setUrl("");
      setSelectedEvents([]);
    }
  }, [dialogOpen, editingWebhook]);

  function openCreate() {
    setEditingWebhook(undefined);
    setDialogMode("create");
    setDialogOpen(true);
  }

  function openEdit(webhook: Webhook) {
    setEditingWebhook(webhook);
    setDialogMode("edit");
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!url.trim() || selectedEvents.length === 0) return;
    try {
      if (dialogMode === "edit" && editingWebhook) {
        await apiClient.patch(`/webhooks/${editingWebhook.id}`, {
          url,
          events: selectedEvents,
        });
        toast.success("Webhook updated");
      } else {
        await apiClient.post("/webhooks", { url, events: selectedEvents });
        toast.success("Webhook created");
      }
      setDialogOpen(false);
      fetchWebhooks();
    } catch {
      toast.error("Failed to save webhook");
    }
  }

  async function handleDelete(id: string) {
    try {
      await apiClient.delete(`/webhooks/${id}`);
      toast.success("Webhook deleted");
      fetchWebhooks();
    } catch {
      toast.error("Failed to delete webhook");
    }
  }

  async function handleToggleActive(webhook: Webhook) {
    try {
      await apiClient.patch(`/webhooks/${webhook.id}`, {
        is_active: !webhook.is_active,
      });
      toast.success(webhook.is_active ? "Webhook disabled" : "Webhook enabled");
      fetchWebhooks();
    } catch {
      toast.error("Failed to update webhook");
    }
  }

  async function handleTest(id: string) {
    try {
      await apiClient.post(`/webhooks/${id}/test`, {});
      toast.success("Test event sent");
    } catch {
      toast.error("Failed to send test event");
    }
  }

  async function fetchDeliveries(webhookId: string) {
    try {
      const res = await apiClient.get<{ data: Delivery[] }>(
        `/webhooks/${webhookId}/deliveries`,
      );
      setDeliveries(res.data);
    } catch {
      setDeliveries([]);
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Webhooks</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Configure HTTP webhooks to receive real-time event notifications.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 size-4" />
          Add Webhook
        </Button>
      </div>

      {loading ? (
        <div className="flex h-32 items-center justify-center text-muted-foreground">
          Loading webhooks...
        </div>
      ) : webhooks.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16">
          <div className="flex size-12 items-center justify-center rounded-full bg-muted">
            <Globe className="size-6 text-muted-foreground" />
          </div>
          <h3 className="mt-4 text-lg font-semibold">
            Create your first webhook
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Webhooks send real-time HTTP notifications when events occur.
          </p>
          <Button className="mt-4" onClick={openCreate}>
            Add Webhook
          </Button>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>URL</TableHead>
                <TableHead>Events</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[50px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {webhooks.map((wh) => (
                <TableRow key={wh.id}>
                  <TableCell>
                    <span className="font-mono text-xs">{wh.url}</span>
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
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={wh.is_active}
                        onCheckedChange={() => handleToggleActive(wh)}
                      />
                      <span className="text-xs text-muted-foreground">
                        {wh.is_active ? "Active" : "Inactive"}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="size-8">
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEdit(wh)}>
                          <Pencil className="mr-2 size-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleTest(wh.id)}>
                          <Send className="mr-2 size-4" />
                          Send Test
                        </DropdownMenuItem>
                        <Sheet>
                          <SheetTrigger asChild>
                            <DropdownMenuItem
                              onSelect={(e) => {
                                e.preventDefault();
                                fetchDeliveries(wh.id);
                              }}
                            >
                              <ScrollText className="mr-2 size-4" />
                              Delivery Logs
                            </DropdownMenuItem>
                          </SheetTrigger>
                          <SheetContent className="w-[500px] sm:w-[600px]">
                            <SheetHeader>
                              <SheetTitle>Delivery Logs</SheetTitle>
                            </SheetHeader>
                            <div className="mt-4 space-y-2 max-h-[70vh] overflow-y-auto">
                              {deliveries.length === 0 ? (
                                <p className="text-sm text-muted-foreground py-4 text-center">
                                  No deliveries yet.
                                </p>
                              ) : (
                                deliveries.map((d) => (
                                  <div
                                    key={d.id}
                                    className="rounded border p-3 text-sm space-y-1"
                                  >
                                    <div className="flex justify-between">
                                      <span className="font-medium">
                                        {d.event_type}
                                      </span>
                                      <span className="text-xs text-muted-foreground">
                                        Attempt {d.attempt}
                                      </span>
                                    </div>
                                    <div className="flex justify-between">
                                      {d.delivered_at ? (
                                        <Badge className="bg-green-100 text-green-700">
                                          {d.response_status}
                                        </Badge>
                                      ) : (
                                        <Badge variant="destructive">
                                          Failed
                                        </Badge>
                                      )}
                                      <span className="text-xs text-muted-foreground">
                                        {new Date(d.created_at).toLocaleString()}
                                      </span>
                                    </div>
                                  </div>
                                ))
                              )}
                            </div>
                          </SheetContent>
                        </Sheet>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-red-600"
                          onClick={() => handleDelete(wh.id)}
                        >
                          <Trash2 className="mr-2 size-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              {dialogMode === "edit" ? "Edit Webhook" : "Add Webhook"}
            </DialogTitle>
            <DialogDescription>
              {dialogMode === "edit"
                ? "Update the webhook URL and event subscriptions."
                : "Configure a URL to receive event notifications via HTTP POST."}
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
                    <Label
                      htmlFor={`event-${event}`}
                      className="text-sm font-normal"
                    >
                      {event}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={!url.trim() || selectedEvents.length === 0}
            >
              {dialogMode === "edit" ? "Save Changes" : "Add Webhook"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
