const fs=require('node:fs');
const dir='public/data/product-documents/';
const read=name=>JSON.parse(fs.readFileSync(dir+name,'utf8'));
const registry=read('sources.json');
const buckets=new Map();
const updated=[];
for(const [ref,[slug,page]] of Object.entries(require('./small-links.json'))){
 const key=ref.slice(0,2)+'.json';
 if(!buckets.has(key)) buckets.set(key,read(key));
 const record=buckets.get(key)[ref];
 if(!record || record.review?.status==='rejected_misattribution')continue;
 const id=slug+':'+page;
 const image=s=>'public/catalogs/'+s.slug+'/page-'+String(s.page).padStart(4,'0')+'.webp';
 if((record.sources||[]).map(k=>registry[k]).some(s=>s && !/promo|tarif|descont|preço/i.test(s.slug+' '+s.catalogTitle) && fs.existsSync(image(s))))continue;
 if(!fs.existsSync(image({slug,page})))continue;
 registry[id]??={id,slug,page,catalogTitle:slug==='auto-pequeno-material'?'Auto Pequeno Material':'Manutenção Pequeno Material'};
 record.sources=[id,...(record.sources||[]).filter(k=>k!==id)];
 if(['no_source','source_candidate'].includes(record.status))record.status='source_partial';
 updated.push(ref);
}
for(const [name,values] of buckets)fs.writeFileSync(dir+name,JSON.stringify(values));
fs.writeFileSync(dir+'sources.json',JSON.stringify(registry));
const file='public/product-documents.js';
fs.writeFileSync(file,fs.readFileSync(file,'utf8').replaceAll('documentos-associados-20261119','documentos-medidas-20261119'));
const index='public/index.html';
fs.writeFileSync(index,fs.readFileSync(index,'utf8').replace('product-documents.js?v=associados-20261119','product-documents.js?v=medidas-20261119'));
console.log('Novas por medida',updated.length,updated.slice(0,10).join(','));
require('./coverage-report.cjs');