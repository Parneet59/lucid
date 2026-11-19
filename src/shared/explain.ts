// Explain-selection config: bring your own API key, stored only in this browser.

export type ProviderId = 'anthropic';

export interface ExplainConfig {
  provider: ProviderId;
  apiKey: string;
  model: string;
}

export interface ProviderInfo {
  id: ProviderId;
  label: string;
  keyHint: string;
  keyUrl: string;
  models: { id: string; label: string }[];
  defaultModel: string;
}

export const PROVIDERS: ProviderInfo[] = [
  {
    id: 'anthropic',
    label: 'Claude (Anthropic)',
    keyHint: 'sk-ant-…',
    keyUrl: 'https://console.anthropic.com/settings/keys',
    models: [
      { id: 'claude-opus-5-5', label: 'Claude Opus 5.5 (best)' },
      { id: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5 (balanced)' },
      { id: 'claude-haiku-5-5', label: 'Claude Haiku 5.5 (fastest, cheapest)' },
    ],
    defaultModel: 'claude-opus-5-5',
  },
];

export const providerInfo = (id: ProviderId) => PROVIDERS.find((p) => p.id === id) ?? PROVIDERS[0];

const KEY = 'explain';

export async function loadExplainConfig(): Promise<ExplainConfig | null> {
  const c = (await chrome.storage.local.get(KEY))[KEY] as ExplainConfig | undefined;
  return c?.apiKey ? c : null;
}

export async function saveExplainConfig(c: ExplainConfig | null): Promise<void> {
  if (c) await chrome.storage.local.set({ [KEY]: c });
  else await chrome.storage.local.remove(KEY);
}

// What the content script sends over the 'lucid-explain' port.
export interface ExplainRequest {
  selection: string;
  context: string;   // surrounding paragraph(s)
  title: string;
  url: string;
}

export type ExplainEvent =
  | { type: 'text'; text: string }
  | { type: 'done' }
  | { type: 'error'; error: string; needsKey?: boolean };
