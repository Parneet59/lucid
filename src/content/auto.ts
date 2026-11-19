// Registered only for sites where the user turned on "open automatically".
// Opens the reader once the page looks like an article.
import { looksReadable } from './extract';
import { install, open } from './index';

if (install() && looksReadable()) {
  open().catch((err) => console.warn('[Lucid] auto-open failed', err));
}
