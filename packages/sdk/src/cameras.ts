import type {
  Camera,
  CreateCameraInput,
  UpdateCameraInput,
  HealthStatus,
} from "@repo/types";
import type { CCTVClient } from "./client.js";

interface CameraListResponse {
  data: Camera[];
  meta: { request_id: string; timestamp: string };
  pagination: {
    page: number;
    per_page: number;
    total: number;
    total_pages: number;
  };
}

interface CameraResponse {
  data: Camera;
  meta: { request_id: string; timestamp: string };
}

interface CameraStatusResponse {
  data: { camera_id: string; health_status: HealthStatus; metrics?: Record<string, unknown>; updated_at: string };
  meta: { request_id: string; timestamp: string };
}

interface DeleteResponse {
  data: { id: string };
  meta: { request_id: string; timestamp: string };
}

export interface CameraListFilters {
  status?: string;
  site_id?: string;
  tags?: string;
  search?: string;
  page?: number;
  per_page?: number;
}

export class CameraClient {
  constructor(private client: CCTVClient) {}

  /** List cameras with optional filters. */
  async list(filters?: CameraListFilters): Promise<Camera[]> {
    const params = new URLSearchParams();
    if (filters?.status) params.set("status", filters.status);
    if (filters?.site_id) params.set("site_id", filters.site_id);
    if (filters?.tags) params.set("tags", filters.tags);
    if (filters?.search) params.set("search", filters.search);
    if (filters?.page) params.set("page", String(filters.page));
    if (filters?.per_page) params.set("per_page", String(filters.per_page));

    const query = params.toString();
    const path = `/cameras${query ? `?${query}` : ""}`;
    const res = await this.client.request<CameraListResponse>("GET", path);
    return res.data;
  }

  /** Get a single camera by ID. */
  async get(cameraId: string): Promise<Camera> {
    const res = await this.client.request<CameraResponse>(
      "GET",
      `/cameras/${cameraId}`,
    );
    return res.data;
  }

  /** Get the current health status of a camera. */
  async getStatus(cameraId: string): Promise<{ status: HealthStatus }> {
    const res = await this.client.request<CameraStatusResponse>(
      "GET",
      `/cameras/${cameraId}/status`,
    );
    return { status: res.data.health_status };
  }

  /** Create a new camera in a site. */
  async create(siteId: string, data: Omit<CreateCameraInput, "site_id">): Promise<Camera> {
    const res = await this.client.request<CameraResponse>(
      "POST",
      `/sites/${siteId}/cameras`,
      data,
    );
    return res.data;
  }

  /** Update an existing camera. */
  async update(cameraId: string, data: UpdateCameraInput): Promise<Camera> {
    const res = await this.client.request<CameraResponse>(
      "PATCH",
      `/cameras/${cameraId}`,
      data,
    );
    return res.data;
  }

  /** Delete a camera by ID. */
  async delete(cameraId: string): Promise<void> {
    await this.client.request<DeleteResponse>(
      "DELETE",
      `/cameras/${cameraId}`,
    );
  }
}
