import { Readability, isProbablyReaderable } from '@mozilla/readability';

export interface Article {
  title: string;
  byline: string | null;
  siteName: string | null;
  contentHtml: string;
  length: number;
}

// Runs Readability on a clone so the live page is never modified.
export function extractArticle(doc: Document = document): Article | null {
  const clone = doc.cloneNode(true) as Document;
  const parsed = new Readability(clone, { keepClasses: false }).parse();
  if (!parsed || !parsed.content || (parsed.textContent ?? '').trim().length < 200) return null;
  return {
    title: cleanTitle(parsed.title || doc.title, doc),
    byline: parsed.byline ?? null,
    siteName: parsed.siteName ?? null,
    contentHtml: parsed.content,
    length: parsed.length ?? 0,
  };
}

export function looksReadable(doc: Document = document): boolean {
  return isProbablyReaderable(doc);
}

// Page titles often carry a site suffix ("Story | Site"). Prefer the page's own
// <h1> when the title contains it.
function cleanTitle(title: string, doc: Document): string {
  for (const h1 of doc.querySelectorAll('h1')) {
    const text = (h1.textContent ?? '').trim().replace(/\s+/g, ' ');
    if (text.length >= 8 && title.includes(text)) return text;
  }
  return title;
}
