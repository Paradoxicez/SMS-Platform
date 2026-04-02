import type {
  Camera,
  CreateCameraInput,
  UpdateCameraInput,
  Project,
  CreateProjectInput,
  UpdateProjectInput,
  Site,
  CreateSiteInput,
  UpdateSiteInput,
} from "@repo/types";

export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}

export class ApiClientError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly details?: unknown;

  constructor(code: string, message: string, statusCode: number, details?: unknown) {
    super(message);
    this.name = "ApiClientError";
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

interface SuccessEnvelope<T> {
  data: T;
  meta: {
    request_id: string;
    timestamp: string;
  };
}

interface PaginatedEnvelope<T> {
  data: T[];
  meta: {
    request_id: string;
    timestamp: string;
  };
  pagination: {
    page: number;
    per_page: number;
    total: number;
    total_pages: number;
  };
}

interface ErrorEnvelope {
  error: ApiError;
  meta?: {
    request_id: string;
    timestamp: string;
  };
}

export interface StreamProfile {
  id: string;
  name: string;
  description?: string;
  protocol: "hls" | "webrtc" | "both";
  audio_mode: "include" | "strip" | "mute";
  max_framerate: number | null;
  output_resolution: "original" | "2160p" | "1440p" | "1080p" | "720p" | "480p" | "360p" | "240p";
  output_codec: "h264" | "passthrough" | "copy";
  keyframe_interval: number;
  is_default: boolean;
  version: number;
  camera_count: number;
  created_at: string;
  updated_at: string;
}

export interface CreateStreamProfileInput {
  name: string;
  description?: string;
  protocol: "hls" | "webrtc" | "both";
  audio_mode: "include" | "strip" | "mute";
  max_framerate: number | null;
  output_resolution?: "original" | "2160p" | "1440p" | "1080p" | "720p" | "480p" | "360p" | "240p";
  output_codec?: "h264" | "passthrough" | "copy";
  keyframe_interval?: number;
}

export interface CameraFilters {
  status?: string;
  site_id?: string;
  tags?: string;
  search?: string;
  page?: number;
  per_page?: number;
}

export interface CameraHealthStatus {
  camera_id: string;
  health_status: string;
  metrics?: Record<string, unknown>;
  updated_at: string;
}

export interface DashboardStats {
  total_cameras: number;
  online_count: number;
  offline_count: number;
  degraded_count: number;
  active_sessions: number;
}

export class ApiClient {
  private baseUrl: string;
  private token: string | null = null;

  constructor(baseUrl?: string) {
    // In browser: use relative URL (proxied by Next.js rewrites)
    // On server: use env var or default
    this.baseUrl = baseUrl
      ?? (typeof window !== "undefined"
        ? "/api/v1"
        : (process.env["NEXT_PUBLIC_API_URL"] ?? "http://localhost:3001/api/v1"));
  }

  setToken(token: string): void {
    this.token = token;
  }

  private async getHeaders(): Promise<Record<string, string>> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    // Try to get token from next-auth session if not manually set
    let authToken = this.token;
    if (!authToken && typeof window !== "undefined") {
      try {
        const res = await fetch("/api/auth/session");
        if (res.ok) {
          const session = await res.json();
          authToken = session?.accessToken ?? null;
          if (authToken) this.token = authToken;
        }
      } catch {
        // Session fetch failed — continue without auth
      }
    }

    if (authToken) {
      headers["Authorization"] = `Bearer ${authToken}`;
    }
    return headers;
  }

  private async handleResponse<T>(res: Response): Promise<T> {
    if (!res.ok) {
      let errorData: ErrorEnvelope | null = null;
      try {
        errorData = (await res.json()) as ErrorEnvelope;
      } catch {
        // Response is not JSON
      }

      throw new ApiClientError(
        errorData?.error?.code ?? `HTTP_${res.status}`,
        errorData?.error?.message ?? `API error: ${res.status}`,
        res.status,
        errorData?.error?.details,
      );
    }

    return res.json() as Promise<T>;
  }

  async get<T>(path: string): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      headers: await this.getHeaders(),
    });
    return this.handleResponse<T>(res);
  }

  async post<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: "POST",
      headers: await this.getHeaders(),
      body: JSON.stringify(body),
    });
    return this.handleResponse<T>(res);
  }

  async patch<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: "PATCH",
      headers: await this.getHeaders(),
      body: JSON.stringify(body),
    });
    return this.handleResponse<T>(res);
  }

  async put<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: "PUT",
      headers: await this.getHeaders(),
      body: JSON.stringify(body),
    });
    return this.handleResponse<T>(res);
  }

  async delete<T>(path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: "DELETE",
      headers: await this.getHeaders(),
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return this.handleResponse<T>(res);
  }

  // ---- Camera methods ----

  async listCameras(
    filters?: CameraFilters,
  ): Promise<PaginatedEnvelope<Camera>> {
    const params = new URLSearchParams();
    if (filters?.status) params.set("status", filters.status);
    if (filters?.site_id) params.set("site_id", filters.site_id);
    if (filters?.tags) params.set("tags", filters.tags);
    if (filters?.search) params.set("search", filters.search);
    if (filters?.page) params.set("page", String(filters.page));
    if (filters?.per_page) params.set("per_page", String(filters.per_page));

    const query = params.toString();
    const path = `/cameras${query ? `?${query}` : ""}`;
    return this.get<PaginatedEnvelope<Camera>>(path);
  }

  async getCamera(id: string): Promise<SuccessEnvelope<Camera>> {
    return this.get<SuccessEnvelope<Camera>>(`/cameras/${id}`);
  }

  async getCameraStatus(id: string): Promise<SuccessEnvelope<CameraHealthStatus>> {
    return this.get<SuccessEnvelope<CameraHealthStatus>>(`/cameras/${id}/status`);
  }

  async createCamera(
    siteId: string,
    data: Omit<CreateCameraInput, "site_id">,
  ): Promise<SuccessEnvelope<Camera>> {
    return this.post<SuccessEnvelope<Camera>>(`/sites/${siteId}/cameras`, data);
  }

  async updateCamera(
    id: string,
    data: UpdateCameraInput,
  ): Promise<SuccessEnvelope<Camera>> {
    return this.patch<SuccessEnvelope<Camera>>(`/cameras/${id}`, data);
  }

  async deleteCamera(id: string): Promise<SuccessEnvelope<{ id: string }>> {
    return this.delete<SuccessEnvelope<{ id: string }>>(`/cameras/${id}`);
  }

  async startCamera(id: string): Promise<SuccessEnvelope<{ id: string; status: string }>> {
    return this.post<SuccessEnvelope<{ id: string; status: string }>>(
      `/cameras/${id}/start`,
      {},
    );
  }

  async stopCamera(id: string): Promise<SuccessEnvelope<{ id: string; status: string }>> {
    return this.post<SuccessEnvelope<{ id: string; status: string }>>(
      `/cameras/${id}/stop`,
      {},
    );
  }

  // ---- Project methods ----

  async listProjects(
    page: number = 1,
    perPage: number = 20,
  ): Promise<PaginatedEnvelope<Project>> {
    return this.get<PaginatedEnvelope<Project>>(
      `/projects?page=${page}&per_page=${perPage}`,
    );
  }

  async getProject(id: string): Promise<SuccessEnvelope<Project>> {
    return this.get<SuccessEnvelope<Project>>(`/projects/${id}`);
  }

  async createProject(data: CreateProjectInput): Promise<SuccessEnvelope<Project>> {
    return this.post<SuccessEnvelope<Project>>("/projects", data);
  }

  async updateProject(id: string, data: Partial<UpdateProjectInput>): Promise<SuccessEnvelope<Project>> {
    return this.patch<SuccessEnvelope<Project>>(`/projects/${id}`, data);
  }

  async deleteProject(id: string): Promise<SuccessEnvelope<{ id: string }>> {
    return this.delete<SuccessEnvelope<{ id: string }>>(`/projects/${id}`);
  }

  // ---- Site methods ----

  async listSites(
    projectId: string,
    page: number = 1,
    perPage: number = 20,
  ): Promise<PaginatedEnvelope<Site>> {
    return this.get<PaginatedEnvelope<Site>>(
      `/projects/${projectId}/sites?page=${page}&per_page=${perPage}`,
    );
  }

  async getSite(id: string): Promise<SuccessEnvelope<Site>> {
    return this.get<SuccessEnvelope<Site>>(`/sites/${id}`);
  }

  async createSite(projectId: string, data: Omit<CreateSiteInput, "project_id">): Promise<SuccessEnvelope<Site>> {
    return this.post<SuccessEnvelope<Site>>(`/projects/${projectId}/sites`, data);
  }

  async updateSite(id: string, data: Partial<UpdateSiteInput>): Promise<SuccessEnvelope<Site>> {
    return this.patch<SuccessEnvelope<Site>>(`/sites/${id}`, data);
  }

  async deleteSite(id: string): Promise<SuccessEnvelope<{ id: string }>> {
    return this.delete<SuccessEnvelope<{ id: string }>>(`/sites/${id}`);
  }

  async applySiteProfile(
    siteId: string,
  ): Promise<SuccessEnvelope<{ cameras_updated: number }>> {
    return this.post<SuccessEnvelope<{ cameras_updated: number }>>(
      `/sites/${siteId}/apply-profile`,
      {},
    );
  }

  // ---- User profile ----

  async updateProfile(data: { name?: string; email?: string }): Promise<SuccessEnvelope<unknown>> {
    return this.patch<SuccessEnvelope<unknown>>("/users/me", data);
  }

  // ---- Playback sessions ----

  async createPlaybackSession(data: {
    camera_id: string;
    ttl?: number;
    embed_origin?: string;
  }): Promise<SuccessEnvelope<{ session_id: string; playback_url: string; protocol: string; codec: string; expires_at: string }>> {
    return this.post<SuccessEnvelope<{ session_id: string; playback_url: string; protocol: string; codec: string; expires_at: string }>>(
      "/playback/sessions",
      data,
    );
  }

  async revokePlaybackSession(sessionId: string): Promise<SuccessEnvelope<{ session_id: string; status: string }>> {
    return this.post<SuccessEnvelope<{ session_id: string; status: string }>>(
      `/playback/sessions/${sessionId}/revoke`,
      {},
    );
  }

  // ---- Stream Profile methods ----

  async listProfiles(): Promise<PaginatedEnvelope<StreamProfile>> {
    return this.get<PaginatedEnvelope<StreamProfile>>("/stream-profiles");
  }

  async getProfile(id: string): Promise<SuccessEnvelope<StreamProfile>> {
    return this.get<SuccessEnvelope<StreamProfile>>(`/stream-profiles/${id}`);
  }

  async createStreamProfile(
    data: CreateStreamProfileInput,
  ): Promise<SuccessEnvelope<StreamProfile>> {
    return this.post<SuccessEnvelope<StreamProfile>>("/stream-profiles", data);
  }

  async updateStreamProfile(
    id: string,
    data: Partial<CreateStreamProfileInput>,
  ): Promise<SuccessEnvelope<StreamProfile>> {
    return this.patch<SuccessEnvelope<StreamProfile>>(`/stream-profiles/${id}`, data);
  }

  async deleteStreamProfile(id: string): Promise<SuccessEnvelope<{ id: string }>> {
    return this.delete<SuccessEnvelope<{ id: string }>>(`/stream-profiles/${id}`);
  }

  async cloneProfile(id: string): Promise<SuccessEnvelope<StreamProfile>> {
    return this.post<SuccessEnvelope<StreamProfile>>(`/stream-profiles/${id}/clone`, {});
  }

  async getProfileCameras(id: string): Promise<PaginatedEnvelope<Camera>> {
    return this.get<PaginatedEnvelope<Camera>>(`/stream-profiles/${id}/cameras`);
  }

  async assignProfileToCamera(
    cameraId: string,
    profileId: string,
  ): Promise<SuccessEnvelope<Camera>> {
    // Fetch current camera to get version for optimistic concurrency
    const current = await this.getCamera(cameraId);
    return this.patch<SuccessEnvelope<Camera>>(`/cameras/${cameraId}`, {
      profile_id: profileId,
      version: (current.data as any).version ?? 1,
    });
  }

  async bulkAssignProfile(
    cameraIds: string[],
    profileId: string,
  ): Promise<SuccessEnvelope<{ updated_count: number }>> {
    return this.post<SuccessEnvelope<{ updated_count: number }>>(
      "/cameras/bulk-assign-profile",
      { camera_ids: cameraIds, profile_id: profileId },
    );
  }

  async importCameras(
    camerasData: {
      name: string;
      rtsp_url: string;
      site_id: string;
      profile_id?: string;
      lat?: number;
      lng?: number;
      tags?: string[];
    }[],
  ): Promise<
    SuccessEnvelope<{
      imported: number;
      skipped: number;
      errors: { index: number; reason: string }[];
    }>
  > {
    return this.post<
      SuccessEnvelope<{
        imported: number;
        skipped: number;
        errors: { index: number; reason: string }[];
      }>
    >("/cameras/import", { cameras: camerasData });
  }

  async importProfiles(
    mappings: { camera_name: string; profile_name: string }[],
  ): Promise<
    SuccessEnvelope<{
      updated: number;
      not_found: number;
      errors: { camera_name: string; reason: string }[];
    }>
  > {
    return this.post<
      SuccessEnvelope<{
        updated: number;
        not_found: number;
        errors: { camera_name: string; reason: string }[];
      }>
    >("/cameras/import-profiles", { mappings });
  }

  // ---- Dashboard ----

  async getDashboardStats(): Promise<SuccessEnvelope<DashboardStats>> {
    // Compose stats from camera list (get counts by status)
    // This is an MVP approach; a dedicated endpoint would be more efficient.
    try {
      const [all, online, offline, degraded] = await Promise.all([
        this.listCameras({ per_page: 1 }),
        this.listCameras({ status: "online", per_page: 1 }),
        this.listCameras({ status: "offline", per_page: 1 }),
        this.listCameras({ status: "degraded", per_page: 1 }),
      ]);

      return {
        data: {
          total_cameras: all.pagination.total,
          online_count: online.pagination.total,
          offline_count: offline.pagination.total,
          degraded_count: degraded.pagination.total,
          active_sessions: 0, // Would require a sessions endpoint
        },
        meta: {
          request_id: crypto.randomUUID(),
          timestamp: new Date().toISOString(),
        },
      };
    } catch {
      // Return zeros if API is unavailable
      return {
        data: {
          total_cameras: 0,
          online_count: 0,
          offline_count: 0,
          degraded_count: 0,
          active_sessions: 0,
        },
        meta: {
          request_id: crypto.randomUUID(),
          timestamp: new Date().toISOString(),
        },
      };
    }
  }
  async getSystemMetrics(): Promise<SuccessEnvelope<{
    current: {
      timestamp: string;
      cpu: { percent: number; cores: number };
      memory: { used: number; total: number; percent: number };
      disk: { used: number; total: number; percent: number };
      bandwidth: { inRate: number; outRate: number; totalInBytes: number; totalOutBytes: number };
    };
    history: { t: string; cpu: number; mem: number; disk: number; bwIn: number; bwOut: number }[];
  }>> {
    return this.get("/system/metrics");
  }
}

export const apiClient = new ApiClient();
