// Messages sent from the popup / background to the content script.
export type LucidRequest =
  | { type: 'lucid:toggle' }
  | { type: 'lucid:open' }
  | { type: 'lucid:close' }
  | { type: 'lucid:status' };

export type LucidResponse =
  | { ok: true; open: boolean }
  | { ok: false; error: string };
