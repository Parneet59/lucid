import { h } from './dom';
import { readingBlocks } from './aids';

// ---------- Article map ----------

export class ArticleMap {
  readonly el: HTMLElement;
  readonly progress: HTMLElement;
  private headings: HTMLElement[];
  private items: HTMLElement[] = [];
  private raf = 0;

  constructor(private scroller: HTMLElement, body: HTMLElement, title: string) {
    this.headings = [...body.querySelectorAll<HTMLElement>('h2, h3, h4')].filter((el) => (el.textContent ?? '').trim());
    this.progress = h('div', { class: 'lucid-progress' }, h('div', { class: 'lucid-progress-fill' }));
    this.el = h('nav', { class: 'lucid-map', hidden: true, 'aria-label': 'Article map' });

    const list = h('ol');
    const top = this.item(title, 2, () => this.scroller.scrollTo({ top: 0, behavior: 'smooth' }));
    list.append(top);
    this.items.push(top);
    for (const hd of this.headings) {
      const level = Number(hd.tagName[1]);
      const li = this.item((hd.textContent ?? '').trim(), level, () => this.scrollTo(hd));
      list.append(li);
      this.items.push(li);
    }
    this.el.append(
      h('div', { class: 'lucid-map-head' }, h('strong', {}, 'Article map'), h('span', { class: 'lucid-map-pct' })),
      this.headings.length ? list : h('p', { class: 'lucid-note' }, 'No sections in this article.'),
    );

    scroller.addEventListener('scroll', () => this.schedule(), { passive: true });
    this.update();
  }

  toggle(force?: boolean): void {
    this.el.hidden = force === undefined ? !this.el.hidden : !force;
  }

  isOpen(): boolean { return !this.el.hidden; }

  private item(text: string, level: number, go: () => void): HTMLElement {
    return h('li', { class: `lucid-map-l${level}` }, h('button', { type: 'button', onclick: go }, text));
  }

  private scrollTo(el: HTMLElement): void {
    const top = el.getBoundingClientRect().top - this.scroller.getBoundingClientRect().top + this.scroller.scrollTop - 64;
    this.scroller.scrollTo({ top, behavior: 'smooth' });
  }

  private schedule(): void {
    if (this.raf) return;
    this.raf = requestAnimationFrame(() => { this.raf = 0; this.update(); });
  }

  private update(): void {
    const s = this.scroller;
    const max = Math.max(1, s.scrollHeight - s.clientHeight);
    const pct = Math.min(100, Math.round((s.scrollTop / max) * 100));
    (this.progress.firstChild as HTMLElement).style.width = `${pct}%`;
    const pctEl = this.el.querySelector('.lucid-map-pct');
    if (pctEl) pctEl.textContent = `${pct}% read`;

    // Current section = last heading above the top third of the screen.
    const line = s.getBoundingClientRect().top + s.clientHeight / 3;
    let current = 0;
    this.headings.forEach((hd, i) => { if (hd.getBoundingClientRect().top <= line) current = i + 1; });
    this.items.forEach((li, i) => li.classList.toggle('on', i === current));
  }
}

// ---------- Resume reading position ----------

interface Position {
  block: number;   // index of the block at the top of the screen
  offset: number;  // how far into that block (0..1)
  pct: number;     // overall progress, for display
  at: number;      // timestamp
}

const KEY = 'positions';
const MAX_ENTRIES = 300;

// Same article regardless of hash or tracking params.
export function articleKey(loc: Location = location): string {
  const u = new URL(loc.href);
  u.hash = '';
  for (const p of [...u.searchParams.keys()]) {
    if (/^(utm_|fbclid|gclid|mc_|ref$|ref_src|smid|cmpid)/i.test(p)) u.searchParams.delete(p);
  }
  return u.toString();
}

async function loadAll(): Promise<Record<string, Position>> {
  return ((await chrome.storage.local.get(KEY))[KEY] as Record<string, Position>) ?? {};
}

export class ResumeTracker {
  private blocks: HTMLElement[];
  private timer = 0;
  private key = articleKey();

  constructor(private scroller: HTMLElement, body: HTMLElement) {
    this.blocks = readingBlocks(body);
    scroller.addEventListener('scroll', () => this.scheduleSave(), { passive: true });
  }

  // Returns the saved progress (0-100) if we jumped there, or null.
  async restore(): Promise<number | null> {
    const pos = (await loadAll())[this.key];
    if (!pos || pos.pct < 3 || pos.pct > 97) return null;
    const el = this.blocks[pos.block];
    if (!el) return null;
    const sTop = this.scroller.getBoundingClientRect().top;
    const r = el.getBoundingClientRect();
    this.scroller.scrollTop += r.top - sTop + r.height * pos.offset - 56;
    return pos.pct;
  }

  async forget(): Promise<void> {
    const all = await loadAll();
    delete all[this.key];
    await chrome.storage.local.set({ [KEY]: all });
  }

  saveNow(): void {
    window.clearTimeout(this.timer);
    this.timer = 0;
    void this.save();
  }

  private scheduleSave(): void {
    if (this.timer) return;
    this.timer = window.setTimeout(() => { this.timer = 0; void this.save(); }, 800);
  }

  private async save(): Promise<void> {
    const s = this.scroller;
    if (!s.isConnected || !this.blocks.length) return;
    const line = s.getBoundingClientRect().top + 56;
    let block = 0;
    for (let i = 0; i < this.blocks.length; i++) {
      if (this.blocks[i].getBoundingClientRect().bottom > line) { block = i; break; }
    }
    const r = this.blocks[block].getBoundingClientRect();
    const offset = r.height ? Math.max(0, Math.min(1, (line - r.top) / r.height)) : 0;
    const max = Math.max(1, s.scrollHeight - s.clientHeight);
    const pct = Math.round((s.scrollTop / max) * 100);

    const all = await loadAll();
    all[this.key] = { block, offset, pct, at: Date.now() };
    const keys = Object.keys(all);
    if (keys.length > MAX_ENTRIES) {
      keys.sort((a, b) => all[a].at - all[b].at).slice(0, keys.length - MAX_ENTRIES).forEach((k) => delete all[k]);
    }
    await chrome.storage.local.set({ [KEY]: all });
  }
}
