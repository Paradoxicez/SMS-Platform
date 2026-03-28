/**
 * Shared fetch wrapper for MediaMTX API calls with basic auth.
 */

const MEDIAMTX_API_USER = process.env["MEDIAMTX_API_USER"] ?? "admin";
const MEDIAMTX_API_PASS = process.env["MEDIAMTX_API_PASS"] ?? "admin";

export const authHeader =
  "Basic " + Buffer.from(`${MEDIAMTX_API_USER}:${MEDIAMTX_API_PASS}`).toString("base64");
