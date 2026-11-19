// Presets, the default preset and per-site rules, all in chrome.storage.local.

export type FontFamily = 'serif' | 'sans' | 'mono';
export type Theme = 'light' | 'sepia' | 'dark';

export interface Typography {
  font: FontFamily;
  fontSize: number;      // px
  lineHeight: number;    // unitless
  width: number;         // max column width, px
  theme: Theme;
  letterSpacing: number; // em
  wordSpacing: number;   // em
}

export interface Preset {
  id: string;
  name: string;
  builtIn?: boolean;
  typography: Typography;
}

export interface SiteRule {
  presetId?: string;
  autoOpen?: boolean;
}

export interface Settings {
  presets: Preset[];
  defaultPresetId: string;
  siteRules: Record<string, SiteRule>; // keyed by hostname
}

export const FONT_STACKS: Record<FontFamily, string> = {
  serif: "Georgia, 'Iowan Old Style', 'Times New Roman', serif",
  sans: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
  mono: "ui-monospace, 'SF Mono', Menlo, Consolas, monospace",
};

export const LIMITS = {
  fontSize: { min: 12, max: 40, step: 1 },
  lineHeight: { min: 1.1, max: 2.6, step: 0.1 },
  width: { min: 400, max: 1200, step: 20 },
  letterSpacing: { min: 0, max: 0.3, step: 0.01 },
  wordSpacing: { min: 0, max: 0.6, step: 0.02 },
} as const;

const base: Typography = {
  font: 'serif', fontSize: 20, lineHeight: 1.6, width: 680, theme: 'light',
  letterSpacing: 0, wordSpacing: 0,
};

export const BUILT_IN_PRESETS: Preset[] = [
  { id: 'classic', name: 'Classic', builtIn: true, typography: { ...base } },
  { id: 'night', name: 'Night', builtIn: true, typography: { ...base, font: 'sans', fontSize: 19, lineHeight: 1.7, theme: 'dark' } },
  { id: 'compact', name: 'Compact', builtIn: true, typography: { ...base, font: 'sans', fontSize: 16, lineHeight: 1.45, width: 820 } },
  { id: 'large', name: 'Large print', builtIn: true, typography: { ...base, fontSize: 26, lineHeight: 1.75, width: 760, theme: 'sepia' } },
];

export const DEFAULT_SETTINGS: Settings = {
  presets: BUILT_IN_PRESETS,
  defaultPresetId: 'classic',
  siteRules: {},
};

const KEY = 'settings';

export async function loadSettings(): Promise<Settings> {
  const stored = (await chrome.storage.local.get(KEY))[KEY] as Partial<Settings> | undefined;
  return normalize(stored);
}

export async function saveSettings(settings: Settings): Promise<void> {
  await chrome.storage.local.set({ [KEY]: settings });
}

export async function updateSettings(fn: (s: Settings) => void): Promise<Settings> {
  const s = await loadSettings();
  fn(s);
  await saveSettings(s);
  return s;
}

export function onSettingsChanged(cb: (s: Settings) => void): void {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes[KEY]) cb(normalize(changes[KEY].newValue as Partial<Settings> | undefined));
  });
}

// Always keep built-ins present and current, keep user presets, fix bad ids.
function normalize(stored: Partial<Settings> | undefined): Settings {
  const user = (stored?.presets ?? []).filter((p) => !p.builtIn);
  const presets = [...BUILT_IN_PRESETS, ...user.map((p) => ({ ...p, typography: { ...base, ...p.typography } }))];
  const ids = new Set(presets.map((p) => p.id));
  const defaultPresetId = stored?.defaultPresetId && ids.has(stored.defaultPresetId) ? stored.defaultPresetId : 'classic';
  return { presets, defaultPresetId, siteRules: { ...(stored?.siteRules ?? {}) } };
}

export function presetById(s: Settings, id: string | undefined): Preset | undefined {
  return s.presets.find((p) => p.id === id);
}

// The preset a page should open with: its site rule, else the default.
export function presetForHost(s: Settings, host: string): Preset {
  return presetById(s, s.siteRules[host]?.presetId) ?? presetById(s, s.defaultPresetId) ?? s.presets[0];
}

export function newPresetId(): string {
  return 'p_' + Math.random().toString(36).slice(2, 10);
}

export function sameTypography(a: Typography, b: Typography): boolean {
  return (Object.keys(a) as (keyof Typography)[]).every((k) => a[k] === b[k]);
}
