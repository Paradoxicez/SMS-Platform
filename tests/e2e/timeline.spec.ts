import { test } from "playwright/test";
const USER = "demo@example.com";
const PASS = "demo123";
const CAM_ID = "2a644ec7-7668-4f7f-aedc-39378013b507";
test("timeline closeup", async ({ page }) => {
  page.setViewportSize({ width: 1400, height: 900 });
  await page.goto("/login");
  await page.waitForLoadState("networkidle");
  await page.locator("input[type='email']").fill(USER);
  await page.locator("input[type='password']").fill(PASS);
  await page.locator("button:has-text('Sign in')").first().click();
  await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 15000 });
  // Use date with recordings
  await page.goto(`/recordings/${CAM_ID}?date=2026-03-29`);
  await page.waitForTimeout(15000); // wait for auto-play

  // Find timeline card and screenshot
  const timelineCard = page.locator("text=Timeline").first().locator("xpath=ancestor::div[contains(@data-slot,'card')]").first();
  if (await timelineCard.isVisible()) {
    await timelineCard.screenshot({ path: "test-results/timeline-closeup.png" });
  }
  
  // Hover timeline bar
  const bar = page.locator(".rounded-lg.cursor-pointer").first();
  if (await bar.isVisible()) {
    const box = await bar.boundingBox();
    if (box) {
      await page.mouse.move(box.x + box.width * 0.4, box.y + box.height * 0.5);
      await page.waitForTimeout(500);
      await page.screenshot({ path: "test-results/timeline-hover.png", clip: { x: box.x - 20, y: box.y - 40, width: box.width + 40, height: box.height + 60 } });
    }
  }

  await page.screenshot({ path: "test-results/timeline-full.png", fullPage: true });
});
