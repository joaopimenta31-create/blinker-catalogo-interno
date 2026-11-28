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
const group = (f, name) => f.find(g => g.group === name)?.values || [];
const option = (f, name, label) => group(f, name).find(v => v.label === label);
test('facets come from names, only when they split the list', () => {
  const list = search('parafuso').results, f = facets(list);
  assert.equal(option(f, 'thread', 'M8').count, 2);
  assert.equal(option(f, 'material', 'Inox').count, 2);
  assert.ok(!option(facets(list.filter(p => p[0] !== '101')), 'material', 'Inox'));
  const chosen = [{group:'thread', value:'M8'}, {group:'material', value:'inox'}];
  assert.deepEqual(applyFacets(list, chosen).map(p => p[0]), ['100']);
});
test('colour forms are one chip', () => {
  assert.equal(group(facets(search('silicone').results), 'colour').length, 0);
  assert.equal(option(facets([...search('silicone').results, P[7]]), 'colour', 'Preto').count, 2);
});

const washers = [
  ['1','ANILHAS COBRE-ESMAGAMENTO 14X22'], ['2','ANILHAS COBRE-ESMAGAMENTO 10X14'],
  ['3','ANILHAS DE COBRE 4X8 MM.'], ['4','ANILHA CARTER ALUMINIO 14X22'],
  ['5','ANILHA GROWER DIN 127 SEM BANHO M5'], ['6','ANILHA ABA LARGA DIN 9021 10X30'],
  ['7','ANILHA ABA LARGA DIN 9021 8X24 A2'],
];
const nuts = [
  ['10','PORCA DIN 985.8 ZN M24'], ['11','PORCA AUTOBLOCANTE DIN 985 A4 M30'],
  ['12','PORCA SERRILHADA DIN 6923 A2 M6'], ['13','PORCA DIN 934 CLASSE 8 ZIN. M10'],
  ['14','PORCA DIN 934 12'],
];
const only = (list, groupName, label) => {
  const value = option(facets(list), groupName, label).value;
  return applyFacets(list, [{group: groupName, value}]).map(p => p[0]);
};
test('a subfamily holds only the products whose name says so', () => {
  assert.deepEqual(only(washers, 'type', 'Esmagamento'), ['1','2']);
});
test('words that always go together are one option', () => {
  assert.deepEqual(only(washers, 'type', 'Aba larga'), ['6','7']);
  assert.ok(!option(facets(washers), 'type', 'Aba'));
});
test('singular and plural names are the same product', () => {
  assert.equal(group(facets([...washers, ...nuts]), 'kind').find(v => v.label.startsWith('Anilha')).count, 7);
});
test('norm, thread, size, finish and class are separate steps', () => {
  assert.deepEqual(only(nuts, 'norm', 'DIN 985'), ['10','11']);
  assert.deepEqual(only(nuts, 'norm', 'DIN 6923'), ['12']);
  assert.deepEqual(only(nuts, 'thread', 'M24'), ['10']);
  assert.deepEqual(only(nuts, 'finish', 'Zincado (ZN)'), ['10','13']);
  assert.deepEqual(only(nuts, 'class', 'Classe 8'), ['10','13']);
  assert.deepEqual(only(nuts, 'size', '12'), ['14']);
  assert.deepEqual(only(washers, 'size', '14x22'), ['1','4']);
  assert.deepEqual(only(washers, 'finish', 'Sem banho'), ['5']);
});
test('every option is offered, not only the first six', () => {
  const many = Array.from({length: 12}, (unused, i) => [String(i), 'PORCA M' + (i + 1)]);
  assert.deepEqual(group(facets(many), 'thread').map(v => v.label).slice(0, 3), ['M1','M2','M3']);
  assert.equal(group(facets(many), 'thread').length, 12);
});
test('choices accumulate and the next steps only show what is left', () => {
  const chosen = [{group:'type', value: option(facets(washers), 'type', 'Esmagamento').value}];
  const left = applyFacets(washers, chosen);
  const next = facets(left, { selected: chosen });
  assert.ok(!option(next, 'type', 'Esmagamento'));
  assert.deepEqual(group(next, 'size').map(v => v.label), ['10x14','14x22']);
});
test('catalogue sections are a step of their own', () => {
  const sections = ref => ref === '4' ? ['Anilhas de vedação'] : [];
  const f = facets(washers, { sections });
  assert.equal(option(f, 'section', 'Anilhas de vedação').count, 1);
  const chosen = [{group:'section', value:'Anilhas de vedação'}];
  assert.deepEqual(applyFacets(washers, chosen, { sections }).map(p => p[0]), ['4']);
});

// Findings from the final review. The engine keeps module-level vocabulary, so each builds its own search.
const build = products => createSearch(globalThis.BlinkSearch, products,
  { hourtec: [], wahlen: [], wahlenMachines: [] });

test('says so when a misspelling has several possible words', () => {
  const r = build([['500','TAPOES METALICOS'], ['501','DISCO TRAVOES']])('trapoes');
  assert.deepEqual(r.corrected, []);
  assert.deepEqual(r.similar, [{from:'trapoes', options:['tapao','travao']}]);
});
test('never leaves out a four-digit or alphanumeric reference', () => {
  const s = build([['600','SILICONE NEUTRO'], ['446AR05','SPRAY ADITIVO'], ['601','SPRAY SILICONE'],
    ['045143','LIMPEZA DE TRAVOES'], ['045999','LIMPEZA GERAL']]);
  assert.deepEqual(refs(s('silicone 0045')), []);
  assert.deepEqual(refs(s('spray 446AR05')), ['446AR05']);
  const other = s('silicone 446AR05');
  assert.deepEqual([refs(other), other.ignored], [['446AR05'], ['silicone']]);
  assert.deepEqual(refs(s('045 143 limpeza')), ['045143']);
});
test('tries a metric size as written in names before leaving it out', () => {
  const s = build([['700','PARAFUSO INOX 10X20'], ['701','PARAFUSO INOX 8X20']]);
  for (const [query, from] of [['parafuso inox m8x20','m8x20'], ['parafuso inox m8 20','m8 20']]) {
    const r = s(query);
    assert.deepEqual([refs(r), r.ignored, r.corrected], [['701'], [], [{from, to:'8x20'}]]);
  }
});
test('a word left out is named as typed and not reported as corrected', () => {
  const r = build([['800','PARAFUSO INOX'], ['801','SILICONE NEUTRO']])('parafuso silicome');
  assert.deepEqual([refs(r), r.ignored, r.corrected], [['800'], ['silicome'], []]);
});

const { matchesFilters, sortByPrice } = require('./search-core.js');
test('filters apply before the closest-match fallback', () => {
  const s = build([['900','PARAFUSO INOX'], ['901','PARAFUSO LATAO'], ['902','PORCA INOX']]);
  const r = s('parafuso inox', p => p[0] !== '900');
  assert.deepEqual([refs(r), r.ignored], [['901'], ['inox']]);
});
test('a filter without text lists every accepted product', () => {
  const s = build([['900','PARAFUSO INOX'], ['901','PORCA INOX']]);
  assert.deepEqual(refs(s('', p => p[0] === '901')), ['901']);
  assert.deepEqual(refs(s('')), []);
});
test('family and catalogue filters behave as before', () => {
  const entry = { f: ['03'], c: ['1'] };
  assert.ok(matchesFilters(entry, { family: '', catalog: '' }));
  assert.ok(matchesFilters(entry, { family: '03', catalog: '1' }));
  assert.ok(!matchesFilters(entry, { family: '04', catalog: '' }));
  assert.ok(!matchesFilters(entry, { family: '', catalog: '2' }));
  assert.ok(matchesFilters(undefined, { family: 'unclassified', catalog: '' }));
  assert.ok(!matchesFilters(entry, { family: 'unclassified', catalog: '' }));
});
test('price order puts products without price last', () => {
  const list = [['a','A',null], ['b','B',5], ['c','C',1]];
  assert.deepEqual(sortByPrice(list, 'low').map(p => p[0]), ['c','b','a']);
  assert.deepEqual(sortByPrice(list, 'high').map(p => p[0]), ['b','c','a']);
  assert.deepEqual(sortByPrice(list, 'relevance').map(p => p[0]), ['a','b','c']);
});

test('the same value written differently is one option', () => {
  const list = [['20','PARAF. SEXT M05 1.50MM'], ['21','PARAFUSO SEXT M5 1,5MM'], ['22','PORCA M6 2,0MM']];
  const f = facets(list);
  assert.equal(option(f, 'thread', 'M5').count, 2);
  assert.equal(option(f, 'size', '1,5mm').count, 2);
  assert.ok(option(f, 'size', '2mm'));
  assert.equal(option(f, 'kind', 'Parafuso').count, 2);
});

const catalog = ref => ({
  '1': { table: 'Selagem de cobre', norm: 'DIN 7603', values: [['A (mm)', '14,2'], ['C (mm)', '2']] },
  '2': { table: 'Selagem de cobre', norm: 'DIN 7603', values: [['A (mm)', '10,2'], ['C (mm)', '1,5']] },
  '3': { table: 'Cobre', finish: 'A2', values: [['A (mm)', '4,2'], ['C (mm)', '1,5']] },
})[ref];
test('catalogue tables are a step, with their norm and finish', () => {
  const f = facets(washers, { catalog });
  assert.equal(option(f, 'table', 'Selagem de cobre').count, 2);
  assert.equal(option(f, 'norm', 'DIN 7603').count, 2);
  assert.equal(option(f, 'finish', 'A2').count, 2);
});
test('table columns are steps only when every result has table data', () => {
  assert.ok(!facets(washers, { catalog }).some(step => step.label === 'A (mm)'));
  const chosen = [{ group: 'table', value: 'Selagem de cobre' }];
  const left = applyFacets(washers, chosen, { catalog });
  const step = facets(left, { catalog }).find(s => s.label === 'A (mm)');
  assert.deepEqual(step.values.map(v => v.label), ['10,2', '14,2']);
  const next = [...chosen, { group: step.group, value: '10,2' }];
  assert.deepEqual(applyFacets(washers, next, { catalog }).map(p => p[0]), ['2']);
});
