import { sendToTab } from '../shared/inject';

chrome.commands.onCommand.addListener(async (command, tab) => {
  if (command !== 'toggle-reader' || tab?.id === undefined) return;
  const res = await sendToTab(tab.id, { type: 'lucid:toggle' });
  if (!res.ok) console.warn('[Lucid]', res.error);
});
