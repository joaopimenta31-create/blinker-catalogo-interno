require('./catalog-build.cjs');
const fs = require('node:fs');
const file = 'public/index.html';
if (!fs.readFileSync(file,'utf8').includes("list.id = 'product-options'")) require('./add-suggestions.cjs');
let html = fs.readFileSync(file,'utf8');
function change(before, after) {
  if (!html.includes(before)) throw Error('Suggestion code changed: ' + before);
  html = html.replace(before, () => after);
}
change("document.addEventListener('pointercancel', () => {pressed = false; close()});", "document.addEventListener('pointercancel', () => {pressed = false});");
change("max-height:38vh;overflow:auto;", "max-height:38vh;max-height:38dvh;overflow-y:auto;overscroll-behavior-y:contain;touch-action:pan-y;");
change("  function prefixProducts()", "  const suggestionLimit = 30;\n  function prefixProducts()");
change("contains.length < 6", "contains.length < suggestionLimit");
change("begins.length === 6", "begins.length === suggestionLimit");
change("begins.concat(contains).slice(0,6)", "begins.concat(contains).slice(0,suggestionLimit)");
change("products.slice(0, 6)", "products.slice(0, suggestionLimit)");
change("cachedResults.slice(0,6)", "cachedResults.slice(0,suggestionLimit)");
const pickerStart = html.lastIndexOf('<script>', html.indexOf("list.id = 'product-options'"));
const picker = html.slice(pickerStart + 8, html.indexOf('</script>',pickerStart));
new (require('node:vm').Script)(picker);
fs.writeFileSync(file, html);

const tagPattern = /<input\b(?=[^>]*\bid="q")[^>]*>/i;
const tag = html.match(tagPattern)[0];
const placeholder = /\splaceholder\s*=\s*(?:"[^"]*"|'[^']*')/i;
const newTag = tag.replace(placeholder, ' placeholder=" "');
if (newTag === tag || !newTag.includes('placeholder=" "')) throw Error('Placeholder');
html = html.replace(tagPattern, () => newTag);
const icon = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#59636b" stroke-width="2" stroke-linecap="round"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></svg>';
const css = '<style>#q:placeholder-shown{background-image:url("data:image/svg+xml,' + encodeURIComponent(icon) + '");background-repeat:no-repeat;background-size:19px 19px;background-position:left 12px center}</style>';
change('</html>',css+'</html>');
if (!html.includes(css) || html.match(tagPattern)[0] !== newTag) throw Error('Missing search icon');
fs.writeFileSync(file,html);
