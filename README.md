# Lucid

A calmer way to read the web. Chrome extension, Manifest V3.

This is the test version: function first, looks later.

## Load it in Chrome

1. Install Node 20+ and run:
   ```sh
   npm install
   npm run build
   ```
2. Open `chrome://extensions`, turn on **Developer mode** (top right).
3. Click **Load unpacked** and pick the `dist/` folder.
4. Pin Lucid from the puzzle-piece menu so the icon is always visible.

After pulling new changes, run `npm run build` again and click the reload arrow on the Lucid card in `chrome://extensions`. `npm run watch` rebuilds on every save.

## Use it

- Open an article, click the Lucid icon, then **Open reader**. Or press **Alt+Shift+R**.
- **Esc** or **Close reader** returns to the page where you left it.
- Lucid only runs on the tab you invoke it on. Browser pages (`chrome://`, the Web Store) are off-limits.

## Develop

| Command | What it does |
| --- | --- |
| `npm run build` | Builds into `dist/` |
| `npm run watch` | Rebuilds on save |
| `npm run typecheck` | TypeScript check |
| `npm test` | Builds, then loads the extension in headless Chromium against a fixture article |

Layout: `src/background` (service worker, shortcut), `src/content` (article extraction with Mozilla Readability, reader overlay in a shadow root), `src/popup`, `src/shared`, `static/` (manifest and HTML, copied as-is).

## Roadmap for the test version

1. Skeleton: reader view from the icon, bare popup ← **this**
2. Presets and typography: font, size, line height, width, theme; default preset; per-site rule
3. Reading aids: dyslexia preset, word anchors (off by default), paragraph focus
4. Navigation: article map, resume where you left off
5. Explain selection with your own API key (Claude first, swappable)
6. Test pass on ~15 real sites
