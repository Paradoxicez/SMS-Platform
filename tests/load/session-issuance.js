import http from "k6/http";
import { check, sleep } from "k6";
import { Rate, Trend } from "k6/metrics";

const errorRate = new Rate("errors");
const sessionLatency = new Trend("session_issuance_latency");

const BASE_URL = __ENV.BASE_URL || "http://localhost:3001";
const API_KEY = __ENV.API_KEY || "test-api-key";

export const options = {
  scenarios: {
    sustained_load: {
      executor: "constant-arrival-rate",
      rate: 100,
      timeUnit: "1m",
      duration: "5m",
      preAllocatedVUs: 50,
      maxVUs: 200,
    },
    spike: {
      executor: "ramping-arrival-rate",
      startRate: 10,
      timeUnit: "1m",
      stages: [
        { duration: "1m", target: 500 },
        { duration: "2m", target: 1000 },
        { duration: "1m", target: 10 },
      ],
      preAllocatedVUs: 100,
      maxVUs: 500,
      startTime: "6m",
    },
  },
  thresholds: {
    session_issuance_latency: ["p(99)<500"],
    errors: ["rate<0.01"],
    http_req_duration: ["p(95)<1000"],
  },
};

const CAMERA_IDS = [
  "cam_test_001", "cam_test_002", "cam_test_003",
  "cam_test_004", "cam_test_005",
];

export default function () {
  const cameraId = CAMERA_IDS[Math.floor(Math.random() * CAMERA_IDS.length)];

  const payload = JSON.stringify({
    camera_id: cameraId,
    ttl: 120,
  });

  const params = {
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": API_KEY,
    },
  };

  // Issue session
  const issueRes = http.post(
    `${BASE_URL}/api/v1/playback/sessions`,
    payload,
    params
  );

  sessionLatency.add(issueRes.timings.duration);

  const issueOk = check(issueRes, {
    "session issued (200/201)": (r) => r.status === 200 || r.status === 201,
    "has session_id": (r) => {
      try {
        return JSON.parse(r.body).data.session_id !== undefined;
      } catch {
        return false;
      }
    },
  });

  errorRate.add(!issueOk);

  if (issueOk && issueRes.status === 200) {
    const sessionId = JSON.parse(issueRes.body).data.session_id;

    // Refresh session
    const refreshRes = http.post(
      `${BASE_URL}/api/v1/playback/sessions/${sessionId}/refresh`,
      null,
      params
    );

    check(refreshRes, {
      "session refreshed": (r) => r.status === 200,
    });
  }

  sleep(0.1);
}
