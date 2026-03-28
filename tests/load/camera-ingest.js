import http from "k6/http";
import { check, sleep } from "k6";
import { Counter, Trend } from "k6/metrics";

const healthUpdateLatency = new Trend("health_update_latency");
const cameraCount = new Counter("cameras_simulated");

const BASE_URL = __ENV.BASE_URL || "http://localhost:3001";
const API_KEY = __ENV.API_KEY || "test-api-key";

export const options = {
  scenarios: {
    baseline_500: {
      executor: "constant-vus",
      vus: 500,
      duration: "10m",
    },
    stretch_1000: {
      executor: "ramping-vus",
      startVUs: 500,
      stages: [
        { duration: "2m", target: 1000 },
        { duration: "5m", target: 1000 },
        { duration: "2m", target: 0 },
      ],
      startTime: "11m",
    },
  },
  thresholds: {
    health_update_latency: ["p(95)<5000"],
    http_req_duration: ["p(95)<2000"],
  },
};

export default function () {
  const cameraId = `cam_load_${__VU}_${__ITER}`;
  cameraCount.add(1);

  const params = {
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": API_KEY,
    },
  };

  // Simulate camera health status check
  const statusRes = http.get(
    `${BASE_URL}/api/v1/cameras/${cameraId}/status`,
    params
  );

  healthUpdateLatency.add(statusRes.timings.duration);

  check(statusRes, {
    "status response ok": (r) => r.status === 200 || r.status === 404,
  });

  // Simulate periodic health reporting (every 5s per camera)
  sleep(5);
}
