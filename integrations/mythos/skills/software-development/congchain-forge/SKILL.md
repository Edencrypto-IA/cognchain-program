---
name: congchain-forge
description: "Use quando o Mythos estiver rodando como backend do CognChain Forge. Formata respostas como propostas estruturadas de arquivo com código, diff e preview, compatíveis com o protocolo SSE do Forge."
version: 1.0.0
author: Eden Lucas / CognChain + Mythos Agent
license: MIT
platforms: [linux, macos, windows]
metadata:
  mythos:
    tags: [CognChain, Forge, IDE, build, proposals, SSE, bridge]
    related_skills: [congchain, writing-plans, subagent-driven-development]
---

# CognChain Forge — Skill de Backend

## Quando Usar

- Mythos está sendo chamado pelo Forge da CognChain como backend de execução
- O sistema prompt contém a flag `FORGE_MODE: true`
- O usuário pede para construir, gerar ou modificar arquivos dentro do Forge
- O usuário pede para analisar, refatorar ou debugar código no workspace

## Formato de Resposta Obrigatório no Forge Mode

Quando em modo Forge, estruture SEMPRE cada proposta assim:

```
[FORGE_PLAN]
Vou criar X arquivos para implementar Y.
1. arquivo-a.ts — responsável por Z
2. arquivo-b.py — responsável por W
[/FORGE_PLAN]

[FORGE_PROPOSAL]
action: create
path: caminho/relativo/do/arquivo.ts
language: typescript
description: O que este arquivo faz e por que está sendo criado
---
// código completo aqui
[/FORGE_PROPOSAL]
```

### Ações válidas
- `create` — novo arquivo
- `modify` — editar arquivo existente
- `delete` — remover arquivo (requer confirmação explícita no plano)

### Regras obrigatórias
- Sempre emita `[FORGE_PLAN]` ANTES das propostas
- Sempre use caminhos relativos ao workspace — nunca absolutos
- Nunca emita código fora de um bloco `[FORGE_PROPOSAL]`
- Propostas de `delete` exigem justificativa explícita no plano

## Fluxo de Execução

1. Receber o prompt do Forge
2. Usar `terminal` para entender o contexto: `ls`, `cat` nos arquivos relevantes
3. Usar LSP via diagnóstico para checar erros antes de propor
4. Emitir `[FORGE_PLAN]` com o plano completo
5. Para cada arquivo: emitir `[FORGE_PROPOSAL]` completo com código
6. Usar `terminal` para rodar testes se existirem
7. Emitir `[FORGE_SUMMARY]` com resultado

## Memória Verificável

Após cada proposta aplicada com sucesso, se a skill `congchain` estiver
disponível, registrar a proposta como memória verificável no bridge.

## Pitfalls

- Nunca emitir código fora de FORGE_PROPOSAL em Forge mode
- Sempre verificar com LSP antes de propor
- Confirmar imports e dependências antes de propor novos arquivos
- Em projetos TypeScript, confirmar se o path está no tsconfig.json
