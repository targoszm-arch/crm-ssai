/**
 * Look at the app before pushing.
 *
 * Every layout regression in this repo shipped because nobody opened a
 * browser — a page that threw before rendering, a transactions table squeezed
 * to five rows, chrome floating as a rounded card. All three would have been
 * obvious in one screenshot.
 *
 *   npm run build && npm run preview &     # 127.0.0.1, not :: — no IPv6 here
 *   node scripts/screenshot.mjs
 *
 * It injects a stub Supabase session so the shell and the page chrome render
 * without credentials. The token is not valid, so data requests fail and the
 * tables come up empty — this checks LAYOUT, not data. Screenshots and
 * measurements land in .screenshots/.
 */
import { chromium } from "playwright";
import { mkdirSync, readdirSync, existsSync } from "node:fs";

const BASE = process.env.PREVIEW_URL ?? "http://127.0.0.1:4179";
const OUT = ".screenshots";
const REF = "getqcxnjsohtlagscmfc";
const PATHS = process.argv.slice(2).length
  ? process.argv.slice(2)
  : ["/", "/finances", "/customers", "/deals", "/orders", "/campaigns", "/inbox"];

const far = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 365;
const session = {
  access_token: "stub", token_type: "bearer", expires_in: 31536000, expires_at: far,
  refresh_token: "stub",
  user: {
    id: "00000000-0000-0000-0000-000000000001", aud: "authenticated",
    email: "preview@localhost", role: "authenticated",
    app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString(),
  },
};

mkdirSync(OUT, { recursive: true });

/**
 * This image ships a pinned Chromium under /opt/pw-browsers that will not
 * match whatever build the installed playwright expects, and playwright then
 * tells you to run `npx playwright install` — which the environment forbids.
 * Use the browser that is actually here; fall back to playwright's own.
 */
function localChromium() {
  const root = "/opt/pw-browsers";
  if (!existsSync(root)) return undefined;
  for (const dir of readdirSync(root).filter(d => d.startsWith("chromium-")).sort().reverse()) {
    const exe = `${root}/${dir}/chrome-linux/chrome`;
    if (existsSync(exe)) return exe;
  }
  return undefined;
}

const browser = await chromium.launch({ executablePath: localChromium() });
const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 } });
await ctx.addInitScript(([ref, sess]) => {
  try { localStorage.setItem(`sb-${ref}-auth-token`, JSON.stringify(sess)); } catch { /* private mode */ }
}, [REF, session]);

const page = await ctx.newPage();
const rows = [];

for (const path of PATHS) {
  await page.goto(BASE + path, { waitUntil: "load" });
  await page.waitForTimeout(2500);
  const m = await page.evaluate(async () => {
    const main = document.querySelector("main");
    const inset = main?.parentElement;
    const grid = document.querySelector(".ag-root-wrapper") || document.querySelector("table");
    const r = grid?.getBoundingClientRect();
    const cs = inset ? getComputedStyle(inset) : null;
    return {
      innerH: window.innerHeight,
      // A page that fills the screen should not also scroll the document.
      pageScrolls: document.documentElement.scrollHeight > window.innerHeight + 2,
      // Both must be 0: variant="inset" floats the content as a rounded card.
      insetMargin: cs?.margin ?? "n/a",
      insetRadius: cs?.borderTopLeftRadius ?? "n/a",
      tableTop: r ? Math.round(r.top) : null,
      tableH: r ? Math.round(r.height) : null,
      // Does the column header actually stay put? A sticky thead pins to its
      // NEAREST scrollport, so a second nested overflow box silently breaks
      // it — which is how the headers ended up scrolling away with the page.
      headerSticks: await (async () => {
        const head = document.querySelector("thead");
        const box = head?.closest("div.overflow-auto");
        if (!head || !box) return "n/a";
        if (box.scrollHeight <= box.clientHeight) return "short";
        const before = head.getBoundingClientRect().top;
        box.scrollTop = 150;
        await new Promise(r => requestAnimationFrame(r));
        const after = head.getBoundingClientRect().top;
        box.scrollTop = 0;
        return Math.abs(after - before) < 2 ? "yes" : "NO";
      })(),
    };
  });
  const file = `${OUT}/${path === "/" ? "dashboard" : path.slice(1).replace(/\//g, "-")}.png`;
  await page.screenshot({ path: file });
  rows.push({ path, ...m, screenshot: file });
}

console.table(rows);
await browser.close();
