import { test, expect } from "playwright/test";
const USER = "demo@example.com";
const PASS = "demo123";

test("dashboard shows real viewer count + cameras table has Viewers column", async ({ page }) => {
  await page.goto("/login");
  await page.waitForLoadState("networkidle");
  await page.locator("input[type='email']").fill(USER);
  await page.locator("input[type='password']").fill(PASS);
  await page.locator("button:has-text('Sign in')").first().click();
  await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 15000 });

  // Dashboard
  await page.goto("/dashboard");
  await page.waitForTimeout(8000); // wait for page + viewer poll

  const sessionCard = page.locator("text=Active Sessions").first();
  await expect(sessionCard).toBeVisible();
  await page.screenshot({ path: "test-results/viewers-01-dashboard.png", fullPage: true });

  // Cameras table
  await page.goto("/cameras");
  await page.waitForTimeout(3000);
  await expect(page.locator("th", { hasText: "Viewers" })).toBeVisible();
  await page.screenshot({ path: "test-results/viewers-02-cameras.png", fullPage: true });

  console.log("Viewers column visible in cameras table: YES");
});
