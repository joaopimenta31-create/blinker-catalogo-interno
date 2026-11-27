const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const read = name => fs.readFileSync(path.join('public', name),'utf8');
const html = read('index.html');
const context = vm.createContext({});
for (const match of html.matchAll(/<script src="((?:data\/)?products(?:-\d+)?\.js)(?:\?[^"]*)?"/g)) {
  vm.runInContext(read(match[1]), context);
}
const rows = new Map(vm.runInContext('PRODUCTS',context).map(row => [row[0],row[1]]));
for (const match of html.matchAll(/for\(const p of (\[\[.*?\]\])\)\{if\(!PRODUCTS\.some/g)) {
  for (const [ref,name] of JSON.parse(match[1])) if (!rows.has(ref)) rows.set(ref,name);
}
const sheets = JSON.parse(read('product-specs.js').match(/const PRODUCT_TECH_SHEETS=(.*);\r?\n/)[1]);
const directory = 'data/product-documents/';
const registry = JSON.parse(read(directory+'sources.json'));
const records = new Map();
for (const file of fs.readdirSync('public/'+directory).filter(name => /^[A-Z0-9_]{1,2}\.json$/.test(name))) {
  for (const entry of Object.entries(JSON.parse(read(directory+file)))) records.set(...entry);
}
const exists = file => !!file && fs.existsSync(path.join('public',file));
function coverage(ref) {
  const photo = ref === '045169' ? 'assets/customer-045169.webp' : sheets[ref]?.photo?.path;
  if (photo) return exists(photo) ? 'individual' : 'missing';
  const record = records.get(ref);
  if (!record || record.review?.status === 'rejected_misattribution') return 'missing';
  const source = (record.sources||[]).map(id => registry[id]).find(s => s && /^[a-z0-9-]+$/.test(s.slug) && Number.isInteger(Number(s.page)) && Number(s.page)>0 && !/promo|tarif|descont|preço/i.test(s.slug+' '+s.catalogTitle));
  if (!source) return 'missing';
  return exists('catalogs/'+source.slug+'/page-'+String(source.page).padStart(4,'0')+'.webp') ? 'page' : 'missing';
}
const list = Array.from(rows, ([ref,name]) => [ref,name,coverage(ref)]);
const counts = {individual:0,page:0,missing:0};
for (const row of list) counts[row[2]]++;
if (rows.size<20000 || coverage('045169')!=='individual') throw Error('Falha na validação das referências');
fs.writeFileSync('public/coverage-data.json',JSON.stringify(list));
fs.copyFileSync('coverage.html','public/cobertura.html');
fs.writeFileSync('public/index.html',html.replace('</nav>','<a class="action" href="cobertura.html">Cobertura das apresentações</a></nav>').replace('</html>','<style>nav{flex-wrap:wrap}</style></html>'));
console.log('Cobertura das apresentações '+JSON.stringify(counts));
