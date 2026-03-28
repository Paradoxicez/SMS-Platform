/**
 * Shared fetch wrapper for MediaMTX API calls with basic auth.
 */

const MEDIAMTX_API_URL =
  process.env["MEDIAMTX_API_URL"] ?? "http://localhost:9997";
const MEDIAMTX_API_USER = process.env["MEDIAMTX_API_USER"] ?? "admin";
const MEDIAMTX_API_PASS = process.env["MEDIAMTX_API_PASS"] ?? "admin";

const authHeader =
  "Basic " + Buffer.from(`${MEDIAMTX_API_USER}:${MEDIAMTX_API_PASS}`).toString("base64");

export function mediamtxFetch(
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const url = `${MEDIAMTX_API_URL}${path}`;
  return fetch(url, {
    ...init,
    headers: {
      Authorization: authHeader,
      ...init?.headers,
    },
  });
}

export { MEDIAMTX_API_URL };
