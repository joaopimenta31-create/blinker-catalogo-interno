(() => {
  const input = document.getElementById('q');
  const picker = input.closest('.product-picker');
  const toolbar = picker.closest('.quick-search');
  const filters = document.getElementById('product-filters');
  const filterGroup = filters.closest('details');
  const clearFilters = document.getElementById('clear-filters');
  const filterFields = [...filters.querySelectorAll('select')];
  const found = document.getElementById('found');
  const modal = document.getElementById('modal');
  const mobileViewport = window.visualViewport;

  const controls = document.createElement('div');
  controls.className = 'search-controls';
  picker.before(controls);
  const filtersButton = document.createElement('button');
  filtersButton.type = 'button';
  filtersButton.textContent = 'Filtros';
  filterGroup.id = 'search-filter-panel';
  filterGroup.open = true;
  filterGroup.querySelector('summary').hidden = true;
  filterGroup.hidden = true;
  filtersButton.setAttribute('aria-controls', filterGroup.id);
  filtersButton.setAttribute('aria-expanded', 'false');
  controls.append(picker, filtersButton);
  toolbar.append(filterGroup);

  const chips = document.createElement('div');
  chips.className = 'search-filter-chips';
  chips.setAttribute('aria-label', 'Filtros ativos');
  chips.hidden = true;
  controls.after(chips);
  const filterLabels = ['Família', 'Catálogo', 'Ordenação'];
  const defaults = ['', '', 'relevance'];
  function activeFilters() {
    return filterFields.filter((field, i) => field.value !== defaults[i]);
  }
  function updateFilters() {
    const active = activeFilters();
    filtersButton.textContent = active.length ? 'Filtros (' + active.length + ')' : 'Filtros';
    const signature = JSON.stringify(filterFields.map(field => field.value));
    if (chips.dataset.signature === signature) return;
    chips.dataset.signature = signature;
    chips.replaceChildren();
    chips.hidden = !active.length;
    for (const field of active) {
      const index = filterFields.indexOf(field);
      const label = field.selectedOptions[0].textContent.replace(/ \(\d+\)$/, '');
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.textContent = filterLabels[index] + ': ' + label + ' ×';
      chip.setAttribute('aria-label', 'Remover filtro ' + label);
      chip.onclick = () => {
        field.value = defaults[index];
        limit = 40;
        search();
        filtersButton.focus({preventScroll:true});
      };
      chips.append(chip);
    }
  }
  clearFilters.onclick = () => {
    filterFields.forEach((field, i) => { field.value = defaults[i]; });
    limit = 40;
    search();
  };

  function showFilters(open) {
    filterGroup.hidden = !open;
    filtersButton.setAttribute('aria-expanded', String(open));
  }
  filtersButton.addEventListener('click', () => {
    hideSuggestions();
    showFilters(filterGroup.hidden);
  });

  const suggestions = document.createElement('div');
  suggestions.className = 'search-suggestions';
  suggestions.hidden = true;
  const wordSuggestions = document.createElement('section');
  wordSuggestions.className = 'search-word-suggestions';
  wordSuggestions.hidden = true;
  wordSuggestions.setAttribute('aria-label', 'Palavras sugeridas');
  const wordLabel = document.createElement('span');
  wordLabel.textContent = 'Completar pesquisa';
  const wordOptions = document.createElement('div');
  wordOptions.className = 'search-word-options';
  wordSuggestions.append(wordLabel, wordOptions);
  const list = document.createElement('div');
  list.id = 'product-options';
  list.role = 'listbox';
  list.setAttribute('aria-label', 'Produtos sugeridos');
  list.hidden = true;
  const allResults = document.createElement('button');
  allResults.type = 'button';
  allResults.className = 'search-all-results';
  allResults.textContent = 'Ver todos os resultados';
  suggestions.append(wordSuggestions, list, allResults);
  picker.append(suggestions);
  input.setAttribute('aria-label', 'Pesquisar produtos');
  input.setAttribute('enterkeyhint', 'search');
  input.setAttribute('role', 'combobox');
  input.setAttribute('aria-controls', list.id);
  input.setAttribute('aria-autocomplete', 'list');
  input.setAttribute('aria-expanded', 'false');

  let wantsSuggestions = false;
  let activeOption = -1;
  let renderedKey = '';
  let renderedWords = '';
  let modalReturn;
  let returning = false;

  function resetActiveOption() {
    list.children[activeOption]?.setAttribute('aria-selected', 'false');
    activeOption = -1;
    input.removeAttribute('aria-activedescendant');
  }
  function hideSuggestions() {
    wantsSuggestions = false;
    suggestions.hidden = true;
    list.hidden = true;
    input.setAttribute('aria-expanded', 'false');
    resetActiveOption();
  }
  function resizeSuggestions() {
    if (suggestions.hidden) return;
    const bottom = mobileViewport ? mobileViewport.offsetTop + mobileViewport.height : window.innerHeight;
    const available = bottom - picker.getBoundingClientRect().bottom - wordSuggestions.offsetHeight - allResults.offsetHeight - 22;
    list.style.setProperty('--suggestion-height', Math.max(50, Math.min(290, available)) + 'px');
  }
  function openSuggestion(ref) {
    const listTop = list.scrollTop;
    const scroll = window.scrollY;
    hideSuggestions();
    input.blur();
    detail(ref);
    if (modalReturn) modalReturn = {scroll, listTop};
  }
  function updateWordSuggestions() {
    const value = input.value;
    const matches = input.selectionStart === value.length && input.selectionEnd === value.length
      ? window.suggestProductWords?.(value, cachedResults.slice(0, 80).map(row => row.p),
          Boolean(filterFields[0].value || filterFields[1].value)) ?? []
      : [];
    const key = JSON.stringify(matches);
    if (renderedWords === key) return;
    renderedWords = key;
    wordSuggestions.hidden = !matches.length;
    wordOptions.replaceChildren(...matches.map(({term, query}) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = term;
      button.setAttribute('aria-label', 'Pesquisar ' + query);
      button.addEventListener('pointerdown', event => {
        if (event.pointerType === 'mouse') event.preventDefault();
      });
      button.onclick = () => {
        input.value = query;
        input.setSelectionRange(query.length, query.length);
        limit = 40;
        if (document.activeElement === input) search();
        else input.focus({preventScroll:true});
      };
      return button;
    }));
  }
  function renderSuggestions() {
    updateFilters();
    if (!wantsSuggestions || !input.value.trim()) return;
    const products = cachedResults.slice(0, 30).map(row => row.p);
    const key = JSON.stringify([input.value, products.map(p => p[0])]);
    if (key !== renderedKey) {
      renderedKey = key;
      resetActiveOption();
      const options = products.map(([ref, name], index) => {
        const option = document.createElement('div');
        option.role = 'option';
        option.id = 'suggested-product-' + index;
        option.setAttribute('aria-selected', 'false');
        const title = document.createElement('strong');
        title.textContent = name;
        const code = document.createElement('small');
        code.textContent = 'Ref. ' + ref;
        option.append(title, code);
        addSearchPhoto(option, ref);
        option.addEventListener('click', () => openSuggestion(ref));
        return option;
      });
      list.replaceChildren(...options);
      list.scrollTop = 0;
      if (!products.length) {
        const empty = document.createElement('div');
        empty.className = 'search-empty';
        empty.role = 'status';
        empty.textContent = 'Nenhum produto encontrado.';
        list.append(empty);
      }
    }
    updateWordSuggestions();
    allResults.hidden = !products.length;
    suggestions.hidden = false;
    list.hidden = false;
    input.setAttribute('aria-expanded', 'true');
    resizeSuggestions();
  }
  function viewResults() {
    hideSuggestions();
    input.blur();
    search();
    found.scrollIntoView({block:'start'});
  }
  allResults.addEventListener('click', viewResults);
  function typeSearch(event) {
    if (event.isComposing) return;
    showFilters(false);
    if (!input.value.trim()) hideSuggestions();
    else wantsSuggestions = true;
    scheduleSearch();
  }
  input.addEventListener('input', typeSearch);
  input.addEventListener('compositionend', typeSearch);
  input.addEventListener('select', () => {
    if (wantsSuggestions && !suggestions.hidden) {
      updateWordSuggestions();
      resizeSuggestions();
    }
  });
  input.addEventListener('focus', () => {
    showFilters(false);
    if (!input.value.trim()) return;
    wantsSuggestions = true;
    search();
  });
  input.addEventListener('keydown', event => {
    if (event.isComposing) return;
    if (event.key === 'Escape' && !suggestions.hidden) {
      event.preventDefault();
      hideSuggestions();
      return;
    }
    if (event.key === 'Enter' && input.value.trim()) {
      event.preventDefault();
      if (activeOption >= 0) list.children[activeOption].click();
      else viewResults();
      return;
    }
    if (list.hidden || !list.querySelector('[role=option]') || !['ArrowUp','ArrowDown'].includes(event.key)) return;
    event.preventDefault();
    list.children[activeOption]?.setAttribute('aria-selected', 'false');
    const count = list.childElementCount;
    activeOption = event.key === 'ArrowDown' ? (activeOption + 1) % count : (activeOption < 1 ? count - 1 : activeOption - 1);
    const option = list.children[activeOption];
    option.setAttribute('aria-selected', 'true');
    input.setAttribute('aria-activedescendant', option.id);
    if (option.offsetTop < list.scrollTop) list.scrollTop = option.offsetTop;
    if (option.offsetTop + option.offsetHeight > list.scrollTop + list.clientHeight) {
      list.scrollTop = option.offsetTop + option.offsetHeight - list.clientHeight;
    }
  });
  window.addEventListener('product-results-ready', renderSuggestions);
  window.addEventListener('resize', resizeSuggestions);
  mobileViewport?.addEventListener('resize', resizeSuggestions);
  mobileViewport?.addEventListener('scroll', resizeSuggestions);
  document.addEventListener('pointerdown', event => {
    if (!picker.contains(event.target)) hideSuggestions();
    if (!filterGroup.contains(event.target) && !filtersButton.contains(event.target)) showFilters(false);
  });
  document.addEventListener('focusin', event => {
    if (!picker.contains(event.target)) hideSuggestions();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !filterGroup.hidden) {
      showFilters(false);
      filtersButton.focus({preventScroll:true});
    }
  });
  new ResizeObserver(() => {
    document.documentElement.style.setProperty('--search-toolbar-height', toolbar.offsetHeight + 'px');
  }).observe(toolbar);

  const originalDetail = detail;
  const originalClose = closeModal;
  const historyKey = 'blinkerProductRef';
  if (history.state?.[historyKey]) {
    const restored = {...history.state};
    delete restored[historyKey];
    history.replaceState(restored, '');
  }
  function renderDetail(ref) {
    modalReturn = {scroll:window.scrollY};
    originalDetail(ref);
    if (!modal.querySelector('.dialog')) modalReturn = undefined;
  }
  detail = function (ref) {
    renderDetail(ref);
    if (!modalReturn) return;
    const state = {...history.state, [historyKey]:ref};
    if (history.state?.[historyKey]) history.replaceState(state, '');
    else history.pushState(state, '');
  };
  function dismissDetail() {
    const previous = modalReturn;
    modalReturn = undefined;
    originalClose();
    if (!previous) return;
    requestAnimationFrame(() => {
      if (modal.querySelector('.dialog')) return;
      window.scrollTo({top:previous.scroll, behavior:'instant'});
      if (previous.listTop !== undefined) {
        wantsSuggestions = true;
        renderSuggestions();
        list.scrollTop = previous.listTop;
      }
    });
  }
  closeModal = function () {
    if (history.state?.[historyKey] && modalReturn) {
      if (!returning) history.back();
      returning = true;
      return;
    }
    dismissDetail();
  };
  window.addEventListener('popstate', event => {
    returning = false;
    const ref = event.state?.[historyKey];
    if (ref) renderDetail(ref);
    else if (modalReturn) dismissDetail();
  });
  updateFilters();
})();
