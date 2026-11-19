// Deliberately plain. Visual polish comes after the test version works.
export const READER_CSS = `
:host { all: initial; }
.lucid-scroller {
  --bg: #fbfaf7; --fg: #1d1d1f; --muted: #6b6b6b; --line: #e5e2da; --link: #1a5fb4; --code: #f0eee8;
  position: fixed; inset: 0; overflow-y: auto; outline: none;
  background: var(--bg); color: var(--fg);
}
.lucid-scroller[data-theme="sepia"] { --bg: #f4ecd8; --fg: #3b2f1e; --muted: #7a6a52; --line: #e0d3b5; --link: #8a4b0f; --code: #ebe0c6; }
.lucid-scroller[data-theme="dark"]  { --bg: #18191b; --fg: #dcdcdc; --muted: #9a9a9a; --line: #2e3033; --link: #8ab4f8; --code: #25272a; }

.lucid-bar {
  position: sticky; top: 0; z-index: 2; display: flex; gap: 8px; align-items: center;
  padding: 8px 16px; background: var(--bg); border-bottom: 1px solid var(--line);
  font: 14px system-ui, sans-serif; color: var(--fg);
}
.lucid-spacer { flex: 1; }
.lucid-bar button, .lucid-bar select, .lucid-panel button, .lucid-panel input[type=text] {
  font: inherit; padding: 4px 10px; cursor: pointer;
}
.lucid-panel {
  position: fixed; top: 48px; left: 16px; z-index: 3; width: 340px; max-height: calc(100vh - 64px); overflow-y: auto;
  padding: 12px 14px; background: var(--bg); color: var(--fg); border: 1px solid var(--line);
  box-shadow: 0 6px 24px rgba(0,0,0,.18); font: 13px system-ui, sans-serif;
}
.lucid-panel[hidden] { display: none; }
.lucid-row { display: flex; align-items: center; gap: 8px; margin: 8px 0; }
.lucid-row > span:first-child { width: 96px; flex: none; }
.lucid-row input[type=range] { flex: 1; }
.lucid-row output { width: 48px; text-align: right; font-variant-numeric: tabular-nums; }
.lucid-choices { display: flex; gap: 4px; }
.lucid-choices button.on { font-weight: 700; outline: 2px solid var(--link); }
.lucid-actions { flex-wrap: wrap; }
.lucid-actions .lucid-name { flex: 1; min-width: 0; }
.lucid-check > span:last-child { width: auto; }
.lucid-row select { flex: 1; font: inherit; padding: 3px; }
.lucid-check { cursor: pointer; }
.lucid-note { color: var(--muted); margin: 8px 0 0; }
.lucid-danger { color: #b00020; }
.lucid-panel hr { border: 0; border-top: 1px solid var(--line); margin: 12px 0; }

.lucid-article {
  max-width: var(--lucid-width, 680px); margin: 0 auto; padding: 32px 20px 45vh;
  font-family: var(--lucid-font); font-size: var(--lucid-size, 20px); line-height: var(--lucid-lh, 1.6);
  letter-spacing: var(--lucid-ls, 0); word-spacing: var(--lucid-ws, 0);
}
.lucid-title { font-size: 2em; line-height: 1.2; margin: 0 0 8px; }
.lucid-meta { color: var(--muted); font-size: 0.8em; margin: 0 0 32px; font-family: system-ui, sans-serif; }
.lucid-body img, .lucid-body video, .lucid-body svg, .lucid-body iframe { max-width: 100%; height: auto; }
.lucid-body figure { margin: 1.5em 0; }
.lucid-body figcaption { font-size: 0.8em; color: var(--muted); }
.lucid-body pre { overflow-x: auto; font-size: 0.8em; background: var(--code); padding: 12px; line-height: 1.45; }
.lucid-body code { font-size: 0.9em; }
.lucid-body blockquote { margin: 1em 0; padding-left: 1em; border-left: 3px solid var(--line); color: var(--muted); }
.lucid-body table { border-collapse: collapse; display: block; overflow-x: auto; font-size: 0.85em; }
.lucid-body td, .lucid-body th { border: 1px solid var(--line); padding: 4px 8px; }
.lucid-body a { color: var(--link); }

/* Progress + article map */
.lucid-progress { position: sticky; top: 45px; z-index: 2; height: 3px; background: var(--line); }
.lucid-progress-fill { height: 100%; width: 0; background: var(--link); }
.lucid-map {
  position: fixed; top: 56px; right: 16px; z-index: 3; width: 280px; max-height: calc(100vh - 72px); overflow-y: auto;
  padding: 10px 12px; background: var(--bg); color: var(--fg); border: 1px solid var(--line);
  box-shadow: 0 6px 24px rgba(0,0,0,.18); font: 13px/1.35 system-ui, sans-serif;
}
.lucid-map[hidden] { display: none; }
.lucid-map-head { display: flex; justify-content: space-between; margin-bottom: 6px; }
.lucid-map-pct { color: var(--muted); }
.lucid-map ol { list-style: none; margin: 0; padding: 0; }
.lucid-map button { all: unset; display: block; width: 100%; box-sizing: border-box; padding: 4px 6px; cursor: pointer; border-left: 3px solid transparent; }
.lucid-map button:hover, .lucid-map button:focus-visible { background: var(--code); }
.lucid-map li.on > button { border-left-color: var(--link); font-weight: 600; }
.lucid-map-l3 button { padding-left: 18px; }
.lucid-map-l4 button { padding-left: 30px; font-size: 12px; }

/* Resume toast */
.lucid-toast {
  position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%); z-index: 4;
  display: flex; gap: 10px; align-items: center; padding: 8px 12px;
  background: var(--fg); color: var(--bg); font: 13px system-ui, sans-serif; box-shadow: 0 4px 16px rgba(0,0,0,.25);
}
.lucid-toast button { font: inherit; cursor: pointer; }

/* Explain selection */
.lucid-explain-btn {
  position: fixed; z-index: 5; font: 13px system-ui, sans-serif; padding: 5px 12px; cursor: pointer;
  background: var(--fg); color: var(--bg); border: 0; box-shadow: 0 2px 10px rgba(0,0,0,.25);
}
.lucid-explain-btn[hidden] { display: none; }
.lucid-explain-card {
  position: fixed; z-index: 5; max-height: 50vh; overflow-y: auto; box-sizing: border-box; padding: 10px 14px 14px;
  background: var(--bg); color: var(--fg); border: 1px solid var(--line); box-shadow: 0 8px 28px rgba(0,0,0,.22);
  font: 14px/1.5 system-ui, sans-serif;
}
.lucid-explain-head { display: flex; justify-content: space-between; align-items: center; }
.lucid-explain-head button { all: unset; cursor: pointer; font-size: 18px; padding: 0 4px; }
.lucid-explain-quote { margin: 6px 0 10px; padding-left: 8px; border-left: 3px solid var(--line); color: var(--muted); font-style: italic; }
.lucid-explain-text { white-space: pre-wrap; }
.lucid-muted { color: var(--muted); }
.lucid-error { color: #b00020; }

/* Word anchors: wrapped once, styled only while on. */
.lucid-anchor { font-weight: inherit; }
.lucid-anchors-on .lucid-anchor { font-weight: 700; }

/* Paragraph focus */
.lucid-focus-on .lucid-block { opacity: .28; transition: opacity .18s ease; }
.lucid-focus-on .lucid-block.lucid-focused { opacity: 1; }
`;
