import type {
  PlaybackSession,
  CreatePlaybackSessionInput,
  BatchCreatePlaybackSessionInput,
} from "@repo/types";
import type { CCTVClient } from "./client.js";

interface SessionResponse {
  data: {
    session_id: string;
    playback_url: string;
    expires_at: string;
    ttl: number;
  };
  meta: { request_id: string; timestamp: string };
}

interface RefreshResponse {
  data: {
    session_id: string;
    expires_at: string;
  };
  meta: { request_id: string; timestamp: string };
}

interface BatchSessionResponse {
  data: Array<{
    camera_id: string;
    session_id?: string;
    playback_url?: string;
    expires_at?: string;
    ttl?: number;
    error?: string;
  }>;
  meta: { request_id: string; timestamp: string };
}

interface RevokeResponse {
  data: {
    session_id: string;
    status: string;
  };
  meta: { request_id: string; timestamp: string };
}

export class PlaybackClient {
  constructor(private client: CCTVClient) {}

  /** Create a single playback session for a camera. */
  async createSession(
    input: CreatePlaybackSessionInput,
  ): Promise<SessionResponse["data"]> {
    const res = await this.client.request<SessionResponse>(
      "POST",
      "/playback/sessions",
      {
        camera_id: input.camera_id,
        ttl: input.ttl,
        embed_origin: input.embed_origin,
      },
    );
    return res.data;
  }

  /** Create playback sessions for multiple cameras at once. */
  async createMultiple(
    input: BatchCreatePlaybackSessionInput,
  ): Promise<BatchSessionResponse["data"]> {
    const res = await this.client.request<BatchSessionResponse>(
      "POST",
      "/playback/sessions/batch",
      {
        camera_ids: input.camera_ids,
        ttl: input.ttl,
        embed_origin: input.embed_origin,
      },
    );
    return res.data;
  }

  /** Refresh an existing playback session to extend its TTL. */
  async refreshSession(
    sessionId: string,
  ): Promise<RefreshResponse["data"]> {
    const res = await this.client.request<RefreshResponse>(
      "POST",
      `/playback/sessions/${sessionId}/refresh`,
    );
    return res.data;
  }

  /** Revoke an active playback session. */
  async revokeSession(sessionId: string): Promise<void> {
    await this.client.request<RevokeResponse>(
      "POST",
      `/playback/sessions/${sessionId}/revoke`,
    );
  }
}
