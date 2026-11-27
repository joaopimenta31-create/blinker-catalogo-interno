require('./before-favorites.cjs');
const fs=require('node:fs');
const path='public/index.html';
const html=fs.readFileSync(path,'utf8');
const script=fs.readFileSync('favorites.js','utf8');
const styles=fs.readFileSync('favorites.css','utf8');
if(!html.includes('Comparar os dois') || !html.includes('function detail(ref)'))throw Error('Ficha indisponível');
fs.writeFileSync(path,html.replace('</html>',()=>'<style>'+styles+'</style><script>'+script+'</script></html>'));
const refs = require('./thumbnail-refs.json');
const photos = Object.fromEntries(refs.map((ref,i)=>[ref,i]));
const tech = JSON.parse(fs.readFileSync('public/product-specs.js','utf8').match(/const PRODUCT_TECH_SHEETS=(.*);\r?\n/)[1]);
for(const [ref,sheet] of Object.entries(tech)) {
  if(sheet.photo?.path && fs.existsSync('public/'+sheet.photo.path)) photos[ref]=sheet.photo.path;
}
photos['045169']='assets/customer-045169.webp';
const full=fs.readFileSync(path,'utf8');
const marker='option.append(name, ref);';
if(full.split(marker).length!==2) throw Error('Picker renderer changed');
const css='.has-search-photo{position:relative}#product-options [role=option].has-search-photo,#results .item.has-search-photo{padding-left:68px;min-height:56px;box-sizing:border-box}.search-photo{position:absolute;left:10px;top:4px;width:48px;height:48px;border-radius:5px;object-fit:contain;background-color:white;background-repeat:no-repeat;background-size:768px auto;pointer-events:none}';
const helper='const searchPhotos='+JSON.stringify(photos)+';\n'+fs.readFileSync('search-photos.js','utf8');
const idx=full.lastIndexOf('<script>',full.indexOf(marker));
let output=full.slice(0,idx)+'<style>'+css+'</style><script>'+helper+'</script>'+full.slice(idx).replace(marker,marker+' addSearchPhoto(option,p[0]);');
output=output.replace('</html>','<script>addResultPhotos()</script></html>');
for(const m of output.matchAll(/<script>([\s\S]*?)<\/script>/g))new (require('node:vm').Script)(m[1]);
if(!fs.existsSync('public/assets/product-thumbnails-v1.webp'))throw Error('Missing thumbnail asset');
console.log('Search thumbnails: '+Object.keys(photos).length+' mapped references');
fs.writeFileSync(path,output);

require('./stable-search.cjs');