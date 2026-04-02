import { test, expect } from "playwright/test";

const USER = "demo@example.com";
const PASS = "demo123";

test("policy selector: remove badge then re-select", async ({ page }) => {
  page.on("console", (msg) => {
    if (msg.type() === "error" && !msg.text().includes("401") && !msg.text().includes("AuthError"))
      console.log(`[error] ${msg.text()}`);
  });

  await page.goto("/login");
  await page.waitForLoadState("networkidle");
  await page.locator("input[type='email'], input[name='email'], input[placeholder*='email' i]").fill(USER);
  await page.locator("input[type='password'], input[name='password']").fill(PASS);
  await page.locator("button:has-text('Sign in')").first().click();
  await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 15000 });

  await page.goto("/policies");
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(2000);

  // Open edit dialog
  await page.locator("button.text-blue-600").first().click();
  await page.waitForTimeout(2000);
  await expect(page.locator("h2", { hasText: "Edit Policy" })).toBeVisible();

  // Go to Cameras tab
  await page.getByRole("tab", { name: /cameras/i }).click();
  await page.waitForTimeout(1500);

  await page.screenshot({ path: "test-results/sel-01-cameras-before.png" });

  // Check current state
  const tabPanel = page.locator("[role='tabpanel']:visible");
  const badgesBefore = tabPanel.locator("[class*='cursor-pointer']");
  const badgeCount = await badgesBefore.count();
  console.log(`Badges before: ${badgeCount}`);

  const selectDisabled = await tabPanel.locator("[role='combobox']").isDisabled();
  console.log(`Select disabled: ${selectDisabled}`);

  if (badgeCount > 0) {
    // Remove first badge by clicking the ×
    const firstBadge = badgesBefore.first();
    const badgeName = await firstBadge.textContent();
    console.log(`Removing badge: "${badgeName}"`);
    await firstBadge.click();
    await page.waitForTimeout(500);

    await page.screenshot({ path: "test-results/sel-02-after-remove.png" });

    // Now select should be enabled
    const selectAfterRemove = tabPanel.locator("[role='combobox']");
    const isDisabled = await selectAfterRemove.isDisabled();
    console.log(`Select disabled after remove: ${isDisabled}`);
    expect(isDisabled).toBe(false);

    // Click to open dropdown
    await selectAfterRemove.click();
    await page.waitForTimeout(1000);

    await page.screenshot({ path: "test-results/sel-03-dropdown-open.png" });

    // Check options
    const options = page.locator("[role='option']");
    const optCount = await options.count();
    console.log(`Options available: ${optCount}`);
    for (let i = 0; i < optCount; i++) {
      console.log(`  option[${i}]: "${await options.nth(i).textContent()}"`);
    }

    if (optCount > 0) {
      // Select the first option
      await options.first().click();
      await page.waitForTimeout(1000);

      await page.screenshot({ path: "test-results/sel-04-after-reselect.png" });

      // Badge should reappear
      const badgesAfter = tabPanel.locator("[class*='cursor-pointer']");
      console.log(`Badges after re-select: ${await badgesAfter.count()}`);

      // Select should reset to placeholder
      const selectText = await tabPanel.locator("[role='combobox']").textContent();
      console.log(`Select text after re-select: "${selectText}"`);
    }
  } else {
    console.log("No badges to remove — select should be enabled");
    const combobox = tabPanel.locator("[role='combobox']");
    expect(await combobox.isDisabled()).toBe(false);

    await combobox.click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: "test-results/sel-02-dropdown-empty.png" });

    const options = page.locator("[role='option']");
    console.log(`Options: ${await options.count()}`);
    if (await options.count() > 0) {
      await options.first().click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: "test-results/sel-03-selected.png" });
    }
  }

  await page.screenshot({ path: "test-results/sel-05-final.png" });
});
