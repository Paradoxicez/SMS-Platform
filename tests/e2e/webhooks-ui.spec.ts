import { test, expect } from "playwright/test";

const USER = "demo@example.com";
const PASS = "demo123";

test.describe("Webhooks Page UI", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.waitForLoadState("networkidle");
    await page.locator("input[type='email'], input[name='email'], input[placeholder*='email' i]").fill(USER);
    await page.locator("input[type='password'], input[name='password']").fill(PASS);
    await page.locator("button:has-text('Sign in')").first().click();
    await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 15000 });
  });

  test("webhooks page loads with consistent UI pattern", async ({ page }) => {
    await page.goto("/settings/webhooks");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);

    await page.screenshot({ path: "test-results/webhooks-01-page.png", fullPage: true });

    // Should have header with Add button
    await expect(page.locator("h1", { hasText: "Webhooks" })).toBeVisible();
    await expect(page.locator("button", { hasText: "Add Webhook" }).first()).toBeVisible();

    // Check for empty state or table
    const bodyText = await page.textContent("body");
    const hasTable = bodyText?.includes("URL") && bodyText?.includes("Events");
    const hasEmpty = bodyText?.includes("Create your first webhook");
    console.log("Has table:", hasTable, "Has empty state:", hasEmpty);

    // Test add dialog
    await page.locator("button", { hasText: "Add Webhook" }).first().click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: "test-results/webhooks-02-dialog.png" });

    // Dialog should have URL input and event checkboxes
    await expect(page.locator("input[placeholder*='example.com']")).toBeVisible();
    await expect(page.locator("text=camera.online")).toBeVisible();

    // Fill form and submit
    await page.locator("input[placeholder*='example.com']").fill("https://httpbin.org/post");
    await page.locator("text=camera.online").click();
    await page.locator("text=camera.offline").click();
    await page.locator("button", { hasText: "Add Webhook" }).last().click();
    await page.waitForTimeout(2000);

    await page.screenshot({ path: "test-results/webhooks-03-after-add.png", fullPage: true });

    // Should see table with the new webhook
    await expect(page.locator("text=httpbin.org")).toBeVisible({ timeout: 5000 });

    // Should have dropdown menu (three dots)
    const moreButton = page.locator("button").filter({ has: page.locator("svg") }).last();
    await moreButton.click();
    await page.waitForTimeout(300);
    await page.screenshot({ path: "test-results/webhooks-04-dropdown.png" });

    // Dropdown should have Edit, Send Test, Delivery Logs, Delete
    console.log("Has Edit:", await page.locator("text=Edit").isVisible());
    console.log("Has Send Test:", await page.locator("text=Send Test").isVisible());
    console.log("Has Delete:", await page.locator("text=Delete").isVisible());

    // Should have switch toggle for active/inactive
    const switchEl = page.locator("[role='switch']");
    const switchCount = await switchEl.count();
    console.log("Switch toggles:", switchCount);
  });
});
