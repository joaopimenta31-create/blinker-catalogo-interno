require('./catalog-before-layout.cjs');
const fs = require('node:fs');
const path = 'public/index.html';
const page = fs.readFileSync(path, 'utf8');
const placement = '  panel.before(toolbar);';
if (page.split(placement).length !== 2) throw Error('Posição da pesquisa desconhecida');
const updated = page.replace(placement, "  panel.closest('main').prepend(toolbar);");
fs.writeFileSync(path, updated.replace('</html>', '<style>main:has(#prod.hide) > .quick-search{display:none}</style></html>'));
