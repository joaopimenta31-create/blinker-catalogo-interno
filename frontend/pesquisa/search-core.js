/* Search behaviour for the quick-search page, on top of BlinkSearch. No product data is changed. */
(function (root) {
  'use strict';

  // Same brand patterns as multi-search.cjs and wahlen-build.cjs.
  const hourtecPattern = /\b1[\s-]*hou(?:r)?[\s-]*tec\b/i;
  const wahlenPattern = /\b(?:w[aäá]hllen|w[aäá]hlen|wh[aäá]len|w-hlen)\b/gi;

  function createSearch(engine, products, brands) {
    const index = engine.createIndex(products, { products: {} });
    const hourtec = new Set(brands.hourtec);
    const wahlen = new Set(brands.wahlen);
    const machines = new Set(brands.wahlenMachines);
    const references = new Set(index.map(entry => entry.ref));
    const isWahlen = entry => wahlen.has(String(entry.p[0])) || entry.name.search(wahlenPattern) >= 0;

    function ranked(entries, query) {
      const found = [];
      for (const entry of entries) {
        const score = engine.rank(entry, query);
        if (score > 0) found.push({ product: entry.p, score });
      }
      return found.sort((a, b) => b.score - a.score).map(row => row.product);
    }

    // A word is corrected only when the engine's sole guesses for it are one and the same typo fix.
    // Several possible fixes are reported as similar words instead.
    function correct(text, query) {
      const corrected = [];
      const similar = [];
      for (const unit of query.units) {
        const guesses = (unit.variants || []).slice(1);
        if (!guesses.length || guesses.some(g => g.kind !== 'fuzzy')) continue;
        const words = new Set(guesses.map(g => g.word));
        if (words.size === 1) corrected.push({ from: unit.raw, to: [...words][0] });
        else similar.push({ from: unit.raw, options: [...words] });
      }
      let fixed = engine.normalize(text);
      for (const { from, to } of corrected) fixed = fixed.replace(from, () => to);
      return { corrected, similar, text: fixed, query: corrected.length ? engine.prepareQuery(fixed) : query };
    }

    const label = unit => unit.dimension ? unit.dimension.join('x') : unit.raw;
    const droppable = unit => !unit.negative && !/^\d{4,}$/.test(unit.raw || '');

    // Leaves out one word, then two, trying the later words first.
    function closest(entries, query) {
      const units = query.units;
      const choices = units.map((unit, i) => i).filter(i => droppable(units[i])).reverse();
      const drops = choices.map(i => [i]);
      for (const i of choices) for (const j of choices) if (j < i) drops.push([i, j]);
      for (const drop of drops) {
        const kept = units.filter((unit, i) => !drop.includes(i));
        if (!kept.length) continue;
        const results = ranked(entries, { ...query, units: kept });
        if (results.length) {
          return { results, ignored: drop.sort((a, b) => a - b).map(i => label(units[i])) };
        }
      }
      return { results: [], ignored: [] };
    }

    // Names usually write a metric screw size "M8 x 20" as "8X20".
    function plainSize(text) {
      const match = text.match(
        /(?<![a-z0-9])m(\d+(?:[.,]\d+)?)(?:\s*[x×]\s*|\s+)(\d+(?:[.,]\d+)?)(?![a-z0-9.,])/);
      if (!match) return null;
      const to = match[1] + 'x' + match[2];
      return { change: { from: match[0], to }, query: engine.prepareQuery(text.replace(match[0], () => to)) };
    }

    function matching(entries, input) {
      const { query, corrected, similar, text } = correct(input, engine.prepareQuery(input));
      let results = ranked(entries, query);
      let ignored = [];
      if (!results.length && !query.code) {
        const size = plainSize(text);
        if (size) {
          results = ranked(entries, size.query);
          if (!results.length) ({ results, ignored } = closest(entries, size.query));
          if (results.length) corrected.push(size.change);
        }
        if (!results.length) ({ results, ignored } = closest(entries, query));
      }
      if (!results.length) return { results, ignored, corrected: [] };
      // A word that was left out is named as typed, and was neither corrected nor guessed at.
      const typed = word => corrected.find(c => c.to === word)?.from || word;
      const answer = {
        results,
        ignored: ignored.map(typed),
        corrected: corrected.filter(c => !ignored.includes(c.to)),
      };
      const guessed = similar.filter(s => !ignored.includes(s.from));
      if (guessed.length) answer.similar = guessed;
      return answer;
    }

    // Finds a full reference typed among other words, so that it is never split or left out.
    function pinned(text) {
      const words = text.split(/\s+/);
      for (let i = 0; i < words.length; i++) {
        // "045 143": references are often written with the first three digits apart.
        for (const length of /^\d{3}$/.test(words[i]) ? [2, 1] : [1]) {
          const ref = engine.compactReference(words.slice(i, i + length).join(''));
          if (ref.length < 5 || !/\d/.test(ref) || !references.has(ref)) continue;
          const rest = [...words.slice(0, i), ...words.slice(i + length)]
            .filter(word => !/^ref(?:er[eê]ncia)?[.:#]*$/i.test(word));
          if (rest.length) return { ref, rest: rest.join(' ') };
        }
      }
      return null;
    }

    // accept(product) limits the search to the products the filters allow.
    return function search(input, accept) {
      let text = String(input).normalize('NFC');
      let entries = accept ? index.filter(entry => accept(entry.p)) : index;
      let branded = false;
      if (hourtecPattern.test(text)) {
        branded = true;
        text = text.replace(hourtecPattern, ' ');
        entries = entries.filter(entry => hourtec.has(String(entry.p[0])));
      }
      let onlyWahlen = false;
      if (text.search(wahlenPattern) >= 0) {
        branded = onlyWahlen = true;
        text = text.replace(wahlenPattern, ' ');
        entries = entries.filter(isWahlen);
      }
      text = text.trim();
      if (!text) {
        if (!branded && (!accept || String(input).trim())) return { results: [], ignored: [], corrected: [] };
        const list = entries.map(entry => entry.p);
        if (onlyWahlen) list.sort((a, b) => machines.has(String(b[0])) - machines.has(String(a[0])));
        return { results: list, ignored: [], corrected: [] };
      }
      const reference = pinned(text);
      if (!reference) return matching(entries, text);
      const named = entries.filter(entry => entry.ref.startsWith(reference.ref));
      const answer = matching(named, reference.rest);
      if (answer.results.length || !named.length) return answer;
      const ignored = engine.prepareQuery(reference.rest).units.length ? reference.rest.split(/\s+/) : [];
      return { results: named.map(entry => entry.p), ignored, corrected: [] };
    };
  }

  const plain = text => String(text).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const colours = {
    preto: 'preto', preta: 'preto', branco: 'branco', branca: 'branco', vermelho: 'vermelho',
    vermelha: 'vermelho', azul: 'azul', verde: 'verde', amarelo: 'amarelo', amarela: 'amarelo',
    cinzento: 'cinzento', cinzenta: 'cinzento', laranja: 'laranja', castanho: 'castanho',
    castanha: 'castanho', transparente: 'transparente',
  };
  const materials = {
    inox: 'inox', aco: 'aço', latao: 'latão', cobre: 'cobre', aluminio: 'alumínio', nylon: 'nylon',
    borracha: 'borracha', silicone: 'silicone', plastico: 'plástico', nitrilo: 'nitrilo', latex: 'látex',
  };

  const cache = new WeakMap();
  function describe(product) {
    let found = cache.get(product);
    if (found) return found;
    const name = plain(product[1]).replace(/×/g, 'x');
    const words = name.split(/[^a-z0-9]+/);
    const size = new Set();
    for (const m of name.matchAll(/(?<![a-z0-9])m(\d+(?:[.,]\d+)?)(?![0-9])/g)) size.add('M' + m[1]);
    for (const m of name.matchAll(/(?<![a-z0-9])(m?)(\d+(?:[.,]\d+)?)\s?x\s?(\d+(?:[.,]\d+)?)(?![0-9])/g)) {
      size.add(m[1].toUpperCase() + m[2] + 'x' + m[3]);
    }
    for (const m of name.matchAll(/(?<![a-z0-9.,])(\d+(?:[.,]\d+)?)\s?(mm|cm|ml|kg|gr|lt|l|g)(?![a-z0-9])/g)) {
      size.add(m[1] + m[2]);
    }
    const pick = table => new Set(words.filter(w => Object.hasOwn(table, w)).map(w => table[w]));
    found = { size, colour: pick(colours), material: pick(materials) };
    cache.set(product, found);
    return found;
  }

  function facets(results) {
    const list = [];
    for (const group of ['size', 'colour', 'material']) {
      const counts = new Map();
      for (const product of results) {
        for (const value of describe(product)[group]) counts.set(value, (counts.get(value) || 0) + 1);
      }
      list.push(...[...counts]
        .filter(([, count]) => count < results.length)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(([value, count]) => ({ group, value, count })));
    }
    return list;
  }

  function applyFacets(results, selected) {
    const wanted = Object.entries(selected).filter(([, value]) => value);
    return results.filter(product => wanted.every(([group, value]) => describe(product)[group].has(value)));
  }

  // familyEntry is FAMILY_DATA.products[ref]: { f: families, c: catalogues }.
  function matchesFilters(familyEntry, { family, catalog }) {
    const families = familyEntry?.f || [];
    if (family === 'unclassified' ? families.length : family && !families.includes(family)) return false;
    return !catalog || (familyEntry?.c || []).includes(catalog);
  }

  function sortByPrice(products, order) {
    if (order !== 'low' && order !== 'high') return products;
    const none = order === 'low' ? Infinity : -Infinity;
    const price = product => product[2] ?? none;
    return [...products].sort((a, b) => order === 'low' ? price(a) - price(b) : price(b) - price(a));
  }

  const api = { createSearch, facets, applyFacets, matchesFilters, sortByPrice };
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.QuickSearch = api;
})(globalThis);
