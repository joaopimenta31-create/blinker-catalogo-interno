const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const vm = require('node:vm');
const { collectVocabulary, createSuggestions } = require('./word-suggestions.js');

const index = 'public/index.html';
const html = fs.readFileSync(index, 'utf8');
const ctx = vm.createContext({});
for (const match of html.matchAll(/<script src="((?:data\/)?products(?:-\d+)?\.js)(?:\?[^"]*)?"/g)) {
  vm.runInContext(fs.readFileSync('public/' + match[1], 'utf8'), ctx);
}
vm.runInContext(fs.readFileSync('public/search-engine.js', 'utf8'), ctx);
const products = vm.runInContext('PRODUCTS', ctx);
const normalize = ctx.BlinkSearch.normalize;
const buckets = collectVocabulary(products, normalize);
const suggest = createSuggestions(buckets, normalize);

assert(suggest('rebi', [], false).some(({term}) => normalize(term).startsWith('rebite')));
assert(suggest('whal', [], false).some(({query}) => query === 'Wählen'));
assert(suggest('1hou', [], false).some(({query}) => query === '1HOURTEC'));
assert.deepEqual(suggest('04519', [], false), []);
assert.deepEqual(suggest('rebi', [], true), []);
const copper = products.filter(([ref]) => ref === '04519' || ref === '045190');
assert(copper.length > 0);
assert.deepEqual(suggest('massa de co', copper, false)[0], {term:'cobre', query:'massa de cobre'});
assert.equal(suggest('massa ', copper, true)[0].query, 'massa cobre');

const script = fs.readFileSync('word-suggestions.js', 'utf8')
  + '\nwindow.suggestProductWords = createWordSuggestions(' + JSON.stringify(buckets) + ', BlinkSearch.normalize);\n';
new vm.Script(script);
const version = crypto.createHash('sha256').update(script).digest('hex').slice(0, 12);
const navScript = /<script src="navigation\.js\?v=[0-9a-f]{12}"><\/script>/g;
assert.equal([...html.matchAll(navScript)].length, 1);
fs.writeFileSync('public/word-suggestions.js', script);
fs.writeFileSync(index, html.replace(navScript, tag =>
  '<script src="word-suggestions.js?v=' + version + '"></script>' + tag));
console.log('Sugestões de palavras validadas com artigos, marcas, contexto e filtros.');
