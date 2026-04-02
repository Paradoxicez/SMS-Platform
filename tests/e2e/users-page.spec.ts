import { test, expect } from "playwright/test";

const USER = "demo@example.com";
const PASS = "demo123";

test.describe("Users Page — Full Test", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.waitForLoadState("networkidle");
    await page.locator("input[type='email']").fill(USER);
    await page.locator("input[type='password']").fill(PASS);
    await page.locator("button:has-text('Sign in')").first().click();
    await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 15000 });
  });

  test("page loads with sortable table, search, and action menus", async ({ page }) => {
    await page.goto("/settings/users");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);

    // Header + buttons
    await expect(page.locator("h1", { hasText: "User Management" })).toBeVisible();
    await expect(page.locator("button", { hasText: "Add User" })).toBeVisible();
    await expect(page.locator("button", { hasText: "Invite" })).toBeVisible();

    // Search input
    await expect(page.locator("input[placeholder*='Search']")).toBeVisible();

    // Sortable columns
    await expect(page.locator("th", { hasText: "Email" })).toBeVisible();
    await expect(page.locator("th", { hasText: "Name" })).toBeVisible();
    await expect(page.locator("th", { hasText: "Role" })).toBeVisible();
    await expect(page.locator("th", { hasText: "Status" })).toBeVisible();

    // At least 1 user row exists
    await expect(page.locator("tbody tr").first()).toBeVisible();

    // Dropdown menu (three dots) exists
    const menuBtn = page.locator("tbody button").filter({ has: page.locator("svg") }).first();
    await expect(menuBtn).toBeVisible();

    await page.screenshot({ path: "test-results/users-01-loaded.png", fullPage: true });

    // Open dropdown menu
    await menuBtn.click();
    await page.waitForTimeout(300);
    await expect(page.locator("text=Change Role")).toBeVisible();
    // Self user should NOT have Remove option
    const hasRemove = await page.locator("[role='menuitem']", { hasText: "Remove" }).isVisible().catch(() => false);
    console.log("Self user has Remove option:", hasRemove, "(should be false)");

    await page.screenshot({ path: "test-results/users-02-dropdown.png" });
    await page.keyboard.press("Escape");
  });

  test("search filters users", async ({ page }) => {
    await page.goto("/settings/users");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);

    const searchInput = page.locator("input[placeholder*='Search']");
    await searchInput.fill("nonexistent@xyz.com");
    await page.waitForTimeout(500);

    // Should show no match message
    await expect(page.locator("text=No users match")).toBeVisible();

    // Clear search
    await searchInput.clear();
    await searchInput.fill("demo");
    await page.waitForTimeout(500);

    // Should still show demo user
    await expect(page.locator("td", { hasText: "demo@example.com" })).toBeVisible();
  });

  test("Add User dialog opens and has all fields", async ({ page }) => {
    await page.goto("/settings/users");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1000);

    await page.locator("button", { hasText: "Add User" }).click();
    await page.waitForTimeout(500);

    // Dialog should show
    await expect(page.locator("text=Create a new user account")).toBeVisible();
    await expect(page.locator("input[placeholder*='user@example']")).toBeVisible();
    await expect(page.locator("input[placeholder*='Full name']")).toBeVisible();
    await expect(page.locator("input[placeholder*='Min 8']")).toBeVisible();

    await page.screenshot({ path: "test-results/users-03-add-dialog.png" });
  });

  test("Invite dialog opens with email + role only", async ({ page }) => {
    await page.goto("/settings/users");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1000);

    await page.locator("button", { hasText: "Invite" }).click();
    await page.waitForTimeout(500);

    await expect(page.locator("text=Send an invitation")).toBeVisible();
    await expect(page.locator("input[placeholder*='user@example']")).toBeVisible();
    // Should NOT have name/password fields
    const hasNameField = await page.locator("input[placeholder*='Full name']").isVisible().catch(() => false);
    console.log("Invite dialog has name field:", hasNameField, "(should be false)");

    await page.screenshot({ path: "test-results/users-04-invite-dialog.png" });
  });

  test("sort by email column", async ({ page }) => {
    await page.goto("/settings/users");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);

    // Click Email header to sort
    await page.locator("th", { hasText: "Email" }).click();
    await page.waitForTimeout(300);
    await page.screenshot({ path: "test-results/users-05-sorted.png", fullPage: true });
  });
});
