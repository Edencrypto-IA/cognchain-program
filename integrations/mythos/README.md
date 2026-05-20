# CongChain Mythos Integration Pack

Este pacote contem os plugins e skills CongChain para o Mythos Agent.

Objetivo:

- conectar Mythos ao Agent Memory Bridge da CongChain;
- salvar contexto, observabilidade e resultados de tarefa com API key autenticada;
- manter cada agente em um vault logico separado;
- preservar o limite de seguranca: sem secrets, sem private keys, sem signed payloads e sem movimento de fundos.

## Arquivos

- `plugins/context_engine/congchain`: salva turnos importantes antes da compressao.
- `plugins/observability/congchain`: salva tool calls e resumo de sessao.
- `plugins/interpretability/congchain-cna`: modo experimental para fingerprint CNA em modelos locais.
- `optional-skills/blockchain/congchain`: CLI stdlib para `health`, `write`, `list`, `read` e `verify`.
- `skills/software-development/congchain-forge`: protocolo para Mythos atuar como backend do Forge.

## Ambiente

```bash
export CONGCHAIN_API_URL=https://cognchain-program-production.up.railway.app
export CONGCHAIN_API_KEY=cog_live_sua_key_completa
export CONGCHAIN_AGENT_ID=mythos-local
```

`CONGCHAIN_API_KEY` e obrigatoria para escrita e listagem. O health publico pode funcionar sem key.

## Instalar no Mythos

Copie o conteudo desta pasta para a raiz do repositorio Mythos, preservando as pastas `plugins/`, `optional-skills/` e `skills/`.

Depois habilite:

```bash
mythos config set context.engine congchain
mythos plugins enable observability/congchain
mythos plugins enable interpretability/congchain-cna
```

O plugin CNA deve ficar opcional. Sem `CNA_MODEL_PATH`, ele roda em modo passivo.

## Teste seguro

```bash
python optional-skills/blockchain/congchain/scripts/congchain_client.py health
python optional-skills/blockchain/congchain/scripts/congchain_client.py write "Mythos bridge test"
python optional-skills/blockchain/congchain/scripts/congchain_client.py list --limit 5
```

## Notas de seguranca

- Nao cole `CONGCHAIN_API_KEY` em chat, logs ou prints.
- O bridge nao assina transacoes e nao move fundos.
- O retorno `on_chain: false` e esperado enquanto a memoria estiver no modo bridge off-chain.
- Prova ZK/on-chain so deve ser exibida como ativa quando a API retornar prova real.
