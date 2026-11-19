import type { ExplainEvent, ExplainRequest } from '../shared/explain';
import { h } from './dom';

const MAX_SELECTION = 1500;
const MAX_CONTEXT = 3000;
const BLOCK = 'p, li, blockquote, h1, h2, h3, h4, h5, h6, dd, dt, td, th, figcaption, pre';

// Floating "Explain" button for selections inside the reader, and the card
// that streams the explanation back from the background worker.
export class Explainer {
  private button: HTMLButtonElement;
  private card: HTMLElement | null = null;
  private port: chrome.runtime.Port | null = null;
  private pending: { text: string; range: Range } | null = null;

  constructor(private root: ShadowRoot, private scroller: HTMLElement, private body: HTMLElement, private title: string) {
    this.button = h('button', {
      type: 'button', class: 'lucid-explain-btn', hidden: true,
      onmousedown: (e: Event) => e.preventDefault(), // keep the selection
      onclick: () => this.explain(),
    }, 'Explain');
    scroller.append(this.button);

    const check = () => window.setTimeout(() => this.onSelection(), 0);
    body.addEventListener('mouseup', check);
    body.addEventListener('keyup', check);
    scroller.addEventListener('scroll', () => this.placeButton(), { passive: true });
  }

  hasCard(): boolean { return this.card !== null; }
  hasSelection(): boolean { return this.pending !== null; }

  // Called on the 'e' key.
  explain(): void {
    if (!this.pending) return;
    const { text, range } = this.pending;
    this.closeCard();
    this.button.hidden = true;

    const answer = h('div', { class: 'lucid-explain-text' }, h('span', { class: 'lucid-muted' }, 'Thinking…'));
    const card = h('div', { class: 'lucid-explain-card', role: 'dialog', 'aria-label': 'Explanation' },
      h('div', { class: 'lucid-explain-head' },
        h('strong', {}, 'Explain'),
        h('button', { type: 'button', 'aria-label': 'Close', onclick: () => this.closeCard() }, '×'),
      ),
      h('blockquote', { class: 'lucid-explain-quote' }, text.length > 180 ? text.slice(0, 180) + '…' : text),
      answer,
    );
    this.card = card;
    this.scroller.append(card);
    this.positionNear(card, range.getBoundingClientRect(), 8);

    const req: ExplainRequest = { selection: text, context: contextFor(range, this.body), title: this.title, url: location.href };
    const port = chrome.runtime.connect({ name: 'lucid-explain' });
    this.port = port;
    let started = false;
    port.onMessage.addListener((e: ExplainEvent) => {
      if (this.port !== port) return;
      if (e.type === 'text') {
        if (!started) { answer.textContent = ''; started = true; }
        answer.append(e.text);
      } else if (e.type === 'done') {
        port.disconnect();
        this.port = null;
      } else if (e.type === 'error') {
        answer.replaceChildren(h('span', { class: 'lucid-error' }, e.error));
        if (e.needsKey) {
          answer.append(' ', h('button', {
            type: 'button', onclick: () => chrome.runtime.sendMessage({ type: 'lucid:openOptions' }),
          }, 'Open options'));
        }
        port.disconnect();
        this.port = null;
      }
    });
    port.postMessage(req);
  }

  closeCard(): void {
    this.port?.disconnect();
    this.port = null;
    this.card?.remove();
    this.card = null;
  }

  destroy(): void {
    this.closeCard();
  }

  private selection(): Selection | null {
    // Chrome exposes getSelection() on shadow roots; selections inside them
    // aren't visible through document.getSelection().
    const s = (this.root as unknown as { getSelection?: () => Selection | null }).getSelection?.();
    return s ?? document.getSelection();
  }

  private onSelection(): void {
    const sel = this.selection();
    const text = sel?.toString().replace(/\s+/g, ' ').trim() ?? '';
    if (!sel || sel.rangeCount === 0 || !text || text.length > MAX_SELECTION) {
      this.pending = null;
      this.button.hidden = true;
      return;
    }
    const range = sel.getRangeAt(0);
    if (!this.body.contains(range.commonAncestorContainer)) {
      this.pending = null;
      this.button.hidden = true;
      return;
    }
    this.pending = { text, range: range.cloneRange() };
    this.button.hidden = false;
    this.placeButton();
  }

  private placeButton(): void {
    if (!this.pending || this.button.hidden) return;
    const r = this.pending.range.getBoundingClientRect();
    this.button.style.top = `${Math.max(56, r.top - 36)}px`;
    this.button.style.left = `${Math.max(8, Math.min(window.innerWidth - 90, r.left + r.width / 2 - 36))}px`;
  }

  private positionNear(el: HTMLElement, r: DOMRect, gap: number): void {
    const width = Math.min(420, window.innerWidth - 24);
    el.style.width = `${width}px`;
    el.style.left = `${Math.max(12, Math.min(window.innerWidth - width - 12, r.left))}px`;
    const below = r.bottom + gap;
    if (below + 220 < window.innerHeight) el.style.top = `${below}px`;
    else el.style.bottom = `${Math.max(12, window.innerHeight - r.top + gap)}px`;
  }
}

// The block holding the selection, plus its neighbours, as plain text.
function contextFor(range: Range, body: HTMLElement): string {
  const start = range.startContainer instanceof Element ? range.startContainer : range.startContainer.parentElement;
  const block = start?.closest(BLOCK);
  if (!block || !body.contains(block)) return (range.commonAncestorContainer.textContent ?? '').slice(0, MAX_CONTEXT);
  const all = [...body.querySelectorAll(BLOCK)];
  const i = all.indexOf(block);
  const parts = [all[i - 1], block, all[i + 1]].filter(Boolean).map((el) => (el!.textContent ?? '').trim());
  return parts.join('\n\n').slice(0, MAX_CONTEXT);
}
