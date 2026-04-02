"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { getApiBaseUrl } from "@/lib/api-url"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
} from "@/components/ui/card"
import { Radio, Loader2, CheckCircle2, XCircle } from "lucide-react"

type VerifyState = "loading" | "success" | "error"

export default function VerifyPage() {
  const params = useParams()
  const token = params.token as string
  const [state, setState] = useState<VerifyState>("loading")
  const [message, setMessage] = useState("")

  useEffect(() => {
    if (!token) {
      setState("error")
      setMessage("No verification token provided.")
      return
    }

    async function verify() {
      try {
        const res = await fetch(`${getApiBaseUrl()}/auth/verify`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        })

        if (!res.ok) {
          const body = await res.json().catch(() => null)
          throw new Error(
            body?.error?.message ?? "Invalid or expired verification link."
          )
        }

        setState("success")
        setMessage("Email verified! You can now sign in.")
      } catch (err) {
        setState("error")
        setMessage(
          err instanceof Error
            ? err.message
            : "Invalid or expired verification link."
        )
      }
    }

    verify()
  }, [token])

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-2">
          <div className="flex size-11 items-center justify-center rounded-lg bg-primary">
            <Radio className="size-5 text-primary-foreground" />
          </div>
          <h1 className="text-lg font-semibold">CCTV Platform</h1>
        </div>

        <Card>
          <CardContent className="flex flex-col items-center gap-4 pt-6 pb-6">
            {state === "loading" && (
              <>
                <Loader2 className="size-8 animate-spin text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Verifying your email...
                </p>
              </>
            )}

            {state === "success" && (
              <>
                <div className="flex size-12 items-center justify-center rounded-full bg-emerald-100">
                  <CheckCircle2 className="size-6 text-emerald-600" />
                </div>
                <div className="text-center">
                  <h2 className="text-lg font-semibold">Email Verified</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {message}
                  </p>
                </div>
                <a href="/login">
                  <Button>Sign in</Button>
                </a>
              </>
            )}

            {state === "error" && (
              <>
                <div className="flex size-12 items-center justify-center rounded-full bg-red-100">
                  <XCircle className="size-6 text-red-600" />
                </div>
                <div className="text-center">
                  <h2 className="text-lg font-semibold">Verification Failed</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {message}
                  </p>
                </div>
                <a href="/login">
                  <Button variant="outline">Back to Sign in</Button>
                </a>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
