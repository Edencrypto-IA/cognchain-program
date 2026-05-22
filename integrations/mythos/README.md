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

- `plugins/congchain-adapter`: conecta os hooks reais do runtime Mythos a
  eventos auditaveis na CongChain.
- `plugins/nvidia-router`: recomenda o melhor modelo para a tarefa e registra
  a decisao como contexto auditavel sem trocar o modelo automaticamente.
- `plugins/context_engine/congchain`: salva turnos importantes antes da compressao.
- `plugins/observability/congchain`: salva tool calls e resumo de sessao.
- `plugins/interpretability/congchain-cna`: modo experimental para fingerprint CNA em modelos locais.
- `optional-skills/blockchain/congchain`: CLI stdlib para `health`, `write`, `list`, `read` e `verify`.
- `skills/autonomous-ai-agents/nvidia-router`: guia operacional para escolher
  modelos NVIDIA/OpenRouter por tipo de trabalho.
- `skills/congchain`: pacote Mythos Verifiable Brain com 16 skills CongChain
  para auditoria, busca de memoria, diff de contexto, rollback, export,
  continuidade multimodelo e revisao Solana segura.
- `skills/software-development/congchain-forge`: protocolo para Mythos atuar como backend do Forge.

## Mythos Verifiable Brain Skill Pack

As 16 skills em `skills/congchain` sao diferenciais oficiais do Mythos dentro
da CongChain. Elas foram corrigidas para nao prometer execucao que o runtime
ainda nao garante.

Skills de governanca e memoria:

- `congchain-session-audit`: cria resumo auditavel de sessao.
- `congchain-memory-search`: busca memorias por hash, metadata e resumo seguro.
- `congchain-context-diff`: compara sessoes ou memorias sem expor chain-of-thought.
- `congchain-vault-bootstrap`: guia setup de API key e vault logico.
- `congchain-chain-graph`: mostra relacoes entre sessoes, skills, hashes e provas.
- `congchain-confidence-calibration`: calibra confianca por evidencia e incerteza.
- `congchain-rollback`: prepara plano de rollback sem reverter automaticamente.
- `congchain-multimodel-sync`: preserva contexto entre modelos e provedores.
- `congchain-export`: exporta somente metadata segura para revisao.

Skills de desenvolvimento:

- `congchain-forge-lsp`: adiciona diagnosticos LSP/testes antes de confiar em propostas.

Skills Solana seguras:

- `solana-tx-inspector`: inspeciona transacoes publicas em modo read-only.
- `solana-vault-health`: revisa sinais publicos de vault/endereco.
- `solana-airdrop-manager`: ajuda Devnet airdrop sem tocar fundos reais.
- `solana-anchor-schema-validator`: revisa IDL/schema Anchor sem deploy.
- `solana-memory-finality-tracker`: separa memoria local, API, prova, anchor e finality.
- `solana-wallet-ecosystem-bridge`: planejamento futuro de wallet/ecossistema; nao assina.

Contrato de seguranca:

- nao armazenar secrets, private keys, seed phrases, signed payloads ou dados
  privados de carteira;
- dizer `registered in CongChain` apenas quando a API de memoria confirmar;
- dizer `on-chain` apenas quando um endpoint de anchor blockchain confirmar;
- manter skills Solana como read-only, Devnet-only ou planning-only ate existir
  fase auditada de Wallet Agent com aprovacao visivel e assinatura explicita.

## Runtime adapter

O `plugins/congchain-adapter` e a camada principal para ligar o Mythos real a
CongChain sem nerfar o agente. Ele nao remove browser, terminal, arquivos,
Python, plataformas, cron, subagentes ou ferramentas. Ele observa os hooks reais
e grava memoria auditavel quando algo importante acontece.

Mapeamento de eventos:

| Evento CongChain | Hook real do Mythos | Dados principais |
| --- | --- | --- |
| `onTaskStart` | `on_session_start` | `session_id`, `model`, `platform` |
| `onSkillSelected` | `pre_llm_call` na primeira chamada | `model`, `user_message`, `is_first_turn` |
| `onToolCall` | `pre_tool_call` | `tool_name`, `args`, `task_id`, `tool_call_id` |
| `onToolResult` | `post_tool_call` | `result`, `duration_ms`, `error` |
| `onMemoryCompress` | `post_api_request` com `finish_reason=length/max_tokens` | `message_count`, `api_call_count` |
| `onTaskComplete` | `on_session_end` e `on_session_finalize` | `completed`, `interrupted`, `tool_count` |
| `onSafetyBlock` | `post_tool_call` e `post_llm_call` | bloqueios, recusas e whitelist |

O adapter escreve em `/api/memory/write` com `Authorization: Bearer
CONGCHAIN_API_KEY`. Cada evento usa `source=mythos`, `agentName=Mythos`,
`origin=mythos-runtime-congchain-adapter` e flags de seguranca que bloqueiam
secrets, private keys, signed payloads e movimento de fundos.

## Ambiente

```bash
export CONGCHAIN_API_URL=https://cognchain-program-production.up.railway.app
export CONGCHAIN_API_KEY=cog_live_sua_key_completa
export CONGCHAIN_AGENT_ID=mythos-local
```

`CONGCHAIN_API_KEY` e obrigatoria para escrita e listagem. O health publico pode funcionar sem key.

## Instalar no Mythos

Modo recomendado: use o instalador stdlib do pacote CongChain. Ele copia o
adapter, plugins auxiliares e skills para `MYTHOS_HOME`, habilita
`plugins.enabled` no `config.yaml` e prepara `context.engine=congchain`.

```bash
python integrations/mythos/scripts/install_congchain_into_mythos.py \
  --mythos-home ~/.mythos \
  --api-url https://cognchain-program-production.up.railway.app \
  --agent-id mythos-local
```

Para gravacoes reais, defina a key no ambiente do Mythos ou passe uma vez para
o instalador local:

```bash
export CONGCHAIN_API_KEY=cog_live_sua_key_completa
```

ou:

```bash
python integrations/mythos/scripts/install_congchain_into_mythos.py \
  --api-key cog_live_sua_key_completa
```

Nao compartilhe essa key em prints, tickets ou commits.

Para verificar contra um runtime Mythos extraido/clonado:

```bash
python integrations/mythos/scripts/install_congchain_into_mythos.py \
  --mythos-home ~/.mythos \
  --runtime-path /caminho/para/mythos-agent
```

O verificador importa `mythos_cli.plugins`, roda `discover_plugins(force=True)`
e confirma que `congchain-adapter` esta `enabled=True` com hooks como
`pre_tool_call` e `post_tool_call` registrados.

Se o runtime extraido ainda nao tiver dependencias instaladas, use apenas para
contract check local:

```bash
python integrations/mythos/scripts/install_congchain_into_mythos.py \
  --mythos-home ~/.mythos \
  --runtime-path /caminho/para/mythos-agent \
  --allow-yaml-shim
```

Esse shim valida descoberta/config/hook do plugin. Ele nao substitui instalar
as dependencias reais do Mythos antes de rodar browser, terminal, gateway,
Telegram ou outras plataformas.

Modo manual: copie o conteudo desta pasta para a raiz do repositorio Mythos,
preservando as pastas `plugins/`, `optional-skills/` e `skills/`.

Depois habilite:

```bash
mythos plugins enable congchain-adapter
mythos config set context.engine congchain
mythos plugins enable observability/congchain
mythos plugins enable interpretability/congchain-cna
```

O plugin CNA deve ficar opcional. Sem `CNA_MODEL_PATH`, ele roda em modo passivo.

## NVIDIA Router v1

O `plugins/nvidia-router` e uma camada de recomendacao, nao um roteador
automatico. Ele usa o hook `pre_llm_call` apenas pelo contrato suportado pelo
Mythos: retorna `{"context": "..."}` com a recomendacao e os motivos.

Ele nao retorna:

- `model_override`;
- `api_key_override`;
- `base_url_override`.

Isso evita prometer uma troca de modelo que o loop principal pode ignorar. A
troca real deve ficar para uma v2, usando um caminho suportado pelo runtime
Mythos.

Tabela recomendada:

| Tipo de tarefa | Modelo primario | Fallback |
| --- | --- | --- |
| Agent loop geral | `nvidia/nemotron-3-super-120b-a12b` | `meta/llama-3.3-70b-instruct` |
| Raciocinio pesado | `openai/gpt-oss-120b` | `nvidia/nemotron-3-super-120b-a12b` |
| Codigo/debugging | `deepseek-ai/deepseek-v4-pro` | `qwen/qwen3.5-122b-a10b` |
| Contexto longo | `moonshotai/kimi-k2.6` | `qwen/qwen3.5-122b-a10b` |
| Rapido/barato | `microsoft/phi-4-mini-instruct` | `google/gemma-3n-e2b-it` |
| Portugues/multilingual | `z-ai/glm-5.1` | `meta/llama-3.3-70b-instruct` |
| Criativo/conteudo | `google/gemma-4-31b-it` | `mistralai/mistral-large-3-675b-instruct-2512` |

Use chaves por provedor sempre que possivel:

```bash
export NVIDIA_API_KEY=sua_key_nvidia
export OPENROUTER_API_KEY=sua_key_openrouter
```

Nao crie uma variavel secreta por modelo a menos que voce realmente tenha
contas ou provedores diferentes. As decisoes do router podem ser registradas na
CongChain como metadata verificavel. O texto "on-chain" so deve aparecer quando
um fluxo chamar explicitamente o endpoint de anchor blockchain.

## Teste seguro

```bash
python optional-skills/blockchain/congchain/scripts/congchain_client.py health
python optional-skills/blockchain/congchain/scripts/congchain_client.py write "Mythos bridge test"
python optional-skills/blockchain/congchain/scripts/congchain_client.py list --limit 5
```

## Teste do runtime adapter

Dentro deste repositorio CongChain, o runtime completo do Mythos nao esta
incluido. Para validar o adapter sem depender do agente inteiro, rode o smoke
test que simula os hooks reais e confirma que os sete eventos geram payloads
para `/api/memory/write`:

```bash
python -m unittest integrations.mythos.tests.test_congchain_adapter
python -m unittest integrations.mythos.tests.test_install_congchain_into_mythos
python -m unittest integrations.mythos.tests.test_nvidia_router
```

Esse teste cobre registro dos hooks, lifecycle completo, metadata Mythos,
flags de seguranca e redacao de secrets antes da escrita.

## Notas de seguranca

- Nao cole `CONGCHAIN_API_KEY` em chat, logs ou prints.
- O bridge nao assina transacoes e nao move fundos.
- O retorno `on_chain: false` e esperado enquanto a memoria estiver no modo bridge off-chain.
- Prova ZK/on-chain so deve ser exibida como ativa quando a API retornar prova real.
