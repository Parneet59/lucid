import type { LucidRequest, LucidResponse } from '../shared/messages';
import { extractArticle } from './extract';
import { closeOverlay, isOpen, openOverlay } from './overlay';

declare global {
  interface Window { __lucidLoaded?: boolean }
}

// executeScript can run this file more than once per page; only wire up once.
if (!window.__lucidLoaded) {
  window.__lucidLoaded = true;
  chrome.runtime.onMessage.addListener((req: LucidRequest, _sender, sendResponse) => {
    sendResponse(handle(req));
  });
}

function handle(req: LucidRequest): LucidResponse {
  try {
    switch (req.type) {
      case 'lucid:status':
        return { ok: true, open: isOpen() };
      case 'lucid:close':
        closeOverlay();
        return { ok: true, open: false };
      case 'lucid:open':
        return open();
      case 'lucid:toggle':
        if (isOpen()) {
          closeOverlay();
          return { ok: true, open: false };
        }
        return open();
    }
  } catch (err) {
    console.error('[Lucid]', err);
    return { ok: false, error: String((err as Error)?.message ?? err) };
  }
}

function open(): LucidResponse {
  if (isOpen()) return { ok: true, open: true };
  const article = extractArticle();
  if (!article) return { ok: false, error: "Couldn't find an article on this page." };
  openOverlay(article);
  return { ok: true, open: true };
}
