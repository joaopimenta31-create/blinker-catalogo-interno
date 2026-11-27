require('./before-compare.cjs');
const fs=require('node:fs');
const path='public/index.html';
const html=fs.readFileSync(path,'utf8');
for(const token of ['product-results-ready','cachedResults','quick-search','button class="primary"'])if(!html.includes(token))throw Error('Estrutura de resultados incompatível: '+token);
const js=fs.readFileSync('compare.js','utf8'),css=fs.readFileSync('compare.css','utf8');
fs.writeFileSync(path,html.replace('</html>',()=>'<style>'+css+'</style><script>'+js+'</script></html>'));