"use client"

import { useSession } from "next-auth/react"

export type UserRole = "admin" | "operator" | "developer" | "viewer"

/**
 * Returns the current user's role from the session.
 * Also provides helper booleans for common permission checks.
 */
export function useUserRole() {
  const { data: session } = useSession()
  const role = ((session as any)?.role as UserRole) ?? "viewer"

  return {
    role,
    /** Can create, update, delete resources (admin + operator) */
    canEdit: role === "admin" || role === "operator",
    /** Full admin access (user management, system config) */
    isAdmin: role === "admin",
    /** Read-only user */
    isViewer: role === "viewer",
  }
}
