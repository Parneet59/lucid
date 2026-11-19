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

### Explain selection (bring your own API key)

1. Open Lucid **Options** (link at the bottom of the popup, or right-click the icon → Options).
2. Paste an Anthropic API key from https://console.anthropic.com/settings/keys, pick a model (Claude Opus 5.5 by default; Sonnet 5.5 and Haiku 5.5 are cheaper), click **Test key**, then **Save**.
3. In the reader, select a word, phrase or sentence and click **Explain** (or press **e**). The explanation streams into a small card; **Esc** closes it.

The key lives in this browser's extension storage (unencrypted, not synced) and is sent only to Anthropic. Calls go straight from the extension to the API and are billed to your key. Each explanation sends the selection, its paragraph and the neighbouring ones, the article title and URL. If Claude declines a request, the API retries it on a fallback model automatically (server-side fallbacks).

Providers are pluggable: see `src/background/providers/`.

### Navigation

- **Map** (or **m**) opens the article map: every section heading, the one you're in highlighted, and how far through you are. Click a heading to jump.
- A thin progress bar under the top bar shows how far you've read.
- **Resume:** Lucid remembers where you were in each article on this computer. Reopen it and you land back there, with a **Start from the top** option.

### Reading aids (in the Aa panel, saved with presets)

- **Word anchors** bold the first part of each word to guide your eye. Off by default; code blocks are left alone.
- **Paragraph focus** dims everything except the paragraph at the reading line, a third of the way down. Scroll, or press **j** / **k** to step one paragraph at a time.
- **Fonts:** Serif, Sans, Mono, Atkinson Hyperlegible and OpenDyslexic (both bundled, OFL licensed).

### Presets

- **One click:** the popup lists your presets. Clicking one opens the reader with it, or restyles the reader if it's already open. The preset picker in the reader's top bar does the same.
- **Tweak:** click **Aa** in the reader for font, size, line height, width, letter and word spacing, and theme. Changes show live and apply to this page only until you save.
- **Save:** **Save as new** stores your tweaks as a preset. **Update** overwrites one of your own presets (built-ins stay fixed). **Make default** sets the preset every site opens with.
- **Per site:** tick **Always use … on this site** in the Aa panel, or pick a preset under the site's name in the popup.
- **Built-ins:** Classic, Night, Compact, Dyslexia (OpenDyslexic, wider spacing, warm background), Focus (Atkinson Hyperlegible with paragraph focus on), Large print.
- **Auto-open:** in the popup, tick **Open reader automatically** for a site. Chrome asks for permission to run on that site only.

## Develop

| Command | What it does |
| --- | --- |
| `npm run build` | Builds into `dist/` |
| `npm run watch` | Rebuilds on save |
| `npm run typecheck` | TypeScript check |
| `npm test` | Builds, then loads the extension in headless Chromium against a fixture article |

Layout: `src/background` (service worker, shortcut), `src/content` (article extraction with Mozilla Readability, reader overlay in a shadow root, typography controls), `src/shared/settings.ts` (presets and site rules in `chrome.storage.local`), `src/popup`, `src/options`, `src/background/providers` (explain providers), `src/shared`, `static/` (manifest and HTML, copied as-is).

## Roadmap for the test version

1. Skeleton: reader view from the icon, bare popup
2. Presets and typography: font, size, line height, width, theme; default preset; per-site rule
3. Reading aids: dyslexia preset, word anchors (off by default), paragraph focus
4. Navigation: article map, resume where you left off
5. Explain selection with your own API key (Claude first, swappable) ← **this**
6. Test pass on ~15 real sites
