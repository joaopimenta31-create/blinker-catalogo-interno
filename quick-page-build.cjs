// Puts the new product search (frontend/pesquisa/) into the main page, in place of the older interface.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = path.join(__dirname, 'frontend', 'pesquisa');
const output = path.join(__dirname, 'public');
const index = path.join(output, 'index.html');
const html = fs.readFileSync(index, 'utf8');
const read = file => fs.readFileSync(file, 'utf8');
const hash = text => crypto.createHash('sha256').update(text).digest('hex').slice(0, 12);

// The page script relies on these parts of the main page.
for (const needed of ['<main', 'id="prod"', 'id="product-filters"', 'id="family"', 'id="catalog"', 'id="sort"',
  'id="clear-filters"', 'const searchPhotos=']) {
  assert(html.includes(needed), 'Elemento em falta na página principal: ' + needed);
}
assert(!html.includes('pesquisa/page.js'), 'A nova pesquisa já está na página');

const hourtecPages = JSON.parse(read(path.join(__dirname, 'hourtec-pages.json')));
const wahlen = JSON.parse(read(path.join(__dirname, 'wahlen-references.json')));
const brands = {
  hourtec: [...new Set(Object.values(hourtecPages).flatMap(pages => pages.flatMap(page => page[1])).map(String))],
  wahlen: [...wahlen.tariff, ...wahlen.catalog],
  wahlenMachines: wahlen.machines,
};

const target = path.join(output, 'pesquisa');
fs.mkdirSync(target, { recursive: true });
function emit(name, content) {
  fs.writeFileSync(path.join(target, name), content);
  return 'pesquisa/' + name + '?v=' + hash(content);
}
const dataUrl = emit('data.js', 'window.QUICK_DATA=' + JSON.stringify(brands) + ';\n');
const coreUrl = emit('search-core.js', read(path.join(source, 'search-core.js')));
const pageUrl = emit('page.js', read(path.join(source, 'page.js')));
const cssUrl = emit('page.css', read(path.join(source, 'page.css')));

const tag = url => '<script src="' + url + '"></script>';
const addition = '<link rel="stylesheet" href="' + cssUrl + '">' + [dataUrl, coreUrl, pageUrl].map(tag).join('');
fs.writeFileSync(index, html + '\n' + addition + '\n');

// Exercise the search against the data the main page loads.
const context = vm.createContext({ window: {} });
const dataScripts = [...html.matchAll(
  /<script src="((?:products|families|data\/(?:products|families)-[\w-]+|search-engine)\.js)(?:\?[^"]*)?"/g,
)].map(m => m[1]);
for (const file of [...dataScripts, 'pesquisa/data.js', 'pesquisa/search-core.js']) {
  vm.runInContext(read(path.join(output, file)), context);
}
const extras = [...html.matchAll(/for\(const p of (\[\[.*?\]\])\)\{if\(!PRODUCTS\.some/g)]
  .flatMap(m => JSON.parse(m[1]));
context.extras = extras;
vm.runInContext(`
  for (const row of extras) if (!PRODUCTS.some(p => p[0] === row[0])) PRODUCTS.push(row);
  const quickSearch = QuickSearch.createSearch(BlinkSearch, PRODUCTS, window.QUICK_DATA);
`, context);
function search(text) {
  context.input = text;
  return vm.runInContext('quickSearch(input)', context);
}
for (const text of ['parafuso inox m8 20', 'limpa travões spray', 'silicome', 'whalen', '1hourtec']) {
  assert(search(text).results.length, 'Pesquisa sem resultados: ' + text);
}
assert.equal(search('04519').results[0][0], '04519');
const paste = search('copper paste');
assert(paste.results.some(p => p[0] === '04519') && !paste.ignored.length, 'copper paste não encontra 04519');
const family = vm.runInContext(`
  const first = Object.entries(FAMILY_DATA.products).find(([, entry]) => entry.f.length);
  quickSearch('', p => QuickSearch.matchesFilters(FAMILY_DATA.products[p[0]], { family: first[1].f[0], catalog: '' }))
`, context);
assert(family.results.length, 'Filtro por família sem resultados');
console.log('Nova pesquisa integrada e verificada.');
