"use client";

import { useState } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiClient } from "../../../../lib/api-client";

export default function DataManagementPage() {
  const [exporting, setExporting] = useState(false);
  const [confirmationName, setConfirmationName] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function handleExport() {
    setExporting(true);
    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };

      // Get auth token
      try {
        const sessionRes = await fetch("/api/auth/session");
        if (sessionRes.ok) {
          const session = await sessionRes.json();
          if (session?.accessToken) {
            headers["Authorization"] = `Bearer ${session.accessToken}`;
          }
        }
      } catch {
        // Continue without auth
      }

      const res = await fetch("http://localhost:3001/api/v1/data/export", {
        method: "POST",
        headers,
      });

      if (!res.ok) throw new Error("Export failed");

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "tenant-data-export.json";
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // Export error
    } finally {
      setExporting(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    setDeleteError(null);
    try {
      await apiClient.post("/data/delete-tenant", {
        confirmation_name: confirmationName,
      });
      // Redirect to login after deletion
      window.location.href = "/login";
    } catch (err: any) {
      setDeleteError(err?.message ?? "Deletion failed. Please verify the tenant name.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Data Management</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Export your data or delete your account in compliance with GDPR.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Export Data</CardTitle>
          <CardDescription>
            Download all your tenant data as a JSON file. This includes cameras,
            projects, sites, users, policies, profiles, and audit events.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={handleExport} disabled={exporting}>
            {exporting ? "Exporting..." : "Download Data Export"}
          </Button>
        </CardContent>
      </Card>

      <Card className="border-destructive">
        <CardHeader>
          <CardTitle className="text-destructive">Delete Tenant</CardTitle>
          <CardDescription>
            Permanently delete your tenant and all associated data. This action
            cannot be undone. All cameras, recordings, users, and configuration
            will be permanently removed.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="confirm-name">
              Type your tenant name to confirm deletion
            </Label>
            <Input
              id="confirm-name"
              value={confirmationName}
              onChange={(e) => setConfirmationName(e.target.value)}
              placeholder="Enter tenant name"
              className="max-w-sm"
            />
          </div>
          {deleteError && (
            <p className="text-sm text-destructive">{deleteError}</p>
          )}
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={!confirmationName.trim() || deleting}
          >
            {deleting ? "Deleting..." : "Permanently Delete Tenant"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
