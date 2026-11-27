require('./select-sizing.cjs');
const fs = require('node:fs');
const path = 'public/index.html';
const page = fs.readFileSync(path, 'utf8');
const before = "group.open = window.matchMedia('(min-width: 701px)').matches;";
if (page.split(before).length !== 2) throw Error('Caixa de filtros não encontrada');
fs.writeFileSync(path, page.replace(before, 'group.open = true;'));
