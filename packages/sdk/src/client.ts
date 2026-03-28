import type { ErrorEnvelope } from "@repo/types";

export interface CCTVClientConfig {
  baseUrl: string;
  apiKey: string;
}

export class CCTVClient {
  readonly config: CCTVClientConfig;

  constructor(config: CCTVClientConfig) {
    this.config = config;
  }

  async request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const url = `${this.config.baseUrl}${path}`;
    const headers: Record<string, string> = {
      "X-API-Key": this.config.apiKey,
      "Content-Type": "application/json",
    };

    const res = await fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    const json = (await res.json()) as T | ErrorEnvelope;

    if (!res.ok) {
      const err = json as ErrorEnvelope;
      throw new Error(
        `API error ${err.error.code}: ${err.error.message}`,
      );
    }

    return json as T;
  }
}
