---
name: memory-anchor
description: Ancoragem verificavel de memoria via SHA-256 e Solana Devnet, sem expor conteudo sensivel.
trigger: "ancorar memoria, salvar hash, verificar memoria, congchain"
version: "1.0.0"
---

# Memory Anchor Skill

Use esta skill quando uma memoria do Mythos precisar ganhar identidade verificavel.

## Ferramenta atual

- Hash: SHA-256 do conteudo/contexto
- Rede: Solana Devnet
- Ponte: CongChain Memory Bridge

## Limites

- Nao assina pela carteira do usuario.
- Nao move fundos.
- Nao publica conteudo sensivel em texto aberto on-chain.
- Se a ancoragem falhar, a memoria continua local/backend e deve ser marcada como pendente.

## Saida esperada

- Hash SHA-256
- Status da ancoragem
- Fonte do evento
- Limite de seguranca aplicado
