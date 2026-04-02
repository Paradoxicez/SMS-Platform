"use client";

import { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { apiClient } from "@/lib/api-client";

interface ApiUsage {
  current_requests_per_minute: number;
  current_requests_per_hour: number;
  current_requests_per_day: number;
  top_endpoints: { endpoint: string; count: number }[];
}

const chartConfig = {
  count: { label: "Requests", color: "hsl(142 71% 45%)" },
} satisfies ChartConfig;

export function ApiRequestsChart() {
  const [usage, setUsage] = useState<ApiUsage | null>(null);

  useEffect(() => {
    function fetchUsage() {
      apiClient
        .get<{ data: ApiUsage }>("/developer/usage")
        .then((r) => setUsage(r.data))
        .catch(() => {});
    }
    fetchUsage();
    const i = setInterval(fetchUsage, 15000);
    return () => clearInterval(i);
  }, []);

  const topEndpoints = (usage?.top_endpoints ?? []).map((e) => ({
    endpoint: e.endpoint,
    count: e.count,
  }));

  const perMin = usage?.current_requests_per_minute ?? 0;
  const perHour = usage?.current_requests_per_hour ?? 0;
  const perDay = usage?.current_requests_per_day ?? 0;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">API Usage</CardTitle>
            <CardDescription>Requests via API Keys (Developer)</CardDescription>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <div className="text-center">
              <div className="font-semibold tabular-nums">{perMin}</div>
              <div className="text-[10px] text-muted-foreground">/min</div>
            </div>
            <div className="h-6 w-px bg-border" />
            <div className="text-center">
              <div className="font-semibold tabular-nums">{perHour}</div>
              <div className="text-[10px] text-muted-foreground">/hr</div>
            </div>
            <div className="h-6 w-px bg-border" />
            <div className="text-center">
              <div className="font-bold tabular-nums text-base">{perDay}</div>
              <div className="text-[10px] text-muted-foreground">/day</div>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pb-3">
        {topEndpoints.length === 0 ? (
          <div className="flex h-[180px] items-center justify-center text-sm text-muted-foreground">
            No API Key requests yet. Create an API Key to start tracking.
          </div>
        ) : (
          <>
            <p className="text-xs text-muted-foreground mb-2">Top Endpoints (today)</p>
            <ChartContainer config={chartConfig} className="h-[160px] w-full">
              <BarChart data={topEndpoints} layout="vertical" accessibilityLayer barCategoryGap={6}>
                <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                <YAxis
                  dataKey="endpoint"
                  type="category"
                  tickLine={false}
                  axisLine={false}
                  width={160}
                  fontSize={11}
                  tick={{ fill: "hsl(var(--muted-foreground))" }}
                />
                <XAxis type="number" tickLine={false} axisLine={false} fontSize={10} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar
                  dataKey="count"
                  fill="var(--color-count)"
                  radius={[0, 6, 6, 0]}
                  isAnimationActive={false}
                />
              </BarChart>
            </ChartContainer>
          </>
        )}
      </CardContent>
    </Card>
  );
}
