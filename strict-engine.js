/* Search-only prototype. No product, technical, price or equivalence data is changed. */
(function(root){
'use strict';
const stop=new Set('de da do dos das o a os as para por em no na nos nas um uma e y del la el los las al x'.split(' '));
const exceptions=new Set(['gas','abs','hss','inox','torx','lapis','tenis','mais','menos','texas','pvc','din','iso']);
function normalize(value){return String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim().replace(/\s+/g,' ')}
function compactReference(value){return normalize(value).replace(/[\s.\-_/]/g,'')}
function singular(word){
 if(/\d/.test(word)||word.length<4||exceptions.has(word))return word;
 if(word.endsWith('oes')||word.endsWith('aos')||word.endsWith('aes'))return word.slice(0,-3)+'ao';
 if(word.endsWith('ais'))return word.slice(0,-3)+'al';
 if(word.endsWith('eis'))return word.slice(0,-3)+'el';
 if(word.endsWith('ois'))return word.slice(0,-3)+'ol';
 if(word.endsWith('is')&&word.length>4)return word.slice(0,-2)+'il';
 if(word.endsWith('s')&&!word.endsWith('ss'))return word.slice(0,-1);
 return word;
}
const groups=[
 ['limpar','limpa','limpeza','limpador','limpadora','limpiador','limpiadora','limpiar','limpieza','cleaner','cleaning'],
 ['travao','travoes','freno','frenos','brake','brakes'],
 ['rebite','rebites','remache','remaches','rivet','rivets'],
 ['parafuso','parafusos','tornillo','tornillos'],
 ['porca','porcas','tuerca','tuercas'],['anilha','anilhas','arandela','arandelas'],
 ['bujao','bujoes','bujon','bujones'],['tampao','tampoes','tapon','tapones'],
 ['massa','massas','pasta','pastas','graxa','graxas','grasa','grasas','grease','paste'],
 ['cobre','copper'],['oleo','oleos','aceite','aceites','oil','oils'],
 ['cola','colas','adesivo','adesivos','adhesivo','adhesivos','glue'],
 ['vedante','vedantes','selante','selantes','sellador','selladores'],
 ['silicone','silicona'],
 ['calcado','calcados','calzado','calzados','sapato','sapatos','zapato','zapatos','sapatilha','sapatilhas','zapatilla','zapatillas'],
 ['bota','botas'],['luva','luvas','guante','guantes'],['oculo','oculos','gafa','gafas'],
 ['parabrisas','parabrisa'],['vidro','vidros','cristal','cristales'],
 ['remover','removedor','removedores','eliminar','eliminador','eliminadores','tirar'],
 ['sem','sin','without']
];
groups.push(...[["polimento","polir","polish","polishing","pulir","pulido","pulimento","polidora","pulidora","polisher"],["desengordurante","desengordurar","desengorduramento","desengordurador","desengrasante","desengrasar","desengrasador","desengrase","degreaser","degrease","degreasing","desengraxante"],["motor","engine"],["roda","rueda","wheel"],["jante","llanta","rim"],["pneu","neumatico","tyre","tire"],["esponja","sponge"],["pano","paño","cloth"],["verniz","barniz","varnish","lacquer"],["primario","imprimacion","primer"],["couro","pele","cuero","piel","leather"],["farol","farois","faro","headlight","headlamp"],["parafuso","parafusos","tornillo","screw"],["anilha","arandela","washer"],["porca","tuerca","nut"],["lixa","lija","sandpaper"],["espuma","foam"],["disco","disc","disk"],["escova","cepillo","brush"],["liquido","liquid"],["vidro","cristal","cristales","glass"],["luva","guante","glove"]]);
const aliases=new Map();for(const group of groups)for(const word of group)aliases.set(singular(normalize(word)),singular(group[0]));
function canonical(word){const value=singular(word.replace(',','.'));return aliases.get(value)||value}
function tokens(value){
 let text=normalize(value).replace(/\bpara[\s-]*brisas?\b/g,'parabrisas');
 text=text.replace(/(\d)\s*[x×]\s*(?=\d)/g,'$1 x ').replace(/\b(din|iso|en|ral)\s*(\d)/g,'$1 $2');
 return (text.match(/[a-z]+\d+(?:[.,]\d+)?(?:[a-z]+\d*)*|[a-z]+|\d+(?:[.,]\d+)?/g)||[]).map(word=>word.replace(',','.'));
}
let rawVocabulary=new Set(),canonicalVocabulary=new Set(),references=new Set(),prefixes=new Set();
function createIndex(products,familyData){
 rawVocabulary=new Set();canonicalVocabulary=new Set();references=new Set();prefixes=new Set();
 const indexed=products.map(p=>{
  const ref=compactReference(p[0]);references.add(ref);for(let n=3;n<=ref.length;n++)prefixes.add(ref.slice(0,n));
  const raw=tokens(p[1]),words=raw.map(canonical);for(const word of raw)rawVocabulary.add(word);
  // This compound explicitly names rust; do not equate rust with oxide paint, oil or descaler.
  if(raw.includes('antiferrugem'))words.push('ferrugem');
  for(const word of words)canonicalVocabulary.add(word);
  const significant=words.filter(w=>!stop.has(w));
  const dimensions=new Set();for(let i=0;i+2<raw.length;i++)if(/^(?:m)?\d+(?:[.]\d+)?$/.test(raw[i])&&raw[i+1]==='x'&&/^\d+(?:[.]\d+)?$/.test(raw[i+2]))dimensions.add(raw[i]+'x'+raw[i+2]);
  return {p,ref,name:normalize(p[1]),words,dimensions,rawWords:new Set(raw.map(singular)),wordSet:new Set(words),sequence:' '+significant.join(' ')+' ',first:significant[0],families:familyData.products[p[0]]?.f||[],catalogs:familyData.products[p[0]]?.c||[]};
 });
 for(const group of groups)for(const word of group)rawVocabulary.add(word);
 return indexed;
}
function oneEdit(a,b){
 if(Math.abs(a.length-b.length)>1)return false;
 let i=0,j=0,edits=0;
 while(i<a.length&&j<b.length){
  if(a[i]===b[j]){i++;j++;continue}
  if(++edits>1)return false;
  if(a.length===b.length&&a[i]===b[j+1]&&a[i+1]===b[j]){i+=2;j+=2}
  else if(a.length>b.length)i++;else if(a.length<b.length)j++;else{i++;j++}
 }
 return edits+(i<a.length||j<b.length?1:0)<=1;
}
function wordUnit(raw){
 const key=canonical(raw),variants=[{word:key,score:100,kind:'word'}];
 // Known words and all numeric specifications must never be silently substituted.
 if(!canonicalVocabulary.has(key)&&!aliases.has(singular(raw))&&!/\d/.test(raw)){
  const candidates=new Map();
  if(raw.length>=3)for(const word of rawVocabulary)if(word.startsWith(raw)&&word!==raw)candidates.set(canonical(word),{word:canonical(word),score:60,kind:'prefix'});
  if(!candidates.size&&raw.length>=6)for(const word of rawVocabulary){
   if(word[0]!==raw[0]||/\d/.test(word)||!oneEdit(raw,word))continue;
   const candidate=canonical(word);if(canonicalVocabulary.has(candidate))candidates.set(candidate,{word:candidate,score:40,kind:'fuzzy'});
  }
  variants.push(...[...candidates.values()].sort((a,b)=>a.word.localeCompare(b.word)).slice(0,12));
 }
 return {raw,key,variants};
}
function prepareQuery(value){
 const whole=normalize(value),withoutLabel=whole.replace(/^(?:ref(?:erencia)?)[\s.:#-]+/,'');
 const compact=compactReference(withoutLabel),code=references.has(compact)||compact.length>=3&&prefixes.has(compact)||/^\d{5,}$/.test(compact);
 if(code || /^\d{1,2}$/.test(compact))return {whole,compact,code:true,empty:!whole,units:[{raw:compact,key:compact,variants:[]}],usesFuzzy:false};
 const raw=tokens(withoutLabel),units=[];
 for(let i=0;i<raw.length;i++){
  if(/^(?:m)?\d+(?:[.]\d+)?$/.test(raw[i])&&raw[i+1]==='x'&&/^\d+(?:[.]\d+)?$/.test(raw[i+2]||'')){units.push({dimension:[raw[i],raw[i+2]],key:raw[i]+'x'+raw[i+2],variants:[]});i+=2;continue}
  if(stop.has(raw[i]))continue;
  if(canonical(raw[i])==='sem'&&raw[i+1]){units.push({negative:canonical(raw[++i]),key:'sem',variants:[]});continue}
  const unit = wordUnit(raw[i]);
  if (i === raw.length - 1 && /^[a-z]+$/.test(raw[i]) &&
      (raw[i].length <= 2 || (!canonicalVocabulary.has(unit.key) && !aliases.has(singular(raw[i]))))) unit.prefix = raw[i];
  units.push(unit);
 }
 return {whole,compact,code:false,empty:!whole,units,usesFuzzy:units.some(u=>u.variants.some(v=>v.kind==='fuzzy'))};
}
function rank(entry,query){
 if(query.empty)return 1;
 if(query.code){if(entry.ref===query.compact)return 1000000;if(entry.ref.startsWith(query.compact))return 500000-Math.min(entry.ref.length,100);return 0}
 if(!query.units.length)return 0;
 let score=0;
 for(const unit of query.units){
  let found=0;
  if(unit.dimension){const [left,right]=unit.dimension;if(entry.dimensions.has(left+'x'+right)||!left.startsWith('m')&&entry.dimensions.has('m'+left+'x'+right))found=150}
  else if(unit.negative){if((' '+entry.words.join(' ')+' ').includes(' sem '+unit.negative+' '))found=150}
  else{
   for(const variant of unit.variants)if(entry.wordSet.has(variant.word))found=Math.max(found,variant.kind==='word'?(entry.rawWords.has(singular(unit.raw))?110:90):variant.score);
   if(!found && unit.prefix && entry.words.some(w=>w.startsWith(unit.prefix))) found=55;
   if(!found && unit.prefix) for (const word of entry.rawWords) if(word.startsWith(unit.prefix)){found=50;break;}
   if(unit.raw.length>=3 && /\d/.test(unit.raw) && entry.ref.startsWith(unit.raw))found=Math.max(found,120);
  }
  // Every meaningful term is required. Never hide an unmatched qualifier.
  if(!found)return 0;score+=found;
 }
 const sequence=query.units.map(u=>u.negative?'sem '+u.negative:u.key).join(' ');
 if(entry.sequence.includes(' '+sequence+' '))score+=80;
 if(entry.first===query.units[0].key)score+=80;
 if(entry.name===query.whole)score+=600;
 return score;
}
root.BlinkSearch={canonical,tokens,createIndex,prepareQuery,rank,normalize,compactReference};
})(globalThis);
