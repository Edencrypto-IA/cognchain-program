---
name: url-reader
description: Leitura limpa de URLs usando Jina Reader r.jina.ai para converter paginas em markdown analisavel.
trigger: "analise este site, leia esse link, url, pagina, docs"
version: "1.0.0"
---

# URL Reader Skill

Use esta skill quando o usuario enviar um link e pedir analise, resumo, auditoria ou extracao de conteudo.

## Ferramenta atual

- Reader: `https://r.jina.ai/http://...` ou `https://r.jina.ai/http://...`
- Saida: markdown limpo
- Modo: somente leitura

## Limites

- Nao executa JavaScript perigoso.
- Nao copia site, codigo, assets protegidos ou branding integral.
- Conteudo inacessivel ao reader deve ser marcado como indisponivel.

## Saida esperada

- O que o site/documento diz
- Pontos importantes
- Riscos, lacunas ou limites
- Recomendacao pratica sem inventar dados
