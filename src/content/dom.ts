// Tiny element helper so the UI code stays readable without a framework.
type Attrs = Record<string, string | number | boolean | EventListener | undefined>;

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K, attrs: Attrs = {}, ...children: (Node | string | null | undefined)[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'class') el.className = String(v);
    else if (k in el && typeof v !== 'string') (el as any)[k] = v;
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  for (const c of children) if (c != null) el.append(c);
  return el;
}
