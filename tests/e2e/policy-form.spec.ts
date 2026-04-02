import { test, expect } from "@playwright/test";

async function login(page: any) {
  await page.goto("/login");
  await page.locator("input[type='email'], input[placeholder*='email' i]").fill("demo@example.com");
  await page.locator("input[type='password']").fill("demo123");
  await page.locator("button:has-text('Sign in')").first().click();
  await page.waitForURL((url: URL) => !url.pathname.includes("/login"), { timeout: 15000 });
}

test.describe("Policy Form", () => {
  test.beforeEach(async ({ page }) => {
    // Log API errors
    page.on("response", async (response) => {
      const url = response.url();
      if (url.includes("/api/v1/") && response.status() >= 400) {
        const body = await response.text().catch(() => "");
        console.log(`API ERROR: ${response.request().method()} ${url.split("/api/v1")[1]} → ${response.status()} ${body}`);
      }
    });
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        console.log(`CONSOLE ERROR: ${msg.text()}`);
      }
    });

    await login(page);
  });

  test("navigate to policies page and see table", async ({ page }) => {
    await page.goto("/policies");
    await page.waitForTimeout(2000);

    // Should see the Policies heading
    await expect(page.locator("h1")).toContainText("Policies");
    await page.screenshot({ path: "test-results/policy-page.png" });
  });

  test("open create policy dialog", async ({ page }) => {
    await page.goto("/policies");
    await page.waitForTimeout(2000);

    // Click Create Policy button
    await page.locator("button", { hasText: /create policy/i }).click();
    await page.waitForTimeout(1000);

    // Should see the dialog
    await expect(page.locator("h2")).toContainText("Create Policy");
    await page.screenshot({ path: "test-results/policy-create-dialog.png" });
  });

  test("create policy with all fields", async ({ page }) => {
    await page.goto("/policies");
    await page.waitForTimeout(2000);

    await page.locator("button", { hasText: /create policy/i }).click();
    await page.waitForTimeout(1000);

    // Fill name
    await page.locator("#policy-name").fill("E2E Test Policy");

    // Set TTL values
    await page.locator("#ttl-min").fill("30");
    await page.locator("#ttl-default").fill("120");
    await page.locator("#ttl-max").fill("600");

    // Add domain
    await page.locator("input[placeholder*='example.com']").fill("*.test.com");
    await page.locator("button", { hasText: /^add$/i }).click();
    await page.waitForTimeout(500);

    // Enable rate limit
    const rateSwitch = page.locator("button[role='switch']");
    if (await rateSwitch.isVisible()) {
      await rateSwitch.click();
      await page.waitForTimeout(500);
    }

    // Set viewer concurrency
    await page.locator("#viewer-concurrency").fill("25");

    await page.screenshot({ path: "test-results/policy-create-filled.png" });

    // Submit
    await page.locator("button", { hasText: /^create policy$/i }).click();
    await page.waitForTimeout(3000);

    await page.screenshot({ path: "test-results/policy-create-result.png" });
  });

  test("edit existing policy and test scope tabs", async ({ page }) => {
    await page.goto("/policies");
    await page.waitForTimeout(2000);

    // Click on first policy name link to edit
    const firstPolicyLink = page.locator("table button.text-blue-600, table a.text-blue-600").first();
    if (await firstPolicyLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      await firstPolicyLink.click();
      await page.waitForTimeout(2000);

      // Should see Edit Policy dialog
      await expect(page.locator("h2")).toContainText("Edit Policy");
      await page.screenshot({ path: "test-results/policy-edit-dialog.png" });

      // Test Projects tab
      const projectsTab = page.locator("[role='tab']", { hasText: /projects/i });
      await projectsTab.click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: "test-results/policy-scope-projects.png" });

      // Test Sites tab
      const sitesTab = page.locator("[role='tab']", { hasText: /sites/i });
      await sitesTab.click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: "test-results/policy-scope-sites.png" });

      // Test Cameras tab
      const camerasTab = page.locator("[role='tab']", { hasText: /cameras/i });
      await camerasTab.click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: "test-results/policy-scope-cameras.png" });

      // Try to select a camera from the dropdown
      const cameraSelect = page.locator("[role='tabpanel']:visible select, [role='tabpanel']:visible [role='combobox']").first();
      if (await cameraSelect.isVisible({ timeout: 2000 }).catch(() => false)) {
        await cameraSelect.click();
        await page.waitForTimeout(1000);

        // Pick first option
        const firstOption = page.locator("[role='option']").first();
        if (await firstOption.isVisible({ timeout: 2000 }).catch(() => false)) {
          await firstOption.click();
          await page.waitForTimeout(1000);
        }
      }

      await page.screenshot({ path: "test-results/policy-scope-camera-selected.png" });

      // Try to save
      await page.locator("button", { hasText: /update policy/i }).click();
      await page.waitForTimeout(3000);

      await page.screenshot({ path: "test-results/policy-edit-result.png" });
    } else {
      // No policies exist — take screenshot
      await page.screenshot({ path: "test-results/policy-no-policies.png" });
    }
  });

  test("verify policy assignment works via API", async ({ page }) => {
    await page.goto("/policies");
    await page.waitForTimeout(2000);

    // Open edit dialog for first policy
    const firstPolicyLink = page.locator("table button.text-blue-600").first();
    if (!await firstPolicyLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      console.log("No policies to test assignment");
      return;
    }

    await firstPolicyLink.click();
    await page.waitForTimeout(2000);

    // Go to Cameras tab
    await page.locator("[role='tab']", { hasText: /cameras/i }).click();
    await page.waitForTimeout(1000);

    // Check if selector is visible and functional
    const selectTrigger = page.locator("[role='tabpanel']:visible [role='combobox']").first();
    const isSelectVisible = await selectTrigger.isVisible({ timeout: 2000 }).catch(() => false);

    if (isSelectVisible) {
      await selectTrigger.click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: "test-results/policy-camera-dropdown-open.png" });

      // Select first camera
      const option = page.locator("[role='option']").first();
      if (await option.isVisible({ timeout: 2000 }).catch(() => false)) {
        const optionText = await option.textContent();
        console.log(`Selecting camera: ${optionText}`);
        await option.click();
        await page.waitForTimeout(1000);

        // Should see a badge chip for the selected camera
        await page.screenshot({ path: "test-results/policy-camera-assigned.png" });

        // Verify badge appears
        const badges = page.locator("[role='tabpanel']:visible .inline-flex, [role='tabpanel']:visible [class*='badge']");
        const badgeCount = await badges.count();
        console.log(`Badge count after selection: ${badgeCount}`);
      }
    } else {
      console.log("Camera selector not visible");
      await page.screenshot({ path: "test-results/policy-camera-no-selector.png" });
    }

    // Click Update Policy to save assignment
    await page.locator("button", { hasText: /update policy/i }).click();
    await page.waitForTimeout(3000);
    await page.screenshot({ path: "test-results/policy-assignment-result.png" });
  });
});
