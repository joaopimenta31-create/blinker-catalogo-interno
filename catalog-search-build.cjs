require('./search-previous-build.cjs');
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const file = 'public/index.html';
let html = fs.readFileSync(file,'utf8');
function patch(before, after) {
  assert.equal(html.split(before).length, 2, before);
  html = html.replace(before, () => after);
}
patch('let renderedKey;', `let renderedKey;
  let savedSearch;
  let restoreOffset;
  const back = document.createElement('button');
  back.type = 'button';
  back.hidden = true;
  back.textContent = 'Voltar aos resultados';
  wrapper.after(back);
  function remember(event) {
    if (!event.target.closest('[role="option"]') && event.key !== 'Enter') return;
    if (list.hidden) return;
    savedSearch = {query:input.value, offset:list.scrollTop};
    back.hidden = false;
  }
  list.addEventListener('click',remember,true);
  list.addEventListener('pointerup',remember,true);
  input.addEventListener('keydown',event=>{if(event.key==='Enter' && active>=0) remember(event)},true);
  back.addEventListener('click',()=>{
    if (!savedSearch) return;
    input.value = savedSearch.query;
    dismissed = false;
    renderedKey = undefined;
    restoreOffset = savedSearch.offset;
    back.hidden = true;
    input.dispatchEvent(new Event('input',{bubbles:true}));
    search();
    refresh(cachedResults.map(row=>row.p));
    input.scrollIntoView({block:'center'});
  });`);
patch('list.scrollTop = 0;', `const offset = restoreOffset ?? 0;
    restoreOffset = undefined;
    requestAnimationFrame(()=>{if(renderedKey===key) list.scrollTop = offset});`);
const context = vm.createContext({});
for(const match of html.matchAll(/<script src="((?:data\/)?products(?:-\d+)?\.js)(?:\?[^"]*)?"/g)) vm.runInContext(fs.readFileSync('public/'+match[1],'utf8'),context);
const all = vm.runInContext('PRODUCTS',context);
const suggest = require('./pesquisa-blinker.cjs').criarSugestoes(all);
assert.equal(suggest('04548210')[0][0],'04548210');
assert.ok(suggest('sapato').length);
assert.deepEqual(suggest('sapato'),suggest('sapatos'));
assert.ok(suggest('rebites de aba larga').length);
const brand = JSON.parse(fs.readFileSync('hourtec-pages.json','utf8'));
const refs = new Set(Object.values(brand).flatMap(pages=>pages.flatMap(page=>page[1])).map(String));
const family = all.filter(p=>refs.has(String(p[0])));
assert.ok(family.length>1);
assert.equal(require('./pesquisa-blinker.cjs').criarSugestoes(family)('1hourtec',family, family.length).length,family.length);
for(const block of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)) if(block[1].trim()) new vm.Script(block[1]);

const canonical = value=>String(value).trim().replace(/^(\d{3})\s+(?=\d)/,'$1');
patch('const query=prepareQuery(scoped.terms);', 'const codigoCanonico='+canonical.toString()+';const codigoPedido=codigoCanonico(scoped.terms);const porReferencia=/^\\d{3,}$/.test(codigoPedido);const query=prepareQuery(scoped.terms);');
patch('let score=rank(entry,query);','let score;if(porReferencia){const ref=codigoCanonico(entry.p[0]);score=ref===codigoPedido?1000:ref.startsWith(codigoPedido)?900:0;}else score=rank(entry,query);');
const criar = require('./pesquisa-blinker.cjs').criarSugestoes;
const mock = criar([['045 48210','Produto A'],['612123','Produto B'],['111333','Produto 045']]);
assert.deepEqual(mock('04548210'),mock('045 48210'));
assert.equal(mock('045')[0][0],'045 48210');
assert.equal(mock('045').length,1);
assert.equal(mock('612 123')[0][0],'612123');
for (const prefix of ['045','612']) {
  const rows = all.filter(row=>canonical(row[0]).startsWith(prefix));
  if(prefix==='045') assert.ok(rows.length);
  assert.equal(suggest(prefix,[],Infinity).length,rows.length);
  if(!rows.length){console.log('Família sem referências no índice',prefix);continue;}
  const row = rows.find(row=>/^\d{4,}$/.test(canonical(row[0])));
  assert.ok(row);
  const ref=canonical(row[0]);
  assert.deepEqual(suggest(ref),suggest(prefix+' '+ref.slice(3)));
  assert.equal(canonical(suggest(ref)[0][0]),ref);
  console.log('Família verificada',prefix,rows.length,'referências');
}

fs.writeFileSync(file, html);
console.log('Pesquisa validada:',all.length,'referências;',family.length,'artigos 1HOURTEC');
