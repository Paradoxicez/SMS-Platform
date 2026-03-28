"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiClient } from "../../lib/api-client";

/**
 * T101: Policy form component
 *
 * Used inside a Dialog for both create and edit.
 * Fields: name, scope tabs, TTL range, domain allowlist, rate limit, viewer concurrency.
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

      if (isEdit && policy?.id) {
        payload.version = policy.version;
        await apiClient.patch(`/policies/${policy.id}`, payload);
      } else {
        await apiClient.post("/policies", payload);
      }

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

          {/* Scope Tabs */}
          <div className="space-y-1.5">
            <Label>Scope</Label>
            <Tabs value={scopeTab} onValueChange={setScopeTab}>
              <TabsList>
                <TabsTrigger value="project">Project Scope</TabsTrigger>
                <TabsTrigger value="camera">Camera Scope</TabsTrigger>
              </TabsList>
              <TabsContent value="project" className="mt-2">
                <p className="text-sm text-muted-foreground">
                  This policy can be assigned as a project default. All cameras
                  in the project will inherit it unless overridden.
                </p>
              </TabsContent>
              <TabsContent value="camera" className="mt-2">
                <p className="text-sm text-muted-foreground">
                  This policy can be assigned directly to individual cameras,
                  overriding the project default.
                </p>
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
              min={1}
              value={viewerConcurrency}
              onChange={(e) =>
                setViewerConcurrency(parseInt(e.target.value, 10) || 0)
              }
            />
            <p className="text-xs text-muted-foreground">
              Maximum number of concurrent viewers per camera.
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
