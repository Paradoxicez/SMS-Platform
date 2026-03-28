"use client"

import { useEffect, useState } from "react"
import { CreditCard, Check, ArrowRight } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { UsageMeters } from "@/components/billing/usage-meters"
import { formatDate } from "@/lib/format-date"
import { apiClient } from "@/lib/api-client"

interface UsageData {
  plan_name: string
  plan_display_name: string
  cameras: { current: number; limit: number }
  projects: { current: number; limit: number }
  users: { current: number; limit: number }
  viewer_hours_quota: number
}

interface Plan {
  id: string
  name: string
  display_name: string
  max_cameras: number
  max_projects: number
  max_users: number
  viewer_hours_quota: number
  features: Record<string, boolean>
  price_cents: number
  billing_interval: string
}

interface Invoice {
  id: string
  plan_id: string | null
  amount_cents: number
  status: string
  payment_method: string | null
  paid_at: string | null
  created_at: string
}

export default function BillingPage() {
  const [usage, setUsage] = useState<UsageData | null>(null)
  const [plans, setPlans] = useState<Plan[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const [usageRes, plansRes, invoicesRes] = await Promise.all([
          apiClient.get<{ data: UsageData }>("/billing/usage"),
          apiClient.get<{ data: Plan[] }>("/plans"),
          apiClient.get<{ data: Invoice[] }>("/billing/invoices"),
        ])
        setUsage(usageRes.data)
        setPlans(plansRes.data)
        setInvoices(invoicesRes.data)
      } catch (err) {
        console.error("Failed to load billing data:", err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  async function handleUpgrade(planId: string) {
    try {
      setCheckoutLoading(planId)
      const res = await apiClient.post<{ data: { url: string } }>(
        "/billing/checkout",
        { plan_id: planId },
      )
      window.location.href = res.data.url
    } catch (err) {
      console.error("Checkout failed:", err)
    } finally {
      setCheckoutLoading(null)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6 p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 bg-muted rounded" />
          <div className="h-40 bg-muted rounded" />
          <div className="h-60 bg-muted rounded" />
        </div>
      </div>
    )
  }

  const formatPrice = (cents: number) => {
    if (cents === 0) return "Free"
    return `$${(cents / 100).toFixed(0)}`
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Billing</h1>
        <p className="text-muted-foreground">
          Manage your subscription, usage, and invoices.
        </p>
      </div>

      {/* Current Plan */}
      {usage && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <CardTitle>Current Plan</CardTitle>
              <Badge variant="secondary" className="text-sm">
                {usage.plan_display_name}
              </Badge>
            </div>
            <CardDescription>
              Your current resource usage and limits.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <UsageMeters
              meters={[
                {
                  label: "Cameras",
                  current: usage.cameras.current,
                  limit: usage.cameras.limit,
                },
                {
                  label: "Projects",
                  current: usage.projects.current,
                  limit: usage.projects.limit,
                },
                {
                  label: "Users",
                  current: usage.users.current,
                  limit: usage.users.limit,
                },
              ]}
            />
          </CardContent>
        </Card>
      )}

      {/* Plan Comparison */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Available Plans</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {plans.map((plan) => {
            const isCurrent =
              usage?.plan_name.toLowerCase() === plan.name.toLowerCase()

            return (
              <Card
                key={plan.id}
                className={
                  isCurrent ? "border-primary ring-1 ring-primary" : ""
                }
              >
                <CardHeader>
                  <CardTitle className="text-lg">{plan.display_name}</CardTitle>
                  <CardDescription>
                    <span className="text-2xl font-bold text-foreground">
                      {formatPrice(plan.price_cents)}
                    </span>
                    {plan.price_cents > 0 && (
                      <span className="text-muted-foreground">
                        /{plan.billing_interval}
                      </span>
                    )}
                    {plan.name === "enterprise" && plan.price_cents === 0 && (
                      <span className="text-muted-foreground"> Custom</span>
                    )}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <Check className="size-4 text-green-500" />
                    <span>
                      {plan.max_cameras >= 999999
                        ? "Unlimited"
                        : plan.max_cameras}{" "}
                      cameras
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="size-4 text-green-500" />
                    <span>
                      {plan.max_projects >= 999999
                        ? "Unlimited"
                        : plan.max_projects}{" "}
                      projects
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="size-4 text-green-500" />
                    <span>
                      {plan.max_users >= 999999
                        ? "Unlimited"
                        : plan.max_users}{" "}
                      users
                    </span>
                  </div>
                  {Object.entries(plan.features ?? {}).map(([key, enabled]) =>
                    enabled ? (
                      <div key={key} className="flex items-center gap-2">
                        <Check className="size-4 text-green-500" />
                        <span className="capitalize">
                          {key.replace(/_/g, " ")}
                        </span>
                      </div>
                    ) : null,
                  )}
                </CardContent>
                <CardFooter>
                  {isCurrent ? (
                    <Button variant="outline" className="w-full" disabled>
                      Current Plan
                    </Button>
                  ) : (
                    <Button
                      className="w-full"
                      onClick={() => handleUpgrade(plan.id)}
                      disabled={checkoutLoading === plan.id}
                    >
                      {checkoutLoading === plan.id ? (
                        "Loading..."
                      ) : (
                        <>
                          {plan.name === "enterprise"
                            ? "Contact Sales"
                            : "Upgrade"}
                          <ArrowRight className="ml-2 size-4" />
                        </>
                      )}
                    </Button>
                  )}
                </CardFooter>
              </Card>
            )
          })}
        </div>
      </div>

      {/* Invoice History */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CreditCard className="size-5" />
            <CardTitle>Invoice History</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {invoices.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No invoices yet.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Created at</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Payment Method</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell>
                      {formatDate(inv.created_at)}
                    </TableCell>
                    <TableCell>
                      ${(inv.amount_cents / 100).toFixed(2)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          inv.status === "paid" ? "default" : "secondary"
                        }
                      >
                        {inv.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="capitalize">
                      {inv.payment_method ?? "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
