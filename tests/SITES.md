# Real-site test list

Load the build, open each page, press Alt+Shift+R, and check the items below.
Note anything that breaks in the project thread with the URL.

| # | Kind | Example page |
|---|------|--------------|
| 1 | Encyclopedia | https://en.wikipedia.org/wiki/Speed_reading |
| 2 | Dev docs | https://developer.mozilla.org/en-US/docs/Web/API/Web_components/Using_shadow_DOM |
| 3 | Language docs | https://docs.python.org/3/tutorial/classes.html |
| 4 | Essay | https://paulgraham.com/greatwork.html |
| 5 | README | https://github.com/mozilla/readability |
| 6 | News | any article on bbc.com/news |
| 7 | News | any article on theguardian.com |
| 8 | Tech news | any article on arstechnica.com |
| 9 | Tech news | any article on theverge.com |
| 10 | Medium | any post on medium.com |
| 11 | Substack | any post on a Substack newsletter |
| 12 | Long essay | any essay on aeon.co |
| 13 | Tutorial | any article on smashingmagazine.com |
| 14 | Personal blog | https://overreacted.io/a-complete-guide-to-useeffect/ |
| 15 | Not an article | https://www.google.com (should say it couldn't find an article) |

Checks per page:

- Title, byline and the full body are there; no nav, ads, or "related" blocks.
- Images, code blocks and tables show and fit the column.
- Switching presets (popup or top bar) restyles instantly; Aa sliders work.
- Word anchors and paragraph focus (j / k) behave.
- Map lists the sections and jumps; progress bar moves.
- Close, reopen: you land where you were.
- Select a sentence, press e: an explanation streams in (needs your key).
- Esc closes the card first, then the reader; the page is back where it was.

Automated checks (`npm test`) cover a fixture article, a hostile page (paywall
overlay, aggressive CSS, lazy images, wheel and key hijacking) and a
non-article page. Real sites can't be fetched from the build sandbox.
Wikipedia was spot-checked in a real browser: Readability extracted the full
article (20.8k of 22.1k visible characters) with the correct title.
