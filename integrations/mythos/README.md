# CongChain Mythos Integration Pack

Este pacote contem os plugins e skills CongChain para o Mythos Agent.

Objetivo:

- conectar Mythos ao Agent Memory Bridge da CongChain;
- salvar contexto, observabilidade e resultados de tarefa com API key autenticada;
- manter cada agente em um vault logico separado;
- preservar o limite de seguranca: sem secrets, sem private keys, sem signed payloads e sem movimento de fundos.

## Identidade Mythos

Mythos pode nascer de um fork compativel com Hermes, mas este pacote trata
Mythos como identidade propria dentro da CongChain.

- `source`: `mythos`
- `contentType`: `mythos_memory`, `mythos_skill` ou `mythos_task_result`
- `namespace`: `mythos`
- `compatibilityMode`: `hermes_compatible_mythos_primary`

Compatibilidade Hermes deve ser considerada camada legada. O vault padrao,
os metadados e os exemplos deste pacote escrevem como Mythos.

## Seis pilares de identidade

1. `Provable Memory Passport`: memorias importantes carregam origem, agent ID,
   skill, hash e metadata de seguranca.
2. `Skill-Governed Execution`: o trabalho comeca por uma skill declarada, nao
   por um prompt generico invisivel.
3. `Memory Constitution`: regras anti-secret, no-funds, no-signed-payload e
   revisao humana acompanham cada gravacao.
4. `Cross-Model Continuity`: modelo, provider, skill e tarefa podem continuar
   rastreaveis mesmo quando o runtime troca de motor.
5. `External Agent Vault`: cada key, source e agent ID fica em um vault logico
   isolado.
6. `Boardroom Audit Packet`: setup, payload, status, capacidades e limites de
   seguranca ficam prontos para revisao tecnica.

Esses pilares posicionam Mythos como infraestrutura de agente verificavel. Eles
nao adicionam execucao autonoma, assinatura de carteira, monitoramento real ou
movimento de fundos.

## Cerebro verificavel v1

Mythos agora carrega uma arquitetura cognitiva auditavel:

- Perception Layer: registra sinais observados antes da resposta.
- Memory Layer: separa prompt vivo, memoria CongChain, Obsidian e providers
  externos.
- Reasoning Layer: explica por que uma skill ou caminho foi escolhido sem
  expor chain-of-thought sensivel.
- Prediction Layer: resume cenarios provaveis, riscos e incerteza.
- Operational Conscience: aplica limites de seguranca antes de qualquer acao.
- Auditable Learning Layer: transforma decisoes em candidatas a memoria apenas
  quando houver escrita autenticada explicita.

Metadados usados pelo pacote:

- `cognitiveArchitecture`: `mythos_verifiable_brain_v1`
- `decisionTraceSchema`: `mythos_decision_trace_v1`

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
