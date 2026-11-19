import type { LucidRequest, LucidResponse } from './messages';

// Injects the content script into a tab (it guards against double injection)
// and sends it a request. Used by both the popup and the keyboard shortcut.
export async function sendToTab(tabId: number, request: LucidRequest): Promise<LucidResponse> {
  try {
    await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] });
  } catch (err) {
    return { ok: false, error: friendlyInjectError(err) };
  }
  try {
    return (await chrome.tabs.sendMessage(tabId, request)) as LucidResponse;
  } catch (err) {
    return { ok: false, error: String((err as Error)?.message ?? err) };
  }
}

function friendlyInjectError(err: unknown): string {
  const msg = String((err as Error)?.message ?? err);
  if (/cannot access|cannot be scripted|chrome:\/\/|extensions gallery/i.test(msg)) {
    return "Lucid can't run on this page (browser and store pages are off-limits).";
  }
  return msg;
}
