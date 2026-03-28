"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, X } from "lucide-react";
import { apiClient } from "@/lib/api-client";

export function LicenseBanner() {
  const [status, setStatus] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    async function check() {
      try {
        const res = await apiClient.get<{
          data: {
            status: string;
            days_remaining?: number;
            is_on_prem?: boolean;
          };
        }>("/license/status");

        const d = res.data;
        if (!d.is_on_prem) return;

        if (d.status === "expiring" && d.days_remaining != null) {
          setStatus("warning");
          setMessage(
            `Your license expires in ${d.days_remaining} day${d.days_remaining !== 1 ? "s" : ""}. Contact your vendor to renew.`,
          );
        } else if (d.status === "grace_period" && d.days_remaining != null) {
          const daysAgo = Math.abs(d.days_remaining);
          const daysLeft = 30 - daysAgo;
          setStatus("danger");
          setMessage(
            `Your license expired ${daysAgo} day${daysAgo !== 1 ? "s" : ""} ago. Renew within ${daysLeft} day${daysLeft !== 1 ? "s" : ""} to avoid service interruption.`,
          );
        } else if (d.status === "read_only") {
          setStatus("danger");
          setMessage(
            "License expired. New cameras and sessions are blocked. Renew your license to continue.",
          );
        } else if (d.status === "trial") {
          setStatus("info");
          setMessage(
            "Running in trial mode (3 cameras, limited features). Activate a license to unlock all features.",
          );
        }
      } catch {
        // Silently fail
      }
    }
    check();
  }, []);

  if (!message || dismissed) return null;

  const bgClass =
    status === "danger"
      ? "bg-red-50 border-red-200 text-red-800 dark:bg-red-950/30 dark:border-red-900 dark:text-red-300"
      : status === "warning"
        ? "bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-950/30 dark:border-amber-900 dark:text-amber-300"
        : "bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-950/30 dark:border-blue-900 dark:text-blue-300";

  return (
    <div className={`border-b px-4 py-2 text-sm flex items-center gap-2 ${bgClass}`}>
      <AlertTriangle className="size-4 shrink-0" />
      <span className="flex-1">{message}</span>
      {status !== "danger" && (
        <button
          onClick={() => setDismissed(true)}
          className="shrink-0 hover:opacity-70"
        >
          <X className="size-4" />
        </button>
      )}
    </div>
  );
}
