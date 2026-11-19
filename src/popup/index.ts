import { sendToTab } from '../shared/inject';
import { loadSettings, presetForHost, updateSettings, type Settings } from '../shared/settings';
import { originPattern, syncAutoOpenScripts } from '../shared/autoopen';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const toggleBtn = $<HTMLButtonElement>('toggle');
const statusEl = $<HTMLDivElement>('status');
const presetList = $<HTMLUListElement>('presets');
const defaultSelect = $<HTMLSelectElement>('default-preset');
const siteSection = $<HTMLElement>('site-section');
const siteTitle = $<HTMLElement>('site-title');
const sitePreset = $<HTMLSelectElement>('site-preset');
const autoOpen = $<HTMLInputElement>('auto-open');

let settings: Settings;
let tabId: number | undefined;
let host = '';
let open = false;
let activePresetId: string | undefined;
let usable = true;

async function init(): Promise<void> {
  settings = await loadSettings();
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  tabId = tab?.id;
  if (tabId !== undefined) {
    const res = await sendToTab(tabId, { type: 'lucid:status' });
    if (res.ok) {
      open = res.open;
      activePresetId = res.presetId;
      host = res.host ?? '';
    } else {
      usable = false;
      statusEl.textContent = res.error;
    }
  }
  render();
}

function render(): void {
  toggleBtn.textContent = open ? 'Close reader' : 'Open reader';
  toggleBtn.disabled = !usable;

  const current = activePresetId ?? (host ? presetForHost(settings, host).id : settings.defaultPresetId);
  presetList.replaceChildren(...settings.presets.map((p) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.disabled = !usable;
    btn.className = p.id === current ? 'on' : '';
    btn.textContent = p.name;
    if (p.id === settings.defaultPresetId) {
      const tag = document.createElement('span');
      tag.className = 'tag';
      tag.textContent = 'default';
      btn.append(tag);
    }
    btn.addEventListener('click', () => applyPreset(p.id));
    const li = document.createElement('li');
    li.append(btn);
    return li;
  }));

  fillSelect(defaultSelect, settings.defaultPresetId, false);

  siteSection.hidden = !usable || !host;
  if (host) {
    siteTitle.textContent = host;
    const rule = settings.siteRules[host];
    fillSelect(sitePreset, rule?.presetId ?? '', true);
    autoOpen.checked = !!rule?.autoOpen;
  }
}

function fillSelect(sel: HTMLSelectElement, value: string, withNone: boolean): void {
  sel.replaceChildren();
  if (withNone) sel.append(new Option('Use default', ''));
  for (const p of settings.presets) sel.append(new Option(p.name, p.id));
  sel.value = value;
}

// One click: switch the open reader to this preset, or open it with this preset.
async function applyPreset(presetId: string): Promise<void> {
  if (tabId === undefined) return;
  const res = await sendToTab(tabId, { type: 'lucid:applyPreset', presetId });
  if (!res.ok) { statusEl.textContent = res.error; return; }
  open = res.open;
  activePresetId = res.presetId;
  statusEl.textContent = '';
  render();
}

toggleBtn.addEventListener('click', async () => {
  if (tabId === undefined) return;
  const res = await sendToTab(tabId, { type: 'lucid:toggle' });
  if (!res.ok) { statusEl.textContent = res.error; return; }
  open = res.open;
  activePresetId = res.presetId;
  statusEl.textContent = '';
  if (open) window.close();
  else render();
});

defaultSelect.addEventListener('change', async () => {
  settings = await updateSettings((s) => { s.defaultPresetId = defaultSelect.value; });
  render();
});

sitePreset.addEventListener('change', async () => {
  settings = await updateSettings((s) => {
    const rule = (s.siteRules[host] ??= {});
    if (sitePreset.value) rule.presetId = sitePreset.value; else delete rule.presetId;
    if (!rule.presetId && !rule.autoOpen) delete s.siteRules[host];
  });
  render();
});

autoOpen.addEventListener('change', async () => {
  const on = autoOpen.checked;
  if (on) {
    // Auto-open needs permission to run on this site without a click.
    const granted = await chrome.permissions.request({ origins: [originPattern(host)] });
    if (!granted) {
      autoOpen.checked = false;
      statusEl.textContent = 'Permission declined, so auto-open stays off.';
      return;
    }
  }
  settings = await updateSettings((s) => {
    const rule = (s.siteRules[host] ??= {});
    if (on) rule.autoOpen = true; else delete rule.autoOpen;
    if (!rule.presetId && !rule.autoOpen) delete s.siteRules[host];
  });
  if (!on) await chrome.permissions.remove({ origins: [originPattern(host)] }).catch(() => {});
  await syncAutoOpenScripts();
  render();
});

init();

$<HTMLAnchorElement>('options').addEventListener('click', (e) => {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
});
