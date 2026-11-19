import { sendToTab } from '../shared/inject';

const toggleBtn = document.getElementById('toggle') as HTMLButtonElement;
const statusEl = document.getElementById('status') as HTMLDivElement;

async function activeTabId(): Promise<number | undefined> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab?.id;
}

function render(open: boolean): void {
  toggleBtn.textContent = open ? 'Close reader' : 'Open reader';
}

async function init(): Promise<void> {
  const tabId = await activeTabId();
  if (tabId === undefined) return;
  const res = await sendToTab(tabId, { type: 'lucid:status' });
  if (res.ok) render(res.open);
  else {
    toggleBtn.disabled = true;
    statusEl.textContent = res.error;
  }
}

toggleBtn.addEventListener('click', async () => {
  const tabId = await activeTabId();
  if (tabId === undefined) return;
  const res = await sendToTab(tabId, { type: 'lucid:toggle' });
  if (res.ok) {
    render(res.open);
    statusEl.textContent = '';
    if (res.open) window.close();
  } else {
    statusEl.textContent = res.error;
  }
});

init();
