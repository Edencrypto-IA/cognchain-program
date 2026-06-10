---
name: web-search
description: Pesquisa web segura usando Anthropic web_search_20250305 para sintetizar fontes publicas sem inventar dados.
trigger: "web search, pesquisar, buscar na web, radar politico, product finder"
version: "1.0.0"
---

# Web Search Skill

Use esta skill quando o Mythos precisar consultar informacoes recentes ou fontes publicas que podem mudar com o tempo.

## Ferramenta atual

- Provider: Anthropic Messages API
- Tool: `web_search_20250305`
- Modo: somente leitura

## Limites

- Nao executa pagamentos, compras, vendas, swaps, assinaturas ou transacoes.
- Nao transforma resultados de busca em acusacoes sem fonte oficial.
- Dados recentes podem ter defasagem de horas ou dias.

## Saida esperada

- Resumo em portugues brasileiro
- Fontes ou tipos de fonte consultados
- Limites da leitura
- Proximo passo seguro
