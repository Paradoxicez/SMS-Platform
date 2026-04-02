import { test, expect } from "playwright/test";

const USER = "demo@example.com";
const PASS = "demo123";
const CAMERA_ID = "2a644ec7-7668-4f7f-aedc-39378013b507";

test("standalone playback test page works", async ({ page }) => {
  await page.goto("http://localhost:8899/test-playback.html");
  await page.waitForTimeout(3000);
  await page.screenshot({ path: "test-results/standalone-01-loaded.png", fullPage: true });

  const statusText = await page.locator("#status").textContent();
  console.log("Status:", statusText);

  const buttons = page.locator("#clips button");
  const btnCount = await buttons.count();
  console.log("Buttons:", btnCount);

  if (btnCount > 0) {
    await buttons.last().click();
    await page.waitForTimeout(5000);
    await page.screenshot({ path: "test-results/standalone-02-playing.png", fullPage: true });

    const vstateText = await page.locator("#vstate").textContent();
    console.log("Video state:", vstateText);
  }
});

test("recording detail page play button works", async ({ page }) => {
  await page.goto("/login");
  await page.waitForLoadState("networkidle");
  await page.locator("input[type='email'], input[name='email'], input[placeholder*='email' i]").fill(USER);
  await page.locator("input[type='password'], input[name='password']").fill(PASS);
  await page.locator("button:has-text('Sign in')").first().click();
  await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 15000 });

  await page.goto(`/recordings/${CAMERA_ID}?date=2026-03-29`);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(2000);

  const clipRows = page.locator("tbody tr");
  const count = await clipRows.count();
  console.log("Total clips:", count);

  for (let i = 0; i < Math.min(count, 20); i++) {
    const cells = clipRows.nth(i).locator("td");
    const endText = await cells.nth(1).textContent();
    const sizeText = await cells.nth(3).textContent();
    if (endText?.includes("progress") || sizeText?.includes("0 B")) continue;

    console.log(`Playing row ${i}: end=${endText?.trim()}, size=${sizeText?.trim()}`);
    await clipRows.nth(i).locator("td").last().locator("button").first().click();
    await page.waitForTimeout(5000);

    await page.screenshot({ path: "test-results/detail-play-result.png", fullPage: true });

    const videoState = await page.evaluate(() => {
      const video = document.querySelector("video");
      if (!video) return "no video element";
      if (video.error) return `error: code=${video.error.code} ${video.error.message}`;
      return `OK: ${video.videoWidth}x${video.videoHeight}, duration=${video.duration.toFixed(1)}s, paused=${video.paused}, readyState=${video.readyState}`;
    });
    console.log("Result:", videoState);
    break;
  }
});
