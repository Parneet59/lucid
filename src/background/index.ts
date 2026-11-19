import { sendToTab } from '../shared/inject';
import { syncAutoOpenScripts } from '../shared/autoopen';
import { onSettingsChanged } from '../shared/settings';

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
