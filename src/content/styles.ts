// Deliberately plain. Visual polish comes after the test version works.
export const READER_CSS = `
:host { all: initial; }
.lucid-scroller {
  position: fixed; inset: 0; overflow-y: auto; outline: none;
  background: #fbfaf7; color: #1d1d1f;
  font-family: Georgia, 'Times New Roman', serif;
  font-size: 20px; line-height: 1.6;
}
.lucid-bar {
  position: sticky; top: 0; display: flex; justify-content: flex-end;
  padding: 8px 16px; background: inherit; border-bottom: 1px solid #e5e2da;
  font-family: system-ui, sans-serif; font-size: 14px;
}
.lucid-close { font: inherit; padding: 4px 10px; cursor: pointer; }
.lucid-article { max-width: 680px; margin: 0 auto; padding: 32px 20px 120px; }
.lucid-title { font-size: 2em; line-height: 1.2; margin: 0 0 8px; }
.lucid-meta { color: #6b6b6b; font-size: 0.8em; margin: 0 0 32px; font-family: system-ui, sans-serif; }
.lucid-body img, .lucid-body video, .lucid-body svg, .lucid-body iframe { max-width: 100%; height: auto; }
.lucid-body figure { margin: 1.5em 0; }
.lucid-body figcaption { font-size: 0.8em; color: #6b6b6b; }
.lucid-body pre { overflow-x: auto; font-size: 0.8em; background: #f0eee8; padding: 12px; }
.lucid-body code { font-size: 0.9em; }
.lucid-body blockquote { margin: 1em 0; padding-left: 1em; border-left: 3px solid #d8d4c8; color: #444; }
.lucid-body table { border-collapse: collapse; display: block; overflow-x: auto; font-size: 0.85em; }
.lucid-body td, .lucid-body th { border: 1px solid #ddd; padding: 4px 8px; }
.lucid-body a { color: #1a5fb4; }
`;
