import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import {
  getSystemMetricsSnapshot,
  getMetricsHistory,
} from "../services/system-metrics";

const systemMetricsRouter = new Hono();

// GET /system/metrics — current snapshot + history (one-time)
systemMetricsRouter.get("/metrics", async (c) => {
  const [current, history] = await Promise.all([
    getSystemMetricsSnapshot(),
    getMetricsHistory(),
  ]);

  return c.json({
    data: { current, history },
    meta: {
      request_id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
    },
  });
});

// GET /system/metrics/stream — SSE realtime stream (every 1s)
systemMetricsRouter.get("/metrics/stream", async (c) => {
  return streamSSE(c, async (stream) => {
    let running = true;

    stream.onAbort(() => {
      running = false;
    });

    // Send initial history
    const history = await getMetricsHistory();
    await stream.writeSSE({
      event: "history",
      data: JSON.stringify(history),
    });

    // Stream updates every 1 second
    while (running) {
      try {
        const snapshot = await getSystemMetricsSnapshot();
        await stream.writeSSE({
          event: "metric",
          data: JSON.stringify({
            t: snapshot.timestamp,
            cpu: snapshot.cpu.percent,
            cpuCores: snapshot.cpu.cores,
            mem: snapshot.memory.percent,
            memUsed: snapshot.memory.used,
            memTotal: snapshot.memory.total,
            disk: snapshot.disk.percent,
            diskUsed: snapshot.disk.used,
            diskTotal: snapshot.disk.total,
            bwIn: snapshot.bandwidth.inRate,
            bwOut: snapshot.bandwidth.outRate,
          }),
        });
      } catch {
        // Skip failed reads
      }
      await stream.sleep(1000);
    }
  });
});

export { systemMetricsRouter };
