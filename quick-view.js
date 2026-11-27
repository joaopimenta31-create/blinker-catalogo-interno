(() => {
  const input = document.querySelector('#q');
  const picker = input.closest('.product-picker');
  const panel = picker.closest('.panel');
  const toolbar = document.createElement('div');
  toolbar.className = 'quick-search';
  panel.before(toolbar);
  toolbar.append(picker);
  const shortcuts = document.createElement('div');
  shortcuts.className = 'quick-terms';
  shortcuts.setAttribute('role', 'group');
  shortcuts.setAttribute('aria-label', 'Atalhos de pesquisa');
  toolbar.append(shortcuts);
  const choices = [
    ['1HOURTEC', '1hourtec'],
    ['Polimento', 'polimento'],
    ['Desengordurantes', 'desengordurante']
  ];
  function sync() {
    const scope = brandTerms(input.value);
    for (const button of shortcuts.children) {
      const selected = button.value === '1hourtec' ? scope.brand : norm(scope.terms) === button.value;
      button.setAttribute('aria-pressed', String(selected));
    }
  }
  for (const [label, value] of choices) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    button.value = value;
    button.onclick = () => {
      const scope = brandTerms(input.value);
      if (value === '1hourtec') scope.brand = !scope.brand;
      else scope.terms = norm(scope.terms) === value ? '' : value;
      input.value = [scope.brand ? '1hourtec' : '', scope.terms].filter(Boolean).join(' ');
      limit = 40;
      search();
      sync();
      document.querySelector('#prod').scrollIntoView({block:'start'});
    };
    shortcuts.append(button);
  }
  input.addEventListener('input', sync);
  document.addEventListener('click', sync);
  sync();

  const results = document.querySelector('#results');
  const host = document.querySelector('#modal');
  let opener;
  results.addEventListener('click', event => {
    const card = event.target.closest('.item');
    if (!card) return;
    const button = card.querySelector('button.primary');
    if (!button) return;
    opener = button;
    if (!event.target.closest('button,a,input,select') && !String(window.getSelection())) button.click();
  });
  new MutationObserver(() => {
    const dialog = host.querySelector('.dialog');
    document.body.classList.toggle('quick-open', !!dialog);
    for (const node of document.querySelectorAll('body > header, body > main')) node.inert = !!dialog;
    if (dialog) {
      dialog.setAttribute('role','dialog');
      dialog.setAttribute('aria-modal','true');
      dialog.setAttribute('aria-label','Ficha do produto');
      dialog.querySelector('button')?.focus({preventScroll:true});
    } else if (opener) {
      opener.focus({preventScroll:true});
      opener = null;
    }
  }).observe(host, {childList:true});
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && host.querySelector('.dialog')) closeModal();
  });
})();
