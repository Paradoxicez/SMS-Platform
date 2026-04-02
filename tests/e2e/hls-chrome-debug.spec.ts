import { test } from "playwright/test";

test("HLS Chrome playback debug", async ({ page }) => {
  const errors: string[] = [];

  page.on("console", (msg) => {
    const text = msg.text();
    if (text.includes("error") || text.includes("Error") || text.includes("FATAL") || text.includes("stall")) {
      errors.push(`[${msg.type()}] ${text}`);
      console.log(`[${msg.type()}] ${text}`);
    }
    if (text.includes("frag loaded") || text.includes("level loaded") || text.includes("buffer")) {
      console.log(`[${msg.type()}] ${text}`);
    }
  });

  page.on("response", async (response) => {
    const url = response.url();
    if (url.includes("8888")) {
      const ct = response.headers()["content-type"] || "unknown";
      console.log(`[${response.status()}] ${url.split("8888")[1]} content-type=${ct}`);
    }
  });

  await page.setContent(`
    <!DOCTYPE html>
    <html>
    <head>
      <script src="https://cdn.jsdelivr.net/npm/hls.js@1.5.17"></script>
    </head>
    <body>
      <video id="video" controls muted style="width:640px;height:360px;background:#000"></video>
      <div id="status">Loading...</div>
      <div id="debug" style="font-size:12px;font-family:monospace;white-space:pre-wrap"></div>
      <script>
        const video = document.getElementById('video');
        const status = document.getElementById('status');
        const debug = document.getElementById('debug');
        const url = 'http://localhost:8888/cam-2a644ec7-7668-4f7f-aedc-39378013b507-hls/index.m3u8';

        function log(msg) {
          debug.textContent += msg + '\\n';
          console.log(msg);
        }

        video.addEventListener('waiting', () => log('VIDEO EVENT: waiting (buffering)'));
        video.addEventListener('stalled', () => log('VIDEO EVENT: stalled'));
        video.addEventListener('playing', () => log('VIDEO EVENT: playing'));
        video.addEventListener('canplay', () => log('VIDEO EVENT: canplay'));
        video.addEventListener('error', () => log('VIDEO EVENT: error ' + (video.error?.message || video.error?.code)));

        // Monitor buffer health
        setInterval(() => {
          if (video.buffered.length > 0) {
            const buffered = video.buffered.end(video.buffered.length - 1);
            const current = video.currentTime;
            const ahead = (buffered - current).toFixed(1);
            if (parseFloat(ahead) < 1) {
              log('BUFFER LOW: ' + ahead + 's ahead (current=' + current.toFixed(1) + ' buffered=' + buffered.toFixed(1) + ')');
            }
          }
        }, 1000);

        if (Hls.isSupported()) {
          log('hls.js version: ' + Hls.version);
          log('MSE supported: ' + MediaSource.isTypeSupported('video/mp4; codecs="avc1.42c01e"'));

          const hls = new Hls({
            debug: false,
            enableWorker: true,
            lowLatencyMode: false,
            backBufferLength: 30,
          });
          hls.loadSource(url);
          hls.attachMedia(video);

          hls.on(Hls.Events.MANIFEST_PARSED, (e, data) => {
            log('MANIFEST_PARSED levels=' + data.levels.length);
            status.textContent = 'Manifest parsed';
            video.play().then(() => log('play() resolved')).catch(e => log('play() rejected: ' + e));
          });

          hls.on(Hls.Events.LEVEL_LOADED, (e, data) => {
            log('LEVEL_LOADED frags=' + data.details.fragments.length + ' live=' + data.details.live + ' type=' + data.details.type);
          });

          hls.on(Hls.Events.FRAG_LOADED, (e, data) => {
            log('FRAG_LOADED sn=' + data.frag.sn + ' size=' + (data.frag.stats?.loaded || '?'));
          });

          hls.on(Hls.Events.FRAG_BUFFERED, (e, data) => {
            log('FRAG_BUFFERED sn=' + data.frag.sn);
          });

          hls.on(Hls.Events.BUFFER_APPENDING, () => {
            log('BUFFER_APPENDING');
          });

          hls.on(Hls.Events.ERROR, (e, data) => {
            log('ERROR: ' + data.type + ' / ' + data.details + (data.fatal ? ' FATAL' : '') + ' reason=' + (data.reason || data.error?.message || ''));
            if (data.fatal) {
              status.textContent = 'FATAL: ' + data.details;
            }
          });
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
          log('Using native HLS');
          video.src = url;
          video.play().catch(() => {});
        }
      </script>
    </body>
    </html>
  `);

  await page.waitForTimeout(20000);

  const statusText = await page.locator("#status").textContent();
  const debugText = await page.locator("#debug").textContent();
  console.log("\n=== FINAL STATUS ===");
  console.log("Status:", statusText);
  console.log("\n=== DEBUG LOG ===");
  console.log(debugText);

  await page.screenshot({ path: "test-results/hls-chrome-debug.png" });
});
