(() => {
  const results = document.querySelector('#results');
  const toolbar = document.querySelector('.quick-search');
  const selected = new Map();
  function make(tag, text) {
    const el = document.createElement(tag);
    if (text != null) el.textContent = text;
    return el;
  }
  const tray = make('div');
  tray.className = 'comparison-tray';
  const status = make('span');
  status.setAttribute('aria-live','polite');
  const open = make('button','Comparar os dois');
  const clear = make('button','Limpar seleção');
  tray.append(status,open,clear);
  toolbar.append(tray);
  function refresh() {
    tray.hidden = !selected.size;
    status.textContent = selected.size === 1 ? '1 de 2 · Ref. ' + selected.keys().next().value : '2 de 2 · ' + [...selected.keys()].join(' e ');
    open.hidden = selected.size !== 2;
    for (const b of results.querySelectorAll('[data-compare-ref]')) {
      const active = selected.has(b.dataset.compareRef);
      b.textContent = active ? 'Retirar' : 'Comparar';
      b.setAttribute('aria-pressed',String(active));
      b.disabled = !active && selected.size === 2;
    }
  }
  clear.onclick = () => { selected.clear(); refresh(); };
  function decorate() {
    const cards = results.querySelectorAll('.item');
    cards.forEach((card,i) => {
      if (card.querySelector('[data-compare-ref]')) return;
      const product = cachedResults[i]?.p;
      if (!product) return;
      const button = make('button','Comparar');
      button.dataset.compareRef = product[0];
      button.setAttribute('aria-label','Comparar · ' + product[1] + ' · ' + product[0]);
      button.onclick = e => {
        e.stopPropagation();
        if (selected.has(product[0])) selected.delete(product[0]);
        else if (selected.size < 2) selected.set(product[0],product);
        refresh();
      };
      const actions = make('div');
      actions.className = 'comparison-actions';
      const detailButton = card.querySelector('button.primary');
      if (!detailButton) return;
      card.append(actions); actions.append(detailButton,button);
    });
    refresh();
  }
  open.onclick = () => {
    if (selected.size !== 2) return;
    const dialog = make('dialog');
    dialog.className = 'comparison-dialog';
    dialog.setAttribute('aria-label','Comparação de produtos');
    const close = make('button','Fechar comparação');
    close.onclick = () => dialog.close();
    dialog.append(make('h2','Comparação de produtos'),close);
    const table = make('table');
    const header = table.createTHead().insertRow();
    for (const title of ['Produto',...[...selected.values()].map(p=>p[1])]) {
      const th=make('th',title); th.scope='col'; header.append(th);
    }
    const body=table.createTBody();
    function row(label,values) {
      const tr=body.insertRow(); const th=make('th',label);th.scope='row';tr.append(th);
      for (const value of values) tr.append(make('td',value || 'Sem indicação'));
    }
    const products=[...selected.values()];
    row('Referência',products.map(p=>p[0]));
    row('PVP sem IVA',products.map(p=>Number.isFinite(p[2]) ? money(p[2]) : 'Sob consulta'));
    row('Embalagem',products.map(p=>p[4]));
    row('Família',products.map(p=>(FAMILY_DATA.products[p[0]]?.f || []).map(f=>FAMILY_DATA.labels[f]).join(' · ')));
    const sheets=products.map(p=>typeof PRODUCT_TECH_SHEETS === 'undefined' ? null : PRODUCT_TECH_SHEETS[p[0]]);
    for(const [key,label] of [['applications','Aplicação'],['characteristics','Características']]){
      const values=sheets.map(s=>s && !s.conflicts?.length ? s[key]?.map(item=>item.text).join('\n') : '');
      if(values.some(Boolean))row(label,values);
    }
    dialog.append(table);
    document.body.append(dialog);
    dialog.addEventListener('close',()=>{dialog.remove();open.focus({preventScroll:true})},{once:true});
    dialog.showModal();
  };
  window.addEventListener('product-results-ready',decorate);
  decorate();
})();
