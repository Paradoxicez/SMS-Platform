import { test } from "playwright/test";

const USER = "demo@example.com";
const PASS = "demo123";

test("stream profile — delete debug", async ({ page }) => {
  page.on("response", async (response) => {
    const url = response.url();
    if (url.includes("/api/v1/") && response.request().method() === "DELETE") {
      const status = response.status();
      const body = await response.text().catch(() => "");
      console.log(`DELETE ${url.split("/api/v1")[1]} → ${status} ${body.substring(0, 500)}`);
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

  // Count rows before
  const rowsBefore = await page.locator("table tbody tr").count();
  console.log("Rows before:", rowsBefore);

  // Click ... on first row (non-default)
  const lastRow = page.locator("table tbody tr").first();
  const lastRowText = await lastRow.textContent();
  console.log("Last row:", lastRowText);

  await lastRow.locator("button").last().click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: "test-results/profile-del-01-menu.png" });

  // Check for Delete option
  const deleteItem = page.getByRole("menuitem", { name: /delete/i });
  const deleteVisible = await deleteItem.isVisible({ timeout: 2000 }).catch(() => false);
  console.log("Delete menu item visible:", deleteVisible);

  if (deleteVisible) {
    await deleteItem.click();
    await page.waitForTimeout(3000);
    await page.screenshot({ path: "test-results/profile-del-02-after.png" });

    const rowsAfter = await page.locator("table tbody tr").count();
    console.log("Rows after:", rowsAfter);
    console.log("Deleted:", rowsBefore > rowsAfter ? "YES" : "NO");
  } else {
    console.log("Delete not in menu — might be default profile");
    await page.screenshot({ path: "test-results/profile-del-02-no-delete.png" });
  }
});
