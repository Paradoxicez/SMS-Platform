"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";


interface ExportButtonProps {
  filters: {
    from: string;
    to: string;
    eventType: string;
    search: string;
  };
}

/**
 * T106: Export button component for audit events.
 * DropdownMenu with CSV and JSON export options.
 * Calls POST /audit/events/export and triggers a browser download.
 */
export function ExportButton({ filters }: ExportButtonProps) {
  async function handleExport(format: "csv" | "json") {
    try {
      const body: Record<string, string> = { format };
      if (filters.from) body.from = filters.from;
      if (filters.to) body.to = filters.to;
      if (filters.eventType) body.event_type = filters.eventType;

      const baseUrl =
        (typeof window !== "undefined"
          ? window.location.origin
          : "") + "/api/v1";

      const res = await fetch(`${baseUrl}/audit/events/export`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) throw new Error("Export failed");

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const filename =
        format === "csv" ? "audit-events.csv" : "audit-events.json";

      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      // Export failed silently
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">Export</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem onClick={() => handleExport("csv")}>
          Export CSV
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport("json")}>
          Export JSON
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
