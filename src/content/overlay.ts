import type { Article } from './extract';
import { READER_CSS } from './styles';

const HOST_ID = 'lucid-reader-host';

let host: HTMLElement | null = null;
let savedOverflow = '';
let savedScrollY = 0;

export function isOpen(): boolean {
  return host !== null && host.isConnected;
}

export function openOverlay(article: Article): void {
  if (isOpen()) return;

  savedScrollY = window.scrollY;
  savedOverflow = document.documentElement.style.overflow;

  host = document.createElement('div');
  host.id = HOST_ID;
  // The host sits above the page; everything inside lives in a shadow root
  // so page CSS can't leak in and ours can't leak out.
  host.style.cssText = 'all: initial; position: fixed; inset: 0; z-index: 2147483647;';
  const root = host.attachShadow({ mode: 'open' });

  const style = document.createElement('style');
  style.textContent = READER_CSS;
  root.appendChild(style);

  const scroller = document.createElement('div');
  scroller.className = 'lucid-scroller';
  scroller.tabIndex = -1;

  const bar = document.createElement('div');
  bar.className = 'lucid-bar';
  const closeBtn = document.createElement('button');
  closeBtn.className = 'lucid-close';
  closeBtn.type = 'button';
  closeBtn.textContent = 'Close reader (Esc)';
  closeBtn.addEventListener('click', closeOverlay);
  bar.appendChild(closeBtn);

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

  scroller.append(bar, articleEl);
  root.appendChild(scroller);

  document.documentElement.appendChild(host);
  document.documentElement.style.overflow = 'hidden';
  document.addEventListener('keydown', onKeyDown, true);
  scroller.focus({ preventScroll: true });
}

export function closeOverlay(): void {
  if (!host) return;
  host.remove();
  host = null;
  document.documentElement.style.overflow = savedOverflow;
  document.removeEventListener('keydown', onKeyDown, true);
  window.scrollTo(0, savedScrollY);
}

function onKeyDown(e: KeyboardEvent): void {
  if (e.key === 'Escape') {
    e.stopPropagation();
    closeOverlay();
  }
}

function hardenLinks(root: HTMLElement): void {
  for (const a of root.querySelectorAll('a[href]')) {
    a.setAttribute('target', '_blank');
    a.setAttribute('rel', 'noopener noreferrer');
  }
  // Drop leftover inline handlers just in case.
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
