import { test } from "playwright/test";

test("screenshot recording detail page", async ({ page }) => {
  await page.goto("/login");
  await page.locator("input[type='email'], input[placeholder*='email' i]").fill("demo@example.com");
  await page.locator("input[type='password']").fill("demo123");
  await page.locator("button:has-text('Sign in')").first().click();
  await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 15000 });

  await page.goto("/recordings/3a88aa5c-972e-4741-81d3-2394fc1240c4?date=2026-03-28");
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(3000);
  await page.screenshot({ path: "test-results/recording-detail-check.png", fullPage: true });
});
