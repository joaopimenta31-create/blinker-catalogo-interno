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

// Catalogue sections of each reference, from every catalogue's table of contents below its top level.
function catalogueSections() {
  const titles = [], refs = {};
  const root = path.join(output, 'catalogs');
  for (const slug of fs.readdirSync(root)) {
    const file = path.join(root, slug, 'index.json');
    if (slug === '1hourtec' || !fs.existsSync(file)) continue;
    const meta = JSON.parse(read(file));
    const pages = meta.pages || meta.page_files.flatMap(name => JSON.parse(read(path.join(root, slug, name))));
    const toc = meta.toc || [];
    toc.forEach((entry, i) => {
      if (entry.level < 2) return;
      // "02. PORCAS E ANILHAS" and "12. P-014: ANILHAS-PORCAS" lose their numbering.
      const text = entry.title.replace(/^(?:\s*(?:\d+\.|P-\d+\s*:))+\s*/i, '').trim().toLocaleLowerCase('pt');
      if (!text) return;
      const title = text.charAt(0).toLocaleUpperCase('pt') + text.slice(1);
      let id = titles.indexOf(title);
      if (id < 0) id = titles.push(title) - 1;
      const next = toc.slice(i + 1).find(other => other.level <= entry.level);
      const end = Math.max(next ? next.page : entry.page + 1, entry.page + 1);
      for (const page of pages) {
        if (page.page < entry.page || page.page >= end) continue;
        for (const ref of page.references || []) {
          const own = refs[ref] ??= [];
          if (!own.includes(id)) own.push(id);
        }
      }
    });
  }
  return { titles, refs };
}
const sections = catalogueSections();
const washers = sections.titles.indexOf('Porcas e anilhas');
assert(washers >= 0 && Object.values(sections.refs).some(ids => ids.includes(washers)),
  'Secções dos catálogos em falta');
brands.sections = sections;

// Values transcribed from catalogue tables, by reference.
function catalogueTables() {
  const file = JSON.parse(read(path.join(source, 'tabelas-anilhas.json')));
  const tables = [], refs = {};
  for (const table of file.tabelas) {
    for (const [references, values] of table.linhas) {
      assert.equal(values.length, table.colunas.length, 'Colunas erradas: ' + table.tabela + ' ' + references);
      references.forEach((ref, i) => {
        if (!ref) return;
        assert(!refs[ref], 'Referência repetida nas tabelas: ' + ref);
        refs[ref] = [tables.length, table.acabamentos?.[i] || '', values];
      });
    }
    tables.push({
      table: table.tabela, norm: table.norma || table.tabela.match(/DIN \d+/)?.[0] || '',
      columns: table.colunas, page: table.pagina, slug: file.slug,
    });
  }
  return { tables, refs };
}
brands.catalogue = catalogueTables();

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
// Subfamilies: only products that say "esmagamento" belong to it.
const crush = vm.runInContext(`
  const washerList = quickSearch('anilha').results;
  const type = QuickSearch.facets(washerList).find(step => step.group === 'type');
  const choice = type.values.find(option => option.value.split(' ').includes('esmagamento'));
  QuickSearch.applyFacets(washerList, [{ group: 'type', value: choice.value }])
`, context);
assert(crush.length && crush.every(p => /esmagamento/i.test(p[1])), 'Subfamília esmagamento incorreta');
// Catalogue tables: every page cited exists and the transcribed references are real products.
const known = new Set(vm.runInContext('PRODUCTS.map(p => p[0])', context));
const transcribed = Object.keys(brands.catalogue.refs);
const unknown = transcribed.filter(ref => !known.has(ref));
// Printed in the catalogue but absent from the price list.
assert.deepEqual(unknown.sort(), ['0883339', '17610', '1766', '1768'],'Referências desconhecidas nas tabelas');
console.log('Tabelas do catálogo: ' + (transcribed.length - unknown.length) + ' referências.');
console.log('Nova pesquisa integrada e verificada.');
