import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"

// Server-side internal URL (container-to-container), falls back to public URL
const API_URL =
  process.env["API_INTERNAL_URL"] ?? process.env["NEXT_PUBLIC_API_URL"] ?? "http://localhost:3001/api/v1"

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
          const res = await fetch(`${API_URL}/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email: credentials.email,
              password: credentials.password,
            }),
          })

          if (!res.ok) return null

          const { data } = await res.json()

          // MFA required — pass the mfa_token through
          if (data.mfa_required) {
            return {
              id: data.user_id,
              mfaRequired: true,
              mfaToken: data.mfa_token,
            } as any
          }

          return {
            id: data.user.id,
            name: data.user.name,
            email: data.user.email,
            accessToken: data.access_token,
            role: data.user.role,
            tenantId: data.user.tenant_id,
          }
        } catch {
          return null
        }
      },
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
    async jwt({ token, user }) {
      if (user) {
        token.accessToken = (user as any).accessToken as string
        token.role = (user as any).role as string
        token.tenantId = (user as any).tenantId as string
      }
      return token
    },
    async session({ session, token }) {
      return {
        ...session,
        accessToken: token.accessToken as string | undefined,
        // Only include role if it was set during login — never silently fallback to "viewer"
        // which would hide admin menu items and confuse users
        role: token.role as string | undefined,
        tenantId: token.tenantId as string | undefined,
      }
    },
    async authorized({ auth: session, request }) {
      const isLoggedIn = !!session?.user
      const { pathname } = request.nextUrl

      const isPublic =
        pathname.startsWith("/login") ||
        pathname.startsWith("/verify") ||
        pathname.startsWith("/api/auth") ||
        pathname.startsWith("/api/v1") ||
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
