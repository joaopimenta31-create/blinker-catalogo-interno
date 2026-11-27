require('./proposal-build.cjs');
const fs=require('node:fs'),assert=require('node:assert/strict'),vm=require('node:vm');
const original=fs.readFileSync('compare.js','utf8');
let next=original;
function change(before,after){
  assert.equal(next.split(before).length,2,before);
  next=next.replace(before,()=>after);
}
change("make('button','Comparar os dois')","make('button','Abrir comparação')");
change("selected.size === 1 ? '1 de 2 · Ref. ' + selected.keys().next().value : '2 de 2 · ' + [...selected.keys()].join(' e ')","selected.size + ' de 3 · ' + [...selected.keys()].join(' · ')");
change("open.hidden = selected.size !== 2","open.hidden = selected.size < 2");
change("!active && selected.size === 2","!active && selected.size >= 3");
change("selected.size < 2) selected.set","selected.size < 3) selected.set");
change("if (selected.size !== 2) return;","if (selected.size < 2) return;");
change("dialog.append(table);",`const proposalRow=body.insertRow();
    const heading=make('th','Proposta');
    heading.scope='row';
    proposalRow.append(heading);
    for(const product of products){
      const cell=make('td');
      const add=make('button','Adicionar à proposta');
      add.type='button';
      add.dataset.quoteRef=product[0];
      add.setAttribute('aria-label','Adicionar à proposta · '+product[1]+' · '+product[0]);
      cell.append(add);
      proposalRow.append(cell);
    }
    const scroll=make('div');
    scroll.className='comparison-scroll';
    scroll.append(table);
    dialog.append(scroll);`);
const path='public/index.html';
let html=fs.readFileSync(path,'utf8');
assert.equal(html.split(original).length,2);
assert.ok(fs.readFileSync('public/proposta.js','utf8').includes("closest('[data-quote-ref]')"));
new vm.Script(next);
html=html.replace(original,()=>next).replace('</head>','<style>.comparison-scroll{overflow-x:auto;max-width:100%}.comparison-scroll table{width:100%}.comparison-scroll td{min-width:9em}</style></head>');
if(!html.includes('.comparison-scroll{'))html+='<style>.comparison-scroll{overflow-x:auto;max-width:100%}.comparison-scroll table{width:100%}.comparison-scroll td{min-width:9em}</style>';
fs.writeFileSync(path,html);
class Node {
  constructor(tag){this.tag=tag;this.children=[];this.dataset={}}
  append(...nodes){this.children.push(...nodes)}
  insertRow(){const n=new Node('tr');this.append(n);return n}
  createTHead(){return this.insertRow()}
  createTBody(){return this.insertRow()}
  setAttribute(){}
  addEventListener(){}
  querySelector(s){return s==='button.primary'?new Node('button'):null}
  showModal(){this.open=true}
}
const cards=Array.from({length:4},()=>new Node('div'));
const descendants=n=>[n,...n.children.flatMap(descendants)];
const options=()=>cards.flatMap(descendants).filter(n=>n.dataset.compareRef);
const results={querySelectorAll:s=>s==='.item'?cards:options()};
const toolbar=new Node('div'),body=new Node('body');
const document={querySelector:s=>s==='#results'?results:toolbar,createElement:t=>new Node(t),body};
const cachedResults=cards.map((_,i)=>({p:['Ref'+i,'Produto'+i,1]}));
vm.runInNewContext(next,{document,window:{addEventListener(){}},cachedResults,FAMILY_DATA:{products:{},labels:{}},money:String});
const open=descendants(toolbar).find(n=>n.textContent==='Abrir comparação');
for(let i=0;i<3;i++){
 options()[i].onclick({stopPropagation(){}});
 assert.equal(open.hidden,i===0);
 if(i===0)continue;
 open.onclick();
 const refs=descendants(body.children.at(-1)).map(n=>n.dataset.quoteRef).filter(Boolean);
 assert.deepEqual(refs,cachedResults.slice(0,i+1).map(r=>r.p[0]));
}
assert.equal(options()[3].disabled,true);
options()[1].onclick({stopPropagation(){}});
assert.equal(options()[3].disabled,false);
console.log('Comparação validada para dois e três produtos, referências na proposta e troca de seleção.');