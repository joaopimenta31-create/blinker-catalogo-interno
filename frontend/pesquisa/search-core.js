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

  const finishes = [
    [/(?<![a-z0-9])s(?:em\s|\.\s?)banho(?![a-z])/g, () => 'Sem banho'],
    [/(?<![a-z0-9])(?:zn|zin|zinc|zincad[oa]s?)(?![a-z0-9])/g, () => 'Zincado (ZN)'],
    [/(?<![a-z0-9])(a[2-5]|hdg|pv|ht|hv\d{3})(?![a-z0-9])/g, m => m[1].toUpperCase()],
  ];
  const stopWords = new Set(('de da do das dos para com sem por em os as um uma no na nos nas ao aos ou '
    + 'del con classe banho din iso').split(' '));
  const keptPlurals = new Set(['gas', 'abs', 'inox', 'torx', 'pvc', 'mais', 'menos', 'lapis', 'tenis']);

  function singular(word) {
    if (word.length < 4 || keptPlurals.has(word) || !word.endsWith('s') || word.endsWith('ss')) return word;
    return word.endsWith('oes') ? word.slice(0, -3) + 'ao' : word.slice(0, -1);
  }
  const capital = text => text.charAt(0).toUpperCase() + text.slice(1);
  const abbreviations = { paraf: 'parafuso', conj: 'conjunto' };
  const wordKey = word => abbreviations[word] || singular(word);
  // "05" and "5", "1.50" and "1,5" are the same number.
  const numbers = text => text.replace(/\d+(?:[.,]\d+)?/g,
    n => String(Number(n.replace(',', '.'))).replace('.', ','));

  // What a product's name says about it. Nothing is deduced beyond the words and codes written there.
  const cache = new WeakMap();
  function describe(product) {
    let found = cache.get(product);
    if (found) return found;
    const name = plain(product[1]).replace(/×/g, 'x');
    const d = {};
    for (const group of ['norm', 'thread', 'size', 'finish', 'class', 'material', 'colour']) d[group] = new Set();
    let rest = name;
    // Reads every match of a pattern and removes it, so that its digits are not read again.
    function take(pattern, use) {
      rest = rest.replace(pattern, (...match) => {
        use(match);
        return ' ';
      });
    }
    take(/(?<![a-z])(din|iso|nfe|uni)\s*\.?\s*(\d{2,5})(?:\.\s?(10|12|4|5|6|8)(?![\d,x]))?(?:-[a-z]{1,2}(?![a-z]))?/g,
      m => {
        d.norm.add(m[1].toUpperCase() + ' ' + m[2]);
        if (m[3]) d.class.add('Classe ' + m[3]);
      });
    take(/(?<![a-z])classe\s*(\d+(?:[.,]\d+)?)/g, m => d.class.add('Classe ' + m[1]));
    for (const [pattern, label] of finishes) take(pattern, m => d.finish.add(label(m)));
    take(/(?<![a-z0-9])(?:\d+\s)?\d+\/\d+(?:"|'')?/g, m => d.size.add(m[0]));
    // Clothing and footwear sizes: "T.44", "T.XL", "T44".
    take(/(?<![a-z])t\.\s?(x{0,3}[sl]|m|\d{1,2})(?![a-z0-9])|(?<![a-z0-9])t(\d{2})(?![a-z0-9])/g,
      m => d.size.add('T' + (m[1] || m[2]).toUpperCase()));
    take(/(?<![a-wyz0-9])(m-?)?(\d+(?:[.,]\d+)?(?:\s?x\s?\d+(?:[.,]\d+)?)+)(?:\s?(?:mm|cm)(?![a-z]))?/g, m => {
      const size = m[2].replace(/\s/g, '');
      d.size.add((m[1] ? 'M' : '') + size);
      if (m[1]) d.thread.add('M' + size.split('x')[0]);
    });
    // "DIN 125X16": the norm is already removed, leaving the size after its "x".
    take(/(?<![a-z])x\s?(\d+(?:[.,]\d+)?)(?![a-z0-9])/g, m => d.size.add(m[1]));
    take(/(?<![a-z0-9])m-?(\d+(?:[.,]\d+)?)(?![a-z0-9])/g, m => d.thread.add('M' + m[1]));
    take(/(?<![a-z0-9.,])(\d+(?:[.,]\d+)?)\s?(mm|cm|ml|kg|gr|lt|l|g|m|v|w|a)(?![a-z0-9])/g,
      m => d.size.add(m[1] + m[2]));
    take(/(?<![a-z0-9.,-])\d+(?:[.,]\d+)?(?![a-z0-9])/g, m => d.size.add(m[0]));

    // How each word is written in the name, to label its option with accents.
    d.surface = new Map();
    for (const word of String(product[1]).toLowerCase().split(/[^\p{L}0-9]+/u)) {
      d.surface.set(singular(plain(word)), word);
    }
    const words = text => text.split(/[^a-z0-9]+/).filter(word => /^[a-z]+$/.test(word));
    const first = words(name).find(word => word.length > 1);
    d.kind = first ? wordKey(first) : '';
    d.type = [];
    for (const word of words(rest)) {
      if (Object.hasOwn(colours, word)) d.colour.add(colours[word]);
      else if (Object.hasOwn(materials, word)) d.material.add(materials[word]);
      else if (word.length > 2 && !stopWords.has(word)) {
        const key = wordKey(word);
        if (key !== d.kind && !d.type.includes(key)) d.type.push(key);
      }
    }
    // Fractions and clothing sizes keep their writing; other measures are unified.
    d.size = new Set([...d.size].map(size => /[/T]/.test(size) ? size : numbers(size)));
    d.thread = new Set([...d.thread].map(numbers));
    cache.set(product, d);
    return d;
  }

  const groups = [
    ['kind', 'Produto'], ['type', 'Tipo'], ['section', 'Secção'], ['norm', 'Norma'], ['thread', 'Rosca'],
    ['size', 'Medida'], ['finish', 'Acabamento'], ['class', 'Classe'], ['material', 'Material'], ['colour', 'Cor'],
  ];
  const measured = new Set(['norm', 'thread', 'size', 'class']);
  const noSections = () => [];
  // catalog(ref): what a catalogue table says about a reference: { table, norm?, finish?, values }.
  const noCatalog = () => undefined;
  const column = 'column:';

  function valuesOf(product, group, { sections = noSections, catalog = noCatalog }) {
    const ref = String(product[0]);
    if (group === 'section') return sections(ref);
    if (group === 'table' || group.startsWith(column)) {
      const entry = catalog(ref);
      if (group === 'table') return entry ? [entry.table] : [];
      const label = group.slice(column.length);
      return (entry?.values || []).filter(([name, value]) => name === label && value).map(([, value]) => value);
    }
    const d = describe(product);
    if (group === 'kind') return d.kind ? [d.kind] : [];
    if (group !== 'norm' && group !== 'finish') return [...d[group]];
    let stated = catalog(ref)?.[group];
    if (stated === 'Zincada') stated = 'Zincado (ZN)';
    return stated ? [...new Set([...d[group], stated])] : [...d[group]];
  }

  // The catalogue's tables, and their columns once every result belongs to one.
  function groupsFor(results, { catalog = noCatalog }) {
    const entries = results.map(product => catalog(String(product[0])));
    const columns = entries.every(Boolean)
      ? [...new Set(entries.flatMap(entry => entry.values.map(([name]) => name)))] : [];
    const list = [...groups];
    list.splice(2, 0, ['table', 'Tabela'], ...columns.map(name => [column + name, name]));
    return list;
  }

  // Words that appear in exactly the same products, side by side, become one option ("aba larga").
  function mergeTypes(counts, results) {
    const pairs = new Map();
    for (const product of results) {
      const words = describe(product).type;
      for (let i = 1; i < words.length; i++) {
        const pair = words[i - 1] + ' ' + words[i];
        pairs.set(pair, (pairs.get(pair) || 0) + 1);
      }
    }
    const next = new Map(), joined = new Set();
    for (const [pair, count] of pairs) {
      const [a, b] = pair.split(' ');
      if (counts.get(a) !== count || counts.get(b) !== count || next.has(a) || joined.has(b)) continue;
      next.set(a, b);
      joined.add(b);
    }
    const merged = new Map();
    for (const [word, count] of counts) {
      if (joined.has(word)) continue;
      const parts = [word];
      while (next.has(parts.at(-1)) && !parts.includes(next.get(parts.at(-1)))) parts.push(next.get(parts.at(-1)));
      merged.set(parts.join(' '), count);
    }
    return merged;
  }

  // The steps that can still divide these results, each with every option and its count.
  function facets(results, options = {}) {
    const list = [];
    for (const [group, title] of groupsFor(results, options)) {
      const worded = group === 'kind' || group === 'type';
      let counts = new Map();
      const spellings = new Map();
      for (const product of results) {
        for (const value of valuesOf(product, group, options)) {
          counts.set(value, (counts.get(value) || 0) + 1);
          if (!worded) continue;
          const written = describe(product).surface.get(value) || value;
          const seen = spellings.get(value) || new Map();
          seen.set(written, (seen.get(written) || 0) + 1);
          spellings.set(value, seen);
        }
      }
      if (group === 'type') counts = mergeTypes(counts, results);
      const spelled = word => [...spellings.get(word)].sort((a, b) => b[1] - a[1])[0][0];
      const values = [...counts]
        .filter(([, count]) => count < results.length)
        .map(([value, count]) => ({
          value, count, label: capital(worded ? value.split(' ').map(spelled).join(' ') : value),
        }));
      values.sort(measured.has(group) || group.startsWith(column)
        ? (a, b) => a.label.localeCompare(b.label, 'pt', { numeric: true })
        : (a, b) => b.count - a.count || a.label.localeCompare(b.label, 'pt'));
      if (values.length) list.push({ group, label: title, values });
    }
    return list;
  }

  // selected: [{ group, value }]; a product must match every choice.
  function applyFacets(results, selected, options = {}) {
    return results.filter(product => selected.every(({ group, value }) => {
      const own = valuesOf(product, group, options);
      return group === 'type' ? value.split(' ').every(word => own.includes(word)) : own.includes(value);
    }));
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
