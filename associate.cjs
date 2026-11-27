const fs=require('node:fs');
const path=require('node:path');
const zlib=require('node:zlib');
const folder='public/data/product-documents';
const read=file=>JSON.parse(fs.readFileSync(file,'utf8'));
const write=(file,value)=>fs.writeFileSync(file,JSON.stringify(value));
const registry=read(path.join(folder,'sources.json'));
const evidence=JSON.parse(zlib.gunzipSync(Buffer.from(fs.readFileSync('matches.b64','utf8'),'base64')));
const catalogs=new Map();
const matches=new Map();
const normalize=value=>String(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase();
for(const [slug,page,refs,terms] of evidence){
 const dir='public/catalogs/'+slug+'/';
 if(!catalogs.has(slug)){
  const index=read(dir+'index.json');
  const pages=index.pages || index.page_files.flatMap(file=>read(dir+file));
  catalogs.set(slug,{title:index.title,pages:new Map(pages.map(p=>[p.page,p]))});
 }
 const catalog=catalogs.get(slug), p=catalog.pages.get(page);
 if(!p || !terms.length)continue;
 const pageText=normalize(p.title+' '+p.search);
 if(!terms.slice(0,4).every(word=>pageText.includes(word)))continue;
 if(!fs.existsSync(dir+'page-'+String(page).padStart(4,'0')+'.webp'))continue;
 for(const ref of refs) {
  if(!matches.has(ref))matches.set(ref,{slug,page,catalogTitle:catalog.title});
 }
}
const valid=s=>s && /^[a-z0-9-]+$/.test(s.slug) && Number(s.page)>0 && !/promo|tarif|descont|preço/i.test(s.slug+' '+s.catalogTitle) && fs.existsSync('public/catalogs/'+s.slug+'/page-'+String(s.page).padStart(4,'0')+'.webp');
const buckets=new Map();
function bucket(key){
 if(!buckets.has(key)){
  const file=path.join(folder,key+'.json');
  buckets.set(key,fs.existsSync(file)?read(file):{});
 }
 return buckets.get(key);
}
const stats={printed:0,variant:0,alternate:0}, examples=[];
for(const name of fs.readdirSync(folder).filter(f=>/^[A-Z0-9_]{1,2}\.json$/.test(f)))bucket(name.slice(0,-5));
function assign(ref,record){
 if(record.review?.status==='rejected_misattribution')return;
 const eligible=(record.sources||[]).filter(id=>{const s=registry[id];return s && !/promo|tarif|descont|preço/i.test(s.slug+' '+s.catalogTitle)});
 if(valid(registry[eligible[0]]))return;
 let id=eligible.find(i=>valid(registry[i])),mode='alternate';
 if(!id && record.status==='source_variant_documented'){
  id=(record.variantSources||[]).map(v=>v.sourceId).find(i=>valid(registry[i]));mode='variant';
 }
 if(!id){
  const source=matches.get(ref); if(!source)return;
  id=source.slug+':'+source.page;
  registry[id]??={...source,id};mode='printed';
 }
 record.sources=[id,...(record.sources||[]).filter(i=>i!==id)];
 if(['no_source','source_candidate'].includes(record.status))record.status='source_partial';
 stats[mode]++;
 if(examples.length<8)examples.push([ref,id]);
}
for(const ref of matches.keys()){const b=bucket(ref.slice(0,2));b[ref]??={sources:[],status:'source_partial'};}
for(const [key,b] of buckets){for(const [ref,record] of Object.entries(b))assign(ref,record);write(path.join(folder,key+'.json'),b);}
write(path.join(folder,'sources.json'),registry);
const js='public/product-documents.js';
fs.writeFileSync(js,fs.readFileSync(js,'utf8').replaceAll('documentos-20261113','documentos-associados-20261119'));
const home='public/index.html';
fs.writeFileSync(home,fs.readFileSync(home,'utf8').replace(/product-documents\.js\?v=[\w-]+/,'product-documents.js?v=associados-20261119'));
console.log('Novas ligações',JSON.stringify(stats),JSON.stringify(examples));
