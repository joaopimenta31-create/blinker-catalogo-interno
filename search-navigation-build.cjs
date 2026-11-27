const fs = require('node:fs');
const crypto = require('node:crypto');

function updateNavigation(html) {
  function replaceOnce(before, after) {
    const pieces = html.split(before);
    if (pieces.length !== 2) throw Error('Marcador de pesquisa inesperado: ' + before.slice(0, 75));
    html = pieces.join(after);
  }

  const picker = html.indexOf("list.id = 'product-options'");
  const start = html.lastIndexOf('<script>', picker);
  const end = html.indexOf('</script>', picker);
  if (picker < 0 || start < 0 || end < 0) throw Error('Seletor de produtos não encontrado');
  html = html.slice(0, start) + html.slice(end + '</script>'.length);

  const referenceStart = html.indexOf('const codigoCanonico=');
  const referenceEnd = html.indexOf('const query=prepareQuery', referenceStart);
  if (referenceStart < 0 || referenceEnd < 0) throw Error('Pesquisa por referência não encontrada');
  html = html.slice(0, referenceStart) + html.slice(referenceEnd);
  const rankingStart = html.indexOf('let score;if(porReferencia)');
  const rankingEnd = html.indexOf('if(score>0)', rankingStart);
  if (rankingStart < 0 || rankingEnd < 0) throw Error('Ordenação de produtos não encontrada');
  html = html.slice(0, rankingStart) + 'const score=rank(entry,query);' + html.slice(rankingEnd);

  replaceOnce("cachedResults=[];searchMatchNote='';return", "cachedResults=[];searchMatchNote='';window.dispatchEvent(new Event('product-results-ready'));return");
  replaceOnce('key=norm(q)', 'key=BlinkSearch.normalize(q)');
  replaceOnce('const query=prepareQuery(scoped.terms);', 'const query=prepareQuery(scoped.terms);if(/^\\d{3,}$/.test(query.compact))query.code=true;');
  replaceOnce('id="clear-filters" type="button" onclick="document.getElementById(\'q\').value=\'\';document.getElementById(\'family\').value=\'\';document.getElementById(\'catalog\').value=\'\';limit=40;search()"', 'id="clear-filters" type="button"');
  return html;
}

if (require.main === module) {
  const path = 'public/index.html';
  const assets = ['navigation.js', 'navigation.css'].map(name => {
    const content = fs.readFileSync(name);
    fs.writeFileSync('public/' + name, content);
    return name + '?v=' + crypto.createHash('sha256').update(content).digest('hex').slice(0, 12);
  });
  const html = updateNavigation(fs.readFileSync(path, 'utf8'));
  fs.writeFileSync(path, html + '\n<link rel="stylesheet" href="' + assets[1] + '"><script src="' + assets[0] + '"></script>\n');
}

module.exports = updateNavigation;
