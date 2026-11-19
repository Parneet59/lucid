// Reading aids that work on the rendered article: word anchors and paragraph focus.

const SKIP = new Set(['PRE', 'CODE', 'KBD', 'SAMP', 'SCRIPT', 'STYLE', 'TEXTAREA', 'SVG', 'MATH']);
const WORD = /[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu;

// Wraps the first part of every word in <b class="lucid-anchor">. Done once per
// article; turning anchors off just un-bolds them with CSS.
export function addWordAnchors(root: HTMLElement): void {
  if (root.dataset.anchored) return;
  root.dataset.anchored = '1';
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      for (let el = node.parentElement; el && el !== root; el = el.parentElement) {
        if (SKIP.has(el.tagName.toUpperCase())) return NodeFilter.FILTER_REJECT;
      }
      return /\S/.test(node.nodeValue ?? '') ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
    },
  });
  const nodes: Text[] = [];
  while (walker.nextNode()) nodes.push(walker.currentNode as Text);

  for (const node of nodes) {
    const text = node.nodeValue ?? '';
    const frag = document.createDocumentFragment();
    let last = 0;
    for (const m of text.matchAll(WORD)) {
      const word = m[0];
      const start = m.index ?? 0;
      const n = anchorLength(word);
      if (start > last) frag.append(text.slice(last, start));
      const b = document.createElement('b');
      b.className = 'lucid-anchor';
      b.textContent = word.slice(0, n);
      frag.append(b, word.slice(n));
      last = start + word.length;
    }
    if (last === 0) continue;
    if (last < text.length) frag.append(text.slice(last));
    node.replaceWith(frag);
  }
}

function anchorLength(word: string): number {
  const len = [...word].length;
  if (len <= 3) return 1;
  return Math.ceil(len * 0.4);
}

// ---------- Paragraph focus ----------

const BLOCKS = 'p, li, h1, h2, h3, h4, h5, h6, blockquote, pre, figure, table, dt, dd';

// Leaf-level blocks in reading order (a <li> holding a <p> yields the <p>).
export function readingBlocks(root: HTMLElement): HTMLElement[] {
  const ATOMIC = 'figure, pre, table';
  return [...root.querySelectorAll<HTMLElement>(BLOCKS)].filter((el) => {
    // Inside a figure/pre/table, the whole thing is one block.
    const atomic = el.parentElement?.closest(ATOMIC);
    if (atomic && root.contains(atomic)) return false;
    if (el.matches(ATOMIC)) return true;
    return !el.querySelector(BLOCKS) && (el.textContent ?? '').trim().length > 0;
  });
}

export class ParagraphFocus {
  private blocks: HTMLElement[] = [];
  private index = -1;
  private enabled = false;
  private raf = 0;

  constructor(private scroller: HTMLElement, private body: HTMLElement) {
    scroller.addEventListener('scroll', () => this.schedule(), { passive: true });
    window.addEventListener('resize', () => this.schedule());
  }

  setEnabled(on: boolean): void {
    if (on === this.enabled) return;
    this.enabled = on;
    this.scroller.classList.toggle('lucid-focus-on', on);
    if (on) {
      this.blocks = readingBlocks(this.body);
      for (const b of this.blocks) b.classList.add('lucid-block');
      this.index = -1;
      this.update();
    } else {
      this.current()?.classList.remove('lucid-focused');
      this.index = -1;
    }
  }

  isEnabled(): boolean { return this.enabled; }

  // Move focus one block forward/back and scroll it to the reading line.
  step(delta: number): void {
    if (!this.enabled || !this.blocks.length) return;
    const next = Math.max(0, Math.min(this.blocks.length - 1, (this.index < 0 ? 0 : this.index) + delta));
    this.setIndex(next);
    const el = this.blocks[next];
    const top = el.getBoundingClientRect().top - this.scroller.getBoundingClientRect().top;
    this.scroller.scrollBy({ top: top - this.lineY() + 8, behavior: 'smooth' });
  }

  private current(): HTMLElement | undefined { return this.blocks[this.index]; }

  private lineY(): number { return this.scroller.clientHeight * 0.33; }

  private schedule(): void {
    if (!this.enabled || this.raf) return;
    this.raf = requestAnimationFrame(() => { this.raf = 0; this.update(); });
  }

  // The focused block is the one crossing the reading line (a third down).
  private update(): void {
    const line = this.scroller.getBoundingClientRect().top + this.lineY();
    let best = 0;
    let bestDist = Infinity;
    for (let i = 0; i < this.blocks.length; i++) {
      const r = this.blocks[i].getBoundingClientRect();
      if (r.top <= line && r.bottom >= line) { best = i; bestDist = 0; break; }
      const d = Math.min(Math.abs(r.top - line), Math.abs(r.bottom - line));
      if (d < bestDist) { bestDist = d; best = i; }
    }
    // At the very end, let the last block take focus.
    if (this.scroller.scrollTop + this.scroller.clientHeight >= this.scroller.scrollHeight - 2) {
      best = this.blocks.length - 1;
    }
    this.setIndex(best);
  }

  private setIndex(i: number): void {
    if (i === this.index) return;
    this.current()?.classList.remove('lucid-focused');
    this.index = i;
    this.current()?.classList.add('lucid-focused');
  }
}
