# Pesquisa rápida Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A separate phone/tablet page, `/pesquisa.html`, to type, narrow and copy a product reference.

**Architecture:** Pure search logic in `search-core.js` on top of the existing `BlinkSearch` engine; a small DOM layer; a final build step that generates the page from the data already in `public/`.

**Tech Stack:** Plain JS/CSS/HTML, Node (`node:test`), no dependencies.

**Spec:** `docs/superpowers/specs/2026-11-27-pesquisa-rapida-design.md`

## Global Constraints

- UI text in European Portuguese. No dependencies, no framework.
- 30 results, then "Mostrar mais". Price label "PVP sem IVA"; no price shows "Sob consulta".
- Never invent product data or equivalences. Chips come only from words in result names. Only new synonym: `paste`.
- A left-out or corrected word is always stated on screen. A reference number is never left out.
- The new page does not link the PWA manifest.
- Product text is rendered with `textContent`, never `innerHTML`.
- Commit steps run only if the user has asked for commits.

## Review Focus

1. Reference typed with spaces or dots (`045 143`, `045.143`): same results as `045143`. (Task 1 test)
2. Only stop words or punctuation (`de`, `--`): empty list with a "no results" message, no crash and no fallback. (Task 1 test)
3. Typing before the index is ready: the typed text is searched once ready. (Task 2 browser check)
4. Clipboard unavailable (plain http on a LAN) or refused: the reference is selected and the button says so, never "Copiado". (Task 2 browser check)
5. Names containing `"`, `<`, `&`: shown literally. (Task 2: `textContent` only; browser check with `1/4"`)

---

### Task 1: Search core

**Files:**
- Create: `frontend/pesquisa/search-core.js`, `frontend/pesquisa/search-core.test.cjs`

**Interfaces:**
- Consumes: `BlinkSearch.{createIndex,prepareQuery,rank,normalize,compactReference}` from `strict-engine.js`.
- Produces (UMD: `module.exports` and `globalThis.QuickSearch`):
  - `createSearch(engine, products, brands)`; `brands = {hourtec:string[], wahlen:string[], wahlenMachines:string[]}`; returns `search(text) → {results: product[], ignored: string[], corrected: {from,to}[]}`
  - `facets(results) → [{group:'size'|'colour'|'material', value:string, count:number}]`
  - `applyFacets(results, selected) → product[]`; `selected = {size?:string, colour?:string, material?:string}`

- [ ] **Step 1: Write the failing tests**

```js
const test = require('node:test'), assert = require('node:assert/strict');
require('../../strict-engine.js');
const { createSearch, facets, applyFacets } = require('./search-core.js');
const P = [
  ['045143','LIMPEZA DE TRAVOES BLINKER 750ML',1],
  ['100','PARAFUSO INOX M8X30',1], ['101','PARAFUSO ACO M8X40',null], ['102','PARAFUSO INOX M10X30',1],
  ['200','SILICONE ACETATO PRETO',1], ['201','FITA SILICONE PRETA',1],
  ['300','REBARBADORA WAHLEN 125MM',1], ['301','DISCO CORTE 125MM',1], ['400','POLIDORA ORBITAL',1],
];
const search = createSearch(globalThis.BlinkSearch, P,
  { hourtec: ['400'], wahlen: ['301'], wahlenMachines: ['301'] });
const refs = r => r.results.map(p => p[0]);

test('exact matches need no fallback', () => {
  const r = search('parafuso inox');
  assert.deepEqual(refs(r).sort(), ['100','102']);
  assert.deepEqual([r.ignored, r.corrected], [[], []]);
});
test('leaves out the last unmatched word and reports it', () => {
  const r = search('limpa travoes spray');
  assert.deepEqual([refs(r), r.ignored], [['045143'], ['spray']]);
});
test('leaves out up to two words, not three', () => {
  assert.deepEqual(search('parafuso xxqq zzkk').ignored.sort(), ['xxqq','zzkk']);
  assert.deepEqual(refs(search('parafuso xxqq zzkk wwvv')), []);
});
test('never leaves out a reference number', () => {
  assert.deepEqual(refs(search('parafuso 999999')), []);
});
test('corrects a single clear typo and ranks by the corrected word', () => {
  const r = search('silicome');
  assert.deepEqual(r.corrected, [{from:'silicome', to:'silicone'}]);
  assert.equal(refs(r)[0], '200');
});
test('reference with spaces or dots', () => {
  for (const q of ['045143','045 143','045.143']) assert.deepEqual(refs(search(q)), ['045143']);
});
test('empty, stop words and punctuation', () => {
  for (const q of ['', '  ', 'de', '--']) assert.deepEqual(search(q), {results:[], ignored:[], corrected:[]});
});
test('brands', () => {
  assert.deepEqual(refs(search('1 hour-tec')), ['400']);
  assert.deepEqual(refs(search('whalen')), ['301','300']);
  assert.deepEqual(refs(search('wählen rebarbadora')), ['300']);
});
test('facets come from names, only when they split the list', () => {
  const list = search('parafuso').results, f = facets(list);
  assert.equal(f.find(x => x.value === 'M8').count, 2);
  assert.equal(f.find(x => x.value === 'inox').count, 2);
  assert.ok(!facets(list.filter(p => p[0] !== '101')).some(x => x.value === 'inox'));
  assert.deepEqual(applyFacets(list, {size:'M8', material:'inox'}).map(p => p[0]), ['100']);
});
test('colour forms are one chip', () => {
  assert.ok(!facets(search('silicone').results).some(x => x.group === 'colour'));
  assert.equal(facets([...search('silicone').results, P[7]]).find(x => x.value === 'preto').count, 2);
});
```

- [ ] **Step 2:** Run `node --test frontend/pesquisa/search-core.test.cjs`. Expected: FAIL, cannot find `./search-core.js`.
- [ ] **Step 3: Implement.** Decisions:
  - Brand patterns, copied from `multi-search.cjs` and `wahlen-build.cjs`: `/\b1[\s-]*hou(?:r)?[\s-]*tec\b/i`; `/\b(?:w[aäá]hllen|w[aäá]hlen|wh[aäá]len|w-hlen)\b/gi` on NFC text. A Wählen product is in `brands.wahlen` or has the brand in its normalised name. With no other terms: machines first.
  - Sort by score descending, ties in catalogue order.
  - Typo: a unit is corrected when all its non-exact variants are `fuzzy` and they name one distinct word; substitute it in the text and prepare again.
  - Fallback only when there are no results and the query is not a reference: drop 1 unit, then 2, trying the later words first, first combination with results wins, at least one unit remains. Never drop `negative` units or `/^\d{5,}$/`. Rank with `{...query, units: subset}`.
  - Facets: sizes `M<n>`, `<n>x<n>`, `<n> mm|cm|ml|l|lt|g|gr|kg`; colours preto, branco, vermelho, azul, verde, amarelo, cinzento, laranja, castanho, transparente (feminine forms map to these); materials inox, aço, latão, cobre, alumínio, nylon, borracha, silicone, plástico, nitrilo, látex (matched without accents). `M8X30` yields `M8` and `M8x30`. Show a value only if `0 < count < results.length`; at most 6 per group, by count.
- [ ] **Step 4:** Run the tests. Expected: 10 pass.
- [ ] **Step 5:** Commit `feat: quick search core`.

### Task 2: Page and build step

**Files:**
- Create: `frontend/pesquisa/page.html`, `page.js`, `page.css`, `quick-page-build.cjs` (repo root)
- Modify: `build.cjs` (require the new step after `pwa-build.cjs`)

**Interfaces:**
- Consumes: Task 1's `QuickSearch`; globals `PRODUCTS`, `CATALOG_MEDIA` (`ref → [slug, page, path?]`).
- Produces: `public/pesquisa.html`, `public/pesquisa/{search-core.js,page.js,page.css,data.js}`; `data.js` sets `window.QUICK_DATA = {extras, photos, hourtec, wahlen, wahlenMachines}`.

- [ ] **Step 1: Write the build step with its assertions.** It reads `public/index.html` and fails if any expectation is missing:
  - script tags matching `products.js`, `data/products-N.js`, `catalog-meta.js`, `data/media-*.js`, reused verbatim in page order, followed by `search-engine.js`
  - `extras`: all matches of `/for\(const p of (\[\[.*?\]\])\)\{if\(!PRODUCTS\.some/g`; assert it contains `690737`
  - `photos`: the `const searchPhotos=({...});` line
  - `hourtec`: all refs in `hourtec-pages.json`; `wahlen`: `tariff` + `catalog`, and `machines`, from `wahlen-references.json`
  - Copies the sources with 12-character sha256 `?v=` hashes; adds `<a class="action" href="pesquisa.html">Pesquisa rápida</a>` right after the single `<nav>`
  - In `node:vm` with the real data, assert non-empty results for `parafuso inox m8 20`, `limpa travões spray`, `silicome`, `whalen`, `1hourtec`, and that `04519` is first for `04519`
  - Assert the output has no `rel="manifest"`
- [ ] **Step 2:** On a clean tree run `node build.cjs`. Expected: FAIL (missing `frontend/pesquisa/page.html`).
- [ ] **Step 3: Write the page.** Decisions:
  - `page.html` has a `<!--SCRIPTS-->` placeholder; elements: sticky search box with clear button, notice line (`aria-live`), chips, result list, "Mostrar mais", link "Abrir catálogo completo" to `./`.
  - Index builds after first paint; status "A preparar a pesquisa…"; the current input is searched when ready. Input debounced 120 ms. The query is kept in `?q=` with `history.replaceState`, so returning from a product sheet restores it.
  - Row: thumbnail (photo string, sprite index as in `search-photos.js`, else the `CATALOG_MEDIA` page image, else blank), name, large reference, "Copiar", price. Name/price link to `./#ficha/<encoded ref>`; extras without a sheet are still listed.
  - Copy: `navigator.clipboard.writeText` → "Copiado"; otherwise select the reference text and show "Selecionado".
  - Thumbnail tap opens a `<dialog>` with the page image (or photo) and "Fechar".
  - Notices: `Sem resultados para tudo. A mostrar sem "spray".`, `A mostrar resultados para "silicone".`, `Sem resultados.`
  - Touch targets at least 44 px; input font 16 px; one column on phone, two from 700 px.
- [ ] **Step 4:** On a clean tree run `node build.cjs`. Expected: exit 0.
- [ ] **Step 5: Browser check** at 375×812 and 768×1024: the spec's six queries plus a reference, chips, copy and its fallback, viewer, sheet link and back, both page links, typing during load, a name with `1/4"`, no console errors, no horizontal scroll.
- [ ] **Step 6:** Commit `feat: quick search page`.

### Task 3: Synonym and housekeeping

**Files:**
- Modify: `strict-engine.js` (massa group), `quick-page-build.cjs`, `CLAUDE.md`
- Create: `.gitignore`

- [ ] **Step 1:** Add to the build assertions: `copper paste` returns `04519` with nothing ignored. Run the build. Expected: FAIL.
- [ ] **Step 2:** Add `'paste'` to the massa group in `strict-engine.js`.
- [ ] **Step 3:** Add `.gitignore` containing `public/`. In `CLAUDE.md`, document the new page, step and test command, and drop the "not in `.gitignore`" line.
- [ ] **Step 4:** Run the tests and a clean build. Expected: all pass.
- [ ] **Step 5:** Commit `feat: paste synonym and docs`.
