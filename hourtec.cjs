const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve('public');
const source = file => path.join(root, file);
const read = file => JSON.parse(fs.readFileSync(source(file), 'utf8'));
const data = require('./hourtec-pages.json');
const pages = [], toc = [], allRefs = new Set();
let lastGroup;
for (const [slug, selected] of Object.entries(data)) {
  const dir = 'catalogs/' + slug + '/';
  const catalog = read(dir+'index.json');
  const original = catalog.pages || catalog.page_files.flatMap(f => read(dir+f));
  for (const [number, refs, group] of selected) {
    const p = original.find(row => row.page === number);
    if (!p) throw Error('Página em falta: '+slug+' '+number);
    const page = pages.length+1;
    if (group !== lastGroup) toc.push({level:1,page,title:group});
    lastGroup = group;
    refs.forEach(ref => allRefs.add(ref));
    const image = p.image || dir+'page-'+String(number).padStart(4,'0')+'.webp';
    if (!fs.existsSync(source(image))) throw Error('Imagem em falta: '+image);
    pages.push({...p,page,image,references:refs,title:p.title+' · '+catalog.title+', p. '+number});
  }
}
const dir = source('catalogs/1hourtec');
fs.mkdirSync(dir,{recursive:true});
fs.writeFileSync(path.join(dir,'index.json'), JSON.stringify({title:'1HOURTEC',source_url:'https://blinkergroup.com/pt-pt/1hourtec/',page_count:pages.length,toc,pages}));
let html = fs.readFileSync(source('index.html'),'utf8');
function patch(before,after) {
  if (!html.includes(before)) throw Error('Elemento em falta: '+before);
  html=html.replace(before,()=>after);
}
patch('const index=BlinkSearch', "for(const p of [[\"690737\",\"Secador de 1800 W\",null,\"\",\"Sob consulta\"],[\"025067\",\"Esponja vermelha de acabamento 200 \u00d7 30 mm\",null,\"\",\"Sob consulta\"]]){if(!PRODUCTS.some(row=>row[0]===p[0]))PRODUCTS.push(p)}\n" + "for(const p of [[\"44514\", \"Lâmpada manual UV\", null, \"\", \"Sob consulta\"], [\"44515\", \"Óculos de proteção UV\", null, \"\", \"Sob consulta\"], [\"44597103\", \"Aparelho HS de alta espessura rápido 3,5 L, cinzento escuro\", null, \"\", \"Sob consulta\"], [\"4456000\", \"Frasco de vidro para veludo, 30 ml\", null, \"\", \"Sob consulta\"], [\"44560001\", \"Frasco de vidro para pó adesivo, 60 ml\", null, \"\", \"Sob consulta\"], [\"4456016\", \"Esponja multiusos para restauro de pele\", null, \"\", \"Sob consulta\"], [\"4456609\", \"Cola para couro de base aquosa\", null, \"\", \"Sob consulta\"], [\"4459223\", \"Mat Foil, adesivo para mascarar\", null, \"\", \"Sob consulta\"], [\"4459215\", \"Cânulas de boca fina, 12 unidades\", null, \"\", \"Sob consulta\"], [\"4459245\", \"Espuma de vácuo para placa de injeção\", null, \"\", \"Sob consulta\"], [\"4459227\", \"Espátula para caravanas\", null, \"\", \"Sob consulta\"], [\"4459242\", \"Pipeta de 3,5 ml, 10 unidades\", null, \"\", \"Sob consulta\"]]){if(!PRODUCTS.some(row=>row[0]===p[0]))PRODUCTS.push(p)}\nconst index=BlinkSearch");
patch('function search(){', 'const hourtecRefs=new Set('+JSON.stringify([...allRefs])+');\nfunction isHourtec(q){return /^1hour?tec$/i.test(q.replace(/[\\s-]+/g,""))}\nfunction search(){');
patch("let arr=cachedResults;", "const brand=isHourtec(q);if(brand)limit=hourtecRefs.size;let arr=cachedResults;");
patch('let score=rank(entry,query);', 'let score=brand?Number(hourtecRefs.has(entry.p[0])):rank(entry,query);');
patch("searchMatchNote=query.usesFuzzy?", "searchMatchNote=!brand&&query.usesFuzzy?");
patch('const value = BlinkSearch.normalize(input.value);', 'if(isHourtec(input.value)) return [];\n    const value = BlinkSearch.normalize(input.value);');
patch("if (!dismissed && list.hidden", "if (!isHourtec(input.value) && !dismissed && list.hidden");
patch('</select><div class="catalog-filters"', '<option value="1hourtec">1HOURTEC</option></select><div class="catalog-filters"');
patch('</nav>','<button type="button" onclick="openCatalogPage(\'1hourtec\',1)">1HOURTEC</button></nav>');
patch('<p id="found"', '<a id="hourtec-link" hidden href="#1hourtec">Abrir catálogo visual 1HOURTEC</a><p id="found"');
patch("if(!q&&!family&&!catalog)", "$('hourtec-link').hidden=!isHourtec(q);if(!q&&!family&&!catalog)");
patch('</html>',`<script>
const brandCard=document.createElement('div');
brandCard.className='panel';
brandCard.innerHTML='<button class="catalog-card-button" type="button"><img loading="lazy" src="${pages.find(p=>p.references.includes('4453309'))?.image||pages[0].image}" alt=""><b>1HOURTEC</b></button>';
brandCard.firstChild.onclick=()=>openCatalogPage('1hourtec',1);
document.getElementById('catalogs').appendChild(brandCard);
document.getElementById('hourtec-link').onclick=e=>{e.preventDefault();openCatalogPage('1hourtec',1)};
if(location.hash==='#1hourtec')openCatalogPage('1hourtec',1);
</script></html>`);
fs.writeFileSync(source('index.html'),html);
console.log('1HOURTEC: '+pages.length+' páginas, '+allRefs.size+' referências');
// Exercise the generated storefront with its own product records before publishing.
const vm=require('node:vm');
const context=vm.createContext({clearTimeout,window:{dispatchEvent(){}},Event:class {}});
for(const m of html.matchAll(/<script src="(products\.js|data\/products-[^"?]+)\?/g)) vm.runInContext(fs.readFileSync(source(m[1]),'utf8'),context);
const productSetup=html.slice(html.indexOf('for(const p of [["690737"'),html.indexOf('const index=BlinkSearch'));
vm.runInContext(productSetup,context);
vm.runInContext(`const index=PRODUCTS.map(p=>({p,families:[],catalogs:[]}));const elements={};const $=id=>(elements[id]||={value:'',style:{}});const norm=s=>s.toLowerCase(),prepareQuery=()=>({}),esc=String,money=String,familyBadges=()=>'';let searchTimer,limit=40,cachedResults=[],lastKey='',searchMatchNote='';`+html.slice(html.indexOf('const hourtecRefs='),html.indexOf('function detail(ref)')),context);
for(const term of ['1hourtec','1houtec','1 Hour-Tec']){
 const count=vm.runInContext("$('q').value="+JSON.stringify(term)+";search();cachedResults.length",context);
 if(count!==allRefs.size)throw Error('Pesquisa '+term+' devolveu '+count+' de '+allRefs.size);
}
console.log('Pesquisa verificada nas três grafias.');
