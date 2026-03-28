"use client";

import { useEffect, useState } from "react";

interface HealthChecks {
  db: string;
  redis: string;
  mediamtx: string;
}

/**
 * T284: Degraded banner component
 *
 * Polls /ready every 30s. If any component is degraded, shows a yellow warning banner.
 */
export function DegradedBanner() {
  const [degradedComponents, setDegradedComponents] = useState<string[]>([]);

  useEffect(() => {
    async function checkHealth() {
      try {
        const res = await fetch("http://localhost:3001/ready");
        const data = await res.json();
        const checks: HealthChecks = data.checks;

        const degraded: string[] = [];
        if (checks.db === "error") degraded.push("Database");
        if (checks.redis === "error") degraded.push("Redis");
        if (checks.mediamtx === "error") degraded.push("Stream Engine");

        setDegradedComponents(degraded);
      } catch {
        // If health check itself fails, show generic degraded
        setDegradedComponents(["API"]);
      }
    }

    checkHealth();
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  if (degradedComponents.length === 0) return null;

  return (
    <div className="bg-yellow-50 border-b border-yellow-200 px-4 py-2 text-sm text-yellow-800 flex items-center gap-2">
      <span className="font-medium">
        Degraded: {degradedComponents.join(", ")}
      </span>
      <span className="text-yellow-600">
        — Some features may be unavailable.
      </span>
    </div>
  );
}
