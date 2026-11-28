/* Product search of the main page. Replaces the older search interface, which stays in the page hidden.
   Product text is only ever written with textContent. */
(() => {
  'use strict';
  const main = document.querySelector('main');
  const oldFilters = document.getElementById('product-filters');
  const selects = ['family', 'catalog', 'sort'].map(id => document.getElementById(id));
  const [family, catalog, sort] = selects;
  const photos = typeof searchPhotos === 'undefined' ? {} : searchPhotos;
  const pageSize = 30;
  const euros = new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 });
  let search, found, selected = [], openStep, shown = pageSize, timer;
  const catalogued = window.QUICK_DATA.sections;
  const sections = ref => (catalogued.refs[ref] || []).map(id => catalogued.titles[id]);
  const tabled = window.QUICK_DATA.catalogue;
  function catalogEntry(ref) {
    if (!Object.hasOwn(tabled.refs, ref)) return undefined;
    const [id, finish, values] = tabled.refs[ref];
    const { table, norm, columns } = tabled.tables[id];
    return { table, norm, finish, values: columns.map((name, i) => [name, values[i]]) };
  }
  const described = { sections, catalog: catalogEntry };
  // "Selagem de cobre · A 10,2 · B 15,9": what the catalogue table says, under the name.
  function tableLine(ref) {
    const entry = catalogEntry(ref);
    if (!entry) return null;
    const values = entry.values.filter(([, value]) => value)
      .map(([name, value]) => name.replace(' (mm)', '') + ' ' + value);
    return [entry.table, ...values].join(' · ');
  }

  function make(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }
  function control(className, text) {
    const node = make('button', className, text);
    node.type = 'button';
    return node;
  }

  const bar = make('div', 'rq-bar');
  const form = make('form');
  form.setAttribute('role', 'search');
  const input = make('input');
  input.id = 'rq-q';
  input.type = 'search';
  input.placeholder = 'Nome, medida ou referência';
  input.setAttribute('aria-label', 'Pesquisar produtos');
  input.setAttribute('enterkeyhint', 'search');
  input.autocomplete = 'off';
  input.spellcheck = false;
  const clear = control('rq-clear', '✕');
  clear.setAttribute('aria-label', 'Limpar pesquisa');
  clear.hidden = true;
  const filtersButton = control('rq-filters-button', 'Filtros');
  filtersButton.setAttribute('aria-expanded', 'false');
  form.append(input, clear, filtersButton);
  const filters = make('div', 'rq-filters');
  filters.id = 'rq-filters';
  filters.hidden = true;
  filtersButton.setAttribute('aria-controls', filters.id);
  filters.append(oldFilters);
  const chips = make('div', 'rq-chips');
  chips.setAttribute('role', 'group');
  chips.setAttribute('aria-label', 'Refinar resultados');
  const options = make('div', 'rq-options');
  options.id = 'rq-options';
  options.setAttribute('role', 'group');
  options.hidden = true;
  bar.append(form, filters, chips, options);
  const area = make('div', 'rq-area');
  const notice = make('p', 'rq-notice');
  notice.setAttribute('aria-live', 'polite');
  notice.hidden = true;
  const status = make('p', 'rq-status', 'A preparar a pesquisa…');
  status.setAttribute('aria-live', 'polite');
  const list = make('ul', 'rq-results');
  const more = control('rq-more', 'Mostrar mais');
  more.hidden = true;
  area.append(notice, status, list, more);
  // Results sit directly under the box, above the buttons of the other sections.
  main.prepend(bar, area);

  const viewer = make('dialog', 'rq-viewer');
  const close = control('', 'Fechar ✕');
  const view = make('img');
  viewer.append(close, view);
  document.body.append(viewer);

  function pageImage(ref) {
    const media = CATALOG_MEDIA[ref];
    if (!media) return null;
    return media[2] || 'catalogs/' + media[0] + '/page-' + String(media[1]).padStart(4, '0') + '.webp';
  }

  function thumbnail(product) {
    const ref = String(product[0]);
    const photo = photos[ref];
    const page = pageImage(ref);
    const button = control('rq-thumb');
    if (typeof photo === 'number') {
      const sprite = make('span', 'rq-sprite');
      sprite.style.backgroundPosition = -48 * (photo % 16) + 'px ' + -48 * Math.floor(photo / 16) + 'px';
      button.append(sprite);
    } else if (photo || page) {
      const image = make('img');
      image.alt = '';
      image.loading = 'lazy';
      image.onerror = () => image.remove();
      image.src = photo || page;
      button.append(image);
    }
    const full = page || (typeof photo === 'string' ? photo : null);
    if (full) {
      button.setAttribute('aria-label', 'Ver imagem de ' + product[1]);
      button.onclick = () => {
        view.src = full;
        view.alt = product[1];
        viewer.showModal();
      };
    } else {
      button.disabled = true;
      button.setAttribute('aria-label', 'Sem imagem');
    }
    return button;
  }

  function copyButton(ref, reference) {
    const button = control('rq-copy', 'Copiar');
    button.setAttribute('aria-label', 'Copiar referência ' + ref);
    let reset;
    function say(text) {
      button.textContent = text;
      clearTimeout(reset);
      reset = setTimeout(() => { button.textContent = 'Copiar'; }, 2000);
    }
    function select() {
      const range = document.createRange();
      range.selectNodeContents(reference);
      getSelection().removeAllRanges();
      getSelection().addRange(range);
      say('Selecionado');
    }
    button.onclick = () => {
      if (!navigator.clipboard) return select();
      navigator.clipboard.writeText(ref).then(() => say('Copiado'), select);
    };
    return button;
  }

  function row(product) {
    const ref = String(product[0]);
    const item = make('li');
    const link = make('a', 'rq-name', product[1]);
    link.href = '#ficha/' + encodeURIComponent(ref);
    link.onclick = event => {
      event.preventDefault();
      input.blur();
      detail(product[0]);
    };
    const reference = make('span', 'rq-ref', ref);
    const priced = Number.isFinite(product[2]);
    const price = make('span', 'rq-price', priced ? euros.format(product[2]) + ' · PVP sem IVA' : 'Sob consulta');
    const line = make('div', 'rq-refline');
    line.append(reference, copyButton(ref, reference));
    item.append(thumbnail(product), link, line, price);
    const stated = tableLine(ref);
    if (stated) item.append(make('span', 'rq-table', stated));
    return item;
  }

  function chip(text, pressed, action) {
    const button = control('rq-chip', text);
    button.setAttribute('aria-pressed', String(pressed));
    button.onclick = action;
    return button;
  }

  function refine(choices) {
    selected = choices;
    openStep = undefined;
    shown = pageSize;
    render();
  }

  const quoted = words => words.map(word => '"' + word + '"').join(' e ');
  const activeSelects = () => selects.filter(field => field.value !== field.options[0].value);

  function render() {
    const asked = input.value.trim();
    const filtered = Boolean(family.value || catalog.value);
    const results = found
      ? QuickSearch.sortByPrice(QuickSearch.applyFacets(found.results, selected, described), sort.value) : [];

    const messages = [];
    if (found?.ignored.length) messages.push('Sem resultados para tudo. A mostrar sem ' + quoted(found.ignored) + '.');
    if (found?.corrected.length) {
      messages.push('A mostrar resultados para ' + quoted(found.corrected.map(c => c.to)) + '.');
    }
    for (const guess of found?.similar || []) {
      messages.push('Não encontrámos ' + quoted([guess.from]) + '. A mostrar palavras parecidas: '
        + guess.options.map(word => '"' + word + '"').join(' ou ') + '.');
    }
    notice.textContent = messages.join(' ');
    notice.hidden = !messages.length;

    if (search) {
      status.textContent = !asked && !filtered ? 'Escreve o que procuras.'
        : !results.length ? 'Sem resultados.'
        : results.length === 1 ? '1 resultado' : results.length.toLocaleString('pt-PT') + ' resultados';
    }

    const active = activeSelects();
    filtersButton.textContent = active.length ? 'Filtros (' + active.length + ')' : 'Filtros';
    chips.replaceChildren(
      ...active.map(field => {
        const label = field.selectedOptions[0].textContent.replace(/ \(\d+\)$/, '');
        return chip(label + ' ✕', true, () => {
          field.selectedIndex = 0;
          restart();
        });
      }),
      ...selected.map(choice => chip(choice.label + ' ✕', true,
        () => refine(selected.filter(other => other !== choice)))),
    );
    // One button per step that can still divide the results; it opens that step's options.
    const steps = QuickSearch.facets(results, described);
    for (const step of steps) {
      const open = step.group === openStep;
      const button = control('rq-step', step.label + ' (' + step.values.length + ') ' + (open ? '▴' : '▾'));
      button.dataset.step = step.group;
      button.setAttribute('aria-expanded', String(open));
      button.setAttribute('aria-controls', options.id);
      button.onclick = () => {
        openStep = open ? undefined : step.group;
        render();
        chips.querySelector('[data-step="' + step.group + '"]')?.focus({ preventScroll: true });
      };
      chips.append(button);
    }
    const current = steps.find(step => step.group === openStep);
    options.hidden = !current;
    options.setAttribute('aria-label', current ? current.label : '');
    options.replaceChildren(...(current?.values || []).map(option => chip(
      option.label + ' (' + option.count + ')', false,
      () => refine([...selected, { group: current.group, value: option.value, label: option.label }]))));
    list.replaceChildren(...results.slice(0, shown).map(row));
    more.hidden = results.length <= shown;
  }

  function run() {
    clearTimeout(timer);
    clear.hidden = !input.value;
    if (!search) return;
    const values = { family: family.value, catalog: catalog.value };
    const accept = values.family || values.catalog
      ? product => QuickSearch.matchesFilters(FAMILY_DATA.products[product[0]], values)
      : undefined;
    found = search(input.value, accept);
    render();
  }
  // A new search starts from the first page, without the previous refinements.
  function restart() {
    selected = [];
    openStep = undefined;
    shown = pageSize;
    run();
    if (!search) render();
  }

  input.addEventListener('input', () => {
    clear.hidden = !input.value;
    clearTimeout(timer);
    timer = setTimeout(restart, 120);
  });
  input.addEventListener('focus', () => showFilters(false));
  form.addEventListener('submit', event => {
    event.preventDefault();
    restart();
    input.blur();
  });
  clear.onclick = () => {
    input.value = '';
    restart();
    input.focus();
  };
  function showFilters(open) {
    filters.hidden = !open;
    filtersButton.setAttribute('aria-expanded', String(open));
  }
  filtersButton.onclick = () => showFilters(filters.hidden);
  // These replace the older handlers, which ran the older search.
  for (const field of selects) field.onchange = restart;
  document.getElementById('clear-filters').onclick = () => {
    for (const field of selects) field.selectedIndex = 0;
    restart();
  };
  more.onclick = () => {
    shown += pageSize;
    render();
  };
  close.onclick = () => viewer.close();
  viewer.addEventListener('click', event => { if (event.target === viewer) viewer.close(); });

  // Let the page paint before building the index, which takes a moment on a phone.
  requestAnimationFrame(() => setTimeout(() => {
    search = QuickSearch.createSearch(BlinkSearch, PRODUCTS, window.QUICK_DATA);
    restart();
  }, 0));
})();
