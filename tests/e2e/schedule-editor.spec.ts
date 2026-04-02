import { test, expect } from "playwright/test";

const USER = "demo@example.com";
const PASS = "demo123";

test("schedule editor appears when Scheduled mode selected", async ({ page }) => {
  await page.goto("/login");
  await page.waitForLoadState("networkidle");
  await page.locator("input[type='email'], input[name='email'], input[placeholder*='email' i]").fill(USER);
  await page.locator("input[type='password'], input[name='password']").fill(PASS);
  await page.locator("button:has-text('Sign in')").first().click();
  await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 15000 });

  await page.goto("/settings/stream-engine");
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(2000);

  // Find the Recording Mode dropdown and switch to Scheduled
  const recordingTab = page.locator("[role='tab']", { hasText: /recording/i });
  if (await recordingTab.isVisible({ timeout: 3000 }).catch(() => false)) {
    await recordingTab.click();
    await page.waitForTimeout(500);
  }

  // Click the recording mode select
  const modeSelect = page.locator("#se-recording-mode").first();
  if (await modeSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
    await modeSelect.click();
    await page.waitForTimeout(300);
    await page.locator("[role='option']", { hasText: "Scheduled" }).click();
    await page.waitForTimeout(500);
  }

  await page.screenshot({ path: "test-results/schedule-01-mode-selected.png", fullPage: true });

  // Schedule Windows section should appear
  await expect(page.locator("text=Schedule Windows").first()).toBeVisible({ timeout: 5000 });
  await expect(page.locator("button", { hasText: "Add Window" })).toBeVisible();

  // Click Add Window
  await page.locator("button", { hasText: "Add Window" }).click();
  await page.waitForTimeout(500);

  await page.screenshot({ path: "test-results/schedule-02-window-added.png", fullPage: true });

  // Should see day buttons (Mon-Sun) and time inputs
  await expect(page.locator("button", { hasText: "Mon" })).toBeVisible();
  await expect(page.locator("button", { hasText: "Sun" })).toBeVisible();
  await expect(page.locator("input[type='time']").first()).toBeVisible();

  // Toggle a day off
  await page.locator("button", { hasText: "Mon" }).click();
  await page.waitForTimeout(200);

  // Delete the window
  const deleteBtn = page.locator("button").filter({ hasText: "×" });
  if (await deleteBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
    await deleteBtn.click();
    await page.waitForTimeout(300);
  }

  await page.screenshot({ path: "test-results/schedule-03-final.png", fullPage: true });
  console.log("Schedule editor test passed");
});
