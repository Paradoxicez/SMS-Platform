"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { MoreHorizontal } from "lucide-react";
import { SortableTableHead, useTableSort } from "@/components/ui/sortable-table-head";
import { TablePagination, useClientPagination } from "@/components/ui/table-pagination";
import { formatDate } from "@/lib/format-date";
import { apiClient } from "../../../lib/api-client";

interface ApiKey {
  id: string;
  key_prefix: string;
  label: string;
  project_id: string | null;
  site_id: string | null;
  project_name: string | null;
  site_name: string | null;
  last_used_at: string | null;
  disabled_at: string | null;
  revoked_at: string | null;
  created_at: string;
  created_by_name: string | null;
  created_by_email: string | null;
}

interface KeyUsage {
  current_requests_per_minute: number;
  current_requests_per_hour: number;
  current_requests_per_day: number;
  top_endpoints: { endpoint: string; count: number }[];
}

interface ProjectItem {
  id: string;
  name: string;
}

interface SiteItem {
  id: string;
  name: string;
  project_id: string;
}

const RATE_LIMIT_PER_MINUTE = 100;

function scopeLabel(key: ApiKey) {
  if (key.site_name && key.project_name) {
    return (
      <div>
        <p className="text-sm">{key.project_name}</p>
        <p className="text-xs text-muted-foreground">{key.site_name}</p>
      </div>
    );
  }
  if (key.project_name) {
    return <span className="text-sm">{key.project_name}</span>;
  }
  return <span className="text-sm text-muted-foreground">All Projects</span>;
}

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const { sortKey, sortDirection, handleSort, sortData } = useTableSort();
  const [generateOpen, setGenerateOpen] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newProjectId, setNewProjectId] = useState<string>("");
  const [newSiteId, setNewSiteId] = useState<string>("");
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [selectedKeyId, setSelectedKeyId] = useState<string | null>(null);
  const [keyUsage, setKeyUsage] = useState<KeyUsage | null>(null);
  const [usageLoading, setUsageLoading] = useState(false);
  const [totalUsage, setTotalUsage] = useState<KeyUsage | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [sites, setSites] = useState<SiteItem[]>([]);

  const fetchKeys = useCallback(async () => {
    try {
      const res = await apiClient.get<{ data: ApiKey[] }>("/api-clients");
      setKeys(Array.isArray(res.data) ? res.data : []);
    } catch {
      // Could not fetch keys
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchTotalUsage = useCallback(async () => {
    try {
      const res = await apiClient.get<{ data: KeyUsage }>("/developer/usage");
      setTotalUsage(res.data);
    } catch {
      // Could not fetch usage
    }
  }, []);

  const fetchProjects = useCallback(async () => {
    try {
      const res = await apiClient.get<{
        data: ProjectItem[];
        pagination: { total: number };
      }>("/projects?per_page=100");
      setProjects(Array.isArray(res.data) ? res.data : []);
    } catch {
      // Could not fetch projects
    }
  }, []);

  useEffect(() => {
    fetchKeys();
    fetchTotalUsage();
    fetchProjects();
  }, [fetchKeys, fetchTotalUsage, fetchProjects]);

  // Fetch sites when project is selected in generate dialog
  useEffect(() => {
    if (!newProjectId) {
      setSites([]);
      setNewSiteId("");
      return;
    }
    async function fetchSites() {
      try {
        const res = await apiClient.get<{
          data: SiteItem[];
          pagination: { total: number };
        }>(`/projects/${newProjectId}/sites?per_page=100`);
        setSites(Array.isArray(res.data) ? res.data : []);
      } catch {
        setSites([]);
      }
    }
    fetchSites();
    setNewSiteId("");
  }, [newProjectId]);

  async function fetchKeyUsage(apiClientId: string) {
    setUsageLoading(true);
    try {
      const res = await apiClient.get<{ data: KeyUsage }>(
        `/developer/usage?api_client_id=${apiClientId}`,
      );
      setKeyUsage(res.data);
    } catch {
      setKeyUsage(null);
    } finally {
      setUsageLoading(false);
    }
  }

  function handleSelectKey(keyId: string) {
    if (selectedKeyId === keyId) {
      setSelectedKeyId(null);
      setKeyUsage(null);
    } else {
      setSelectedKeyId(keyId);
      fetchKeyUsage(keyId);
    }
  }

  async function handleGenerate() {
    try {
      const body: Record<string, string> = { label: newLabel };
      if (newProjectId && newProjectId !== "all")
        body.project_id = newProjectId;
      if (newSiteId && newSiteId !== "all") body.site_id = newSiteId;

      const res = await apiClient.post<{
        data: { id: string; key: string; prefix: string; label: string };
      }>("/api-clients", body);
      setGeneratedKey(res.data.key);
      setNewLabel("");
      setNewProjectId("");
      setNewSiteId("");
      fetchKeys();
    } catch (err) {
      console.error("Failed to generate API key:", err);
    }
  }

  async function handleRevoke(id: string) {
    try {
      await apiClient.post(`/api-clients/${id}/revoke`, {});
      clearSelection(id);
      fetchKeys();
    } catch {
      // Handle error
    }
  }

  async function handleToggleDisable(id: string, currentlyDisabled: boolean) {
    try {
      if (currentlyDisabled) {
        await apiClient.post(`/api-clients/${id}/enable`, {});
      } else {
        await apiClient.post(`/api-clients/${id}/disable`, {});
      }
      fetchKeys();
    } catch {
      // Handle error
    }
  }

  async function handleDelete(id: string) {
    try {
      await apiClient.delete(`/api-clients/${id}`);
      clearSelection(id);
      setDeleteConfirmId(null);
      fetchKeys();
    } catch {
      // Handle error
    }
  }

  function clearSelection(id: string) {
    if (selectedKeyId === id) {
      setSelectedKeyId(null);
      setKeyUsage(null);
    }
  }

  function handleCopy() {
    if (generatedKey) {
      navigator.clipboard.writeText(generatedKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  const activeKeys = keys.filter((k) => !k.revoked_at);
  const sortedActiveKeys = sortData(activeKeys, (k: ApiKey, key: string) => {
    if (key === "label") return k.label
    if (key === "created_at") return k.created_at
    if (key === "last_used_at") return k.last_used_at
    return null
  })
  const keysPagination = useClientPagination(sortedActiveKeys, 20);
  const revokedKeys = keys.filter((k) => k.revoked_at);
  const selectedKey = keys.find((k) => k.id === selectedKeyId);
  const deleteKey = keys.find((k) => k.id === deleteConfirmId);

  function statusBadge(key: ApiKey) {
    if (key.revoked_at) {
      return <Badge variant="destructive">Revoked</Badge>;
    }
    if (key.disabled_at) {
      return (
        <Badge className="bg-yellow-100 text-yellow-700">Disabled</Badge>
      );
    }
    return <Badge className="bg-green-100 text-green-700">Active</Badge>;
  }

  function maskedKey(prefix: string) {
    if (!prefix) return "sk-...";
    return `${prefix}...`;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">API Keys</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage API keys and monitor usage for programmatic access.
          </p>
        </div>
        <Dialog
          open={generateOpen}
          onOpenChange={(open) => {
            setGenerateOpen(open);
            if (!open) {
              setGeneratedKey(null);
              setCopied(false);
              setNewProjectId("");
              setNewSiteId("");
            }
          }}
        >
          <DialogTrigger asChild>
            <Button>Generate API Key</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {generatedKey ? "API Key Generated" : "Generate API Key"}
              </DialogTitle>
              <DialogDescription>
                {generatedKey
                  ? "Copy this key now. It will not be shown again."
                  : "Provide a label and optionally scope this key to a project or site."}
              </DialogDescription>
            </DialogHeader>

            {generatedKey ? (
              <div className="space-y-4 py-4">
                <div className="flex items-center gap-2">
                  <Input
                    readOnly
                    value={generatedKey}
                    className="font-mono text-sm"
                  />
                  <Button variant="outline" size="sm" onClick={handleCopy}>
                    {copied ? "Copied" : "Copy"}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Store this key securely. You will not be able to see it again.
                </p>
              </div>
            ) : (
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="key-label">Label</Label>
                  <Input
                    id="key-label"
                    value={newLabel}
                    onChange={(e) => setNewLabel(e.target.value)}
                    placeholder="e.g. Production Backend"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Project</Label>
                  <Select
                    value={newProjectId}
                    onValueChange={setNewProjectId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All Projects" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Projects</SelectItem>
                      {projects.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {newProjectId && newProjectId !== "all" && sites.length > 0 && (
                  <div className="space-y-2">
                    <Label>Site</Label>
                    <Select
                      value={newSiteId}
                      onValueChange={setNewSiteId}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="All Sites in Project" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Sites in Project</SelectItem>
                        {sites.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            )}

            <DialogFooter>
              {generatedKey ? (
                <Button onClick={() => setGenerateOpen(false)}>Done</Button>
              ) : (
                <>
                  <Button
                    variant="outline"
                    onClick={() => setGenerateOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleGenerate}
                    disabled={!newLabel.trim()}
                  >
                    Generate
                  </Button>
                </>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Usage Overview */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-2xl font-bold">
                {totalUsage?.current_requests_per_minute ?? 0}
              </p>
              <p className="text-xs text-muted-foreground">Requests / min</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-2xl font-bold">
                {totalUsage?.current_requests_per_hour ?? 0}
              </p>
              <p className="text-xs text-muted-foreground">Requests / hour</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-2xl font-bold">
                {totalUsage?.current_requests_per_day ?? 0}
              </p>
              <p className="text-xs text-muted-foreground">Requests / day</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* API Keys Table */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-lg font-semibold">Keys ({activeKeys.length})</h2>
            <p className="text-sm text-muted-foreground">Click a key to view its usage details.</p>
          </div>
        </div>
        {loading ? (
          <p className="text-sm text-muted-foreground py-8 text-center">Loading...</p>
        ) : activeKeys.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            No API keys yet. Generate one to get started.
          </p>
        ) : (
          <>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableTableHead sortKey="label" currentSortKey={sortKey} currentDirection={sortDirection} onSort={handleSort}>Key</SortableTableHead>
                  <TableHead>Project / Site</TableHead>
                  <TableHead>Created by</TableHead>
                  <SortableTableHead sortKey="created_at" currentSortKey={sortKey} currentDirection={sortDirection} onSort={handleSort}>Created at</SortableTableHead>
                  <SortableTableHead sortKey="last_used_at" currentSortKey={sortKey} currentDirection={sortDirection} onSort={handleSort}>Last used at</SortableTableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[50px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {keysPagination.paginatedData.map((key) => (
                  <TableRow
                    key={key.id}
                    className={`cursor-pointer ${selectedKeyId === key.id ? "bg-muted/50" : ""}`}
                    onClick={() => handleSelectKey(key.id)}
                  >
                    <TableCell>
                      <div>
                        <p className="font-medium">{key.label}</p>
                        <p className="font-mono text-xs text-muted-foreground">
                          {maskedKey(key.key_prefix)}
                        </p>
                      </div>
                    </TableCell>

                    <TableCell>{scopeLabel(key)}</TableCell>

                    <TableCell>
                      <div>
                        <p className="text-sm">
                          {key.created_by_name ?? "-"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {key.created_by_email ?? ""}
                        </p>
                      </div>
                    </TableCell>

                    <TableCell className="text-sm">
                      {formatDate(key.created_at)}
                    </TableCell>

                    <TableCell className="text-sm">
                      {key.last_used_at
                        ? formatDate(key.last_used_at)
                        : "Never"}
                    </TableCell>

                    <TableCell>{statusBadge(key)}</TableCell>

                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MoreHorizontal className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleDisable(key.id, !!key.disabled_at);
                            }}
                          >
                            {key.disabled_at ? "Enable" : "Disable"}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRevoke(key.id);
                            }}
                          >
                            Revoke
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteConfirmId(key.id);
                            }}
                          >
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
          <TablePagination page={keysPagination.page} totalPages={keysPagination.totalPages} totalItems={keysPagination.totalItems} pageSize={keysPagination.pageSize} onPageChange={keysPagination.onPageChange} />
          </>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={!!deleteConfirmId}
        onOpenChange={(open) => {
          if (!open) setDeleteConfirmId(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete API Key</DialogTitle>
            <DialogDescription>
              Are you sure you want to permanently delete the key{" "}
              <strong>{deleteKey?.label}</strong> ({deleteKey?.key_prefix}
              ...)? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Selected Key Usage Detail */}
      {selectedKeyId && selectedKey && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Usage: {selectedKey.label}
              <span className="font-mono text-sm font-normal text-muted-foreground">
                ({selectedKey.key_prefix}...)
              </span>
            </CardTitle>
            <CardDescription>
              Real-time usage statistics for this API key.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {usageLoading ? (
              <p className="text-sm text-muted-foreground">
                Loading usage data...
              </p>
            ) : keyUsage ? (
              <div className="space-y-6">
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        Requests / min
                      </span>
                      <span className="font-mono font-medium">
                        {keyUsage.current_requests_per_minute} /{" "}
                        {RATE_LIMIT_PER_MINUTE}
                      </span>
                    </div>
                    <Progress
                      value={
                        (keyUsage.current_requests_per_minute /
                          RATE_LIMIT_PER_MINUTE) *
                        100
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        Requests / hour
                      </span>
                      <span className="font-mono font-medium">
                        {keyUsage.current_requests_per_hour}
                      </span>
                    </div>
                    <Progress
                      value={Math.min(
                        (keyUsage.current_requests_per_hour / 6000) * 100,
                        100,
                      )}
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        Requests / day
                      </span>
                      <span className="font-mono font-medium">
                        {keyUsage.current_requests_per_day}
                      </span>
                    </div>
                    <Progress
                      value={Math.min(
                        (keyUsage.current_requests_per_day / 144000) * 100,
                        100,
                      )}
                    />
                  </div>
                </div>

                {keyUsage.top_endpoints && keyUsage.top_endpoints.length > 0 ? (
                  <div>
                    <h4 className="mb-2 text-sm font-medium">Top Endpoints</h4>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Endpoint</TableHead>
                          <TableHead className="text-right">
                            Requests
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {keyUsage.top_endpoints.map((ep, i) => (
                          <TableRow key={i}>
                            <TableCell className="font-mono text-sm">
                              {ep.endpoint}
                            </TableCell>
                            <TableCell className="text-right">
                              {ep.count}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No endpoint usage data available yet.
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No usage data available.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Revoked Keys */}
      {revokedKeys.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-lg font-semibold">Revoked Keys ({revokedKeys.length})</h2>
              <p className="text-sm text-muted-foreground">Previously active keys that have been revoked.</p>
            </div>
          </div>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Key</TableHead>
                  <TableHead>Project / Site</TableHead>
                  <TableHead>Created by</TableHead>
                  <TableHead>Created at</TableHead>
                  <TableHead>Revoked at</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[50px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {revokedKeys.map((key) => (
                  <TableRow key={key.id} className="opacity-60">
                    <TableCell>
                      <div>
                        <p className="font-medium">{key.label}</p>
                        <p className="font-mono text-xs text-muted-foreground">
                          {maskedKey(key.key_prefix)}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>{scopeLabel(key)}</TableCell>
                    <TableCell>
                      <div>
                        <p className="text-sm">
                          {key.created_by_name ?? "-"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {key.created_by_email ?? ""}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {formatDate(key.created_at)}
                    </TableCell>
                    <TableCell className="text-sm">
                      {formatDate(key.revoked_at)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="destructive">Revoked</Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                          >
                            <MoreHorizontal className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => setDeleteConfirmId(key.id)}
                          >
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
        </div>
      )}
    </div>
  );
}
