import { PROVIDERS, loadExplainConfig, providerInfo, saveExplainConfig, type ExplainConfig, type ProviderId } from '../shared/explain';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const providerSel = $<HTMLSelectElement>('provider');
const keyInput = $<HTMLInputElement>('key');
const modelSel = $<HTMLSelectElement>('model');
const keyLink = $<HTMLAnchorElement>('key-link');
const statusEl = $<HTMLDivElement>('status');

function status(text: string, ok = true): void {
  statusEl.textContent = text;
  statusEl.className = ok ? 'ok' : 'err';
}

function fillModels(provider: ProviderId, selected?: string): void {
  const info = providerInfo(provider);
  modelSel.replaceChildren(...info.models.map((m) => new Option(m.label, m.id)));
  modelSel.value = selected && info.models.some((m) => m.id === selected) ? selected : info.defaultModel;
  keyInput.placeholder = info.keyHint;
  keyLink.href = info.keyUrl;
}

function current(): ExplainConfig {
  return { provider: providerSel.value as ProviderId, apiKey: keyInput.value.trim(), model: modelSel.value };
}

async function init(): Promise<void> {
  providerSel.replaceChildren(...PROVIDERS.map((p) => new Option(p.label, p.id)));
  const cfg = await loadExplainConfig();
  providerSel.value = cfg?.provider ?? PROVIDERS[0].id;
  fillModels(providerSel.value as ProviderId, cfg?.model);
  keyInput.value = cfg?.apiKey ?? '';
  if (!cfg) status('No key saved yet.', false);
}

providerSel.addEventListener('change', () => fillModels(providerSel.value as ProviderId));

$('save').addEventListener('click', async () => {
  const cfg = current();
  if (!cfg.apiKey) return status('Enter an API key first.', false);
  await saveExplainConfig(cfg);
  status('Saved.');
});

$('test').addEventListener('click', async () => {
  const cfg = current();
  if (!cfg.apiKey) return status('Enter an API key first.', false);
  status('Testing…');
  const res = await chrome.runtime.sendMessage({ type: 'lucid:testKey', cfg });
  if (res?.ok) status('Key works with this model.');
  else status(res?.error ?? 'Test failed.', false);
});

$('clear').addEventListener('click', async () => {
  await saveExplainConfig(null);
  keyInput.value = '';
  status('Key removed.');
});

init();
