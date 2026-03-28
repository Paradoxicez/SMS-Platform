/**
 * Recording storage abstraction — supports local disk and S3-compatible storage.
 * Uses the built-in fetch API for S3 (no AWS SDK dependency needed for basic ops).
 */

import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

export interface S3Config {
  bucket: string;
  region: string;
  endpoint?: string; // For MinIO/compatible
  accessKey: string;
  secretKey: string;
}

export interface StorageProvider {
  upload(filePath: string, destinationKey: string): Promise<string>;
  download(key: string, destinationPath: string): Promise<void>;
  delete(key: string): Promise<void>;
  getSignedUrl(key: string, expiresInSec: number): Promise<string>;
  exists(key: string): Promise<boolean>;
}

// ─── Local Storage ────────────────────────────────────���─────────────────────

export class LocalStorageProvider implements StorageProvider {
  constructor(private basePath: string = "./recordings") {}

  async upload(filePath: string, destinationKey: string): Promise<string> {
    const dest = path.join(this.basePath, destinationKey);
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.copyFile(filePath, dest);
    return dest;
  }

  async download(key: string, destinationPath: string): Promise<void> {
    const src = path.join(this.basePath, key);
    await fs.mkdir(path.dirname(destinationPath), { recursive: true });
    await fs.copyFile(src, destinationPath);
  }

  async delete(key: string): Promise<void> {
    const filePath = path.join(this.basePath, key);
    try {
      await fs.unlink(filePath);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
    }
  }

  async getSignedUrl(key: string, _expiresInSec: number): Promise<string> {
    // For local, return direct file path via origin
    const originBase = process.env["ORIGIN_BASE_URL"] ?? "http://localhost:8888";
    return `${originBase}/vod/${key}`;
  }

  async exists(key: string): Promise<boolean> {
    try {
      await fs.access(path.join(this.basePath, key));
      return true;
    } catch {
      return false;
    }
  }
}

// ─── S3-Compatible Storage ──────────────────────────────────────────────────

export class S3StorageProvider implements StorageProvider {
  private config: S3Config;

  constructor(config: S3Config) {
    this.config = config;
  }

  private get endpoint(): string {
    return (
      this.config.endpoint ??
      `https://s3.${this.config.region}.amazonaws.com`
    );
  }

  private signV4(
    method: string,
    path: string,
    headers: Record<string, string>,
    payloadHash: string,
  ): Record<string, string> {
    const now = new Date();
    const dateStamp = now.toISOString().replace(/[-:]/g, "").split("T")[0]!;
    const amzDate = now.toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
    const scope = `${dateStamp}/${this.config.region}/s3/aws4_request`;

    headers["x-amz-date"] = amzDate;
    headers["x-amz-content-sha256"] = payloadHash;

    const signedHeaders = Object.keys(headers)
      .sort()
      .map((k) => k.toLowerCase())
      .join(";");

    const canonicalHeaders = Object.keys(headers)
      .sort()
      .map((k) => `${k.toLowerCase()}:${headers[k]!.trim()}`)
      .join("\n");

    const canonicalRequest = [
      method,
      path,
      "",
      canonicalHeaders + "\n",
      signedHeaders,
      payloadHash,
    ].join("\n");

    const stringToSign = [
      "AWS4-HMAC-SHA256",
      amzDate,
      scope,
      crypto.createHash("sha256").update(canonicalRequest).digest("hex"),
    ].join("\n");

    const signingKey = this.getSigningKey(dateStamp);
    const signature = crypto
      .createHmac("sha256", signingKey)
      .update(stringToSign)
      .digest("hex");

    headers[
      "Authorization"
    ] = `AWS4-HMAC-SHA256 Credential=${this.config.accessKey}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

    return headers;
  }

  private getSigningKey(dateStamp: string): Buffer {
    const kDate = crypto
      .createHmac("sha256", `AWS4${this.config.secretKey}`)
      .update(dateStamp)
      .digest();
    const kRegion = crypto
      .createHmac("sha256", kDate)
      .update(this.config.region)
      .digest();
    const kService = crypto
      .createHmac("sha256", kRegion)
      .update("s3")
      .digest();
    return crypto
      .createHmac("sha256", kService)
      .update("aws4_request")
      .digest();
  }

  async upload(filePath: string, destinationKey: string): Promise<string> {
    const fileContent = await fs.readFile(filePath);
    const payloadHash = crypto
      .createHash("sha256")
      .update(fileContent)
      .digest("hex");

    const s3Path = `/${this.config.bucket}/${destinationKey}`;
    const host = new URL(this.endpoint).host;

    const headers = this.signV4("PUT", s3Path, { host }, payloadHash);

    const res = await fetch(`${this.endpoint}${s3Path}`, {
      method: "PUT",
      headers,
      body: fileContent,
    });

    if (!res.ok) {
      throw new Error(`S3 upload failed: ${res.status} ${await res.text()}`);
    }

    return `s3://${this.config.bucket}/${destinationKey}`;
  }

  async download(key: string, destinationPath: string): Promise<void> {
    const s3Path = `/${this.config.bucket}/${key}`;
    const host = new URL(this.endpoint).host;
    const payloadHash = "UNSIGNED-PAYLOAD";

    const headers = this.signV4("GET", s3Path, { host }, payloadHash);

    const res = await fetch(`${this.endpoint}${s3Path}`, {
      method: "GET",
      headers,
    });

    if (!res.ok) {
      throw new Error(`S3 download failed: ${res.status}`);
    }

    await fs.mkdir(path.dirname(destinationPath), { recursive: true });
    const buffer = Buffer.from(await res.arrayBuffer());
    await fs.writeFile(destinationPath, buffer);
  }

  async delete(key: string): Promise<void> {
    const s3Path = `/${this.config.bucket}/${key}`;
    const host = new URL(this.endpoint).host;
    const payloadHash = crypto.createHash("sha256").update("").digest("hex");

    const headers = this.signV4("DELETE", s3Path, { host }, payloadHash);

    const res = await fetch(`${this.endpoint}${s3Path}`, {
      method: "DELETE",
      headers,
    });

    if (!res.ok && res.status !== 404) {
      throw new Error(`S3 delete failed: ${res.status}`);
    }
  }

  async getSignedUrl(key: string, expiresInSec: number): Promise<string> {
    // Generate a pre-signed GET URL
    const now = new Date();
    const dateStamp = now.toISOString().replace(/[-:]/g, "").split("T")[0]!;
    const amzDate = now.toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
    const scope = `${dateStamp}/${this.config.region}/s3/aws4_request`;

    const queryParams = new URLSearchParams({
      "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
      "X-Amz-Credential": `${this.config.accessKey}/${scope}`,
      "X-Amz-Date": amzDate,
      "X-Amz-Expires": String(expiresInSec),
      "X-Amz-SignedHeaders": "host",
    });

    const host = new URL(this.endpoint).host;
    const s3Path = `/${this.config.bucket}/${key}`;

    const canonicalRequest = [
      "GET",
      s3Path,
      queryParams.toString(),
      `host:${host}\n`,
      "host",
      "UNSIGNED-PAYLOAD",
    ].join("\n");

    const stringToSign = [
      "AWS4-HMAC-SHA256",
      amzDate,
      scope,
      crypto.createHash("sha256").update(canonicalRequest).digest("hex"),
    ].join("\n");

    const signingKey = this.getSigningKey(dateStamp);
    const signature = crypto
      .createHmac("sha256", signingKey)
      .update(stringToSign)
      .digest("hex");

    queryParams.set("X-Amz-Signature", signature);
    return `${this.endpoint}${s3Path}?${queryParams.toString()}`;
  }

  async exists(key: string): Promise<boolean> {
    const s3Path = `/${this.config.bucket}/${key}`;
    const host = new URL(this.endpoint).host;
    const payloadHash = crypto.createHash("sha256").update("").digest("hex");

    const headers = this.signV4("HEAD", s3Path, { host }, payloadHash);

    const res = await fetch(`${this.endpoint}${s3Path}`, {
      method: "HEAD",
      headers,
    });

    return res.ok;
  }
}

// ─── Factory ────────────────────────────────────────────────────────────────

let cachedProvider: StorageProvider | null = null;

/**
 * Get the recording storage provider based on config.
 * Returns cached instance for the same config type.
 */
export function getStorageProvider(
  storageType: string = "local",
  s3Config?: S3Config | null,
): StorageProvider {
  if (storageType === "s3" && s3Config) {
    // Always create new for S3 (config may differ per scope)
    return new S3StorageProvider(s3Config);
  }

  // Cache local provider
  if (!cachedProvider) {
    const basePath =
      process.env["RECORDING_STORAGE_PATH"] ?? "./recordings";
    cachedProvider = new LocalStorageProvider(basePath);
  }
  return cachedProvider;
}
