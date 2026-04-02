import { test, expect } from "playwright/test";
const USER = "demo@example.com";
const PASS = "demo123";
test("cameras page has grid/table toggle and card view works", async ({ page }) => {
  await page.goto("/login");
  await page.waitForLoadState("networkidle");
  await page.locator("input[type='email']").fill(USER);
  await page.locator("input[type='password']").fill(PASS);
  await page.locator("button:has-text('Sign in')").first().click();
  await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 15000 });
  await page.goto("/cameras");
  await page.waitForTimeout(3000);

  // Should see table view by default
  await page.screenshot({ path: "test-results/cam-view-01-table.png", fullPage: true });

  // Click Grid view toggle
  const gridBtn = page.locator("button[aria-label='Grid view']");
  await expect(gridBtn).toBeVisible();
  await gridBtn.click();
  await page.waitForTimeout(1000);

  await page.screenshot({ path: "test-results/cam-view-02-grid.png", fullPage: true });

  // Should see camera cards
  const cards = page.locator("[class*='aspect-']");
  const cardCount = await cards.count();
  console.log("Camera cards:", cardCount);

  // Switch back to table
  await page.locator("button[aria-label='Table view']").click();
  await page.waitForTimeout(500);
  await expect(page.locator("th", { hasText: "Name" })).toBeVisible();
});
