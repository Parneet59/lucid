// Messages sent from the popup / background to the content script.
export type LucidRequest =
  | { type: 'lucid:toggle'; presetId?: string }
  | { type: 'lucid:open'; presetId?: string }
  | { type: 'lucid:close' }
  | { type: 'lucid:status' }
  | { type: 'lucid:applyPreset'; presetId: string };

export type LucidResponse =
  | { ok: true; open: boolean; presetId?: string; host?: string }
  | { ok: false; error: string };
