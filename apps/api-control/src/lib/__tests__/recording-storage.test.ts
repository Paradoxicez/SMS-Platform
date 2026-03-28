import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import { LocalStorageProvider } from "../recording-storage";

const TEST_DIR = path.join(process.cwd(), ".test-recordings");

describe("LocalStorageProvider", () => {
  let storage: LocalStorageProvider;

  beforeAll(async () => {
    await fs.mkdir(TEST_DIR, { recursive: true });
    storage = new LocalStorageProvider(TEST_DIR);
  });

  afterAll(async () => {
    await fs.rm(TEST_DIR, { recursive: true, force: true });
  });

  it("should upload a file (copy to destination)", async () => {
    // Create a temp source file
    const srcPath = path.join(TEST_DIR, "source.fmp4");
    await fs.writeFile(srcPath, "test recording data");

    const result = await storage.upload(srcPath, "cam-001/2026-03-28.fmp4");
    expect(result).toContain("cam-001/2026-03-28.fmp4");

    // Verify file exists at destination
    const exists = await storage.exists("cam-001/2026-03-28.fmp4");
    expect(exists).toBe(true);
  });

  it("should download a file (copy to destination)", async () => {
    const destPath = path.join(TEST_DIR, "downloaded.fmp4");
    await storage.download("cam-001/2026-03-28.fmp4", destPath);

    const content = await fs.readFile(destPath, "utf-8");
    expect(content).toBe("test recording data");
  });

  it("should check existence correctly", async () => {
    expect(await storage.exists("cam-001/2026-03-28.fmp4")).toBe(true);
    expect(await storage.exists("nonexistent.fmp4")).toBe(false);
  });

  it("should generate a signed URL (local = origin URL)", async () => {
    const url = await storage.getSignedUrl("cam-001/2026-03-28.fmp4", 3600);
    expect(url).toContain("/vod/cam-001/2026-03-28.fmp4");
  });

  it("should delete a file", async () => {
    await storage.delete("cam-001/2026-03-28.fmp4");
    expect(await storage.exists("cam-001/2026-03-28.fmp4")).toBe(false);
  });

  it("should not throw when deleting nonexistent file", async () => {
    await expect(storage.delete("nonexistent.fmp4")).resolves.not.toThrow();
  });
});
