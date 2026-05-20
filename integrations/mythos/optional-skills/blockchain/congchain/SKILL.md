---
name: congchain
description: "Leia e escreva memórias de IA verificáveis na CongChain. Use quando o usuário quiser salvar, recuperar ou verificar uma memória de IA por hash usando uma API key CongChain."
version: 1.0.0
author: Eden Lucas / CognChain + Mythos Agent
license: MIT
platforms: [linux, macos, windows]
metadata:
  mythos:
    tags: [CognChain, memory, verifiable, bridge, AI-agents, Web3]
    category: blockchain
    related_skills: [solana]
    requires_toolsets: [terminal]
---

# CongChain — Memória Verificável para Agentes

## Quando Usar

- Usuário quer salvar um insight ou memória verificável na CongChain
- Usuário quer recuperar uma memória por hash
- Usuário quer verificar a prova ou status de uma memória por hash
- Usuário quer listar memórias do vault lógico do agente
- Usuário quer registrar um checkpoint de sessão do Mythos

## Pré-requisitos

```bash
export CONGCHAIN_API_URL=https://cognchain-program-production.up.railway.app
export CONGCHAIN_API_KEY=<sua_key_cog_live_completa>
export CONGCHAIN_AGENT_ID=mythos-local  # opcional
```

## Referência Rápida

```bash
SCRIPT=~/.mythos/skills/blockchain/congchain/scripts/congchain_client.py

python3 $SCRIPT health                        # verificar conectividade
python3 $SCRIPT vault-info                    # verificar vault lógico da API key
python3 $SCRIPT write "Seu insight aqui" --confidence 9000 --importance 8500
python3 $SCRIPT read <hash>
python3 $SCRIPT list --limit 10
python3 $SCRIPT verify <hash>
python3 $SCRIPT chain <hash1> <hash2>
```

## Procedimento

### 1. Verificar conectividade

```bash
python3 $SCRIPT health
# Saída esperada: status: ok | cluster: devnet | program: BgrtrS...
```

### 2. Escrever uma memória

```bash
python3 $SCRIPT write "Insight técnico aqui" --confidence 9000 --importance 8500
# Retorna: memory_id, content_hash, readUrl, proofUrl e verifyUrl
```

Escala de confiança (confidence_bps):
- 10000 = 100% — certeza absoluta
- 8500  = 85%  — alta confiança (mínimo para ancoragem automática)
- 6000  = 60%  — confiança moderada

### 3. Ler uma memória

```bash
python3 $SCRIPT read <hash>
```

### 4. Verificar prova/status

```bash
python3 $SCRIPT verify <hash>
# Retorna: status da memória, prova quando disponível e flags de segurança
```

### 5. Encadear memórias (cross-session)

```bash
python3 $SCRIPT chain <hash1> <hash2> <hash3>
```

Saída em formato de cabeçalho verificado:
```
⚡ Memória Verificada · CongChain Bridge
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Hash: <hash[:32]>...
Origem: <model> · <created_at>
Status: ✓ Verificável · Score: 90%
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
<resumo>
```

## Pitfalls

- A key completa só aparece uma vez em /dashboard/keys; salve fora do chat.
- Não envie API keys, seed phrases, private keys ou signed payloads como memória.
- O bridge atual salva metadados verificáveis. ZK/on-chain só aparecem como ativos quando a API retornar essa prova de verdade.
- Se o endpoint retornar 401, confira `CONGCHAIN_API_KEY`.
- Se o endpoint retornar 404/5xx, confira a saúde da produção antes de alterar o plugin.

## Verificação

```bash
python3 $SCRIPT health
```

Deve retornar `status: ok`. Se falhar, verificar CONGCHAIN_API_URL.
