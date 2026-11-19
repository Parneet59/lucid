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

  // --- Part 2: presets and typography ---
  const send = (msg) => sw.evaluate(async ([pageUrl, msg]) => {
    const tab = (await chrome.tabs.query({})).find((t) => t.url === pageUrl);
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
    return chrome.tabs.sendMessage(tab.id, msg);
  }, [url, msg]);
  const shadow = (fn, arg) => page.evaluate(fn, arg);
  const readerVars = () => shadow(() => {
    const sc = document.getElementById('lucid-reader-host')?.shadowRoot?.querySelector('.lucid-scroller');
    return sc ? { style: sc.getAttribute('style'), theme: sc.dataset.theme } : null;
  });

  const a1 = await send({ type: 'lucid:applyPreset', presetId: 'night' });
  let v = await readerVars();
  check(a1.ok && a1.open && a1.presetId === 'night' && v?.theme === 'dark', 'one-click preset opens reader with Night (dark)');
  await send({ type: 'lucid:applyPreset', presetId: 'large' });
  v = await readerVars();
  check(v?.style.includes('--lucid-size: 26px') && v.theme === 'sepia', 'switching preset restyles live');

  // Open the Aa panel, change size, save as a new preset.
  await shadow(() => {
    const root = document.getElementById('lucid-reader-host').shadowRoot;
    root.querySelector('.lucid-aa').click();
    const r = root.querySelector('input[data-key="fontSize"]');
    r.value = '31'; r.dispatchEvent(new Event('input')); r.dispatchEvent(new Event('change'));
  });
  v = await readerVars();
  const label = await shadow(() => document.getElementById('lucid-reader-host').shadowRoot.querySelector('.lucid-preset option:checked').textContent);
  check(v.style.includes('--lucid-size: 31px') && label.includes('(modified)'), `slider changes size and marks preset modified (${label})`);
  await shadow(() => {
    const root = document.getElementById('lucid-reader-host').shadowRoot;
    root.querySelector('.lucid-name').value = 'Test preset';
    [...root.querySelectorAll('button')].find((b) => b.textContent === 'Save as new').click();
  });
  await page.waitForTimeout(200);
  const stored = await sw.evaluate(async () => (await chrome.storage.local.get('settings')).settings);
  const mine = stored?.presets.find((p) => p.name === 'Test preset');
  check(mine?.typography.fontSize === 31, 'Save as new stores the preset');

  // Site rule: tick "Always use on this site", reopen and expect it.
  await shadow(() => {
    const root = document.getElementById('lucid-reader-host').shadowRoot;
    root.querySelector('.lucid-site-rule').click();
  });
  await page.waitForTimeout(200);
  await send({ type: 'lucid:close' });
  const reopened = await send({ type: 'lucid:open' });
  check(reopened.presetId === mine.id, 'per-site rule picks the saved preset on reopen');
  await send({ type: 'lucid:close' });

  // Default preset applies on sites without a rule.
  await sw.evaluate(async (id) => {
    const { settings } = await chrome.storage.local.get('settings');
    settings.siteRules = {}; settings.defaultPresetId = 'compact';
    await chrome.storage.local.set({ settings });
  });
  const def = await send({ type: 'lucid:open' });
  check(def.presetId === 'compact', 'default preset used when no site rule');
  await send({ type: 'lucid:close' });

  // Auto-open: rule + permission registers auto.js; a reload opens the reader.
  await sw.evaluate(async () => {
    const { settings } = await chrome.storage.local.get('settings');
    settings.siteRules = { localhost: { autoOpen: true } };
    await chrome.storage.local.set({ settings });
  });
  await page.waitForTimeout(300);
  await page.reload();
  const auto = await page.waitForSelector('#lucid-reader-host', { timeout: 3000 }).then(() => true, () => false);
  check(auto, 'auto-open opens the reader on page load');
  await page.screenshot({ path: 'test-results/reader-panel.png' });

  // --- Part 3: reading aids ---
  await send({ type: 'lucid:close' });
  await page.waitForTimeout(100);
  const dys = await send({ type: 'lucid:applyPreset', presetId: 'dyslexia' });
  const fontOk = await page.evaluate(async () => {
    await document.fonts.ready;
    const root = document.getElementById('lucid-reader-host').shadowRoot;
    const fam = getComputedStyle(root.querySelector('.lucid-article')).fontFamily;
    await document.fonts.load("16px 'Lucid OpenDyslexic'");
    return { fam, loaded: document.fonts.check("16px 'Lucid OpenDyslexic'") };
  });
  check(dys.presetId === 'dyslexia' && fontOk.fam.includes('OpenDyslexic') && fontOk.loaded, `dyslexia preset loads OpenDyslexic (${JSON.stringify(fontOk)})`);

  const setAid = (key, on) => shadow(([key, on]) => {
    const root = document.getElementById('lucid-reader-host').shadowRoot;
    const panel = root.querySelector('.lucid-panel');
    if (panel.hidden) root.querySelector('.lucid-aa').click();
    const box = root.querySelector(`input[data-key="${key}"]`);
    if (box.checked !== on) box.click();
  }, [key, on]);

  const anchorsBefore = await shadow(() => document.getElementById('lucid-reader-host').shadowRoot.querySelectorAll('.lucid-anchor').length);
  await setAid('anchors', true);
  const anchors = await shadow(() => {
    const root = document.getElementById('lucid-reader-host').shadowRoot;
    const first = root.querySelector('.lucid-body p .lucid-anchor');
    return {
      count: root.querySelectorAll('.lucid-anchor').length,
      inCode: root.querySelectorAll('pre .lucid-anchor').length,
      weight: getComputedStyle(first).fontWeight,
      first: first.textContent + first.nextSibling.textContent,
      text: root.querySelector('.lucid-body p').textContent.slice(0, 30),
    };
  });
  check(anchorsBefore === 0 && anchors.count > 100 && anchors.inCode === 0 && anchors.weight === '700', `word anchors bold word starts, skip code (${JSON.stringify(anchors)})`);
  check(anchors.text.startsWith('Paragraph 1. Reading on the'), 'anchors keep the text intact');
  await setAid('anchors', false);
  const offWeight = await shadow(() => getComputedStyle(document.getElementById('lucid-reader-host').shadowRoot.querySelector('.lucid-body p .lucid-anchor')).fontWeight);
  check(offWeight === '400', 'anchors off un-bolds');

  await setAid('focus', true);
  await page.waitForTimeout(100);
  const focusState = () => shadow(() => {
    const root = document.getElementById('lucid-reader-host').shadowRoot;
    const blocks = [...root.querySelectorAll('.lucid-block')];
    const f = root.querySelector('.lucid-focused');
    return { blocks: blocks.length, focused: blocks.indexOf(f), dim: getComputedStyle(blocks.find((b) => b !== f)).opacity, on: getComputedStyle(f).opacity };
  });
  const f1 = await focusState();
  // close the panel so j/k reach the reader
  await shadow(() => document.getElementById('lucid-reader-host').shadowRoot.querySelector('.lucid-aa').click());
  await page.keyboard.press('j'); await page.keyboard.press('j'); await page.keyboard.press('j');
  await page.waitForTimeout(700);
  const f2 = await focusState();
  check(f1.blocks > 12 && f1.focused >= 0 && Number(f1.dim) < 0.5 && f1.on === '1', `paragraph focus dims others (${JSON.stringify(f1)})`);
  check(f2.focused > f1.focused, `j steps focus forward (${f1.focused} -> ${f2.focused})`);
  await page.screenshot({ path: 'test-results/reader-aids.png' });

  // --- Part 4: article map + resume ---
  await send({ type: 'lucid:close' });
  await sw.evaluate(async () => {
    const { settings } = await chrome.storage.local.get('settings');
    settings.siteRules = {}; settings.defaultPresetId = 'classic';
    await chrome.storage.local.set({ settings, positions: {} });
  });
  await send({ type: 'lucid:open' });
  await page.keyboard.press('m');
  const mapInfo = await shadow(() => {
    const root = document.getElementById('lucid-reader-host').shadowRoot;
    const nav = root.querySelector('.lucid-map');
    return { open: !nav.hidden, items: [...nav.querySelectorAll('li')].map((l) => l.textContent) };
  });
  check(mapInfo.open && mapInfo.items.includes('The problem') && mapInfo.items.includes('The fix'), `m opens article map (${mapInfo.items.join(' | ')})`);
  await shadow(() => [...document.getElementById('lucid-reader-host').shadowRoot.querySelectorAll('.lucid-map button')].find((b) => b.textContent === 'The fix').click());
  await page.waitForTimeout(900);
  const jumped = await shadow(() => {
    const root = document.getElementById('lucid-reader-host').shadowRoot;
    const fix = [...root.querySelectorAll('.lucid-body h2')].find((x) => x.textContent === 'The fix');
    return {
      top: Math.round(fix.getBoundingClientRect().top),
      active: root.querySelector('.lucid-map li.on')?.textContent,
      pct: root.querySelector('.lucid-map-pct').textContent,
      bar: root.querySelector('.lucid-progress-fill').style.width,
    };
  });
  check(jumped.top > 0 && jumped.top < 200 && jumped.active === 'The fix', `map jump scrolls to section and highlights it (${JSON.stringify(jumped)})`);
  check(parseInt(jumped.bar) > 50, `progress bar tracks reading (${jumped.bar})`);
  await page.screenshot({ path: 'test-results/reader-map.png' });

  // Scroll to the middle, close, reopen: should resume there.
  await shadow(() => {
    const sc = document.getElementById('lucid-reader-host').shadowRoot.querySelector('.lucid-scroller');
    sc.scrollTop = (sc.scrollHeight - sc.clientHeight) * 0.5;
  });
  await page.waitForTimeout(1200);
  const before = await shadow(() => document.getElementById('lucid-reader-host').shadowRoot.querySelector('.lucid-scroller').scrollTop);
  await send({ type: 'lucid:close' });
  await page.waitForTimeout(200);
  await send({ type: 'lucid:open' });
  await page.waitForTimeout(400);
  const after = await shadow(() => {
    const root = document.getElementById('lucid-reader-host').shadowRoot;
    return { top: root.querySelector('.lucid-scroller').scrollTop, toast: root.querySelector('.lucid-toast')?.textContent ?? '' };
  });
  check(Math.abs(after.top - before) < 80 && /Resumed/.test(after.toast), `reopening resumes position (${Math.round(before)} -> ${Math.round(after.top)}, "${after.toast}")`);
  await shadow(() => [...document.getElementById('lucid-reader-host').shadowRoot.querySelectorAll('.lucid-toast button')].find((b) => /top/.test(b.textContent)).click());
  await page.waitForTimeout(300);
  await send({ type: 'lucid:close' });
  await send({ type: 'lucid:open' });
  await page.waitForTimeout(400);
  const fresh = await shadow(() => document.getElementById('lucid-reader-host').shadowRoot.querySelector('.lucid-scroller').scrollTop);
  check(fresh < 5, `"Start from the top" forgets the position (${fresh})`);

  // --- Part 5: explain selection (API mocked) ---
  const selectAndExplain = async () => {
    await shadow(() => {
      const root = document.getElementById('lucid-reader-host').shadowRoot;
      root.querySelector('.lucid-toast')?.remove();
      const p = root.querySelectorAll('.lucid-body p')[1];
      p.scrollIntoView();
      const text = p.firstChild;
      const range = document.createRange();
      range.setStart(text, 13); range.setEnd(text, 40);
      const sel = root.getSelection();
      sel.removeAllRanges(); sel.addRange(range);
      p.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    });
    await page.waitForTimeout(100);
    const btnVisible = await shadow(() => !document.getElementById('lucid-reader-host').shadowRoot.querySelector('.lucid-explain-btn').hidden);
    await page.keyboard.press('e');
    await page.waitForTimeout(800);
    return { btnVisible, card: await shadow(() => document.getElementById('lucid-reader-host').shadowRoot.querySelector('.lucid-explain-card')?.textContent ?? null) };
  };

  const noKey = await selectAndExplain();
  check(noKey.btnVisible, 'selecting text shows the Explain button');
  check(/Add your API key/.test(noKey.card ?? '') && /Open options/.test(noKey.card), `no key: explains how to add one (${noKey.card})`);
  await page.keyboard.press('Escape');
  const stillOpen = await page.$('#lucid-reader-host');
  check(!!stillOpen, 'Esc closes the explain card before the reader');

  let apiRequest = null;
  await ctx.route('https://api.anthropic.com/**', async (route) => {
    apiRequest = { url: route.request().url(), headers: await route.request().allHeaders(), body: route.request().postDataJSON() };
    const ev = (type, data) => `event: ${type}\ndata: ${JSON.stringify({ type, ...data })}\n\n`;
    const body = [
      ev('message_start', { message: { id: 'msg_1', type: 'message', role: 'assistant', model: 'claude-opus-5-5', content: [], stop_reason: null, usage: { input_tokens: 10, output_tokens: 0 } } }),
      ev('content_block_start', { index: 0, content_block: { type: 'text', text: '' } }),
      ev('content_block_delta', { index: 0, delta: { type: 'text_delta', text: 'It means the web ' } }),
      ev('content_block_delta', { index: 0, delta: { type: 'text_delta', text: 'is noisy.' } }),
      ev('content_block_stop', { index: 0 }),
      ev('message_delta', { delta: { stop_reason: 'end_turn' }, usage: { output_tokens: 6 } }),
      ev('message_stop', {}),
    ].join('');
    await route.fulfill({ status: 200, headers: { 'content-type': 'text/event-stream' }, body });
  });
  await sw.evaluate(() => chrome.storage.local.set({ explain: { provider: 'anthropic', apiKey: 'sk-ant-test', model: 'claude-opus-5-5' } }));
  const withKey = await selectAndExplain();
  check(/It means the web is noisy\./.test(withKey.card ?? ''), `streams the explanation into the card (${withKey.card})`);
  check((apiRequest?.headers['x-api-key'] === 'sk-ant-test' || apiRequest?.headers.authorization === 'Bearer sk-ant-test') && apiRequest.body.model === 'claude-opus-5-5', 'calls Anthropic with the saved key and model');
  check(/web is full of distractions/.test(apiRequest?.body.messages[0].content ?? '') && /<selection>/.test(apiRequest.body.messages[0].content), 'sends the selection with its paragraph as context');
  await page.screenshot({ path: 'test-results/reader-explain.png' });
  await page.keyboard.press('Escape');

  // Options page loads.
  const opts = await ctx.newPage();
  const optErrors = [];
  opts.on('pageerror', (e) => optErrors.push(e.message));
  await opts.goto(`chrome-extension://${new URL(sw.url()).host}/options.html`);
  await opts.waitForTimeout(300);
  const optKey = await opts.inputValue('#key');
  check(optErrors.length === 0 && optKey === 'sk-ant-test', `options page shows the saved key (${optErrors.join('; ')})`);
  await opts.close();

  // Popup renders without errors.
  const popup = await ctx.newPage();
  const errors = [];
  popup.on('pageerror', (e) => errors.push(e.message));
  await popup.goto(`chrome-extension://${new URL(sw.url()).host}/popup.html`);
  await popup.waitForTimeout(300);
  const items = await popup.$$eval('#presets li', (els) => els.length);
  check(errors.length === 0 && items >= 5, `popup lists presets (${items}) with no errors ${errors.join('; ')}`);
} finally {
  await ctx.close();
  server.close();
}
process.exit(failed ? 1 : 0);
