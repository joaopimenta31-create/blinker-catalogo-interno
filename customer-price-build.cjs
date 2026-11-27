require('./catalog-search-build.cjs');
const fs=require('node:fs');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const path='public/index.html';
let html=fs.readFileSync(path,'utf8');
function replaceOnce(before,after){
  assert.equal(html.split(before).length,2,before);
  html=html.replace(before,()=>after);
}
replaceOnce('function present(product, amount)', 'function present(product, amount, quantity)');
replaceOnce("const price = element('p',money(amount) + ' sem IVA');", `const cents = Math.round(Number(amount.toFixed(2).replace('.','')));
      content.append(element('p','Quantidade · ' + quantity + (quantity === 1 ? ' unidade' : ' unidades')),
                     element('p','Preço unitário · ' + money(cents/100) + ' sem IVA'));
      const price = element('p','Total sem IVA · ' + money(cents * quantity / 100));`);
replaceOnce("form.append(label,custom,go);", `const quantityLabel = element('label','Quantidade (unidades)');
    const quantity = element('input');
    quantity.type = 'number';
    quantity.inputMode = 'numeric';
    quantity.min = '1';
    quantity.step = '1';
    quantity.required = true;
    quantity.value = '1';
    quantityLabel.append(quantity);
    const syncQuantity = () => {
      quantityLabel.hidden = quantity.disabled = select.value === 'none';
    };
    select.addEventListener('change',syncQuantity);
    syncQuantity();
    form.append(label,custom,quantityLabel,go);`);
replaceOnce("present(product,amount);", `const units = amount === null ? 1 : Number(quantity.value);
      if (!Number.isSafeInteger(units) || units < 1) return;
      if (amount !== null && !Number.isSafeInteger(Math.round(amount*100)*units)) {
        quantity.setCustomValidity('O total é demasiado elevado. Confirma o preço e a quantidade.');
        quantity.reportValidity();
        quantity.setCustomValidity('');
        return;
      }
      present(product,amount,units);`);
const script=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(m=>m[1]).find(s=>s.includes('function present(product, amount, quantity)'));
assert.ok(script);
const body={append(screen){this.screen=screen}};
const node=(tag)=>({tag,children:[],append(...children){this.children.push(...children)},setAttribute(){},addEventListener(){},showModal(){},querySelector(){return null}});
const sandbox={document:{body,createElement:node},detail(){},location:{hash:''},money:value=>value.toFixed(2),test:null};
const customer=script.slice(script.lastIndexOf('(() => {',script.indexOf('function element(tag, text)')),script.indexOf('if (initial) addControls(initial[1]);')+'if (initial) addControls(initial[1]);'.length)+'\n})();';
vm.runInNewContext(customer.replace('const original = detail;', 'globalThis.test=present; const original = detail;'),sandbox);
for(const [amount,units,expected] of [[12.35,3,'37.05'],[0.1,3,'0.30'],[9.99,1,'9.99'],[null,1,null]]){
  sandbox.test(['045169','Artigo de teste'],amount,units);
  const fields=body.screen.children[0].children.map(n=>n.textContent).filter(Boolean);
  assert.equal(fields.some(s=>s.startsWith('Total sem IVA')),expected!==null);
  if(expected!==null)assert.ok(fields.includes('Total sem IVA · '+expected));
}
fs.writeFileSync(path,html);
console.log('Vista cliente validada: total sem IVA, unidade, múltiplas unidades e sem preço.');