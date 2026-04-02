import { test } from "playwright/test";
const USER = "demo@example.com";
const PASS = "demo123";
test("dashboard chart closeup", async ({ page }) => {
  page.setViewportSize({ width: 1400, height: 900 });
  await page.goto("/login");
  await page.waitForLoadState("networkidle");
  await page.locator("input[type='email']").fill(USER);
  await page.locator("input[type='password']").fill(PASS);
  await page.locator("button:has-text('Sign in')").first().click();
  await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 15000 });
  await page.goto("/dashboard");
  await page.waitForTimeout(10000);

  // Find the bandwidth card and hover to show tooltip
  const charts = page.locator(".recharts-surface");
  const chartCount = await charts.count();
  
  if (chartCount > 0) {
    const firstChart = charts.first();
    const box = await firstChart.boundingBox();
    if (box) {
      // Hover middle of chart
      await page.mouse.move(box.x + box.width * 0.4, box.y + box.height * 0.4);
      await page.waitForTimeout(1000);
      
      // Screenshot the card area (parent of chart)
      const card = page.locator("text=Bandwidth").first().locator("xpath=ancestor::div[contains(@class,'card')]").first();
      if (await card.isVisible()) {
        await card.screenshot({ path: "test-results/dash-chart-closeup.png" });
      } else {
        // fallback: clip from page
        await page.screenshot({ 
          path: "test-results/dash-chart-closeup.png",
          clip: { x: box.x - 20, y: box.y - 80, width: box.width + 40, height: box.height + 200 }
        });
      }
    }
  }
  
  await page.screenshot({ path: "test-results/dash-full.png", fullPage: true });
});
