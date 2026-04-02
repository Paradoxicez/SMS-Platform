import { test, expect } from "playwright/test";

const USER = "demo@example.com";
const PASS = "demo123";

test.describe("Settings — Full Functional Tests", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.waitForLoadState("networkidle");
    await page.locator("input[type='email'], input[name='email'], input[placeholder*='email' i]").fill(USER);
    await page.locator("input[type='password'], input[name='password']").fill(PASS);
    await page.locator("button:has-text('Sign in')").first().click();
    await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 15000 });
  });

  test("Profile tab — save name works", async ({ page }) => {
    await page.goto("/profile?tab=profile");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1000);

    // Change name
    const nameInput = page.locator("#name");
    await nameInput.clear();
    await nameInput.fill("Test User Updated");

    // Click Save Changes
    await page.locator("button", { hasText: "Save Changes" }).click();
    await page.waitForTimeout(2000);

    // Should see success toast
    const toast = page.locator("[data-sonner-toast]").first();
    const toastText = await toast.textContent().catch(() => "");
    console.log("Profile save toast:", toastText);
    expect(toastText).toContain("updated");

    await page.screenshot({ path: "test-results/func-01-profile-saved.png", fullPage: true });

    // Revert name back
    await nameInput.clear();
    await nameInput.fill("Demo Admin");
    await page.locator("button", { hasText: "Save Changes" }).click();
    await page.waitForTimeout(1000);
  });

  test("Appearance tab — theme buttons and Save Timezone visible", async ({ page }) => {
    await page.goto("/profile?tab=appearance");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1000);

    // Theme buttons visible and clickable
    await expect(page.locator("button", { hasText: "Light" })).toBeVisible();
    await expect(page.locator("button", { hasText: "Dark" })).toBeVisible();
    await expect(page.locator("button", { hasText: "System" })).toBeVisible();

    // Click each theme button — no errors
    await page.locator("button", { hasText: "Dark" }).click();
    await page.waitForTimeout(300);
    await page.screenshot({ path: "test-results/func-02-dark-theme.png", fullPage: true });

    await page.locator("button", { hasText: "Light" }).click();
    await page.waitForTimeout(300);

    // Save Timezone button visible
    await expect(page.locator("button", { hasText: "Save Timezone" })).toBeVisible();
  });

  test("Appearance tab — timezone save works", async ({ page }) => {
    await page.goto("/profile?tab=appearance");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);

    // Get current timezone value
    const tzSelect = page.locator("#timezone");
    const currentTz = await tzSelect.inputValue();
    console.log("Current timezone:", currentTz);

    // Change to a different timezone
    await tzSelect.selectOption("America/New_York");
    await page.locator("button", { hasText: "Save Timezone" }).click();
    await page.waitForTimeout(2000);

    const toast = page.locator("[data-sonner-toast]").first();
    const toastText = await toast.textContent().catch(() => "");
    console.log("Timezone save toast:", toastText);
    expect(toastText).toContain("saved");

    // Verify it persists — reload page
    await page.goto("/profile?tab=appearance");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);

    const savedTz = await tzSelect.inputValue();
    console.log("Timezone after reload:", savedTz);
    expect(savedTz).toBe("America/New_York");

    await page.screenshot({ path: "test-results/func-03-timezone-saved.png", fullPage: true });

    // Revert timezone
    await tzSelect.selectOption(currentTz || "Asia/Bangkok");
    await page.locator("button", { hasText: "Save Timezone" }).click();
    await page.waitForTimeout(1000);
  });

  test("Account tab — change password form validates", async ({ page }) => {
    await page.goto("/profile?tab=account");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1000);

    // Button should be disabled initially (empty fields)
    const submitBtn = page.locator("button", { hasText: "Change Password" });
    await expect(submitBtn).toBeDisabled();

    // Fill mismatched passwords
    await page.locator("#current-password").fill("oldpass");
    await page.locator("#new-password").fill("newpass123");
    await page.locator("#confirm-password").fill("different");
    await page.waitForTimeout(300);

    // Should show mismatch error
    await expect(page.locator("text=Passwords do not match")).toBeVisible();
    await expect(submitBtn).toBeDisabled();

    // Fix confirm password
    await page.locator("#confirm-password").clear();
    await page.locator("#confirm-password").fill("newpass123");
    await page.waitForTimeout(300);

    // Button should now be enabled
    await expect(submitBtn).toBeEnabled();

    await page.screenshot({ path: "test-results/func-04-password-form.png", fullPage: true });

    // Try with wrong current password
    await submitBtn.click();
    await page.waitForTimeout(3000);

    const toast = page.locator("[data-sonner-toast]").first();
    const toastText = await toast.textContent().catch(() => "");
    console.log("Password change toast:", toastText);
    // Should fail because "oldpass" is wrong
    expect(toastText?.toLowerCase()).toContain("incorrect");

    await page.screenshot({ path: "test-results/func-05-password-error.png", fullPage: true });
  });

  test("Account tab — delete account requires email confirmation", async ({ page }) => {
    await page.goto("/profile?tab=account");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1000);

    // Click Delete Account
    await page.locator("button", { hasText: "Delete Account" }).click();
    await page.waitForTimeout(500);

    // Should see confirmation input
    await expect(page.locator("text=Type")).toBeVisible();
    await expect(page.locator("button", { hasText: "Permanently Delete" })).toBeDisabled();

    // Type wrong email
    const emailInput = page.locator("input[placeholder='Enter your email']");
    await emailInput.fill("wrong@email.com");
    await expect(page.locator("button", { hasText: "Permanently Delete" })).toBeDisabled();

    // Type correct email
    await emailInput.clear();
    await emailInput.fill(USER);
    await expect(page.locator("button", { hasText: "Permanently Delete" })).toBeEnabled();

    await page.screenshot({ path: "test-results/func-06-delete-confirm.png", fullPage: true });

    // Click Cancel (don't actually delete!)
    await page.locator("button", { hasText: "Cancel" }).click();
    await page.waitForTimeout(300);

    // Confirmation should be hidden
    await expect(page.locator("input[placeholder='Enter your email']")).not.toBeVisible();
  });

  test("Billing tab — shows usage and plans", async ({ page }) => {
    await page.goto("/profile?tab=billing");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(3000);

    await page.screenshot({ path: "test-results/func-07-billing.png", fullPage: true });

    // Should show current plan usage
    await expect(page.locator("text=Current Plan").first()).toBeVisible();
    await expect(page.locator("text=Cameras").first()).toBeVisible();

    // Should show invoice section
    await expect(page.locator("text=Invoice History").first()).toBeVisible();

    // Check usage numbers are actual data (not 0/0)
    const bodyText = await page.textContent("body");
    console.log("Has usage data:", bodyText?.includes("/ 100") || bodyText?.includes("/ 10") || bodyText?.includes("/ 20"));
  });
});
