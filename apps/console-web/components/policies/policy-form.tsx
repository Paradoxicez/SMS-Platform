"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiClient } from "../../lib/api-client";
import { toast } from "sonner";

/**
 * T101: Policy form component
 *
 * Used inside a Dialog for both create and edit.
 * Fields: name, scope tabs (with assignment), TTL range, domain allowlist, rate limit, viewer concurrency.
 */

interface PolicyData {
  id?: string;
  name: string;
  ttl_min: number;
  ttl_max: number;
  ttl_default: number;
  domain_allowlist: string[] | null;
  rate_limit_per_min: number;
  viewer_concurrency_limit: number;
  version?: number;
}

interface AssignTarget {
  id: string;
  name: string;
  assigned: boolean;
}

interface PolicyFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  policy?: PolicyData;
}

export function PolicyFormDialog({
  open,
  onOpenChange,
  onSuccess,
  policy,
}: PolicyFormDialogProps) {
  const isEdit = !!policy?.id;

  const [name, setName] = useState(policy?.name ?? "");
  const [ttlMin, setTtlMin] = useState(policy?.ttl_min ?? 60);
  const [ttlMax, setTtlMax] = useState(policy?.ttl_max ?? 300);
  const [ttlDefault, setTtlDefault] = useState(policy?.ttl_default ?? 120);
  const [domains, setDomains] = useState<string[]>(
    policy?.domain_allowlist ?? [],
  );
  const [domainInput, setDomainInput] = useState("");
  const [rateLimitEnabled, setRateLimitEnabled] = useState(
    (policy?.rate_limit_per_min ?? 100) > 0,
  );
  const [rateLimitPerMin, setRateLimitPerMin] = useState(
    policy?.rate_limit_per_min ?? 100,
  );
  const [viewerConcurrency, setViewerConcurrency] = useState(
    policy?.viewer_concurrency_limit ?? 50,
  );
  const [scopeTab, setScopeTab] = useState<string>("project");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  // Assignment state
  const [projects, setProjects] = useState<AssignTarget[]>([]);
  const [sites, setSites] = useState<AssignTarget[]>([]);
  const [cameras, setCameras] = useState<AssignTarget[]>([]);
  const [loadingTargets, setLoadingTargets] = useState(false);
  // Key to force re-mount Select after picking an option (resets to placeholder)
  const [selectKey, setSelectKey] = useState(0);

  // Fetch assignment targets
  useEffect(() => {
    if (!open) return;

    setLoadingTargets(true);

    const policyId = policy?.id;

    Promise.all([
      apiClient.listProjects(1, 100),
      apiClient.get<{ data: { id: string; name: string; site_id: string; policy_id: string | null }[] }>("/cameras?per_page=200"),
    ]).then(async ([projectsRes, camerasRes]) => {
      const allProjects = (projectsRes.data ?? []) as any[];
      const allCameras = (camerasRes.data ?? []) as any[];

      // Fetch all sites for all projects
      const siteResults = await Promise.all(
        allProjects.map((p: any) =>
          apiClient.listSites(p.id, 1, 100).catch(() => ({ data: [] })),
        ),
      );
      const allSites = siteResults.flatMap((r) => (r.data ?? []) as any[]);

      setProjects(
        allProjects.map((p: any) => ({
          id: p.id,
          name: p.name,
          assigned: policyId ? (p.default_policy_id ?? p.defaultPolicyId) === policyId : false,
        })),
      );

      setSites(
        allSites.map((s: any) => ({
          id: s.id,
          name: `${s.name}`,
          assigned: policyId ? (s.default_policy_id ?? s.defaultPolicyId) === policyId : false,
        })),
      );

      setCameras(
        allCameras.map((c: any) => ({
          id: c.id,
          name: c.name,
          assigned: policyId ? (c.policy_id ?? c.policyId) === policyId : false,
        })),
      );
    }).catch(() => {
      // ignore
    }).finally(() => {
      setLoadingTargets(false);
    });
  }, [open, policy?.id]);

  const validate = (): boolean => {
    const errors: string[] = [];

    if (!name.trim()) {
      errors.push("Name is required");
    }
    if (ttlMin <= 0) {
      errors.push("TTL min must be positive");
    }
    if (ttlMax <= 0) {
      errors.push("TTL max must be positive");
    }
    if (ttlDefault <= 0) {
      errors.push("TTL default must be positive");
    }
    if (ttlMin > ttlDefault) {
      errors.push("TTL min must be less than or equal to TTL default");
    }
    if (ttlDefault > ttlMax) {
      errors.push("TTL default must be less than or equal to TTL max");
    }

    setValidationErrors(errors);
    return errors.length === 0;
  };

  const handleAddDomain = () => {
    const domain = domainInput.trim();
    if (domain && !domains.includes(domain)) {
      setDomains([...domains, domain]);
      setDomainInput("");
    }
  };

  const handleRemoveDomain = (domain: string) => {
    setDomains(domains.filter((d) => d !== domain));
  };

  function addTarget(
    list: AssignTarget[],
    setList: React.Dispatch<React.SetStateAction<AssignTarget[]>>,
    id: string,
  ) {
    setList(list.map((t) => (t.id === id ? { ...t, assigned: true } : t)));
    setSelectKey((k) => k + 1); // reset Select to placeholder
  }

  function removeTarget(
    list: AssignTarget[],
    setList: React.Dispatch<React.SetStateAction<AssignTarget[]>>,
    id: string,
  ) {
    setList(list.map((t) => (t.id === id ? { ...t, assigned: false } : t)));
  }

  const handleSubmit = async () => {
    if (!validate()) return;

    setSaving(true);
    setError(null);

    try {
      const payload: Record<string, unknown> = {
        name: name.trim(),
        ttl_min: ttlMin,
        ttl_max: ttlMax,
        ttl_default: ttlDefault,
        domain_allowlist: domains.length > 0 ? domains : null,
        rate_limit_per_min: rateLimitEnabled ? rateLimitPerMin : 0,
        viewer_concurrency_limit: viewerConcurrency,
      };

      let policyId: string;

      if (isEdit && policy?.id) {
        payload.version = policy.version;
        const res = await apiClient.patch<{ data: { id: string } }>(`/policies/${policy.id}`, payload);
        policyId = res.data.id;
      } else {
        const res = await apiClient.post<{ data: { id: string } }>("/policies", payload);
        policyId = res.data.id;
      }

      // Assign to projects
      const assignPromises: Promise<unknown>[] = [];

      for (const p of projects) {
        if (p.assigned) {
          assignPromises.push(
            apiClient.updateProject(p.id, { default_policy_id: policyId } as any),
          );
        } else if (isEdit) {
          // Unassign: only if it was previously assigned to this policy
          assignPromises.push(
            apiClient.getProject(p.id).then((res) => {
              const current = (res.data as any).default_policy_id ?? (res.data as any).defaultPolicyId;
              if (current === policyId) {
                return apiClient.updateProject(p.id, { default_policy_id: null } as any);
              }
            }),
          );
        }
      }

      // Assign to sites
      for (const s of sites) {
        if (s.assigned) {
          assignPromises.push(
            apiClient.patch(`/sites/${s.id}`, { default_policy_id: policyId }),
          );
        } else if (isEdit) {
          assignPromises.push(
            apiClient.get<{ data: any }>(`/sites/${s.id}`).then((res) => {
              const current = res.data.default_policy_id ?? res.data.defaultPolicyId;
              if (current === policyId) {
                return apiClient.patch(`/sites/${s.id}`, { default_policy_id: null });
              }
            }),
          );
        }
      }

      // Assign to cameras
      for (const c of cameras) {
        if (c.assigned) {
          // Fetch version for OCC
          assignPromises.push(
            apiClient.get<{ data: any }>(`/cameras/${c.id}`).then((res) => {
              const version = res.data.version;
              return apiClient.patch(`/cameras/${c.id}`, { policy_id: policyId, version });
            }),
          );
        } else if (isEdit) {
          assignPromises.push(
            apiClient.get<{ data: any }>(`/cameras/${c.id}`).then((res) => {
              const current = res.data.policy_id ?? res.data.policyId;
              if (current === policyId) {
                const version = res.data.version;
                return apiClient.patch(`/cameras/${c.id}`, { policy_id: null, version });
              }
            }),
          );
        }
      }

      await Promise.allSettled(assignPromises);

      toast.success(isEdit ? "Policy updated" : "Policy created");
      onSuccess();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to save policy",
      );
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  const assignedProjectCount = projects.filter((p) => p.assigned).length;
  const assignedSiteCount = sites.filter((s) => s.assigned).length;
  const assignedCameraCount = cameras.filter((c) => c.assigned).length;

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/60">
      <div className="w-full max-w-lg overflow-hidden rounded-lg bg-white shadow-2xl">
        {/* Header */}
        <div className="border-b px-6 py-4">
          <h2 className="text-lg font-semibold">
            {isEdit ? "Edit Policy" : "Create Policy"}
          </h2>
        </div>

        {/* Body */}
        <div className="max-h-[70vh] space-y-5 overflow-y-auto px-6 py-4">
          {/* Name */}
          <div className="space-y-1.5">
            <Label htmlFor="policy-name">Name</Label>
            <Input
              id="policy-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Production Default"
            />
          </div>

          {/* Scope Tabs — Assign to targets */}
          <div className="space-y-1.5">
            <Label>Assign To</Label>
            <Tabs value={scopeTab} onValueChange={setScopeTab}>
              <TabsList>
                <TabsTrigger value="project">
                  Projects{assignedProjectCount > 0 ? ` (${assignedProjectCount})` : ""}
                </TabsTrigger>
                <TabsTrigger value="site">
                  Sites{assignedSiteCount > 0 ? ` (${assignedSiteCount})` : ""}
                </TabsTrigger>
                <TabsTrigger value="camera">
                  Cameras{assignedCameraCount > 0 ? ` (${assignedCameraCount})` : ""}
                </TabsTrigger>
              </TabsList>
              <TabsContent value="project" className="mt-2">
                <p className="text-xs text-muted-foreground mb-2">
                  Set as default policy for selected projects. All cameras inherit unless overridden at site or camera level.
                </p>
                {loadingTargets ? (
                  <p className="text-sm text-muted-foreground">Loading...</p>
                ) : (
                  <div className="space-y-2">
                    <Select
                      key={`proj-${selectKey}`}
                      onValueChange={(v) => addTarget(projects, setProjects, v)}
                      disabled={projects.filter((p) => !p.assigned).length === 0}
                    >
                      <SelectTrigger className="h-8 text-sm">
                        <SelectValue placeholder={
                          projects.filter((p) => !p.assigned).length === 0
                            ? "All projects assigned"
                            : "Select a project..."
                        } />
                      </SelectTrigger>
                      <SelectContent className="z-[2100]">
                        {projects.filter((p) => !p.assigned).map((p) => (
                          <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {projects.filter((p) => p.assigned).length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {projects.filter((p) => p.assigned).map((p) => (
                          <Badge
                            key={p.id}
                            variant="secondary"
                            className="cursor-pointer gap-1"
                            onClick={() => removeTarget(projects, setProjects, p.id)}
                          >
                            {p.name}
                            <span className="ml-1 text-xs">&times;</span>
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </TabsContent>
              <TabsContent value="site" className="mt-2">
                <p className="text-xs text-muted-foreground mb-2">
                  Set as default policy for selected sites. Cameras in the site inherit unless overridden at camera level.
                </p>
                {loadingTargets ? (
                  <p className="text-sm text-muted-foreground">Loading...</p>
                ) : (
                  <div className="space-y-2">
                    <Select
                      key={`site-${selectKey}`}
                      onValueChange={(v) => addTarget(sites, setSites, v)}
                      disabled={sites.filter((s) => !s.assigned).length === 0}
                    >
                      <SelectTrigger className="h-8 text-sm">
                        <SelectValue placeholder={
                          sites.filter((s) => !s.assigned).length === 0
                            ? "All sites assigned"
                            : "Select a site..."
                        } />
                      </SelectTrigger>
                      <SelectContent className="z-[2100]">
                        {sites.filter((s) => !s.assigned).map((s) => (
                          <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {sites.filter((s) => s.assigned).length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {sites.filter((s) => s.assigned).map((s) => (
                          <Badge
                            key={s.id}
                            variant="secondary"
                            className="cursor-pointer gap-1"
                            onClick={() => removeTarget(sites, setSites, s.id)}
                          >
                            {s.name}
                            <span className="ml-1 text-xs">&times;</span>
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </TabsContent>
              <TabsContent value="camera" className="mt-2">
                <p className="text-xs text-muted-foreground mb-2">
                  Assign directly to specific cameras. This overrides site and project defaults.
                </p>
                {loadingTargets ? (
                  <p className="text-sm text-muted-foreground">Loading...</p>
                ) : (
                  <div className="space-y-2">
                    <Select
                      key={`cam-${selectKey}`}
                      onValueChange={(v) => addTarget(cameras, setCameras, v)}
                      disabled={cameras.filter((c) => !c.assigned).length === 0}
                    >
                      <SelectTrigger className="h-8 text-sm">
                        <SelectValue placeholder={
                          cameras.filter((c) => !c.assigned).length === 0
                            ? "All cameras assigned"
                            : "Select a camera..."
                        } />
                      </SelectTrigger>
                      <SelectContent className="z-[2100]">
                        {cameras.filter((c) => !c.assigned).map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {cameras.filter((c) => c.assigned).length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {cameras.filter((c) => c.assigned).map((c) => (
                          <Badge
                            key={c.id}
                            variant="secondary"
                            className="cursor-pointer gap-1"
                            onClick={() => removeTarget(cameras, setCameras, c.id)}
                          >
                            {c.name}
                            <span className="ml-1 text-xs">&times;</span>
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>

          {/* TTL Range */}
          <div className="space-y-3">
            <Label>TTL Range (seconds)</Label>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label htmlFor="ttl-min" className="text-xs text-muted-foreground">
                  Min
                </Label>
                <Input
                  id="ttl-min"
                  type="number"
                  min={1}
                  value={ttlMin}
                  onChange={(e) => setTtlMin(parseInt(e.target.value, 10) || 0)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="ttl-default" className="text-xs text-muted-foreground">
                  Default
                </Label>
                <Input
                  id="ttl-default"
                  type="number"
                  min={1}
                  value={ttlDefault}
                  onChange={(e) =>
                    setTtlDefault(parseInt(e.target.value, 10) || 0)
                  }
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="ttl-max" className="text-xs text-muted-foreground">
                  Max
                </Label>
                <Input
                  id="ttl-max"
                  type="number"
                  min={1}
                  value={ttlMax}
                  onChange={(e) => setTtlMax(parseInt(e.target.value, 10) || 0)}
                />
              </div>
            </div>
          </div>

          {/* Domain Allowlist */}
          <div className="space-y-2">
            <Label>Domain Allowlist</Label>
            <div className="flex gap-2">
              <Input
                placeholder="e.g., *.example.com"
                value={domainInput}
                onChange={(e) => setDomainInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddDomain();
                  }
                }}
              />
              <Button type="button" variant="outline" onClick={handleAddDomain}>
                Add
              </Button>
            </div>
            {domains.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {domains.map((domain) => (
                  <Badge
                    key={domain}
                    variant="secondary"
                    className="cursor-pointer gap-1"
                    onClick={() => handleRemoveDomain(domain)}
                  >
                    {domain}
                    <span className="ml-1 text-xs">&times;</span>
                  </Badge>
                ))}
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Leave empty to allow all domains. Use *.example.com for wildcard
              subdomains.
            </p>
          </div>

          {/* Rate Limit */}
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <Switch
                checked={rateLimitEnabled}
                onCheckedChange={setRateLimitEnabled}
              />
              <Label>Rate Limit</Label>
            </div>
            {rateLimitEnabled && (
              <div className="space-y-1">
                <Label
                  htmlFor="rate-limit"
                  className="text-xs text-muted-foreground"
                >
                  Requests per minute
                </Label>
                <Input
                  id="rate-limit"
                  type="number"
                  min={1}
                  value={rateLimitPerMin}
                  onChange={(e) =>
                    setRateLimitPerMin(parseInt(e.target.value, 10) || 0)
                  }
                />
              </div>
            )}
          </div>

          {/* Viewer Concurrency */}
          <div className="space-y-1.5">
            <Label htmlFor="viewer-concurrency">
              Viewer Concurrency Limit
            </Label>
            <Input
              id="viewer-concurrency"
              type="number"
              min={0}
              value={viewerConcurrency}
              onChange={(e) =>
                setViewerConcurrency(parseInt(e.target.value, 10) || 0)
              }
            />
            <p className="text-xs text-muted-foreground">
              Maximum number of concurrent viewers per camera. Set 0 for unlimited.
            </p>
          </div>

          {/* Validation errors */}
          {validationErrors.length > 0 && (
            <div className="rounded-md border border-red-200 bg-red-50 p-3">
              <ul className="list-inside list-disc text-sm text-red-600">
                {validationErrors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </div>
          )}

          {/* API error */}
          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 p-3">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 border-t px-6 py-4">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? "Saving..." : isEdit ? "Update Policy" : "Create Policy"}
          </Button>
        </div>
      </div>
    </div>
  );
}
