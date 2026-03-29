import { test } from "playwright/test";

test("Stream Engine save — capture all network", async ({ page }) => {
  await page.goto("/login");
  await page.locator("input[type='email'], input[placeholder*='email' i]").fill("demo@example.com");
  await page.locator("input[type='password']").fill("demo123");
  await page.locator("button:has-text('Sign in')").first().click();
  await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 15000 });

  // Listen to ALL API responses
  page.on("response", async (response) => {
    const url = response.url();
    if (url.includes("/api/v1/") && ["PATCH", "PUT", "POST"].includes(response.request().method())) {
      const status = response.status();
      const body = status !== 200 ? await response.text().catch(() => "") : "ok";
      console.log(`${response.request().method()} ${url.split("/api/v1")[1]} → ${status} ${status !== 200 ? body : ""}`);
    }
  });

  // Also capture console errors
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      console.log(`CONSOLE ERROR: ${msg.text()}`);
    }
  });

  await page.goto("/settings/stream-engine");
  await page.waitForTimeout(3000);

  // Click Save Changes
  const saveBtn = page.locator("button", { hasText: /save changes/i });
  if (await saveBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await saveBtn.click();
    await page.waitForTimeout(5000);
  }

  await page.screenshot({ path: "test-results/settings-save-result.png" });
});
