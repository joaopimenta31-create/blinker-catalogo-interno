(() => {
  function element(tag, text) {
    const node = document.createElement(tag);
    if (text != null) node.textContent = text;
    return node;
  }
  const blackSilicone = {
    photo: {path:'assets/customer-045169.webp'},
    photoCaption:'Silicone de juntas preto TP1 com aplicador de pistola',
    applications:[{text:'Vedação de juntas expostas a temperaturas elevadas, incluindo bombas de água, tampas de válvulas e cárteres.'}],
    characteristics:[{text:'Silicone preto de 200 ml, em embalagem pressurizada TP1 com pistola.'},{text:'Mantém-se estável e flexível até 250 °C. A secagem total demora aproximadamente 24 horas.'}]
  };
  async function catalogEvidence(ref, section) {
    section.textContent = 'A carregar a página de catálogo…';
    try {
      const [record, catalog] = await Promise.all([productDocumentRecord(ref),documentRegistry()]);
      if (!section.isConnected) return;
      const sources = (record?.sources || []).map(id => catalog[id]).filter(source =>
        source && /^[a-z0-9-]+$/.test(source.slug) && Number.isInteger(Number(source.page)) &&
        Number(source.page) > 0 && !/promo|tarif|descont|preço/i.test(source.slug+' '+source.catalogTitle));
      section.replaceChildren();
      if (!sources.length || record.review?.status === 'rejected_misattribution') {
        section.textContent = 'Sem página de catálogo confirmada para esta referência.';
        return;
      }
      const source = sources[0];
      const label = source.catalogTitle + ' · pág. ' + source.page;
      const figure = element('figure');
      const image = element('img');
      image.alt = 'Página de catálogo com a referência ' + ref;
      image.onerror = () => { image.replaceWith(element('p','Imagem da página indisponível.')); };
      image.src = 'catalogs/' + source.slug + '/page-' + String(source.page).padStart(4,'0') + '.webp';
      figure.append(image,element('figcaption',label));
      section.append(figure);
    } catch {
      section.textContent = 'Não foi possível carregar a documentação deste produto.';
    }
  }
  function present(product, amount) {
    const sheet = product[0] === '045169' ? blackSilicone : typeof PRODUCT_TECH_SHEETS === 'undefined' ? null : PRODUCT_TECH_SHEETS[product[0]];
    const screen = element('dialog');
    screen.className = 'customer-screen';
    screen.setAttribute('aria-label', 'Apresentação ao cliente');
    const content = element('article');
    const back = element('button', 'Terminar apresentação');
    back.onclick = () => screen.close();
    content.append(element('strong','BLINKER'), element('p','Ref. ' + product[0]), element('h2',product[1]));
    if (sheet?.photo?.path) {
      const image = element('img');
      image.src = sheet.photo.path;
      image.alt = sheet.photoCaption || product[1];
      content.append(image);
    }
    if (sheet && !sheet.conflicts?.length) {
      for (const [title, items] of [['Aplicação',sheet.applications],['Características',sheet.characteristics]]) {
        if (!items?.length) continue;
        const list = element('ul');
        for (const item of items) list.append(element('li',item.text));
        content.append(element('h3',title),list);
      }
    }
    if (product[0] === '045169') content.append(element('p','Fonte · Catálogo Auto Geral, pág. 8'));
    if (!sheet) {
      const evidence = element('section');
      evidence.className = 'customer-evidence';
      content.append(evidence);
      catalogEvidence(product[0],evidence);
    }
    if (product[4] && product[4] !== 'Sob consulta') content.append(element('p','Embalagem · ' + product[4]));
    if (amount !== null) {
      const price = element('p',money(amount) + ' sem IVA');
      price.className = 'customer-price';
      content.append(price);
    }
    content.append(back);
    screen.append(content);
    document.body.append(screen);
    screen.addEventListener('close', () => screen.remove(), {once:true});
    screen.addEventListener('keydown', event => {
      if (event.key === 'Escape') event.stopPropagation();
    });
    screen.showModal();
    screen.scrollTop = 0;
  }
  function addControls(ref) {
    const panel = document.querySelector('#modal .dialog');
    const product = PRODUCTS.find(row => row[0] === ref);
    if (!panel || !product || panel.querySelector('.customer-controls')) return;
    const controls = element('details');
    controls.className = 'customer-controls';
    controls.append(element('summary','Mostrar ao cliente'));
    const form = element('form');
    const label = element('label','Preço a apresentar');
    const select = element('select');
    select.add(new Option('Sem preço','none'));
    if (Number.isFinite(product[2])) select.add(new Option('PVP · ' + money(product[2]) + ' sem IVA','pvp'));
    select.add(new Option('Preço proposto','custom'));
    label.append(select);
    const custom = element('label','Preço proposto sem IVA (€)');
    const input = element('input');
    input.type = 'text';
    input.inputMode = 'decimal';
    input.required = true;
    input.pattern = '[0-9]+([.,][0-9]{1,2})?';
    input.title = 'Introduz um preço em euros com até duas casas decimais.';
    custom.append(input);
    function update() {
      custom.hidden = input.disabled = select.value !== 'custom';
    }
    select.onchange = update;
    update();
    const go = element('button','Iniciar apresentação');
    go.className = 'primary';
    form.append(label,custom,go);
    form.onsubmit = event => {
      event.preventDefault();
      const amount = select.value === 'custom' ? Number(input.value.replace(',','.')) : select.value === 'pvp' ? product[2] : null;
      if (amount !== null && !Number.isFinite(amount)) return;
      present(product,amount);
    };
    controls.append(form);
    panel.querySelector('h3')?.after(controls);
  }
  const original = detail;
  detail = function(ref) { original(ref); addControls(ref); };
  const initial = location.hash.match(/^#ficha\/([A-Za-z0-9_-]+)$/);
  if (initial) addControls(initial[1]);
})();
