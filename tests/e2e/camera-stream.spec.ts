import { test } from "playwright/test";

test("Camera-2 detail — stream check", async ({ page }) => {
  await page.goto("/login");
  await page.locator("input[type='email'], input[placeholder*='email' i]").fill("demo@example.com");
  await page.locator("input[type='password']").fill("demo123");
  await page.locator("button:has-text('Sign in')").first().click();
  await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 15000 });

  await page.goto("/cameras");
  await page.waitForTimeout(3000);

  // Open ⋯ menu on Camera-2 row
  const row = page.locator("tr", { hasText: "Camera-2" }).first();
  const menuButton = row.locator("button").last();
  await menuButton.click();
  await page.waitForTimeout(500);

  // Click View Details
  const viewDetails = page.locator("[role='menuitem']", { hasText: "View Details" });
  if (await viewDetails.isVisible({ timeout: 2000 }).catch(() => false)) {
    await viewDetails.click();
    await page.waitForTimeout(10000);
  }

  await page.screenshot({ path: "test-results/camera2-detail-stream.png", fullPage: true });
});
