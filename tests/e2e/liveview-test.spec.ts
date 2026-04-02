import { test } from "playwright/test";
test("live view stream test", async ({ page }) => {
  page.on("console", (msg) => {
    const t = msg.text();
    if (t.includes("error") || t.includes("Error") || t.includes("HLS") || t.includes("hls"))
      console.log(`[${msg.type()}] ${t.substring(0, 200)}`);
  });
  page.on("response", async (res) => {
    const u = res.url();
    if (u.includes("8888") || u.includes("internal/sessions")) {
      console.log(`[${res.status()}] ${res.request().method()} ${u.substring(u.indexOf("/api") >= 0 ? u.indexOf("/api") : u.indexOf(":8888") + 5)}`);
    }
  });

  // Login
  await page.goto("/login");
  await page.waitForTimeout(3000);
  await page.locator("input[type='email'], input[placeholder*='email' i]").fill("demo@example.com");
  await page.locator("input[type='password']").fill("demo123");
  await page.locator("button:has-text('Sign in')").first().click();
  await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 15000 });

  // Go to cameras
  await page.goto("/cameras");
  await page.waitForTimeout(3000);
  await page.waitForTimeout(2000);

  // Click Camera-2
  await page.locator("text=Camera-2").first().click();
  await page.waitForTimeout(8000);

  // Check video element
  const video = page.locator("video");
  const videoVisible = await video.isVisible().catch(() => false);
  const currentTime = await video.evaluate((v: HTMLVideoElement) => v.currentTime).catch(() => 0);
  const paused = await video.evaluate((v: HTMLVideoElement) => v.paused).catch(() => true);
  const error = await video.evaluate((v: HTMLVideoElement) => v.error?.message ?? "none").catch(() => "no video");

  console.log("\n=== VIDEO STATE ===");
  console.log("visible:", videoVisible);
  console.log("currentTime:", currentTime);
  console.log("paused:", paused);
  console.log("error:", error);

  await page.screenshot({ path: "test-results/liveview-test.png" });
});
