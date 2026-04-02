/**
 * Resolve API base URL.
 * - Browser: relative "/api/v1" (proxied by Next.js rewrites to api-control)
 * - Server: API_INTERNAL_URL or NEXT_PUBLIC_API_URL env var
 */
export function getApiBaseUrl(): string {
  if (typeof window !== "undefined") {
    return "/api/v1";
  }
  return process.env["API_INTERNAL_URL"] ?? process.env["NEXT_PUBLIC_API_URL"] ?? "http://localhost:3001/api/v1";
}

/**
 * Resolve API origin (without /api/v1 suffix).
 * Used for streaming endpoints, thumbnails, etc.
 */
export function getApiOrigin(): string {
  if (typeof window !== "undefined") {
    return "";  // relative
  }
  return (process.env["API_INTERNAL_URL"] ?? process.env["NEXT_PUBLIC_API_URL"] ?? "http://localhost:3001/api/v1").replace(/\/api\/v1$/, "");
}
