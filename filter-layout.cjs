require('./footer-layout.cjs');
const fs = require('node:fs');
const path = 'public/index.html';
let html = fs.readFileSync(path, 'utf8');
const anchor = '  toolbar.append(picker);';
if (html.split(anchor).length !== 2) throw Error('Barra de pesquisa desconhecida');
html = html.replace(anchor, `  toolbar.append(picker);
  const filters = document.getElementById('product-filters');
  const group = document.createElement('details');
  group.className = 'product-filter-group';
  group.open = window.matchMedia('(min-width: 701px)').matches;
  const summary = document.createElement('summary');
  summary.textContent = 'Filtros e ordenação';
  group.append(summary, filters);
  toolbar.after(group);`);
const catalogFields = /(<label for="catalog-select">[\s\S]*?<\/select>)(<div class="catalog-filters">[\s\S]*?<\/div>)(<label for="catalog-search">[^<]*<\/label><input id="catalog-search"[^>]*>)/;
if (!catalogFields.test(html)) throw Error('Campos do catálogo desconhecidos');
html = html.replace(catalogFields, (_, select, filters, search) => '<div class="catalog-search-fields"><div>' + select + '</div><div>' + search + '</div></div>' + filters);
const css = `<style>
.product-filter-group{box-sizing:border-box;margin:6px 0 12px;padding:0 14px;background:white;border-radius:10px}
.product-filter-group summary{padding:12px 0;cursor:pointer;font-weight:600}
.product-filter-group #product-filters{margin:0!important;padding:0 0 14px}
main:has(#prod.hide)>.product-filter-group{display:none}
.catalog-search-fields{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,2fr);gap:12px;margin-bottom:14px;align-items:end}
#catalog-library .catalog-search-fields :is(select,input){box-sizing:border-box;width:100%;max-width:none;margin:6px 0 0;min-height:44px}
@media(max-width:700px){.catalog-search-fields{grid-template-columns:1fr}.product-picker input[type=search]{font-size:16px}}
</style>`;
fs.writeFileSync(path, html.replace('</html>', css + '</html>'));
