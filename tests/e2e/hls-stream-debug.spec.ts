import { test } from "playwright/test";

test("debug HLS stream playback", async ({ page }) => {
  // Capture all network requests
  const requests: { url: string; status: number; size: number; error?: string }[] = [];

  page.on("response", async (response) => {
    const url = response.url();
    if (url.includes("8888") || url.includes("m3u8") || url.includes(".mp4")) {
      const size = (await response.body().catch(() => Buffer.alloc(0))).length;
      requests.push({ url: url.split("8888")[1] || url, status: response.status(), size });
      console.log(`[${response.status()}] ${response.request().method()} ${url.split("8888")[1] || url} (${size} bytes)`);
    }
  });

  page.on("requestfailed", (request) => {
    const url = request.url();
    if (url.includes("8888") || url.includes("m3u8") || url.includes(".mp4")) {
      console.log(`[FAILED] ${request.method()} ${url.split("8888")[1] || url} — ${request.failure()?.errorText}`);
      requests.push({ url: url.split("8888")[1] || url, status: 0, size: 0, error: request.failure()?.errorText });
    }
  });

  page.on("console", (msg) => {
    const text = msg.text();
    if (text.includes("hls") || text.includes("HLS") || text.includes("error") || text.includes("Error")) {
      console.log(`[console.${msg.type()}] ${text}`);
    }
  });

  // Navigate directly to the HLS URL in a simple HTML page with hls.js
  await page.setContent(`
    <!DOCTYPE html>
    <html>
    <head>
      <script src="https://cdn.jsdelivr.net/npm/hls.js@latest"></script>
    </head>
    <body>
      <video id="video" controls autoplay muted style="width:640px;height:360px;background:#000"></video>
      <div id="status">Loading...</div>
      <div id="errors" style="color:red"></div>
      <script>
        const video = document.getElementById('video');
        const status = document.getElementById('status');
        const errors = document.getElementById('errors');
        const url = 'http://localhost:8888/cam-2a644ec7-7668-4f7f-aedc-39378013b507-hls/index.m3u8';

        if (Hls.isSupported()) {
          const hls = new Hls({
            debug: true,
            enableWorker: false,
          });
          hls.loadSource(url);
          hls.attachMedia(video);
          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            status.textContent = 'Manifest parsed — playing';
            video.play().catch(e => console.error('play error:', e));
          });
          hls.on(Hls.Events.FRAG_LOADED, (e, data) => {
            console.log('HLS frag loaded: ' + data.frag.sn);
          });
          hls.on(Hls.Events.ERROR, (e, data) => {
            console.error('HLS error:', data.type, data.details, data.fatal ? 'FATAL' : '');
            errors.textContent += data.type + ': ' + data.details + (data.fatal ? ' (FATAL)' : '') + '\\n';
            if (data.fatal) {
              status.textContent = 'FATAL ERROR: ' + data.details;
            }
          });
          hls.on(Hls.Events.LEVEL_LOADED, (e, data) => {
            console.log('HLS level loaded, fragments: ' + data.details.fragments.length);
          });
        } else {
          status.textContent = 'HLS not supported';
        }
      </script>
    </body>
    </html>
  `);

  // Wait and observe
  await page.waitForTimeout(15000);

  // Get status
  const statusText = await page.locator("#status").textContent();
  const errorsText = await page.locator("#errors").textContent();
  console.log("\n=== RESULT ===");
  console.log("Status:", statusText);
  console.log("Errors:", errorsText || "(none)");
  console.log("Total requests:", requests.length);
  console.log("Failed requests:", requests.filter(r => r.status === 0 || r.status >= 400).length);

  // Summary
  const ok = requests.filter(r => r.status === 200);
  const fail = requests.filter(r => r.status !== 200);
  console.log(`OK: ${ok.length}, Failed: ${fail.length}`);
  if (fail.length > 0) {
    console.log("Failed URLs:");
    fail.forEach(r => console.log(`  ${r.status} ${r.url} ${r.error || ''}`));
  }

  await page.screenshot({ path: "test-results/hls-stream-debug.png" });
});
