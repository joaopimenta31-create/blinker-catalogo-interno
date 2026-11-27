/* Ordenação para o seletor do catálogo. Cada produto é [referência, nome, ...].
   Passar o universo permitido pelos filtros atuais e os resultados do motor de sinónimos. */
function normalizar(texto) {
  return String(texto).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}
const ignorar = new Set(['de','da','do','dos','das','para']);
function palavras(texto) {
  const limpo = normalizar(texto).replace(/1\s*hour\s*tec/g, 'hourtec').replace(/(\d),(?=\d)/g, '$1.').replace(/(\d)\s*[x×]\s*(?=\d)/g, '$1 ');
  return (limpo.match(/\d+(?:\.\d+)?|[a-z]+/g) || [])
    .filter(p => !ignorar.has(p))
    .map(p => ({sapatos:'sapato',rebites:'rebite',remaches:'rebite',remache:'rebite',abas:'aba',largas:'larga'})[p] || p);
}
function proxima(a, b) {
  if (a.length < 4 || /\d/.test(a + b) || Math.abs(a.length-b.length)>1) return false;
  let i=0;
  while(i<a.length && a[i]===b[i]) i++;
  if(a.length===b.length) {
    return a.slice(i+1)===b.slice(i+1) ||
      (a[i]===b[i+1] && a[i+1]===b[i] && a.slice(i+2)===b.slice(i+2));
  }
  return a.length>b.length ? a.slice(i+1)===b.slice(i) : b.slice(i+1)===a.slice(i);
}
function codigoPesquisa(valor) {
  return String(valor).trim().replace(/^(\d{3})\s+(?=[a-z0-9])/i,'$1').toLowerCase();
}
function criarSugestoes(produtos) {
  const indice = produtos.map(produto => ({
    produto, ref:codigoPesquisa(produto[0]), nome:palavras(produto[1])
  }));
  return function sugerir(texto, resultadosDoMotor=[], limite=30) {
    const termos=palavras(texto);
    if (!termos.length) return [];
    const consulta=codigoPesquisa(texto);
    const porCodigo=/^\d{3,}$/.test(consulta);
    const anteriores=new Map(resultadosDoMotor.map((p,i)=>[p[0],i]));
    const pontos=new Map();
    const encontrados=[];
    for(const item of indice) {
      let valor=0;
      if(item.ref===consulta) valor=1000;
      else if(/\d/.test(consulta) && item.ref.startsWith(consulta)) valor=900;
      else if(porCodigo) continue;
      else {
        let soma=0;
        let aproximada=false;
        for(const termo of termos) {
          let melhor=0;
          for(const palavra of item.nome) {
            const chave=termo+' '+palavra;
            let v=pontos.get(chave);
            if(v===undefined) {
              v=termo===palavra ? 6 : palavra.startsWith(termo) && !/\d/.test(termo) ? 4 : proxima(termo,palavra) ? 2 : 0;
              pontos.set(chave,v);
            }
            melhor=Math.max(melhor,v);
          }
          if(!melhor) { soma=0; break; }
          aproximada ||= melhor===2;
          soma+=melhor;
        }
        if(soma) valor=(aproximada ? 100 : 500)+soma/termos.length+
          Number(item.nome.join(' ').includes(termos.join(' ')));
        if(anteriores.has(item.produto[0]) && termos.filter(t=>/^\d/.test(t)).every(t=>item.nome.includes(t) || item.ref===consulta)) valor=Math.max(valor,300);
      }
      if(valor) encontrados.push({produto:item.produto,valor,ordem:anteriores.get(item.produto[0]) ?? Infinity});
    }
    return encontrados.sort((a,b)=>b.valor-a.valor || a.ordem-b.ordem).slice(0,limite).map(x=>x.produto);
  };
}
module.exports={criarSugestoes};