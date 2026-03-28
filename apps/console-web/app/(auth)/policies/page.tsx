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
import { ShieldCheck, Gauge, Save, Loader2, MoreHorizontal } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SortableTableHead, useTableSort } from "@/components/ui/sortable-table-head";
import { TablePagination, useClientPagination } from "@/components/ui/table-pagination";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { apiClient } from "../../../lib/api-client";
import { PolicyFormDialog } from "../../../components/policies/policy-form";

/**
 * T100: Policies page
 *
 * DataTable listing all policies for the tenant with create/edit actions.
 */

interface PolicyRow {
  id: string;
  name: string;
  ttl_min: number;
  ttl_max: number;
  ttl_default: number;
  domain_allowlist: string[] | null;
  rate_limit_per_min: number;
  viewer_concurrency_limit: number;
  version: number;
  created_at: string;
  updated_at: string;
}

export default function PoliciesPage() {
  const [policies, setPolicies] = useState<PolicyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const { sortKey, sortDirection, handleSort, sortData } = useTableSort();
  const sortedPolicies = sortData(policies, (p: PolicyRow, key: string) => {
    if (key === "name") return p.name
    return null
  })
  const policiesPagination = useClientPagination(sortedPolicies, 20);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState<PolicyRow | null>(null);

  // Quota state
  const [viewerHoursQuota, setViewerHoursQuota] = useState("1000");
  const [quotaSaving, setQuotaSaving] = useState(false);

  const fetchPolicies = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get<{
        data: PolicyRow[];
        meta: { request_id: string; timestamp: string };
      }>("/policies");
      setPolicies(Array.isArray(res.data) ? res.data : []);
    } catch {
      setPolicies([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPolicies();
  }, [fetchPolicies]);

  const handleDelete = async (id: string) => {
    try {
      await apiClient.delete(`/policies/${id}`);
      await fetchPolicies();
    } catch {
      // Error handled by api client
    }
  };

  async function handleQuotaSave() {
    setQuotaSaving(true);
    try {
      await apiClient.patch("/tenants/me", {
        viewer_hours_quota: parseInt(viewerHoursQuota, 10),
      });
      toast.success("Quota updated successfully");
    } catch {
      toast.error("Failed to update quota");
    } finally {
      setQuotaSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Policies & Quotas</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage playback policies, rate limits, and usage quotas.
          </p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)}>
          Create Policy
        </Button>
      </div>

      {/* Usage Quotas */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Gauge className="size-5 text-muted-foreground" />
            <div>
              <CardTitle className="text-base">Usage Quotas</CardTitle>
              <CardDescription>
                Control viewer-hours limits for your tenant. Per-project quotas
                can be set in individual policies.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-4">
            <div className="space-y-2 flex-1 max-w-xs">
              <Label htmlFor="viewer-hours-quota">
                Monthly Viewer-Hours Limit
              </Label>
              <Input
                id="viewer-hours-quota"
                type="number"
                value={viewerHoursQuota}
                onChange={(e) => setViewerHoursQuota(e.target.value)}
                placeholder="1000"
              />
              <p className="text-xs text-muted-foreground">
                Total viewer-hours allowed per month across all projects. Set 0
                for unlimited.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleQuotaSave}
              disabled={quotaSaving}
            >
              {quotaSaving ? (
                <Loader2 className="mr-1 size-3 animate-spin" />
              ) : (
                <Save className="mr-1 size-3" />
              )}
              Save Quota
            </Button>
          </div>
        </CardContent>
      </Card>

      <Separator />

      {loading ? (
        <div className="flex h-32 items-center justify-center text-muted-foreground">
          Loading policies...
        </div>
      ) : policies.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16">
          <div className="flex size-12 items-center justify-center rounded-full bg-muted">
            <ShieldCheck className="size-6 text-muted-foreground" />
          </div>
          <h3 className="mt-4 text-lg font-semibold">
            No policies configured
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Create a playback policy to control session TTL, domain allowlists,
            and rate limits.
          </p>
          <Button
            className="mt-4"
            onClick={() => setCreateDialogOpen(true)}
          >
            Create Policy
          </Button>
        </div>
      ) : (
        <>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <SortableTableHead sortKey="name" currentSortKey={sortKey} currentDirection={sortDirection} onSort={handleSort}>Name</SortableTableHead>
                <TableHead>TTL Range</TableHead>
                <TableHead>Domains</TableHead>
                <TableHead>Rate Limit</TableHead>
                <TableHead>Concurrency</TableHead>
                <TableHead className="w-[50px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {policiesPagination.paginatedData.map((policy) => (
                <TableRow key={policy.id}>
                  <TableCell>
                    <button
                      className="text-left font-medium text-blue-600 hover:underline"
                      onClick={() => setEditingPolicy(policy)}
                    >
                      {policy.name}
                    </button>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm">
                      {policy.ttl_min}s - {policy.ttl_max}s (default:{" "}
                      {policy.ttl_default}s)
                    </span>
                  </TableCell>
                  <TableCell>
                    {!policy.domain_allowlist ||
                    policy.domain_allowlist.length === 0 ? (
                      <span className="text-sm text-muted-foreground">
                        Any
                      </span>
                    ) : (
                      <Badge variant="secondary">
                        {policy.domain_allowlist.length} domain(s)
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="text-sm">
                      {policy.rate_limit_per_min} req/min
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm">
                      {policy.viewer_concurrency_limit} viewers
                    </span>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="size-8">
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setEditingPolicy(policy)}>
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-red-600"
                          onClick={() => handleDelete(policy.id)}
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
        <TablePagination page={policiesPagination.page} totalPages={policiesPagination.totalPages} totalItems={policiesPagination.totalItems} pageSize={policiesPagination.pageSize} onPageChange={policiesPagination.onPageChange} />
        </>
      )}

      {/* Create dialog */}
      <PolicyFormDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSuccess={() => {
          setCreateDialogOpen(false);
          fetchPolicies();
        }}
      />

      {/* Edit dialog */}
      {editingPolicy && (
        <PolicyFormDialog
          open={true}
          onOpenChange={(open) => {
            if (!open) setEditingPolicy(null);
          }}
          policy={editingPolicy}
          onSuccess={() => {
            setEditingPolicy(null);
            fetchPolicies();
          }}
        />
      )}
    </div>
  );
}
