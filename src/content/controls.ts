import {
  FONT_STACKS, LIMITS, newPresetId, presetById, sameTypography, updateSettings,
  type FontFamily, type Settings, type Theme, type Typography,
} from '../shared/settings';
import { h } from './dom';

export interface ControlsState {
  settings: Settings;
  presetId: string;      // preset the reader is based on
  typography: Typography; // what's on screen (may be modified from the preset)
  host: string;
}

// Builds the toolbar (preset picker, Aa) and the typography panel.
// `apply` pushes typography to the page; `rerender` rebuilds this UI.
export function buildControls(
  state: ControlsState,
  apply: (t: Typography) => void,
  onClose: () => void,
): { bar: HTMLElement; panel: HTMLElement; refresh: () => void } {
  const bar = h('div', { class: 'lucid-bar' });
  const panel = h('div', { class: 'lucid-panel', hidden: true });

  const refresh = () => {
    bar.replaceChildren(...toolbar());
    panel.replaceChildren(...panelContents());
  };

  const preset = () => presetById(state.settings, state.presetId) ?? state.settings.presets[0];
  const modified = () => !sameTypography(preset().typography, state.typography);

  const setTypo = (patch: Partial<Typography>) => {
    state.typography = { ...state.typography, ...patch };
    apply(state.typography);
    refresh();
  };

  const choosePreset = (id: string) => {
    const p = presetById(state.settings, id);
    if (!p) return;
    state.presetId = id;
    state.typography = { ...p.typography };
    apply(state.typography);
    refresh();
  };

  function toolbar(): Node[] {
    const select = h('select', {
      class: 'lucid-preset', title: 'Preset',
      onchange: (e: Event) => choosePreset((e.target as HTMLSelectElement).value),
    });
    for (const p of state.settings.presets) {
      const label = p.name + (p.id === state.presetId && modified() ? ' (modified)' : '');
      select.append(h('option', { value: p.id, selected: p.id === state.presetId }, label));
    }
    const aa = h('button', {
      type: 'button', class: 'lucid-aa', title: 'Typography',
      'aria-expanded': String(!panel.hidden),
      onclick: () => { panel.hidden = !panel.hidden; refresh(); },
    }, 'Aa');
    const close = h('button', { type: 'button', class: 'lucid-close', onclick: onClose }, 'Close (Esc)');
    return [select, aa, h('span', { class: 'lucid-spacer' }), close];
  }

  function slider(label: string, key: 'fontSize' | 'lineHeight' | 'width' | 'letterSpacing' | 'wordSpacing', fmt: (v: number) => string): HTMLElement {
    const lim = LIMITS[key];
    const out = h('output', {}, fmt(state.typography[key]));
    const input = h('input', {
      type: 'range', min: String(lim.min), max: String(lim.max), step: String(lim.step),
      value: String(state.typography[key]), 'data-key': key,
      oninput: (e: Event) => {
        const v = Number((e.target as HTMLInputElement).value);
        state.typography = { ...state.typography, [key]: v };
        out.textContent = fmt(v);
        apply(state.typography);
      },
      onchange: () => refresh(), // update "(modified)" once the drag ends
    });
    return h('label', { class: 'lucid-row' }, h('span', {}, label), input, out);
  }

  function choice<T extends string>(label: string, current: T, options: [T, string][], set: (v: T) => void): HTMLElement {
    const group = h('div', { class: 'lucid-choices' });
    for (const [value, text] of options) {
      group.append(h('button', {
        type: 'button', class: value === current ? 'on' : '', 'aria-pressed': String(value === current),
        onclick: () => set(value),
      }, text));
    }
    return h('div', { class: 'lucid-row' }, h('span', {}, label), group);
  }

  function panelContents(): Node[] {
    const t = state.typography;
    const p = preset();
    const nameInput = h('input', { type: 'text', placeholder: 'New preset name', class: 'lucid-name' });
    const siteRule = state.settings.siteRules[state.host];
    const usesForSite = siteRule?.presetId === state.presetId;

    return [
      choice<FontFamily>('Font', t.font, [['serif', 'Serif'], ['sans', 'Sans'], ['mono', 'Mono']], (font) => setTypo({ font })),
      slider('Size', 'fontSize', (v) => `${v}px`),
      slider('Line height', 'lineHeight', (v) => v.toFixed(1)),
      slider('Width', 'width', (v) => `${v}px`),
      slider('Letter spacing', 'letterSpacing', (v) => v.toFixed(2)),
      slider('Word spacing', 'wordSpacing', (v) => v.toFixed(2)),
      choice<Theme>('Theme', t.theme, [['light', 'Light'], ['sepia', 'Sepia'], ['dark', 'Dark']], (theme) => setTypo({ theme })),
      h('hr'),
      h('div', { class: 'lucid-row lucid-actions' },
        h('button', {
          type: 'button', disabled: p.builtIn || !modified(),
          title: p.builtIn ? 'Built-in presets can’t be changed. Save as a new preset instead.' : '',
          onclick: async () => {
            state.settings = await updateSettings((s) => {
              const target = presetById(s, p.id);
              if (target && !target.builtIn) target.typography = { ...state.typography };
            });
            refresh();
          },
        }, `Update “${p.name}”`),
        h('button', {
          type: 'button', disabled: !modified(),
          onclick: () => choosePreset(p.id),
        }, 'Revert'),
      ),
      h('div', { class: 'lucid-row lucid-actions' },
        nameInput,
        h('button', {
          type: 'button',
          onclick: async () => {
            const name = nameInput.value.trim() || `My preset ${state.settings.presets.filter((x) => !x.builtIn).length + 1}`;
            const id = newPresetId();
            state.settings = await updateSettings((s) => { s.presets.push({ id, name, typography: { ...state.typography } }); });
            state.presetId = id;
            refresh();
          },
        }, 'Save as new'),
      ),
      h('div', { class: 'lucid-row lucid-actions' },
        h('button', {
          type: 'button', disabled: state.settings.defaultPresetId === p.id,
          onclick: async () => {
            state.settings = await updateSettings((s) => { s.defaultPresetId = p.id; });
            refresh();
          },
        }, state.settings.defaultPresetId === p.id ? 'This is your default' : `Make “${p.name}” the default`),
        p.builtIn ? null : h('button', {
          type: 'button', class: 'lucid-danger',
          onclick: async () => {
            state.settings = await updateSettings((s) => {
              s.presets = s.presets.filter((x) => x.id !== p.id);
              if (s.defaultPresetId === p.id) s.defaultPresetId = 'classic';
              for (const r of Object.values(s.siteRules)) if (r.presetId === p.id) delete r.presetId;
            });
            choosePreset(state.settings.defaultPresetId);
          },
        }, 'Delete preset'),
      ),
      h('label', { class: 'lucid-row lucid-check' },
        h('input', {
          type: 'checkbox', checked: usesForSite,
          onchange: async (e: Event) => {
            const on = (e.target as HTMLInputElement).checked;
            state.settings = await updateSettings((s) => {
              const rule = (s.siteRules[state.host] ??= {});
              if (on) rule.presetId = state.presetId; else delete rule.presetId;
              if (!rule.presetId && !rule.autoOpen) delete s.siteRules[state.host];
            });
            refresh();
          },
        }),
        h('span', {}, `Always use “${p.name}” on ${state.host}`),
      ),
      modified() ? h('p', { class: 'lucid-note' }, 'Unsaved changes apply to this page only.') : null,
    ].filter(Boolean) as Node[];
  }

  refresh();
  return { bar, panel, refresh };
}

export function typographyVars(t: Typography): string {
  return [
    `--lucid-font: ${FONT_STACKS[t.font]}`,
    `--lucid-size: ${t.fontSize}px`,
    `--lucid-lh: ${t.lineHeight}`,
    `--lucid-width: ${t.width}px`,
    `--lucid-ls: ${t.letterSpacing}em`,
    `--lucid-ws: ${t.wordSpacing}em`,
  ].join('; ');
}
