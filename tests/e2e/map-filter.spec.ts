import { test, expect } from "playwright/test";

async function login(page: import("playwright/test").Page) {
  await page.goto("/login");
  await page.waitForSelector('input[type="email"]', { timeout: 5000 });
  await page.fill('input[type="email"]', "demo@example.com");
  await page.fill('input[type="password"]', "demo123");
  await page.click('button:has-text("Sign in")');
  await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 10000 });
}

test.describe("Map page filters", () => {
  test("diagnose filter dropdown z-index", async ({ page }) => {
    await login(page);
    await page.goto("/map");
    await page.waitForTimeout(3000);

    // Click status dropdown
    const statusBtn = page.locator('button:has-text("All Statuses")');
    await expect(statusBtn).toBeVisible();
    await statusBtn.click();
    await page.waitForTimeout(500);

    const listbox = page.locator('[role="listbox"]');
    const opened = await listbox.isVisible().catch(() => false);
    console.log("Listbox visible:", opened);

    if (opened) {
      // Check z-index of listbox vs leaflet
      const info = await page.evaluate(() => {
        const lb = document.querySelector('[role="listbox"]');
        const leaflet = document.querySelector('.leaflet-container');
        const results: Record<string, string> = {};

        if (lb) {
          let el: Element | null = lb;
          let i = 0;
          while (el && i < 10) {
            const s = window.getComputedStyle(el);
            if (s.zIndex !== "auto") {
              results[`listbox_ancestor_${i}`] = `${el.tagName} z=${s.zIndex} pos=${s.position}`;
            }
            el = el.parentElement;
            i++;
          }
          const lbRect = lb.getBoundingClientRect();
          results["listbox_rect"] = `top=${lbRect.top} left=${lbRect.left} w=${lbRect.width} h=${lbRect.height}`;
        }

        if (leaflet) {
          const s = window.getComputedStyle(leaflet);
          results["leaflet_z"] = s.zIndex;
          results["leaflet_pos"] = s.position;

          // Check leaflet pane z-indexes
          const panes = leaflet.querySelectorAll('.leaflet-pane');
          panes.forEach((p) => {
            const ps = window.getComputedStyle(p);
            if (parseInt(ps.zIndex) > 100) {
              results[`pane_${p.className.split(' ')[0]}`] = `z=${ps.zIndex}`;
            }
          });
        }

        // Check the select content portal
        const portals = document.querySelectorAll('[data-radix-popper-content-wrapper]');
        portals.forEach((p, i) => {
          const s = window.getComputedStyle(p);
          results[`portal_${i}`] = `z=${s.zIndex} pos=${s.position}`;
        });

        return results;
      });
      console.log("Z-index diagnosis:", JSON.stringify(info, null, 2));

      // Check if listbox is actually visible on screen
      const box = await listbox.boundingBox();
      console.log("Listbox bounding box:", box);

      // Check what element is on top at the listbox center
      if (box) {
        const topEl = await page.evaluate(({ x, y }) => {
          const el = document.elementFromPoint(x, y);
          return el ? `${el.tagName} class="${el.className.toString().slice(0, 60)}"` : "null";
        }, { x: box.x + box.width / 2, y: box.y + box.height / 2 });
        console.log("Element on top of listbox center:", topEl);
      }
    }

    await page.screenshot({ path: "tests/e2e/screenshots/map-dropdown-open.png", fullPage: true });

    // Also try selecting an option
    if (opened) {
      const onlineOption = page.locator('[role="option"]:has-text("Online")');
      const optionVisible = await onlineOption.isVisible().catch(() => false);
      console.log("Online option visible:", optionVisible);

      if (optionVisible) {
        await onlineOption.click();
        await page.waitForTimeout(1000);
        await page.screenshot({ path: "tests/e2e/screenshots/map-online-selected.png", fullPage: true });
        console.log("Selected Online successfully");
      }
    }
  });
});
