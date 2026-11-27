const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const references = require('./wahlen-references.json');
const file = 'public/index.html';
let html = fs.readFileSync(file, 'utf8');

function replaceOnce(marker, replacement) {
  assert.equal(html.split(marker).length, 2, 'Marcador de pesquisa alterado: ' + marker);
  html = html.replace(marker, () => replacement);
}

const brandSearch = `
const wahlenRefs = new Set(${JSON.stringify([...references.tariff, ...references.catalog])});
const wahlenMachines = new Set(${JSON.stringify(references.machines)});
const wahlenPattern = /\\b(?:w[aäá]hllen|w[aäá]hlen|wh[aäá]len|w-hlen)\\b/gi;
function wahlenTerms(value) {
  let matchesBrand = false;
  const terms = value.normalize('NFC').replace(wahlenPattern, () => {
    matchesBrand = true;
    return ' ';
  }).trim();
  return { matchesBrand, terms };
}
function isWahlen(entry) {
  return wahlenRefs.has(entry.ref) || wahlenTerms(entry.name).matchesBrand;
}
function wahlenRank(entry, query) {
  if (!isWahlen(entry)) return 0;
  if (!query.empty) return rank(entry, query);
  return wahlenMachines.has(entry.ref) ? 2 : 1;
}
`;

replaceOnce(
  'function rank(entry,query){return BlinkSearch.rank(entry,query)}',
  'function rank(entry,query){return BlinkSearch.rank(entry,query)}\n' + brandSearch,
);
replaceOnce(
  'const query=prepareQuery(scoped.terms);',
  'const wahlen=wahlenTerms(scoped.terms);const query=prepareQuery(wahlen.terms);',
);
replaceOnce(
  'const score=rank(entry,query);',
  'const score=wahlen.matchesBrand?wahlenRank(entry,query):rank(entry,query);',
);

for (const block of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)) {
  if (block[1].trim()) new vm.Script(block[1]);
}

const ctx = vm.createContext({});
for (const match of html.matchAll(/<script src="((?:data\/)?products(?:-\d+)?\.js)(?:\?[^"]*)?"/g)) {
  vm.runInContext(fs.readFileSync('public/' + match[1], 'utf8'), ctx);
}
vm.runInContext(fs.readFileSync('public/search-engine.js', 'utf8'), ctx);
// Exercise the actual browser search loop against the packaged products.
const searchStart = html.indexOf('function search(){clearTimeout(searchTimer);');
const searchEnd = html.indexOf("if(sort==='low')", searchStart);
assert(searchStart !== -1 && searchEnd > searchStart);
const searchLoop = html.slice(searchStart, searchEnd) + '}return arr}';
const originalBrand = html.match(/^function brandTerms\(value\).*$/m)[0];
vm.runInContext(`
const index = BlinkSearch.createIndex(PRODUCTS, {products:{}});
const {prepareQuery,rank} = BlinkSearch;
const fields = {q:{value:''}, sort:{value:'relevance'}, family:{value:''}, catalog:{value:''}, 'hourtec-link':{}};
const $ = id => fields[id];
const clearTimeout = () => {};
let searchTimer, searchMatchNote, lastKey = '', cachedResults = [], limit = 40;
${originalBrand}
${brandSearch}
${searchLoop}
`, ctx);

function query(value) {
  ctx.inputValue = value;
  return Array.from(vm.runInContext("fields.q.value=inputValue;search().map(row=>row.p[0])", ctx),
    ref => ref.replace(/[\s.\-_/]/g, '').toLowerCase());
}

const results = query('whalen');
for (const variant of ['WÄHLEN', 'Wahlen', 'Wa\u0308hlen']) {
  assert.deepEqual(query(variant), results);
}
const returned = new Set(results);
for (const ref of ['61010731', '61080194', '610947', '6108050', '6109022', '01217431', '6076051', '6102920', '61010735', '6073615']) {
  assert(returned.has(ref), 'Referência Wählen em falta: ' + ref);
}
assert.deepEqual(query('whalen 61080194'), ['61080194']);
assert(query('wählen rebarbadora').includes('610802513'));
assert(!returned.has('04519') && !returned.has('700808'), 'A pesquisa por marca incluiu artigos Blinker');
assert(query('04519').includes('04519'));
assert(query('04519').every(ref => ref.startsWith('04519')));
const missingFromSite = references.tariff.filter(ref => !returned.has(ref));
assert.equal(missingFromSite.length, 0, 'Referências da tarifa ausentes do site: ' + missingFromSite.join(', '));
console.log('Pesquisa Wählen validada: ' + results.length + ' referências, '
  + references.tariff.length + ' da tarifa com a marca expressa e todas as grafias.');

fs.writeFileSync(file, html);
