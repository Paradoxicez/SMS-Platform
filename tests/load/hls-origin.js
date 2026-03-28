import http from "k6/http";
import { check, sleep } from "k6";
import { Trend } from "k6/metrics";

const playlistLatency = new Trend("hls_playlist_latency");
const segmentLatency = new Trend("hls_segment_latency");

const ORIGIN_URL = __ENV.ORIGIN_URL || "http://localhost:8888";

export const options = {
  scenarios: {
    viewers: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "1m", target: 100 },
        { duration: "5m", target: 5000 },
        { duration: "2m", target: 5000 },
        { duration: "1m", target: 0 },
      ],
    },
  },
  thresholds: {
    hls_playlist_latency: ["p(99)<100"],
    hls_segment_latency: ["p(95)<500"],
    http_req_failed: ["rate<0.05"],
  },
};

const CAMERA_PATHS = [
  "cam_001", "cam_002", "cam_003", "cam_004", "cam_005",
  "cam_006", "cam_007", "cam_008", "cam_009", "cam_010",
];

export default function () {
  const camera = CAMERA_PATHS[Math.floor(Math.random() * CAMERA_PATHS.length)];
  const token = "test-token";

  // Fetch playlist
  const playlistRes = http.get(
    `${ORIGIN_URL}/${camera}/index.m3u8?token=${token}`
  );
  playlistLatency.add(playlistRes.timings.duration);

  check(playlistRes, {
    "playlist 200": (r) => r.status === 200,
  });

  // Simulate segment fetches (3 segments per playlist refresh)
  for (let i = 0; i < 3; i++) {
    const segRes = http.get(
      `${ORIGIN_URL}/${camera}/segment_${Date.now()}.ts?token=${token}`
    );
    segmentLatency.add(segRes.timings.duration);

    check(segRes, {
      "segment response": (r) => r.status === 200 || r.status === 404,
    });
  }

  // HLS refresh interval (2s segment duration)
  sleep(2);
}
