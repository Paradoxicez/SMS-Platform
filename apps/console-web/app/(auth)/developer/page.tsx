"use client";

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CodeSnippets } from "../../../components/developer/code-snippets";

export default function DeveloperPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Developer Portal</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          API examples with real URLs — copy, replace your API key, and run.
        </p>
      </div>

      {/* Quick link to API Keys */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>API Keys</CardTitle>
            <CardDescription>
              Manage API keys and monitor per-key usage.
            </CardDescription>
          </div>
          <Button asChild variant="outline">
            <a href="/api-keys">Manage API Keys</a>
          </Button>
        </CardHeader>
      </Card>

      <CodeSnippets />
    </div>
  );
}
