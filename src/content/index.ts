import type { LucidRequest, LucidResponse } from '../shared/messages';
import { extractArticle } from './extract';
import { applyPreset, closeOverlay, currentPresetId, isOpen, openOverlay } from './overlay';

declare global {
  interface Window { __lucidLoaded?: boolean }
}

// executeScript can run this more than once per page (and auto.js may have
// loaded it already); only wire up once.
export function install(): boolean {
  if (window.__lucidLoaded) return false;
  window.__lucidLoaded = true;
  chrome.runtime.onMessage.addListener((req: LucidRequest, _sender, sendResponse) => {
    handle(req).then(sendResponse);
    return true; // async response
  });
  return true;
}

const status = (): LucidResponse => ({ ok: true, open: isOpen(), presetId: currentPresetId(), host: location.hostname });

async function handle(req: LucidRequest): Promise<LucidResponse> {
  try {
    switch (req.type) {
      case 'lucid:status':
        return status();
      case 'lucid:close':
        closeOverlay();
        return status();
      case 'lucid:open':
        return open(req.presetId);
      case 'lucid:toggle':
        if (isOpen()) {
          closeOverlay();
          return status();
        }
        return open(req.presetId);
      case 'lucid:applyPreset':
        if (isOpen()) applyPreset(req.presetId);
        else return open(req.presetId);
        return status();
    }
  } catch (err) {
    console.error('[Lucid]', err);
    return { ok: false, error: String((err as Error)?.message ?? err) };
  }
}

export async function open(presetId?: string): Promise<LucidResponse> {
  if (isOpen()) return status();
  const article = extractArticle();
  if (!article) return { ok: false, error: "Couldn't find an article on this page." };
  await openOverlay(article, presetId);
  return status();
}
