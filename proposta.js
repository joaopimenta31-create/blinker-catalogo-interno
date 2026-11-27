(() => {
  const key = 'blinker-proposta-v1';
  const products = new Map(PRODUCTS.map(row => [String(row[0]), row]));
  const el = (tag, label) => {
    const node = document.createElement(tag);
    if (label !== undefined) node.textContent = label;
    return node;
  };
  function button(label, action) {
    const node = el('button',label);
    node.type='button';
    node.onclick=action;
    return node;
  }
  function cents(value) {
    const normalized=String(value).trim().replace(',','.');
    if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) return null;
    const [whole,fraction='']=normalized.split('.');
    const result=Number(whole)*100+Number(fraction.padEnd(2,'0'));
    return Number.isSafeInteger(result) ? result : null;
  }
  let lines=[];
  try {
    const saved=JSON.parse(sessionStorage.getItem(key)||'[]');
    if(Array.isArray(saved)) lines=saved.filter(l=>l && products.has(l.ref) && typeof l.price==='string' && typeof l.qty==='string');
  } catch {}
  const launch=button('',()=>openEditor());
  document.querySelector('.quick-search').after(launch);
  function sync(){
    launch.textContent='Proposta ('+lines.length+')';
    try {sessionStorage.setItem(key,JSON.stringify(lines))} catch {}
  }
  sync();
  const dialog=el('dialog');
  dialog.className='quote-dialog';
  dialog.setAttribute('aria-label','Proposta comercial');
  document.body.append(dialog);
  function add(ref){
    const p=products.get(String(ref));
    if(!p)return;
    const current=lines.find(l=>l.ref===String(ref));
    if(current){
      const next=Number(current.qty)+1;
      if(Number.isSafeInteger(next)&&next>0)current.qty=String(next);
    } else lines.push({ref:String(ref),qty:'1',price:Number.isFinite(p[2])?p[2].toFixed(2).replace('.',','):''});
    sync();
    openEditor();
  }
  document.addEventListener('click',event=>{
    const target=event.target.closest('[data-quote-ref]');
    if(target)add(target.dataset.quoteRef);
  });
  const previous=detail;
  detail=function(ref){
    previous(ref);
    const panel=document.querySelector('#modal .dialog');
    if(panel && !panel.querySelector('.quote-add')){
      const b=button('Adicionar à proposta',()=>add(ref));
      b.className='quote-add';
      panel.querySelector('h3')?.after(b);
    }
  };
  function subtotal(line){
    const price=cents(line.price), qty=Number(line.qty);
    if(!/^\d+$/.test(line.qty)||!Number.isSafeInteger(qty)||qty<1||price===null)return null;
    return Number.isSafeInteger(qty*price)?qty*price:null;
  }
  function sum(){
    let total=0;
    for(const line of lines){
      const value=subtotal(line);
      if(value===null||!Number.isSafeInteger(total+value))return null;
      total+=value;
    }
    return total;
  }
  function field(label,line,property,mode,onChange){
    const node=el('label',label),input=el('input');
    input.inputMode=mode;
    input.value=line[property];
    input.oninput=()=>{line[property]=input.value;sync();onChange()};
    node.append(input);
    return node;
  }
  function openEditor(){
    dialog.classList.remove('quote-client');
    dialog.replaceChildren(el('h2','Proposta comercial'));
    if(!lines.length) dialog.append(el('p','Adiciona artigos nos resultados da pesquisa ou na ficha de produto.'));
    const total=el('strong');
    const show=button('Mostrar ao cliente',preview);
    function refresh(){
      const value=sum();
      total.textContent=value===null?'Confirma as quantidades e os preços.':'Total sem IVA · '+money(value/100);
      show.disabled=!lines.length||value===null;
    }
    for(const line of lines){
      const box=el('section'),p=products.get(line.ref),partial=el('p');
      const change=()=>{
        const value=subtotal(line);
        partial.textContent=value===null?'Introduz uma quantidade inteira positiva e um preço válido.':'Subtotal · '+money(value/100);
        refresh();
      };
      box.append(el('b',p[1]),el('p','Ref. '+line.ref),field('Quantidade',line,'qty','numeric',change),field('Preço unitário sem IVA (€)',line,'price','decimal',change),partial,button('Remover',()=>{lines=lines.filter(l=>l!==line);sync();openEditor()}));
      dialog.append(box);
      change();
    }
    dialog.append(total,el('div'));
    dialog.append(button('Continuar no catálogo',()=>dialog.close()),show);
    refresh();
    if(!dialog.open)dialog.showModal();
  }
  function preview(){
    const value=sum();
    if(!lines.length||value===null)return;
    dialog.classList.add('quote-client');
    dialog.replaceChildren(el('strong','BLINKER'),el('h2','Proposta comercial'),el('p',new Date().toLocaleDateString('pt-PT')));
    for(const line of lines){
      const box=el('section');
      box.append(el('b',products.get(line.ref)[1]),el('p','Ref. '+line.ref),el('p',line.qty+' × '+money(cents(line.price)/100)+' = '+money(subtotal(line)/100)));
      dialog.append(box);
    }
    dialog.append(el('h3','Total sem IVA · '+money(value/100)),button('Editar proposta',openEditor),button('Imprimir / Guardar PDF',()=>window.print()));
  }
})();