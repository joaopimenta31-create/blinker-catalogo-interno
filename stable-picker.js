(() => {
  const input = document.getElementById('q');
  const wrapper = input.parentElement;
  const list = document.createElement('div');
  list.id = 'product-options';
  list.setAttribute('role', 'listbox');
  list.setAttribute('aria-label', 'Produtos sugeridos');
  wrapper.append(list);
  input.setAttribute('aria-label', 'Pesquisar produtos');
  input.setAttribute('role', 'combobox');
  input.setAttribute('aria-controls', list.id);
  input.setAttribute('aria-autocomplete', 'list');
  input.autocomplete = 'off';
  let active = -1;
  let dismissed = false;
  function close() {
    list.hidden = true;
    active = -1;
    input.removeAttribute('aria-activedescendant');
    input.setAttribute('aria-expanded', 'false');
  }
  const suggestionLimit = 30;
  let renderedKey;
  function refresh(products) {
    if (dismissed || !input.value.trim()) return;
    const key = JSON.stringify([input.value,cachedResults.length,products.map(p=>p[0])]);
    if (renderedKey === key && !list.hidden) return;
    renderedKey = key;
    active = -1;
    input.removeAttribute('aria-activedescendant');
    list.replaceChildren();
    list.scrollTop = 0;
    for (const p of products.slice(0, suggestionLimit)) {
      const option = document.createElement('div');
      option.id = 'suggested-product-' + list.childElementCount;
      option.setAttribute('role', 'option');
      option.setAttribute('aria-selected', 'false');
      const name = document.createElement('strong');
      name.textContent = p[1];
      const ref = document.createElement('small');
      ref.textContent = 'Ref. ' + p[0];
      option.append(name, ref); addSearchPhoto(option,p[0]);
      option.addEventListener('click', () => {
        dismissed = true;
        close();
        input.blur();
        detail(p[0]);
        document.querySelector('#modal button')?.focus();
      });
      list.append(option);
    }
    if(products.length&&cachedResults.length>suggestionLimit){const all=document.createElement('div');all.id='suggested-product-all';all.setAttribute('role','option');all.textContent='Ver os '+cachedResults.length+' resultados';all.onclick=()=>{dismissed=true;close();input.blur();document.getElementById('found').scrollIntoView({block:'start'})};list.append(all)}
    if (!list.childElementCount) {
      const empty = document.createElement('div');
      empty.className = 'search-empty';
      empty.setAttribute('role','status');
      empty.textContent = 'Nenhum produto encontrado.';
      list.append(empty);
    }
    list.hidden = false;
    input.setAttribute('aria-expanded', String(!list.hidden));
  }
  close();
  let lastValue;
  function typing() {
    if (lastValue === input.value) return;
    lastValue = input.value;
    dismissed = false;
    if (!input.value.trim()) close();
    limit = 40;
    search();
  }
  input.addEventListener('input', typing);
  input.addEventListener('compositionupdate', () => requestAnimationFrame(typing));
  input.addEventListener('compositionend', typing);
  input.addEventListener('keyup', typing);
  input.addEventListener('focus', () => {lastValue = undefined; typing()});
  function completeSuggestions() {
    if (!dismissed && lastValue === input.value && input.value.trim()) {
      refresh(cachedResults.slice(0,suggestionLimit).map(row=>row.p));
    }
  }
  window.addEventListener('product-results-ready', completeSuggestions);
  if (document.activeElement === input) typing();
  document.addEventListener('focusin',e=>{if(!wrapper.contains(e.target)){dismissed=true;close()}});
  document.addEventListener('pointerdown', e => {if(!wrapper.contains(e.target)){dismissed = true; close()}});
  input.addEventListener('keydown', e => {
    if(e.key === 'Escape') {if(!list.hidden) e.preventDefault(); dismissed = true; close(); return}
    if(list.hidden || !list.querySelector('[role=option]')) return;
    if(e.key === 'Enter' && active >= 0) {e.preventDefault(); list.children[active].click(); return}
    if(e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    if(active >= 0) list.children[active].setAttribute('aria-selected','false');
    const count = list.childElementCount;
    active = e.key === 'ArrowDown' ? (active + 1) % count : (active <= 0 ? count - 1 : active - 1);
    const option = list.children[active];
    option.setAttribute('aria-selected','true');
    input.setAttribute('aria-activedescendant', option.id);
    option.scrollIntoView({block:'nearest'});
  });
})();