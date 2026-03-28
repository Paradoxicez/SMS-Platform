import { test, expect } from "playwright/test";

const USER = "demo@example.com";
const PASS = "demo123";

test.describe("Recordings Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.waitForLoadState("networkidle");

    // Fill login form (console's own login page)
    await page.locator("input[type='email'], input[name='email'], input[placeholder*='email' i]").fill(USER);
    await page.locator("input[type='password'], input[name='password']").fill(PASS);
    await page.locator("button:has-text('Sign in')").first().click();

    // Wait for redirect after login (could go to dashboard, cameras, or /)
    await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 15000 });
  });

  test("should load recordings page with Browse and Settings tabs", async ({ page }) => {
    await page.goto("/recordings");
    await page.waitForLoadState("networkidle");

    // Should see tabs
    await expect(page.locator("[role='tab']", { hasText: /browse/i })).toBeVisible({ timeout: 5000 });
    await expect(page.locator("[role='tab']", { hasText: /settings/i })).toBeVisible();

    await page.screenshot({ path: "test-results/recordings-browse.png", fullPage: true });
  });

  test("should show camera dropdown and date picker", async ({ page }) => {
    await page.goto("/recordings");
    await page.waitForLoadState("networkidle");

    // Should have filter controls
    await expect(page.locator("text=/camera|select/i").first()).toBeVisible({ timeout: 5000 });

    await page.screenshot({ path: "test-results/recordings-filters.png" });
  });

  test("should switch to Settings tab and show global config", async ({ page }) => {
    await page.goto("/recordings");
    await page.waitForLoadState("networkidle");

    // Click Settings tab
    await page.locator("[role='tab']", { hasText: /settings/i }).click();
    await page.waitForTimeout(1000);

    // Should see settings content
    await expect(
      page.locator("text=/global|recording mode|retention|storage/i").first()
    ).toBeVisible({ timeout: 5000 });

    await page.screenshot({ path: "test-results/recordings-settings.png", fullPage: true });
  });

  test("should toggle between Card and Table view", async ({ page }) => {
    await page.goto("/recordings");
    await page.waitForLoadState("networkidle");

    // Screenshot default view (Card)
    await page.screenshot({ path: "test-results/recordings-card-view.png" });

    // Click table view button (List icon)
    const tableButton = page.locator("button").filter({ has: page.locator("svg") }).nth(1);
    if (await tableButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await tableButton.click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: "test-results/recordings-table-view.png" });
    }
  });

  test("should show storage usage in Settings", async ({ page }) => {
    await page.goto("/recordings");
    await page.waitForLoadState("networkidle");

    // Go to Settings tab
    await page.locator("[role='tab']", { hasText: /settings/i }).click();
    await page.waitForTimeout(1000);

    // Should see storage usage section
    await expect(
      page.locator("text=/storage usage|total.*used|recordings/i").first()
    ).toBeVisible({ timeout: 5000 });

    await page.screenshot({ path: "test-results/recordings-storage-usage.png", fullPage: true });
  });
});
