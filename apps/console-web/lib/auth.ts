/**
 * T053: Keycloak OIDC auth helpers for console-web (Next.js)
 *
 * MVP: Lightweight approach using cookie-based session.
 * Keycloak provider configuration:
 *   - issuer: KEYCLOAK_ISSUER env
 *   - clientId: console-web (public client, no client secret)
 */

const KEYCLOAK_ISSUER =
  process.env.KEYCLOAK_ISSUER ??
  "http://localhost:8080/realms/sms-platform";

const KEYCLOAK_CLIENT_ID = process.env.KEYCLOAK_CLIENT_ID ?? "console-web";

export interface Session {
  accessToken: string;
  sub: string;
  email: string;
  name?: string;
  roles: string[];
  expiresAt: number;
}

/**
 * Build the Keycloak authorization URL for initiating the OIDC login flow.
 */
export function getAuthorizationUrl(redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    client_id: KEYCLOAK_CLIENT_ID,
    response_type: "code",
    scope: "openid email profile",
    redirect_uri: redirectUri,
    state,
  });

  return `${KEYCLOAK_ISSUER}/protocol/openid-connect/auth?${params.toString()}`;
}

/**
 * Exchange an authorization code for tokens from Keycloak.
 */
export async function exchangeCodeForTokens(
  code: string,
  redirectUri: string,
): Promise<{
  access_token: string;
  refresh_token?: string;
  id_token?: string;
  expires_in: number;
}> {
  const tokenUrl = `${KEYCLOAK_ISSUER}/protocol/openid-connect/token`;

  const res = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: KEYCLOAK_CLIENT_ID,
      code,
      redirect_uri: redirectUri,
    }),
  });

  if (!res.ok) {
    throw new Error(`Token exchange failed: ${res.status}`);
  }

  return res.json();
}

/**
 * Decode a JWT payload without signature verification (MVP only).
 */
function decodeJwtPayload(token: string): Record<string, unknown> {
  const parts = token.split(".");
  if (parts.length !== 3 || !parts[1]) {
    throw new Error("Malformed JWT");
  }
  return JSON.parse(Buffer.from(parts[1], "base64url").toString("utf-8"));
}

/**
 * Parse a session from a raw access token.
 */
export function parseSession(accessToken: string): Session {
  const payload = decodeJwtPayload(accessToken);

  const realmAccess = payload.realm_access as
    | { roles?: string[] }
    | undefined;

  return {
    accessToken,
    sub: payload.sub as string,
    email: (payload.email as string) ?? "",
    name: payload.name as string | undefined,
    roles: realmAccess?.roles ?? [],
    expiresAt: ((payload.exp as number) ?? 0) * 1000,
  };
}

/**
 * Read the session from cookies/headers.
 *
 * MVP: Reads the access token from a cookie named `sms_session` or
 * from the Authorization header. In production, use encrypted
 * HTTP-only cookies and server-side session storage.
 */
export function getSession(
  cookieHeader?: string | null,
  authorizationHeader?: string | null,
): Session | null {
  // Try Authorization header first
  if (authorizationHeader?.startsWith("Bearer ")) {
    try {
      const token = authorizationHeader.slice(7);
      const session = parseSession(token);
      if (session.expiresAt > Date.now()) {
        return session;
      }
    } catch {
      // Fall through
    }
  }

  // Try cookie
  if (cookieHeader) {
    const match = cookieHeader.match(/sms_session=([^;]+)/);
    if (match?.[1]) {
      try {
        const token = decodeURIComponent(match[1]);
        const session = parseSession(token);
        if (session.expiresAt > Date.now()) {
          return session;
        }
      } catch {
        // Fall through
      }
    }
  }

  return null;
}

/**
 * Check if the current request has a valid session.
 */
export function isAuthenticated(
  cookieHeader?: string | null,
  authorizationHeader?: string | null,
): boolean {
  return getSession(cookieHeader, authorizationHeader) !== null;
}

/**
 * Build the Keycloak logout URL.
 */
export function getLogoutUrl(postLogoutRedirectUri: string): string {
  const params = new URLSearchParams({
    client_id: KEYCLOAK_CLIENT_ID,
    post_logout_redirect_uri: postLogoutRedirectUri,
  });

  return `${KEYCLOAK_ISSUER}/protocol/openid-connect/logout?${params.toString()}`;
}

export const keycloakConfig = {
  issuer: KEYCLOAK_ISSUER,
  clientId: KEYCLOAK_CLIENT_ID,
} as const;
