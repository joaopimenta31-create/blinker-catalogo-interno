const fs=require('fs'),vm=require('vm'),crypto=require('crypto');
const load=file=>fs.readFileSync('public/'+file,'utf8');
const save=(file,text)=>fs.writeFileSync('public/'+file,text);
function change(text,before,after){if(!text.includes(before))throw Error('Elemento em falta: '+before);return text.replace(before,()=>after)}
const groups=[
 ['polimento','polir','polish','polishing','pulir','pulido','pulimento','polidora','pulidora','polisher'],
 ['desengordurante','desengordurar','desengorduramento','desengordurador','desengrasante','desengrasar','desengrasador','desengrase','degreaser','degrease','degreasing','desengraxante'],
 ['motor','engine'],['roda','rueda','wheel'],['jante','llanta','rim'],['pneu','neumatico','tyre','tire'],
 ['esponja','sponge'],['pano','paño','cloth'],['verniz','barniz','varnish','lacquer'],['primario','imprimacion','primer'],
 ['couro','pele','cuero','piel','leather'],['farol','farois','faro','headlight','headlamp'],
 ['parafuso','parafusos','tornillo','screw'],['anilha','arandela','washer'],['porca','tuerca','nut'],
 ['lixa','lija','sandpaper'],['espuma','foam'],['disco','disc','disk'],['escova','cepillo','brush'],
 ['liquido','liquid'],['vidro','cristal','cristales','glass'],['luva','guante','glove']
];
let engine=change(load('search-engine.js'),'const aliases=new Map();','groups.push(...'+JSON.stringify(groups)+');\nconst aliases=new Map();');
engine=change(engine,'root.BlinkSearch={','root.BlinkSearch={canonical,tokens,');
save('search-engine.js',engine);
let html=load('index.html');
function patch(before,after){html=change(html,before,after)}
patch('function isHourtec(q)',"function brandTerms(value){const pattern=/\\b1[\\s-]*hou(?:r)?[\\s-]*tec\\b/i;return {brand:pattern.test(value),terms:value.replace(pattern,' ').trim()}}\nfunction isHourtec(q)");
patch('const brand=isHourtec(q);','const scoped=brandTerms(q);const brand=scoped.brand;');
patch("$('hourtec-link').hidden=!isHourtec(q);","$('hourtec-link').hidden=!brandTerms(q).brand;");
patch('const query=prepareQuery(q);','const query=prepareQuery(scoped.terms);');
patch('let score=brand?Number(hourtecRefs.has(entry.p[0])):rank(entry,query);','if(brand&&!hourtecRefs.has(entry.p[0]))continue;let score=rank(entry,query);');
patch('refresh(prefixProducts());\n    scheduleSearch();','close();\n    scheduleSearch();');
patch('if (!isHourtec(input.value) && !dismissed && list.hidden && document.activeElement === input && input.value.trim())','if (!dismissed && document.activeElement === input && input.value.trim())');
patch('refresh(cachedResults.slice(0,suggestionLimit).map(row => row.p));','refresh(cachedResults.length?cachedResults.slice(0,suggestionLimit).map(row=>row.p):input.value.trim().length<3?prefixProducts():[]);');
patch('list.hidden = !list.childElementCount;', "if(products.length&&cachedResults.length>suggestionLimit){const all=document.createElement('div');all.id='suggested-product-all';all.setAttribute('role','option');all.textContent='Ver os '+cachedResults.length+' resultados';all.onclick=()=>{dismissed=true;close();input.blur();document.getElementById('found').scrollIntoView({block:'start'})};list.append(all)}\n    list.hidden = !list.childElementCount;");
let catalog=load('catalog.js');
catalog=change(catalog,"terms=norm($('catalog-search').value.trim()).split(/\\s+/).filter(Boolean)","scoped=brandTerms($('catalog-search').value),terms=BlinkSearch.tokens(scoped.terms).map(BlinkSearch.canonical)");
catalog=change(catalog,"terms.every(q=>p.search.includes(q))","(!scoped.brand||base==='catalogs/1hourtec/'||p.references.some(r=>hourtecRefs.has(r)))&&terms.every(q=>p.search.includes(q)||(p.searchWords??=new Set(BlinkSearch.tokens(p.search).map(BlinkSearch.canonical))).has(q))");
save('catalog.js',catalog);
const version=s=>crypto.createHash('sha256').update(s).digest('hex').slice(0,12);
html=html.replace(/search-engine\.js\?v=[\da-f]+/,'search-engine.js?v='+version(engine)).replace(/catalog\.js\?v=[\da-f]+/,'catalog.js?v='+version(catalog));
save('index.html',html);
const ctx=vm.createContext({clearTimeout,window:{dispatchEvent(){}},Event:class {}});
for(const m of html.matchAll(/<script src="(products\.js|data\/products-[^"?]+)\?/g))vm.runInContext(load(m[1]),ctx);
vm.runInContext(engine,ctx);
vm.runInContext(html.slice(html.indexOf('for(const p of [["690737"'),html.indexOf('const index=BlinkSearch')),ctx);
vm.runInContext("const index=BlinkSearch.createIndex(PRODUCTS,{products:{}});const elements={};const $=id=>(elements[id]||={value:'',style:{}});const norm=BlinkSearch.normalize,prepareQuery=BlinkSearch.prepareQuery,rank=BlinkSearch.rank,esc=String,money=String,familyBadges=()=>'';let searchTimer,limit=40,cachedResults=[],lastKey='',searchMatchNote='';"+html.slice(html.indexOf('const hourtecRefs='),html.indexOf('function detail(ref)')),ctx);
for(const [term,ref] of [['1hourtec','4453309'],['1houtec','4456406'],['polish','4455611'],['pulimento','4455611'],['polimento','4455312'],['polimemto','4455611'],['degreaser','045173'],['desengrasante','4456406'],['desengordurante','44550'],['1hourtec polish','4455611'],['1hourtec desengrasante','44550'],['4453309','4453309']]){
const refs=vm.runInContext("$('q').value="+JSON.stringify(term)+";search();cachedResults.map(row=>row.p[0])",ctx);
if(!refs.includes(ref)||(['1hourtec','1houtec'].includes(term)&&refs.length!==438))throw Error('Falha: '+term);
console.log(term+': '+refs.length);
}