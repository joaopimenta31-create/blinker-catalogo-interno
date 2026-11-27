const fs=require('node:fs'),crypto=require('node:crypto');
const path='public/index.html';
let html=fs.readFileSync(path,'utf8');
const pos=html.indexOf("list.id = 'product-options'");
const from=html.lastIndexOf('<script>',pos),to=html.indexOf('</script>',pos);
if(pos<0||from<0||to<0) throw Error('Picker unavailable');
const picker=fs.readFileSync('stable-picker.js','utf8');
html=html.slice(0,from)+'<script>'+picker+html.slice(to);
const css='#product-options:not([hidden]){display:block;height:min(36vh,300px);height:min(36dvh,300px);overscroll-behavior:contain;overflow-anchor:none}#product-options[hidden]{display:none}.quick-search{overflow-anchor:none}#product-options .search-empty{padding:12px 14px;color:#58636c}';
html=html.replace('</html>','<style>'+css+'</style></html>');
const engine=fs.readFileSync('strict-engine.js','utf8');
const hash=crypto.createHash('sha256').update(engine).digest('hex').slice(0,12);
html=html.replace(/search-engine\.js\?v=[0-9a-f]+/g,'search-engine.js?v='+hash);
fs.writeFileSync('public/search-engine.js',engine);
fs.writeFileSync(path,html);
const vm=require('node:vm');
const ctx=vm.createContext({});
for (const match of html.matchAll(/<script src="((?:data\/)?products(?:-\d+)?\.js)(?:\?[^"]*)?"/g)) vm.runInContext(fs.readFileSync('public/'+match[1],'utf8'),ctx);
vm.runInContext(engine,ctx);
const engineApi=ctx.BlinkSearch;
const records=engineApi.createIndex(vm.runInContext('PRODUCTS',ctx),{products:{}});
const examples=[['massa de cobre','04519'],['cobre massa','04519'],['limpeza de travões 750 ml','045143'],['rebite flor aba larga branco','1161416'],['massa co','04519'],['cobre 04519','04519'],['massa de cobre travões',null]];
for(const [q,ref] of examples){const query=engineApi.prepareQuery(q),results=records.filter(e=>engineApi.rank(e,query)>0);if(ref?!results.some(e=>e.p[0]===ref):results.length)throw Error('Pesquisa falhou '+q);console.log('Teste '+q+' = '+results.length)}
for(const f of fs.readdirSync('public').filter(f=>f.endsWith('.js'))){if(f==='search-engine.js')continue;const s=fs.readFileSync('public/'+f,'utf8'); for(const m of s.matchAll(/(?:window\.search\s*=|window\.rank\s*=|function search\(\)|search\s*=\s*function)/g))console.log('Override '+f+' '+s.slice(m.index,m.index+180));}
