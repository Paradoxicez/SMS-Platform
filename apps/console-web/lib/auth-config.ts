import NextAuth from "next-auth"
import Keycloak from "next-auth/providers/keycloak"
import Credentials from "next-auth/providers/credentials"

const keycloakIssuer =
  process.env.AUTH_KEYCLOAK_ISSUER ?? "http://localhost:8080/realms/sms-platform"
const keycloakClientId = process.env.AUTH_KEYCLOAK_ID ?? "console-web"
const keycloakClientSecret =
  process.env.AUTH_KEYCLOAK_SECRET ?? "console-web-dev-secret"

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      id: "credentials",
      name: "Email & Password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null

        try {
          // Use Keycloak's Direct Access Grants (Resource Owner Password)
          const tokenRes = await fetch(
            `${keycloakIssuer}/protocol/openid-connect/token`,
            {
              method: "POST",
              headers: { "Content-Type": "application/x-www-form-urlencoded" },
              body: new URLSearchParams({
                grant_type: "password",
                client_id: keycloakClientId,
                client_secret: keycloakClientSecret,
                username: credentials.email as string,
                password: credentials.password as string,
                scope: "openid profile email",
              }),
            }
          )

          if (!tokenRes.ok) return null

          const tokens = await tokenRes.json()

          // Decode the access token to get user info
          const payload = JSON.parse(
            Buffer.from(tokens.access_token.split(".")[1], "base64").toString()
          )

          return {
            id: payload.sub,
            name: payload.name ?? payload.preferred_username,
            email: payload.email,
            image: null,
            accessToken: tokens.access_token,
            refreshToken: tokens.refresh_token,
            role:
              payload.realm_access?.roles?.find(
                (r: string) =>
                  r === "admin" || r === "operator" || r === "developer" || r === "viewer"
              ) ?? "viewer",
          }
        } catch {
          return null
        }
      },
    }),
    Keycloak({
      clientId: keycloakClientId,
      clientSecret: keycloakClientSecret,
      issuer: keycloakIssuer,
    }),
  ],
  secret: process.env.AUTH_SECRET,
  trustHost: true,
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  callbacks: {
    async jwt({ token, user, account, profile }) {
      // Credentials provider
      if (user && "accessToken" in user) {
        token.accessToken = user.accessToken as string
        token.refreshToken = (user as Record<string, unknown>).refreshToken as string
        token.role = (user as Record<string, unknown>).role as string
      }
      // Keycloak OIDC provider
      if (account?.provider === "keycloak") {
        token.accessToken = account.access_token
        token.role =
          (profile as Record<string, unknown>)?.realm_access !== undefined
            ? (
                (profile as Record<string, unknown>).realm_access as Record<
                  string,
                  string[]
                >
              )?.roles?.find(
                (r) =>
                  r === "admin" || r === "operator" || r === "developer" || r === "viewer"
              ) ?? "viewer"
            : "admin"
      }
      return token
    },
    async session({ session, token }) {
      return {
        ...session,
        accessToken: token.accessToken as string | undefined,
        role: (token.role as string) ?? "viewer",
      }
    },
    async authorized({ auth: session, request }) {
      const isLoggedIn = !!session?.user
      const { pathname } = request.nextUrl

      const isPublic =
        pathname.startsWith("/login") ||
        pathname.startsWith("/register") ||
        pathname.startsWith("/verify") ||
        pathname.startsWith("/api/auth") ||
        pathname.startsWith("/play") ||
        pathname.startsWith("/embed/") ||
        pathname.startsWith("/map/") ||
        pathname.startsWith("/invite/") ||
        pathname === "/favicon.ico"

      if (isPublic) return true
      return isLoggedIn
    },
  },
})
