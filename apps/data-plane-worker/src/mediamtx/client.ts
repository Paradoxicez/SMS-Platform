/**
 * T061: MediaMTX API client
 *
 * Communicates with MediaMTX v3 API for managing RTSP paths.
 */

import { authHeader } from "../lib/mediamtx-fetch";

export interface MediaMTXPathConfig {
  source?: string;
  sourceProtocol?: string;
  sourceOnDemand?: boolean;
  sourceOnDemandStartTimeout?: string;
  sourceOnDemandCloseAfter?: string;
  record?: boolean;
  runOnReady?: string;
  runOnReadyRestart?: boolean;
  [key: string]: unknown;
}

export interface MediaMTXPath {
  name: string;
  confName: string;
  source: {
    type: string;
    id: string;
  } | null;
  ready: boolean;
  readyTime: string | null;
  tracks: string[];
  bytesReceived: number;
  bytesSent: number;
  readers: unknown[];
}

export interface MediaMTXPathList {
  pageCount: number;
  items: MediaMTXPath[];
}

export interface MediaMTXGlobalConfig {
  logLevel: string;
  logDestinations: string[];
  readTimeout: string;
  writeTimeout: string;
  readBufferCount: number;
  api: boolean;
  apiAddress: string;
  [key: string]: unknown;
}

export class MediaMTXClient {
  private readonly baseUrl: string;
  private readonly authHeader: string;

  constructor(baseUrl: string = "http://localhost:9997") {
    this.baseUrl = baseUrl;
    this.authHeader = authHeader;
  }

  /**
   * Add a new path to MediaMTX configuration.
   * Supports both RTSP and SRT source URLs.
   * MediaMTX handles srt:// sources natively the same as rtsp:// sources.
   */
  async addPath(name: string, config: MediaMTXPathConfig): Promise<void> {
    // For SRT sources, ensure proper config
    // MediaMTX path config accepts srt:// URLs in the `source` field directly
    const pathConfig = { ...config };
    if (pathConfig.source?.startsWith("srt://")) {
      // SRT sources don't use sourceProtocol (it's RTSP-specific)
      delete pathConfig.sourceProtocol;
    }

    const res = await fetch(`${this.baseUrl}/v3/config/paths/add/${encodeURIComponent(name)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: this.authHeader },
      body: JSON.stringify(pathConfig),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`MediaMTX addPath failed (${res.status}): ${body}`);
    }
  }

  /**
   * Update an existing path configuration.
   */
  async updatePath(name: string, config: Partial<MediaMTXPathConfig>): Promise<void> {
    const res = await fetch(
      `${this.baseUrl}/v3/config/paths/patch/${encodeURIComponent(name)}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: this.authHeader },
        body: JSON.stringify(config),
      },
    );

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`MediaMTX updatePath failed (${res.status}): ${body}`);
    }
  }

  /**
   * Remove a path from MediaMTX configuration.
   */
  async removePath(name: string): Promise<void> {
    const res = await fetch(
      `${this.baseUrl}/v3/config/paths/delete/${encodeURIComponent(name)}`,
      {
        method: "POST",
        headers: { Authorization: this.authHeader },
      },
    );

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`MediaMTX removePath failed (${res.status}): ${body}`);
    }
  }

  /**
   * List all active paths.
   */
  async listPaths(): Promise<MediaMTXPathList> {
    const res = await fetch(`${this.baseUrl}/v3/paths/list`, {
      headers: { Authorization: this.authHeader },
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`MediaMTX listPaths failed (${res.status}): ${body}`);
    }

    return res.json() as Promise<MediaMTXPathList>;
  }

  /**
   * Get global MediaMTX configuration.
   */
  async getGlobalConfig(): Promise<MediaMTXGlobalConfig> {
    const res = await fetch(`${this.baseUrl}/v3/config/global/get`, {
      headers: { Authorization: this.authHeader },
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`MediaMTX getGlobalConfig failed (${res.status}): ${body}`);
    }

    return res.json() as Promise<MediaMTXGlobalConfig>;
  }
}
