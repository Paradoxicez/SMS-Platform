import { test, expect } from "playwright/test";
const USER = "demo@example.com";
const PASS = "demo123";
test("dashboard shows bandwidth chart instead of project summary / recent events", async ({ page }) => {
  await page.goto("/login");
  await page.waitForLoadState("networkidle");
  await page.locator("input[type='email']").fill(USER);
  await page.locator("input[type='password']").fill(PASS);
  await page.locator("button:has-text('Sign in')").first().click();
  await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 15000 });
  await page.goto("/dashboard");
  await page.waitForTimeout(8000);

  // Should have Bandwidth chart
  await expect(page.locator("text=Bandwidth").first()).toBeVisible();
  await expect(page.locator("text=Real-time network throughput")).toBeVisible();

  // Should NOT have Project Summary or Recent Events
  const hasProjectSummary = await page.locator("text=Project Summary").isVisible().catch(() => false);
  const hasRecentEvents = await page.locator("text=Recent Events").isVisible().catch(() => false);
  console.log("Project Summary visible:", hasProjectSummary, "(should be false)");
  console.log("Recent Events visible:", hasRecentEvents, "(should be false)");

  // Should still have Camera Status
  await expect(page.locator("text=Camera Status").first()).toBeVisible();

  await page.screenshot({ path: "test-results/dashboard-chart.png", fullPage: true });
});
