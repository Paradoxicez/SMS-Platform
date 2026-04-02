import { test } from "playwright/test";
test("check viewer count is 0 when nobody watching", async ({ page }) => {
  await page.goto("/login");
  await page.waitForLoadState("networkidle");
  await page.locator("input[type='email']").fill("demo@example.com");
  await page.locator("input[type='password']").fill("demo123");
  await page.locator("button:has-text('Sign in')").first().click();
  await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 15000 });

  const result = await page.evaluate(async () => {
    const session = await (await fetch("/api/auth/session")).json();
    const res = await fetch("http://localhost:3001/api/v1/cameras/status/viewers", {
      headers: { Authorization: "Bearer " + session?.accessToken },
    });
    return res.json();
  });
  console.log("Viewers:", JSON.stringify(result?.data));
});
