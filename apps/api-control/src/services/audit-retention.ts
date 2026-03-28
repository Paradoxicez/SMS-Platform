import { lt, count } from "drizzle-orm";
import { db } from "../db/client";
import { auditEvents } from "../db/schema/audit-events";

/**
 * T107: Audit retention service
 *
 * Purges audit events older than the specified retention period.
 * Designed to run as a cron job or scheduled task.
 */
export async function purgeOldEvents(retentionDays: number = 90): Promise<number> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - retentionDays);

  // Count events to be purged first
  const [countResult] = await db
    .select({ count: count() })
    .from(auditEvents)
    .where(lt(auditEvents.timestamp, cutoff));

  const totalToPurge = countResult?.count ?? 0;

  if (totalToPurge === 0) {
    console.log(
      JSON.stringify({
        level: "info",
        service: "audit-retention",
        message: "No audit events to purge",
        retentionDays,
        cutoff: cutoff.toISOString(),
        timestamp: new Date().toISOString(),
      }),
    );
    return 0;
  }

  // Delete old events
  await db
    .delete(auditEvents)
    .where(lt(auditEvents.timestamp, cutoff));

  console.log(
    JSON.stringify({
      level: "info",
      service: "audit-retention",
      message: `Purged ${totalToPurge} audit events older than ${retentionDays} days`,
      retentionDays,
      cutoff: cutoff.toISOString(),
      purgedCount: totalToPurge,
      timestamp: new Date().toISOString(),
    }),
  );

  return totalToPurge;
}

// Allow running directly via: tsx src/services/audit-retention.ts
if (process.argv[1]?.endsWith("audit-retention.ts")) {
  const days = parseInt(process.argv[2] ?? "90", 10);
  purgeOldEvents(days)
    .then((count) => {
      console.log(`Done. Purged ${count} events.`);
      process.exit(0);
    })
    .catch((err) => {
      console.error("Purge failed:", err);
      process.exit(1);
    });
}
