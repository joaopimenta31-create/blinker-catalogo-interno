(() => {
  const key = 'blinker-favoritos-v1';
  const products = new Map(PRODUCTS.map(p => [p[0],p]));
  let favorites = new Set();
  let persistent = true;
  const recentKey = 'blinker-recentes-v1';
  const recentLimit = 20;
  let recent = [];
  let recentPersistent = true;
  let view = 'favorites';
  function readRecent() {
    if (!recentPersistent) return;
    try {
      const saved = JSON.parse(localStorage.getItem(recentKey) || '[]');
      recent = Array.isArray(saved) ? [...new Set(saved.filter(ref => products.has(ref)))].slice(0,recentLimit) : [];
    } catch { recentPersistent = false; }
  }
  function remember(ref) {
    if (!products.has(ref)) return;
    readRecent();
    recent = [ref,...recent.filter(value => value !== ref)].slice(0,recentLimit);
    try { localStorage.setItem(recentKey,JSON.stringify(recent)); }
    catch { recentPersistent = false; }
  }
  readRecent();
  function read() {
    try {
      const saved = JSON.parse(localStorage.getItem(key) || '[]');
      if (Array.isArray(saved)) favorites = new Set(saved.filter(ref => products.has(ref)));
    } catch { persistent = false; }
  }
  read();
  function button(text) {
    const node = document.createElement('button');
    node.type = 'button';
    node.textContent = text;
    return node;
  }
  const launch = button('');
  document.querySelector('nav').append(launch);
  const dialog = document.createElement('dialog');
  dialog.className = 'favorites-dialog';
  dialog.setAttribute('aria-label','Favoritos e recentes');
  const title = document.createElement('h2');
  title.textContent = 'Favoritos e recentes';
  const close = button('Fechar');
  close.onclick = () => dialog.close();
  const message = document.createElement('p');
  const list = document.createElement('ul');
  const switcher = document.createElement('div');
  switcher.className = 'saved-views';
  const savedTab = button('Favoritos');
  const recentTab = button('Recentes');
  savedTab.onclick = () => { view = 'favorites'; refresh(); };
  recentTab.onclick = () => { view = 'recent'; readRecent(); refresh(); };
  switcher.append(savedTab,recentTab);
  dialog.append(title,close,switcher,message,list);
  document.body.append(dialog);
  function refresh() {
    launch.textContent = 'Favoritos (' + favorites.size + ')';
    for (const control of document.querySelectorAll('[data-favorite-ref]')) {
      const active = favorites.has(control.dataset.favoriteRef);
      control.textContent = active ? '★ Nos favoritos' : '☆ Guardar nos favoritos';
      control.setAttribute('aria-pressed',String(active));
    }
    if (!dialog.open) return;
    message.textContent = !persistent ? 'O navegador só permite guardar a seleção nesta sessão.' : favorites.size ? 'Guardados neste navegador.' : 'Abre uma ficha e toca em «Guardar nos favoritos».';
    const showRecent = view === 'recent';
    savedTab.setAttribute('aria-pressed',String(!showRecent));
    recentTab.setAttribute('aria-pressed',String(showRecent));
    if (showRecent) message.textContent = !recent.length ? 'As fichas que abrires aparecem aqui.' : recentPersistent ? 'Últimas fichas abertas neste navegador.' : 'Últimas fichas abertas nesta sessão.';
    list.replaceChildren();
    for (const ref of (showRecent ? recent : favorites)) {
      const item = document.createElement('li');
      const link = button(products.get(ref)[1] + ' · ' + ref);
      link.onclick = () => { dialog.close(); detail(ref); };
      const remove = button('Retirar');
      remove.setAttribute('aria-label','Retirar dos favoritos · ' + ref);
      remove.onclick = () => toggle(ref);
      item.append(link);
      if (!showRecent) item.append(remove);
      list.append(item);
    }
  }
  function toggle(ref) {
    if (persistent) read();
    if (favorites.has(ref)) favorites.delete(ref);
    else favorites.add(ref);
    try { localStorage.setItem(key,JSON.stringify([...favorites])); }
    catch { persistent = false; }
    refresh();
  }
  function addControl(ref) {
    if (!products.has(ref)) return;
    const heading = document.querySelector('#modal .dialog h3');
    if (!heading || heading.parentElement.querySelector('[data-favorite-ref]')) return;
    const control = button('');
    control.dataset.favoriteRef = ref;
    control.onclick = () => toggle(ref);
    heading.after(control);
    refresh();
  }
  const previousDetail = detail;
  detail = function(ref) { previousDetail(ref); remember(ref); addControl(ref); };
  const initial = location.hash.match(/^#ficha\/([A-Za-z0-9_-]+)$/);
  if (initial) { remember(initial[1]); addControl(initial[1]); }
  launch.onclick = () => { if (persistent) read(); dialog.showModal(); refresh(); };
  window.addEventListener('storage',event => { if (event.key === recentKey || event.key === null) { readRecent(); refresh(); } if (event.key === key || event.key === null) { read(); refresh(); } });
  refresh();
})();
