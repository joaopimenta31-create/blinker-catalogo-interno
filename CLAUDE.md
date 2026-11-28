# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Internal Blinker product catalogue: a static, framework-free web app (UI text and most error messages in European Portuguese) deployed on Vercel (`vercel.json`: `node build.cjs` → `public/`).

## Commands

There is no `package.json`, dependency install or linter. Plain Node is enough.

```powershell
node build.cjs
```

```powershell
node --test frontend/pesquisa/search-core.test.cjs
```

Add `--test-name-pattern "brands"` before the file to run a single test.

- **`public/` must not exist before a build.** A second build over an old one fails in `catalog-build.cjs` (`Cannot read properties of undefined (reading 'flatMap')`), because the generated `catalogs/1hourtec/index.json` has `pages` instead of `page_files`. The failed run also leaves `public/` half overwritten, so don't inspect it afterwards.
- A full build takes about a minute. To preview, serve `public/` with any static server.
- Apart from the quick-search tests above, tests are assertions inside the build steps; a throw fails the build. To run the checks up to one stage, run that stage on a clean tree (e.g. `node catalog-search-build.cjs`): its `require` chain runs every earlier step first. The exceptions are the helpers a stage pulls in (`add-suggestions`, `hourtec`, `multi-search`, `stable-search`, `associate`, `coverage-*`), which don't build their prerequisites. `search-navigation-build.cjs` only does its work when run as the main script, and it, `wahlen-build.cjs`, `word-suggestions-build.cjs` and `pwa-build.cjs` need an already built `public/`.

## Architecture

### The base app lives in archives

`index.html`, `catalog.js`, product data, catalogue page images and documents are **not** loose files in the repo. They are inside `package-000.tgz` … `package-NNN.tgz`, which `catalog-build.cjs` unpacks into `public/` with its own tar reader, in filename order, so **a later archive overrides an earlier one** (`index.html` appears in many). `assets/` is then copied over the top. To see the real base HTML or data, build and read `public/`, or unpack the archives. To change data, add the next numbered archive (3-digit padding, paths relative to the `public/` root) or add a build step.

### The build is a linear chain of in-place patches

Each step `require`s its predecessor, then rewrites files in `public/` (mostly `index.html`) by exact string or regex replacement. Execution order:

1. `catalog-build` (unpack, validate page images, add `?v=` hashes to scripts)
2. `base-build` (+ `add-suggestions`) → `hourtec` → `multi-search` → `before-compare` (quick view, customer view, `associate`, `coverage-build` → `coverage-report`)
3. `before-favorites` (compare) → `original-build` (favourites, search thumbnails, `stable-search`)
4. `search-previous-build` → `catalog-search-build` → `customer-price-build` → `proposal-build` → `catalog-before-layout`
5. `search-layout` → `footer-layout` → `filter-layout` → `select-sizing` → `previous-build`
6. From `build.cjs`: `search-navigation-build` → `wahlen-build` → `word-suggestions-build` → `pwa-build` → `quick-page-build`

File names such as `previous-`, `original-` and `before-*` are historical; all of them are live stages.

Consequences when editing:

- **Source text is an API.** Later steps match literal snippets of earlier output, including minified code from the archived HTML and the whole contents of `compare.js`. Changing a runtime `.js` file or an injected string can break a marker several steps later; search the `.cjs` files for the text you are changing.
- Some markers must occur exactly once (`split(...).length === 2`).
- Add new behaviour as a new step at the end of the chain rather than editing the archived HTML.
- Several steps execute the generated code in `node:vm` against the real product data and assert specific references and result counts (e.g. 438 for `1hourtec`). Data changes can require updating those assertions.
- A step that changes a script in `public/` must also update its `?v=` query in `index.html`. `product-documents.js` uses literal version strings that `associate.cjs` and `coverage-build.cjs` replace in sequence.
- `catalog-build.cjs` hard-requires `data/prices-2026-11-11.json`.

### Which search code actually ships

Search has been replaced in layers, and the earlier layers still run at build time:

- **Engine:** `strict-engine.js` is written over `public/search-engine.js` by `stable-search.cjs`. This discards `multi-search.cjs`'s edits to the engine, so synonyms and ranking changes belong in `strict-engine.js` (`multi-search.cjs`'s edits to `index.html` and `catalog.js` remain).
- **Suggestions UI:** `navigation.js`. `search-navigation-build.cjs` removes the inline picker built by `add-suggestions.cjs` / `stable-picker.js` and patched by `base-build`, `search-previous-build` and `catalog-search-build`, along with the latter's reference-number ranking. Editing those has no visible effect, though their markers and assertions must still pass. `pesquisa-blinker.cjs` now matters only to those intermediate steps.
- **Brands:** 1HOURTEC (`hourtec.cjs`, `hourtec-pages.json`, `multi-search.cjs`) and Wählen (`wahlen-build.cjs`, `wahlen-references.json`) are special-cased in the search loop. `word-suggestions.js` is both the build-time vocabulary builder and the browser script.

### Product search the user sees

The search on the main page has real source files in `frontend/pesquisa/`. Edit those directly; no patching is involved. `search-core.js` holds the behaviour (fallback when words don't match, typo correction, subfamily steps read from product names and catalogue sections, filters, brand terms; a product joins a subfamily only if its name or section says so, never by deduction; `tabelas-anilhas.json` holds washer catalogue tables transcribed by hand from the page images, one value per cell, empty when the catalogue has none) on top of `strict-engine.js`; `page.js` is the DOM layer. `quick-page-build.cjs`, the last step, appends them to `index.html`. Its brand patterns duplicate those in `multi-search.cjs` and `wahlen-build.cjs`; change them together.

The older search interface is still built and loaded but hidden by `page.css`: its input, suggestions (`navigation.js`), result cards, compare (`compare.js`) and shortcuts (`quick-view.js`). The older steps' assertions and other features depend on it, so it was not removed. Changing it has no visible effect. `page.js` does reuse its filter `<select>`s (replacing their handlers) and opens product sheets with the global `detail()`.

### Runtime

Feature files (`quick-view`, `customer-view`, `compare`, `favorites`, `proposta`) are vanilla JS/CSS that hook into globals from the base page (`PRODUCTS`, `search()`, `cachedResults`, `detail()`, `BlinkSearch`) and DOM events such as `product-results-ready`. Most are inlined into `index.html`; `proposta`, `navigation` and `word-suggestions` ship as separate files. Product rows are arrays beginning `[reference, name, price, …]`. Favourites, recents and quotes persist in `localStorage` (`blinker-*-v1` keys).

`.b64` files are build inputs: `matches.b64` is gzipped JSON linking references to catalogue pages; `customer-045169.b64` is an image.

## Content rules

- Do not infer or invent prices, product characteristics, exact equivalences or certifications; the data is only what source documents support.
- Promotion, tariff and discount catalogues are excluded as product presentation sources, and records marked `rejected_misattribution` stay excluded.
