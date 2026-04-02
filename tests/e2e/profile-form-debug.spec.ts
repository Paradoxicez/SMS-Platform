import { test, expect } from "playwright/test";

const USER = "demo@example.com";
const PASS = "demo123";

test("stream profile — edit and save", async ({ page }) => {
  page.on("response", async (response) => {
    const url = response.url();
    if (url.includes("/api/v1/") && ["PATCH", "PUT", "POST"].includes(response.request().method())) {
      const status = response.status();
      const body = await response.text().catch(() => "");
      console.log(`${response.request().method()} ${url.split("/api/v1")[1]} → ${status} ${body.substring(0, 500)}`);
    }
  });

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

  await page.goto("/profiles");
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(2000);

  // Click ... menu on first row (HLS-480p-15fps-Strip)
  const rows = page.locator("table tbody tr");
  const firstRow = rows.first();
  const moreBtn = firstRow.locator("button").last();
  await moreBtn.click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: "test-results/profile-02-menu.png" });

  // Click Edit
  await page.getByRole("menuitem", { name: /edit/i }).click();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: "test-results/profile-03-edit-dialog.png" });

  // Verify dialog
  const dialog = page.locator("[role='dialog']");
  await expect(dialog).toBeVisible({ timeout: 3000 });

  // Log form state
  const nameVal = await dialog.locator("input").first().inputValue();
  console.log("Profile name:", nameVal);

  // Check Video Processing field
  const allSelects = await dialog.locator("[role='combobox']").all();
  console.log("Number of selects:", allSelects.length);
  for (let i = 0; i < allSelects.length; i++) {
    const text = await allSelects[i].textContent();
    console.log(`  Select[${i}]: "${text}"`);
  }

  // Click Save Changes
  const saveBtn = dialog.locator("button", { hasText: /save/i });
  await saveBtn.click();
  await page.waitForTimeout(3000);

  await page.screenshot({ path: "test-results/profile-04-after-save.png" });

  const dialogStillOpen = await dialog.isVisible().catch(() => false);
  console.log("Dialog still open:", dialogStillOpen);

  if (!dialogStillOpen) {
    console.log("SUCCESS — dialog closed after save");
  }
});
