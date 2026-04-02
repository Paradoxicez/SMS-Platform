import { test, expect } from "playwright/test";
const USER = "demo@example.com";
const PASS = "demo123";
test("recordings page aligned with cameras UI", async ({ page }) => {
  await page.goto("/login");
  await page.waitForLoadState("networkidle");
  await page.locator("input[type='email']").fill(USER);
  await page.locator("input[type='password']").fill(PASS);
  await page.locator("button:has-text('Sign in')").first().click();
  await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 15000 });
  await page.goto("/recordings");
  await page.waitForTimeout(3000);

  // Grid view screenshot
  await page.screenshot({ path: "test-results/rec-ui-01-grid.png", fullPage: true });

  // Check filters exist
  await expect(page.locator("text=All Cameras").first()).toBeVisible();
  await expect(page.locator("text=All Status").first()).toBeVisible();
  await expect(page.locator("text=All Projects").first()).toBeVisible();
  await expect(page.locator("text=All Sites").first()).toBeVisible();
  await expect(page.locator("text=All Tags").first()).toBeVisible();
  await expect(page.locator("input[placeholder*='Search']")).toBeVisible();
  await expect(page.locator("button[aria-label='Grid view']")).toBeVisible();
  await expect(page.locator("button[aria-label='Table view']")).toBeVisible();

  // Switch to table
  await page.locator("button[aria-label='Table view']").click();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: "test-results/rec-ui-02-table.png", fullPage: true });

  // Table should have sortable headers
  await expect(page.locator("th", { hasText: "Camera" })).toBeVisible();
  await expect(page.locator("th", { hasText: "Start Time" })).toBeVisible();
  await expect(page.locator("th", { hasText: "Size" })).toBeVisible();

  console.log("All UI elements present");
});
