import { test } from "playwright/test";
const USER = "demo@example.com";
const PASS = "demo123";

test("map player dialog behavior on marker click", async ({ page }) => {
  const failedRequests: string[] = [];
  page.on("response", (res) => {
    if (res.status() >= 400 && !res.url().includes(".js")) {
      failedRequests.push(`[${res.status()}] ${res.url().substring(0, 120)}`);
    }
  });

  await page.goto("/login");
  await page.waitForLoadState("networkidle");
  await page.locator("input[type='email']").fill(USER);
  await page.locator("input[type='password']").fill(PASS);
  await page.locator("button:has-text('Sign in')").first().click();
  await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 15000 });

  await page.goto("/map");
  await page.waitForTimeout(5000);

  // Click marker via JS (Leaflet markers are tricky to click normally)
  await page.evaluate(() => {
    const markers = document.querySelectorAll(".leaflet-marker-icon[style*='transform']");
    if (markers.length > 0) (markers[0] as HTMLElement).click();
  });

  await page.waitForTimeout(2000);
  await page.screenshot({ path: "test-results/map-02-after-click.png", fullPage: true });

  // Watch for 8 seconds
  console.log("=== Dialog behavior ===");
  for (let i = 0; i < 8; i++) {
    await page.waitForTimeout(1000);
    const closeBtn = await page.locator("button:has-text('Close'), text=Close").first().isVisible().catch(() => false);
    const error = await page.locator("text=not streaming").or(page.locator("text=Failed")).first().isVisible().catch(() => false);
    const retry = await page.locator("button:has-text('Retry')").isVisible().catch(() => false);
    const loading = await page.locator(".animate-spin").isVisible().catch(() => false);
    console.log(`T+${i+1}s: dialog=${closeBtn} error=${error} retry=${retry} loading=${loading}`);
    if (i === 3) await page.screenshot({ path: "test-results/map-03-t4s.png", fullPage: true });
  }

  await page.screenshot({ path: "test-results/map-04-final.png", fullPage: true });

  console.log("\nFailed requests:");
  failedRequests.forEach((r) => console.log("  " + r));
});
