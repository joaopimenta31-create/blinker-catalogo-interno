require('./base-build.cjs');
require('./hourtec.cjs');
require('./multi-search.cjs');
const fs = require('node:fs');
const path = 'public/index.html';
const html = fs.readFileSync(path,'utf8');
if (!html.includes('class="product-picker"') || !html.includes('function brandTerms(')) throw Error('Estrutura da pesquisa incompatível');
const styles = ['quick-view.css','customer-view.css'].map(f => fs.readFileSync(f,'utf8')).join('\n');
const script = ['quick-view.js','customer-view.js'].map(f => fs.readFileSync(f,'utf8')).join('\n');
fs.writeFileSync(path,html.replace('</html>', () => '<style>'+styles+'</style><script>'+script+'</script></html>'));

fs.writeFileSync('public/assets/customer-045169.webp', Buffer.from(fs.readFileSync('customer-045169.b64','utf8'),'base64'));

require('./associate.cjs');
require('./coverage-build.cjs');
