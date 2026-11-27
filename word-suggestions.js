(function (root) {
  'use strict';

  const stop = new Set('a as o os de da das do dos e em no nos na nas com sem por para um uma un del el los las y and the und mit'.split(' '));
  const brands = [
    {term:'Wählen', prefixes:['wahlen', 'whalen', 'wahllen']},
    {term:'1HOURTEC', prefixes:['1hourtec', '1houtec']},
  ];
  const tokens = value => value.match(/[\p{L}\p{M}][\p{L}\p{M}-]*/gu) || [];

  function collectVocabulary(products, normalize) {
    const vocabulary = new Map();
    for (const [, name] of products) {
      for (const word of new Set(tokens(name.toLocaleLowerCase('pt-PT')))) {
        const key = normalize(word);
        if (key.length < 3 || stop.has(key)) continue;
        if (!vocabulary.has(key)) vocabulary.set(key, new Map());
        const spellings = vocabulary.get(key);
        spellings.set(word, (spellings.get(word) || 0) + 1);
      }
    }
    const buckets = {};
    for (const [key, spellings] of vocabulary) {
      const [word] = [...spellings].sort((a, b) =>
        b[1] - a[1] || Number(b[0] !== key) - Number(a[0] !== key))[0];
      const count = [...spellings.values()].reduce((total, frequency) => total + frequency, 0);
      if (count < 2) continue;
      (buckets[key.slice(0, 2)] ||= []).push([key, word, count]);
    }
    return buckets;
  }

  function createSuggestions(buckets, normalize) {
    return function suggest(value, products, scoped) {
      const tail = value.match(/[\p{L}\p{M}\d-]+$/u);
      const typed = tail?.[0] || '';
      const prefix = normalize(typed);
      const before = tail ? value.slice(0, tail.index) : value;
      const previous = tokens(normalize(before)).filter(word => !stop.has(word)).at(-1);
      if (prefix ? prefix.length < 2 : !previous || !/\s$/.test(value)) return [];
      const candidates = new Map();

      function add(key, term, score) {
        const candidate = candidates.get(key);
        if (candidate) candidate.score += score;
        else candidates.set(key, {term, score});
      }

      if (prefix && !scoped) {
        for (const [key, word, count] of buckets[prefix.slice(0, 2)] || []) {
          if (key.startsWith(prefix) && key !== prefix) add(key, word, Math.log2(count) + 1);
        }
      }

      for (const [, name] of products.slice(0, 80)) {
        const words = tokens(name.toLocaleLowerCase('pt-PT'))
          .map(word => [normalize(word), word])
          .filter(([key]) => !stop.has(key));
        const matched = new Set();
        for (let i = 1; i < words.length; i++) {
          const [key, word] = words[i];
          if (!previous || words[i - 1][0] !== previous || !key.startsWith(prefix) ||
              key === prefix || key.length < 3 || matched.has(key)) continue;
          matched.add(key);
          add(key, word, 5);
        }
        if (!prefix) continue;
        for (const [key, word] of words) {
          if (!key.startsWith(prefix) || key === prefix || key.length < 3 || matched.has(key)) continue;
          matched.add(key);
          add(key, word, 1);
        }
      }

      if (prefix && (!scoped || products.length)) {
        for (const {term, prefixes} of brands) {
          for (const alias of prefixes) candidates.delete(alias);
          if (prefixes.some(variant => variant.startsWith(prefix)) &&
              typed.toLocaleLowerCase('pt-PT') !== term.toLocaleLowerCase('pt-PT')) {
            candidates.set(prefixes[0], {term, score:1000});
          }
        }
      }

      return [...candidates.values()].sort((a, b) => b.score - a.score ||
        a.term.localeCompare(b.term, 'pt-PT')).slice(0, 4)
        .map(({term}) => ({term, query:before + term}));
    };
  }

  if (typeof module !== 'undefined') module.exports = {collectVocabulary, createSuggestions};
  else root.createWordSuggestions = createSuggestions;
})(globalThis);
