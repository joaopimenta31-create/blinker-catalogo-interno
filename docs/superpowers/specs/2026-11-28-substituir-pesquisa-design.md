# Substituir a pesquisa antiga pela nova

Aprovado pelo utilizador. Substitui a decisão de página separada em `2026-11-27-pesquisa-rapida-design.md`; o comportamento de pesquisa aí descrito mantém-se.

## Objetivo

Uma só pesquisa, no ecrã onde a aplicação abre, para chegar à referência no telemóvel ou tablet.

## Abordagens

| Abordagem | Compromisso |
|---|---|
| **Dentro da aplicação atual (escolhida)** | Ficha abre de imediato; há código antigo ligado à pesquisa, por isso é escondido e não apagado |
| Página nova no início | Menos risco, mas abrir uma ficha carrega outra página |

## Desenho

- Caixa de pesquisa, botão **Filtros**, botões de refinar, avisos e linhas com **Copiar** substituem a pesquisa, as sugestões e os cartões antigos.
- **Filtros** (família, catálogo, ordenação) mantêm-se: aplicam-se antes da correspondência aproximada, funcionam sem texto, e os ativos aparecem como botões removíveis.
- Tocar no nome abre a ficha existente por cima (proposta e favoritos continuam lá).
- Saem: Comparar, sugestões, "Completar pesquisa", atalhos 1HOURTEC/Polimento/Desengordurantes, `/pesquisa.html` e o botão "Pesquisa rápida".
- Ficam os botões das outras secções, abaixo dos resultados (decidido na verificação: acima deles empurravam o primeiro resultado para o fundo do ecrã).

## Plano

1. `search-core.js` (teste primeiro): `search(text, accept?)` pesquisa só produtos aceites, e sem texto devolve todos os aceites; `matchesFilters(entry, {family, catalog})` com a semântica antiga (`unclassified` = sem família); `sortByPrice(products, 'relevance'|'low'|'high')`, sem preço no fim.
2. `page.js` / `page.css`: montam a interface dentro de `main` e `#prod`, estilos limitados a classes `rq-`, reutilizam os `select` antigos, `PRODUCTS`, `searchPhotos`, `CATALOG_MEDIA`, `FAMILY_DATA` e `detail()`.
3. `quick-page-build.cjs`: junta os ficheiros ao `index.html`, deixa de gerar `pesquisa.html`, valida com dados reais.
4. `CLAUDE.md`, build limpo, verificação a 375×812 e 768×1024, revisão final.
