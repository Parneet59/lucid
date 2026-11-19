// Smoke test: loads the built extension in Chromium, opens a fixture article,
// toggles the reader from the service worker (same path as the shortcut),
// and checks the overlay rendered the article without the page chrome.
import { chromium } from 'playwright';
import http from 'node:http';
import { readFileSync, writeFileSync, mkdtempSync, cpSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

// The real extension relies on activeTab (granted by a click), which a headless
// test can't produce, so the test copy also gets host access.
const dist = mkdtempSync(path.join(tmpdir(), 'lucid-ext-'));
cpSync('dist', dist, { recursive: true });
const manifest = JSON.parse(readFileSync(path.join(dist, 'manifest.json'), 'utf8'));
manifest.host_permissions = ['<all_urls>'];
manifest.permissions.push('tabs');
writeFileSync(path.join(dist, 'manifest.json'), JSON.stringify(manifest));
const server = http.createServer((req, res) => {
  const file = req.url === '/' ? 'article.html' : req.url.slice(1);
  let data;
  try { data = readFileSync(path.join('tests/fixtures', file)); } catch { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': 'text/html' });
  res.end(data);
}).listen(0);
const url = `http://localhost:${server.address().port}/`;

const ctx = await chromium.launchPersistentContext(mkdtempSync(path.join(tmpdir(), 'lucid-')), {
  channel: 'chromium',
  headless: true,
  args: [`--disable-extensions-except=${dist}`, `--load-extension=${dist}`],
});
let failed = false;
const check = (cond, msg) => { console.log(`${cond ? 'PASS' : 'FAIL'} ${msg}`); if (!cond) failed = true; };

try {
  const [sw] = ctx.serviceWorkers().length ? ctx.serviceWorkers() : [await ctx.waitForEvent('serviceworker')];
  const page = await ctx.newPage();
  await page.goto(url);

  const toggle = () => sw.evaluate(async (pageUrl) => {
    const tab = (await chrome.tabs.query({})).find((t) => t.url === pageUrl);
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
    return chrome.tabs.sendMessage(tab.id, { type: 'lucid:toggle' });
  }, url);

  const r1 = await toggle();
  check(r1.ok && r1.open, `toggle opens reader (${JSON.stringify(r1)})`);
  const info = await page.evaluate(() => {
    const root = document.getElementById('lucid-reader-host')?.shadowRoot;
    const body = root?.querySelector('.lucid-body');
    return {
      title: root?.querySelector('.lucid-title')?.textContent,
      paras: body?.querySelectorAll('p').length ?? 0,
      hasAside: body?.textContent.includes("won't believe"),
      hasAd: body?.textContent.includes('AD'),
      linkTarget: body?.querySelector('a')?.getAttribute('target'),
    };
  });
  check(info.title === 'Why calm reading matters', `title rendered (${info.title})`);
  check(info.paras >= 12, `paragraphs rendered (${info.paras})`);
  check(!info.hasAside && !info.hasAd, 'page clutter removed');
  check(info.linkTarget === '_blank', 'links open in new tab');

  await page.screenshot({ path: 'test-results/reader.png' });
  await page.keyboard.press('Escape');
  check(!(await page.$('#lucid-reader-host')), 'Esc closes reader');

  const r2 = await toggle();
  const r3 = await toggle();
  check(r2.open && r3.ok && !r3.open, 'toggle twice opens then closes (no double injection)');

} finally {
  await ctx.close();
  server.close();
}
process.exit(failed ? 1 : 0);
