import { test } from "playwright/test";
const USER = "demo@example.com";
const PASS = "demo123";
test("check all clickable links on dashboard", async ({ page }) => {
  await page.goto("/login");
  await page.waitForLoadState("networkidle");
  await page.locator("input[type='email']").fill(USER);
  await page.locator("input[type='password']").fill(PASS);
  await page.locator("button:has-text('Sign in')").first().click();
  await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 15000 });
  await page.goto("/dashboard");
  await page.waitForTimeout(8000);

  // Find all links and buttons on the page
  const links = await page.locator("a[href]").all();
  console.log("=== Links found ===");
  for (const link of links) {
    const href = await link.getAttribute("href");
    const text = (await link.textContent())?.trim().substring(0, 50);
    const visible = await link.isVisible();
    if (visible) console.log(`  [link] ${href} — "${text}"`);
  }

  const buttons = await page.locator("button").all();
  console.log("\n=== Buttons found ===");
  for (const btn of buttons) {
    const text = (await btn.textContent())?.trim().substring(0, 50);
    const visible = await btn.isVisible();
    if (visible && text) console.log(`  [button] "${text}"`);
  }

  // Check stat cards — are they clickable?
  console.log("\n=== Stat Cards ===");
  const statCards = page.locator("[data-stat-card], .cursor-pointer");
  const statCount = await statCards.count();
  console.log(`Clickable stat cards: ${statCount}`);

  // Check what "active" means — look for active sessions value
  const bodyText = await page.textContent("body");
  const activeMatch = bodyText?.match(/Active Sessions[^0-9]*(\d+)/);
  console.log(`\nActive Sessions value: ${activeMatch?.[1] ?? "not found"}`);

  await page.screenshot({ path: "test-results/dash-links.png", fullPage: true });
});
