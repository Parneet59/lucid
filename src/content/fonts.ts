// @font-face doesn't work inside a shadow root, so declare the reader fonts on
// the page itself (unique family names so we never clash with the site).
const FAMILIES: [family: string, file: string][] = [
  ['Lucid Atkinson Hyperlegible', 'atkinson-hyperlegible'],
  ['Lucid OpenDyslexic', 'opendyslexic'],
];

export function ensureFonts(): void {
  if (document.getElementById('lucid-fonts')) return;
  const url = (f: string) => chrome.runtime.getURL(`fonts/${f}.woff2`);
  const css = FAMILIES.flatMap(([family, file]) => [
    `@font-face{font-family:'${family}';font-weight:400;font-style:normal;font-display:swap;src:url(${url(`${file}-latin-400-normal`)}) format('woff2')}`,
    `@font-face{font-family:'${family}';font-weight:700;font-style:normal;font-display:swap;src:url(${url(`${file}-latin-700-normal`)}) format('woff2')}`,
    `@font-face{font-family:'${family}';font-weight:400;font-style:italic;font-display:swap;src:url(${url(`${file}-latin-400-italic`)}) format('woff2')}`,
  ]).join('\n');
  const style = document.createElement('style');
  style.id = 'lucid-fonts';
  style.textContent = css;
  (document.head ?? document.documentElement).appendChild(style);
}
