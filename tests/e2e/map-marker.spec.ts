import { test, expect } from "playwright/test";

async function login(page: import("playwright/test").Page) {
  await page.goto("/login");
  await page.waitForSelector('input[type="email"]', { timeout: 5000 });
  await page.fill('input[type="email"]', "demo@example.com");
  await page.fill('input[type="password"]', "demo123");
  await page.click('button:has-text("Sign in")');
  await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 10000 });
}

test.describe("Map markers", () => {
  test("dot at low zoom, label at high zoom", async ({ page }) => {
    await login(page);
    await page.goto("/map");
    await page.waitForTimeout(4000);

    // Screenshot default view (fitBounds auto-zoom)
    await page.screenshot({ path: "test-results/map-default.png", fullPage: false });

    // Log current marker class
    const defaultClass = await page.evaluate(() => {
      const el = document.querySelector(".leaflet-marker-icon");
      return el?.className ?? "none";
    });
    console.log("Default marker class:", defaultClass);

    // Zoom OUT by clicking zoom-out button multiple times
    const mapContainer = page.locator(".leaflet-container");
    const zoomOut = page.locator(".leaflet-control-zoom-out");
    for (let i = 0; i < 5; i++) {
      await zoomOut.click();
      await page.waitForTimeout(400);
    }
    await page.waitForTimeout(1000);
    await page.screenshot({ path: "test-results/map-zoomed-out.png", fullPage: false });

    const zoomOutClass = await page.evaluate(() => {
      const el = document.querySelector(".leaflet-marker-icon");
      return el?.className ?? "none";
    });
    console.log("Zoom out marker class:", zoomOutClass);

    // Zoom IN by clicking zoom-in button many times
    const zoomIn = page.locator(".leaflet-control-zoom-in");
    for (let i = 0; i < 8; i++) {
      await zoomIn.click();
      await page.waitForTimeout(400);
    }
    await page.waitForTimeout(1000);
    await page.screenshot({ path: "test-results/map-zoomed-in.png", fullPage: false });

    const zoomInClass = await page.evaluate(() => {
      const el = document.querySelector(".leaflet-marker-icon");
      return el?.className ?? "none";
    });
    console.log("Zoom in marker class:", zoomInClass);
  });
});
