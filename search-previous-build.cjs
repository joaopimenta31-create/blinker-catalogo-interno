require('./original-build.cjs');
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const path='public/index.html';
let html=fs.readFileSync(path,'utf8');
const marker='function refresh(products) {';
assert.equal(html.split(marker).length,2);
const source=fs.readFileSync('pesquisa-blinker.cjs','utf8').split('module.exports=')[0];
const inject=source+`
  let sugerirTodos;
  function refresh(products) {
    if (dismissed || !input.value.trim()) return;
    const strict = cachedResults.map(row=>row.p);
    const scoped = document.getElementById('family').value || document.getElementById('catalog').value || brandTerms(input.value).brand;
    if (!sugerirTodos) sugerirTodos = criarSugestoes(PRODUCTS);
    const ranked = scoped ? criarSugestoes(strict) : sugerirTodos;
    products = ranked(input.value, strict, suggestionLimit);
`;
html=html.replace(marker,()=>inject);
for(const block of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g))if(block[1].trim())new vm.Script(block[1]);
const ctx=vm.createContext({});
for(const match of html.matchAll(/<script src="((?:data\/)?products(?:-\d+)?\.js)(?:\?[^"]*)?"/g)) vm.runInContext(fs.readFileSync('public/'+match[1],'utf8'),ctx);
const all=vm.runInContext('PRODUCTS',ctx),suggest=require('./pesquisa-blinker.cjs').criarSugestoes(all);
for(const q of ['massa de cob','masa cobre','04519']){
const rows=suggest(q);assert(rows.length);if(q==='04519')assert.equal(rows[0][0],q);else assert(rows[0][1].toLowerCase().includes('cobre'));console.log('Sugestão validada',q,rows[0][0],rows[0][1]);
}
fs.writeFileSync(path,html);