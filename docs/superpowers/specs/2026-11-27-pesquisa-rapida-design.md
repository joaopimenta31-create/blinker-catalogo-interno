# Quick-search page for phone and tablet

## Context

You use the catalogue on a phone or tablet, with a customer, to get a reference number fast, by typing in search. Today the home screen is full of buttons, results show twice (dropdown over list), cards squeeze names into a narrow column, and every word must match, so `parafuso inox m8 20`, `limpa travões spray` and `copper paste` return nothing while `parafuso` returns 888.

**Outcome:** a separate page, `/pesquisa.html`, where you type, narrow and copy a reference. The current app stays at `/`.

## Approaches considered

| Approach | Trade-off |
|---|---|
| **New search page (chosen by you)** | Clean layout, low risk; two screens until the old one is retired |
| Restyle current screen | One screen, but more patches on a fragile chain |
| Fix results only | Smallest, but layout stays confusing |

## What the page does

- **One search box**, one result list, no dropdown. 30 results, then "Mostrar mais".
- **Compact rows:** thumbnail, full-width name, large reference, "Copiar" button, PVP sem IVA in smaller text. Tapping the row opens the existing product sheet (`./#ficha/REF`, already works).
- **Narrowing chips** for size, colour and material, taken only from words in the result names, shown only when they split the list.
- **No empty screen:** if nothing matches, leave out one word (then two) and say so plainly: *Sem resultados para tudo. A mostrar sem "spray".* Never drop a reference number.
- **Typos:** when a misspelled word has one clear correction, search the corrected word and say so.
- **Thumbnail tap** shows the catalogue page full screen, to confirm with the customer.
- Links both ways: "Catálogo completo" on the new page, "Pesquisa rápida" on the old one.

**Not included:** quotes, comparison, favourites (stay in the old app); offline use; changing the app's start page.

**My calls, correct if wrong:** UI in Portuguese; price visible as in your sketch; the only new synonym is `paste` → massa/pasta. Words like `desbloqueante` or `tira cola` need your list of what they should match, and no brand equivalences (e.g. `wd40`) are invented.

## Implementation

New source files in `frontend/pesquisa/` (plain JS/CSS, no dependencies):

- `search-core.js`: pure logic (search, fallback, typo correction, chips). Calls `BlinkSearch.createIndex / prepareQuery / rank / tokens` from [strict-engine.js](strict-engine.js); the fallback ranks with a subset of `query.units`, so the engine itself is unchanged. Handles the 1HOURTEC and Wählen terms with the same patterns as `multi-search.cjs` and `wahlen-build.cjs`, using `hourtec-pages.json` and `wahlen-references.json`.
- `page.js`, `page.css`: rendering, copy (with a fallback when the clipboard is unavailable), page viewer, loading state while the index builds.
- `page.html`: template.
- `search-core.test.cjs`: `node:test` tests.

New build step `quick-page-build.cjs`, required last in [build.cjs](build.cjs):

- Writes `public/pesquisa.html` with the same versioned product and `media-*` script tags found in `public/index.html`, plus `search-engine.js` and the new files (with `?v=` hashes).
- Carries over the extra products pushed inline in `index.html` (same regex as `coverage-report.cjs`) and the `searchPhotos` map from `original-build.cjs`. Thumbnails otherwise come from `CATALOG_MEDIA` page images, as in `catalog.js`.
- Adds the "Pesquisa rápida" link to `index.html`.
- Does not link the PWA manifest, so "Add to home screen" saves this page.
- Asserts sample queries against the real data.

Also: add `paste` to the massa group in `strict-engine.js`, add `public/` to `.gitignore`, update `CLAUDE.md`.

## Order of work

1. Save this as `docs/superpowers/specs/YYYY-MM-DD-pesquisa-rapida-design.md`, then break it into tasks (writing-plans). Work on a branch.
2. `search-core.js`, test first.
3. Page and build step.
4. `paste` synonym, `.gitignore`, `CLAUDE.md`.
5. Verify.

## Verification

- `node --test frontend/pesquisa/search-core.test.cjs`
- `node build.cjs` on a clean tree: all existing assertions still pass.
- Serve `public/` locally and check in the browser at phone (375×812) and tablet (768×1024) sizes: the six queries above plus a reference code; chips; copy; page viewer; product sheet link; links between the two pages; no console errors.
- Then you try it on your own phone from a preview deployment (deploying only when you ask).
