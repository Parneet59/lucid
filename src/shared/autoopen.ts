import { loadSettings } from './settings';

const SCRIPT_ID = 'lucid-auto-open';

export function originPattern(host: string): string {
  return `*://${host}/*`;
}

// Registers auto.js for every site with auto-open on whose permission we hold.
export async function syncAutoOpenScripts(): Promise<void> {
  const settings = await loadSettings();
  const wanted: string[] = [];
  for (const [host, rule] of Object.entries(settings.siteRules)) {
    if (!rule.autoOpen) continue;
    const pattern = originPattern(host);
    if (await chrome.permissions.contains({ origins: [pattern] })) wanted.push(pattern);
  }
  const existing = await chrome.scripting.getRegisteredContentScripts({ ids: [SCRIPT_ID] });
  if (existing.length) await chrome.scripting.unregisterContentScripts({ ids: [SCRIPT_ID] });
  if (wanted.length) {
    await chrome.scripting.registerContentScripts([
      { id: SCRIPT_ID, matches: wanted, js: ['auto.js'], runAt: 'document_idle' },
    ]);
  }
}
