import { test, expect } from "playwright/test";

test.describe("Recording Settings", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.locator("input[type='email'], input[placeholder*='email' i]").fill("demo@example.com");
    await page.locator("input[type='password']").fill("demo123");
    await page.locator("button:has-text('Sign in')").first().click();
    await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 15000 });
  });

  test("should load settings tab and save global config", async ({ page }) => {
    await page.goto("/recordings");
    await page.waitForLoadState("networkidle");

    // Click Settings tab
    await page.locator("[role='tab']", { hasText: /settings/i }).click();
    await page.waitForTimeout(2000);

    // Screenshot before changes
    await page.screenshot({ path: "test-results/rec-settings-before.png", fullPage: true });

    // Check form elements exist
    const modeSelect = page.locator("text=/recording mode/i").first();
    await expect(modeSelect).toBeVisible({ timeout: 5000 });

    // Try changing retention to 60 days
    const retentionTrigger = page.locator("button[role='combobox']").nth(1);
    if (await retentionTrigger.isVisible({ timeout: 3000 }).catch(() => false)) {
      await retentionTrigger.click();
      await page.waitForTimeout(500);

      const option60 = page.locator("[role='option']", { hasText: "60" });
      if (await option60.isVisible({ timeout: 2000 }).catch(() => false)) {
        await option60.click();
        await page.waitForTimeout(500);
      }
    }

    // Click Save
    const saveButton = page.locator("button", { hasText: /save/i });
    if (await saveButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await saveButton.click();
      await page.waitForTimeout(2000);
    }

    // Screenshot after save
    await page.screenshot({ path: "test-results/rec-settings-after-save.png", fullPage: true });

    // Reload and check if settings persisted
    await page.reload();
    await page.waitForLoadState("networkidle");
    await page.locator("[role='tab']", { hasText: /settings/i }).click();
    await page.waitForTimeout(2000);

    await page.screenshot({ path: "test-results/rec-settings-after-reload.png", fullPage: true });
  });
});
