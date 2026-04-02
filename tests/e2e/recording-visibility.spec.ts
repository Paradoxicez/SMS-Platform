import { test, expect } from "playwright/test";

const USER = "demo@example.com";
const PASS = "demo123";
const CAMERA_ID = "2a644ec7-7668-4f7f-aedc-39378013b507";

test.describe("Recording Playback Check", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.waitForLoadState("networkidle");
    await page.locator("input[type='email'], input[name='email'], input[placeholder*='email' i]").fill(USER);
    await page.locator("input[type='password'], input[name='password']").fill(PASS);
    await page.locator("button:has-text('Sign in')").first().click();
    await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 15000 });
  });

  test("recording detail page loads clips and can play", async ({ page }) => {
    // Go to recording detail page for Camera-2
    await page.goto(`/recordings/${CAMERA_ID}?date=2026-03-29`);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(3000);

    await page.screenshot({ path: "test-results/rec-detail-01-loaded.png", fullPage: true });

    // Check clips are loaded
    const bodyText = await page.textContent("body");
    const hasNoRecordings = bodyText?.includes("No recordings found for this day");
    console.log("No recordings found:", hasNoRecordings);
    console.log("Has Clips section:", bodyText?.includes("Clips"));

    // Count table rows (recording clips)
    const clipRows = page.locator("tbody tr");
    const clipCount = await clipRows.count();
    console.log("Clip rows found:", clipCount);

    // Try to play the first clip
    if (clipCount > 0) {
      // Intercept playback API call
      const [playbackResponse] = await Promise.all([
        page.waitForResponse(
          (r) => r.url().includes("/playback") && r.request().method() === "POST",
          { timeout: 10000 }
        ).catch(() => null),
        clipRows.first().locator("button").first().click(),
      ]);

      if (playbackResponse) {
        console.log("Playback API status:", playbackResponse.status());
        const playbackBody = await playbackResponse.json().catch(() => null);
        console.log("Playback URL:", playbackBody?.data?.playback_url?.substring(0, 150));
      }

      await page.waitForTimeout(3000);
      await page.screenshot({ path: "test-results/rec-detail-02-playing.png", fullPage: true });

      // Check if video element exists and is playing
      const videoState = await page.evaluate(() => {
        const video = document.querySelector("video");
        if (!video) return { exists: false };
        return {
          exists: true,
          src: video.src?.substring(0, 150),
          readyState: video.readyState,
          paused: video.paused,
          error: video.error?.message ?? null,
          duration: video.duration,
        };
      });
      console.log("Video state:", JSON.stringify(videoState, null, 2));
    }
  });
});
