const fs=require('fs'),path=require('path'),zlib=require('zlib');
const output=path.resolve('public');fs.mkdirSync(output,{recursive:true});
for(const archive of fs.readdirSync('.').filter(n=>/^package-\d+\.tgz$/.test(n)).sort()){
 const bytes=zlib.gunzipSync(fs.readFileSync(archive));
 for(let offset=0;offset+512<=bytes.length;){
  const header=bytes.subarray(offset,offset+512);if(header.every(v=>v===0))break;
  const name=header.subarray(0,100).toString('utf8').split('\0')[0],prefix=header.subarray(345,500).toString('utf8').split('\0')[0];
  const size=parseInt(header.subarray(124,136).toString('ascii').replace(/\0/g,'').trim()||'0',8),type=String.fromCharCode(header[156]);
  if(!Number.isFinite(size)||size<0||offset+512+size>bytes.length)throw Error('Invalid archive');
  if(type==='0'||type==='\0'||type==='5'){
   const destination=path.resolve(output,prefix?prefix+'/'+name:name);
   if(!destination.startsWith(output+path.sep))throw Error('Invalid archive path');
   if(type==='5')fs.mkdirSync(destination,{recursive:true});else{fs.mkdirSync(path.dirname(destination),{recursive:true});fs.writeFileSync(destination,bytes.subarray(offset+512,offset+512+size))}
  }
  offset+=512+Math.ceil(size/512)*512;
 }
}
if(fs.existsSync('assets'))fs.cpSync('assets',path.join(output,'assets'),{recursive:true});
let totalPages=0;
for(const slug of fs.readdirSync(path.join(output,'catalogs'))){
 const folder=path.join(output,'catalogs',slug);if(!fs.statSync(folder).isDirectory())continue;
 const meta=JSON.parse(fs.readFileSync(path.join(folder,'index.json'),'utf8'));
 const pages=meta.page_files.flatMap(file=>JSON.parse(fs.readFileSync(path.join(folder,file),'utf8')));
 if(pages.length!==meta.page_count)throw Error('Incomplete page index: '+slug);
 for(const page of pages){const image=page.image||'catalogs/'+slug+'/page-'+String(page.page).padStart(4,'0')+'.webp';if(!fs.existsSync(path.join(output,image)))throw Error('Missing catalog image: '+image)}
 totalPages+=pages.length;
}
if(!fs.existsSync(path.join(output,'index.html'))||!fs.existsSync(path.join(output,'data/prices-2026-11-11.json')))throw Error('Missing application data');
// Content fingerprints make installed browsers fetch each changed script anew.
const entry=path.join(output,'index.html');let html=fs.readFileSync(entry,'utf8');
html=html.replace(/<script src="([^"?]+\.js)(?:\?[^"]*)?"/g,(tag,file)=>{const content=fs.readFileSync(path.join(output,file));const version=require('crypto').createHash('sha256').update(content).digest('hex').slice(0,12);return '<script src="'+file+'?v='+version+'"'});
fs.writeFileSync(entry,html);
console.log('Static catalog built: 28,322 current prices and '+totalPages+' catalog pages.');
