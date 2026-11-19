import type { Article } from './extract';
import { READER_CSS } from './styles';
import { buildControls, typographyVars, type ControlsState } from './controls';
import { addWordAnchors, ParagraphFocus } from './aids';
import { ensureFonts } from './fonts';
import { ArticleMap, ResumeTracker } from './nav';
import { h } from './dom';
import { Explainer } from './explain';
import { loadSettings, onSettingsChanged, presetById, presetForHost, type Typography } from '../shared/settings';

const HOST_ID = 'lucid-reader-host';

let host: HTMLElement | null = null;
let state: ControlsState | null = null;
let refreshControls: (() => void) | null = null;
let savedOverflow = '';
let savedScrollY = 0;
let listening = false;
let focus: ParagraphFocus | null = null;
let map: ArticleMap | null = null;
let resume: ResumeTracker | null = null;
let explainer: Explainer | null = null;

export function isOpen(): boolean {
  return host !== null && host.isConnected;
}

export async function openOverlay(article: Article, presetId?: string): Promise<void> {
  if (isOpen()) return;
  const settings = await loadSettings();
  const preset = presetById(settings, presetId) ?? presetForHost(settings, location.hostname);
  state = { settings, presetId: preset.id, typography: { ...preset.typography }, host: location.hostname };

  savedScrollY = window.scrollY;
  savedOverflow = document.documentElement.style.overflow;

  host = document.createElement('div');
  host.id = HOST_ID;
  // Everything lives in a shadow root so page CSS can't leak in and ours can't leak out.
  host.style.cssText = 'all: initial; position: fixed; inset: 0; z-index: 2147483647;';
  const root = host.attachShadow({ mode: 'open' });
  root.appendChild(Object.assign(document.createElement('style'), { textContent: READER_CSS }));

  const scroller = document.createElement('div');
  scroller.className = 'lucid-scroller';
  scroller.tabIndex = -1;

  ensureFonts();
  const articleEl = renderArticle(article);
  const body = articleEl.querySelector('.lucid-body') as HTMLElement;
  focus = new ParagraphFocus(scroller, body);

  map = new ArticleMap(scroller, body, article.title);
  const m = map;
  const { bar, panel, refresh } = buildControls(state, (t) => applyStyle(scroller, body, t), closeOverlay, {
    toggle: () => m.toggle(), isOpen: () => m.isOpen(),
  });
  refreshControls = refresh;

  scroller.append(bar, map.progress, panel, map.el, articleEl);
  root.appendChild(scroller);
  applyStyle(scroller, body, state.typography);

  document.documentElement.appendChild(host);
  document.documentElement.style.overflow = 'hidden';
  document.addEventListener('keydown', onKeyDown, true);
  scroller.focus({ preventScroll: true });
  window.addEventListener('pagehide', onPageHide);

  explainer = new Explainer(root, scroller, body, article.title);
  resume = new ResumeTracker(scroller, body);
  const r = resume;
  // Wait a frame so fonts/layout settle before measuring.
  requestAnimationFrame(async () => {
    const pct = await r.restore();
    if (pct !== null && isOpen()) showResumeToast(scroller, pct, r);
  });

  // Keep presets in sync if they change elsewhere (popup, another tab).
  if (!listening) {
    listening = true;
    onSettingsChanged((s) => {
      if (!state || !isOpen()) return;
      state.settings = s;
      refreshControls?.();
    });
  }
}

// Switch preset from outside the overlay (popup one-click apply).
export function applyPreset(presetId: string): boolean {
  if (!state || !isOpen()) return false;
  const p = presetById(state.settings, presetId);
  if (!p) return false;
  state.presetId = p.id;
  state.typography = { ...p.typography };
  const scroller = host!.shadowRoot!.querySelector('.lucid-scroller') as HTMLElement;
  applyStyle(scroller, scroller.querySelector('.lucid-body') as HTMLElement, state.typography);
  refreshControls?.();
  return true;
}

export function currentPresetId(): string | undefined {
  return isOpen() ? state?.presetId : undefined;
}

export function closeOverlay(): void {
  if (!host) return;
  resume?.saveNow();
  resume = null;
  map = null;
  explainer?.destroy();
  explainer = null;
  window.removeEventListener('pagehide', onPageHide);
  host.remove();
  host = null;
  state = null;
  refreshControls = null;
  focus = null;
  document.documentElement.style.overflow = savedOverflow;
  document.removeEventListener('keydown', onKeyDown, true);
  window.scrollTo(0, savedScrollY);
}

function renderArticle(article: Article): HTMLElement {
  const articleEl = document.createElement('article');
  articleEl.className = 'lucid-article';

  const h1 = document.createElement('h1');
  h1.className = 'lucid-title';
  h1.textContent = article.title;
  articleEl.appendChild(h1);

  const meta = [article.byline, article.siteName].filter(Boolean).join(' · ');
  if (meta) {
    const p = document.createElement('p');
    p.className = 'lucid-meta';
    p.textContent = meta;
    articleEl.appendChild(p);
  }

  const body = document.createElement('div');
  body.className = 'lucid-body';
  // Readability output: scripts, styles and event handlers are already stripped.
  body.innerHTML = article.contentHtml;
  hardenLinks(body);
  dropDuplicateTitle(body, article.title);
  articleEl.appendChild(body);
  return articleEl;
}

function applyStyle(scroller: HTMLElement, body: HTMLElement, t: Typography): void {
  scroller.setAttribute('style', typographyVars(t));
  scroller.dataset.theme = t.theme;
  if (t.anchors) addWordAnchors(body);
  scroller.classList.toggle('lucid-anchors-on', t.anchors);
  // Let layout settle so focus measures the restyled text.
  requestAnimationFrame(() => focus?.setEnabled(t.focus));
}

function onPageHide(): void {
  resume?.saveNow();
}

function showResumeToast(scroller: HTMLElement, pct: number, r: ResumeTracker): void {
  const toast = h('div', { class: 'lucid-toast', role: 'status' },
    h('span', {}, `Resumed where you left off (${pct}%).`),
    h('button', {
      type: 'button',
      onclick: () => { scroller.scrollTo({ top: 0 }); void r.forget(); toast.remove(); },
    }, 'Start from the top'),
    h('button', { type: 'button', 'aria-label': 'Dismiss', onclick: () => toast.remove() }, '×'),
  );
  scroller.append(toast);
  window.setTimeout(() => toast.remove(), 8000);
}

function onKeyDown(e: KeyboardEvent): void {
  if (e.key === 'Escape') {
    e.stopPropagation();
    // Esc closes the innermost thing first.
    if (explainer?.hasCard()) explainer.closeCard();
    else closeOverlay();
    return;
  }
  // j / k step through paragraphs while paragraph focus is on.
  const typing = (e.composedPath()[0] as HTMLElement)?.matches?.('input, textarea, select, [contenteditable]');
  if (typing || e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.key === 'e' && explainer?.hasSelection()) {
    e.preventDefault();
    e.stopPropagation();
    explainer.explain();
    return;
  }
  if (e.key === 'm' && map) {
    e.preventDefault();
    e.stopPropagation();
    map.toggle();
    refreshControls?.();
    return;
  }
  if (!focus?.isEnabled()) return;
  if (e.key === 'j' || e.key === 'k') {
    e.preventDefault();
    e.stopPropagation();
    focus.step(e.key === 'j' ? 1 : -1);
  }
}

function hardenLinks(root: HTMLElement): void {
  for (const a of root.querySelectorAll('a[href]')) {
    a.setAttribute('target', '_blank');
    a.setAttribute('rel', 'noopener noreferrer');
  }
  for (const el of root.querySelectorAll('*')) {
    for (const attr of [...el.attributes]) {
      if (attr.name.startsWith('on')) el.removeAttribute(attr.name);
    }
  }
}

// Readability sometimes keeps the article's own <h1>; we already show the title.
function dropDuplicateTitle(root: HTMLElement, title: string): void {
  const first = root.querySelector('h1, h2');
  if (first && (first.textContent ?? '').trim() === title.trim()) first.remove();
}
