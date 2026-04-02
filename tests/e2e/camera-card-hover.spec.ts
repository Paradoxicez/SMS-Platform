import { test } from "playwright/test";
const USER = "demo@example.com";
const PASS = "demo123";
test("camera card hover shows action buttons", async ({ page }) => {
  await page.goto("/login");
  await page.waitForLoadState("networkidle");
  await page.locator("input[type='email']").fill(USER);
  await page.locator("input[type='password']").fill(PASS);
  await page.locator("button:has-text('Sign in')").first().click();
  await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 15000 });
  await page.goto("/cameras");
  await page.waitForTimeout(3000);

  // Switch to grid
  await page.locator("button[aria-label='Grid view']").click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: "test-results/cam-card-01-grid.png", fullPage: true });

  // Hover first card
  const card = page.locator("[class*='aspect-']").first();
  await card.hover();
  await page.waitForTimeout(500);
  await page.screenshot({ path: "test-results/cam-card-02-hover.png", fullPage: true });
});
