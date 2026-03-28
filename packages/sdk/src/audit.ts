import type { AuditEvent } from "@repo/types";
import type { CCTVClient } from "./client.js";

interface AuditListResponse {
  data: AuditEvent[];
  meta: { request_id: string; timestamp: string };
  pagination: {
    page: number;
    per_page: number;
    total: number;
    total_pages: number;
  };
}

export interface AuditEventFilters {
  event_type?: string;
  actor_id?: string;
  camera_id?: string;
  session_id?: string;
  from?: string;
  to?: string;
  source_ip?: string;
  page?: number;
  per_page?: number;
}

export interface AuditExportParams {
  format: "csv" | "json";
  event_type?: string;
  actor_id?: string;
  camera_id?: string;
  session_id?: string;
  from?: string;
  to?: string;
}

export class AuditClient {
  constructor(private client: CCTVClient) {}

  /** List audit events with optional filters. */
  async listEvents(filters?: AuditEventFilters): Promise<AuditEvent[]> {
    const params = new URLSearchParams();
    if (filters?.event_type) params.set("event_type", filters.event_type);
    if (filters?.actor_id) params.set("actor_id", filters.actor_id);
    if (filters?.camera_id) params.set("camera_id", filters.camera_id);
    if (filters?.session_id) params.set("session_id", filters.session_id);
    if (filters?.from) params.set("from", filters.from);
    if (filters?.to) params.set("to", filters.to);
    if (filters?.source_ip) params.set("source_ip", filters.source_ip);
    if (filters?.page) params.set("page", String(filters.page));
    if (filters?.per_page) params.set("per_page", String(filters.per_page));

    const query = params.toString();
    const path = `/audit/events${query ? `?${query}` : ""}`;
    const res = await this.client.request<AuditListResponse>("GET", path);
    return res.data;
  }

  /** Export audit events as CSV or JSON. Returns raw response text. */
  async exportEvents(params: AuditExportParams): Promise<string> {
    const url = `${this.client.config.baseUrl}/audit/events/export`;
    const headers: Record<string, string> = {
      "X-API-Key": this.client.config.apiKey,
      "Content-Type": "application/json",
    };

    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(params),
    });

    if (!res.ok) {
      throw new Error(`Export failed with status ${res.status}`);
    }

    return res.text();
  }
}
