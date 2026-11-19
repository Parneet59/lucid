import { sendToTab } from '../shared/inject';
import { syncAutoOpenScripts } from '../shared/autoopen';
import { onSettingsChanged } from '../shared/settings';
import { loadExplainConfig, type ExplainEvent, type ExplainRequest } from '../shared/explain';
import { getProvider } from './providers';

chrome.commands.onCommand.addListener(async (command, tab) => {
  if (command !== 'toggle-reader' || tab?.id === undefined) return;
  const res = await sendToTab(tab.id, { type: 'lucid:toggle' });
  if (!res.ok) console.warn('[Lucid]', res.error);
});

// Keep auto-open registrations in line with site rules and granted permissions.
chrome.runtime.onInstalled.addListener(() => void syncAutoOpenScripts());
chrome.runtime.onStartup.addListener(() => void syncAutoOpenScripts());
chrome.permissions.onRemoved.addListener(() => void syncAutoOpenScripts());
onSettingsChanged(() => void syncAutoOpenScripts());

// ---------- Explain selection ----------

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === 'lucid:openOptions') {
    chrome.runtime.openOptionsPage();
    sendResponse({ ok: true });
  }
  // Only the options page (an extension page, no tab URL from a site) may test keys.
  if (msg?.type === 'lucid:testKey' && sender.url?.startsWith(chrome.runtime.getURL(''))) {
    const provider = getProvider(msg.cfg.provider);
    provider.test(msg.cfg).then(
      () => sendResponse({ ok: true }),
      (err) => sendResponse({ ok: false, ...provider.describeError(err) }),
    );
    return true;
  }
});

// One port per explanation; the content script disconnects to cancel.
chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== 'lucid-explain') return;
  const abort = new AbortController();
  let closed = false;
  port.onDisconnect.addListener(() => { closed = true; abort.abort(); });
  const send = (e: ExplainEvent) => { if (!closed) port.postMessage(e); };

  port.onMessage.addListener(async (req: ExplainRequest) => {
    const cfg = await loadExplainConfig();
    if (!cfg) {
      send({ type: 'error', error: 'Add your API key in Lucid options to use Explain.', needsKey: true });
      return;
    }
    const provider = getProvider(cfg.provider);
    try {
      await provider.explain(cfg, req, (text) => send({ type: 'text', text }), abort.signal);
      send({ type: 'done' });
    } catch (err) {
      if (abort.signal.aborted) return;
      send({ type: 'error', ...provider.describeError(err) });
    }
  });
});
