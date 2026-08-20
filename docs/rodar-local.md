# Rodar o CongChain localmente (sem Railway)

Guia passo a passo para rodar o CongChain (Forge + Mythos + chat) **no seu computador**,
exatamente como usamos em desenvolvimento.

---

## 1. Requisitos

| Ferramenta | Versão | Por quê |
|---|---|---|
| [Node.js](https://nodejs.org) | **20 ou 22+** (o projeto usa `20` no `.node-version`) | Runtime do Next.js |
| [Git](https://git-scm.com) | qualquer | Clonar o repositório |
| (opcional) [Docker](https://docker.com) | qualquer | Postgres local para memórias |
| (opcional) [Ollama](https://ollama.com) | qualquer | Modo local/privado do Forge (zero custo de API) |

## 2. Baixar o código

```bash
git clone https://github.com/Edencrypto-IA/cognchain-program.git
cd cognchain-program
```

## 3. Instalar dependências

```bash
npm install        # ou: bun install (mais rápido)
```

## 4. Configurar as chaves (.env)

```bash
cp .env.example .env
# edite o .env e preencha pelo menos:
#   DEEPSEEK_API_KEY=...        → agente Mythos + navegação web (barato)
#   DATABASE_URL=postgresql://...  → memórias verificadas (opcional p/ chat)
#   OPENAI_API_KEY=...          → chat GPT (opcional)
#   ANTHROPIC_API_KEY=...       → chat Claude (opcional)
#   NVIDIA_API_KEY / NVIDIA_QWEN_KEY ... → modelos grátis (opcional)
```

> **Sem Postgres?** O chat, o Forge e o Mythos funcionam normalmente; só o **salvar memória**
> precisa do banco. Para Postgres local rápido:
> ```bash
> docker run -d --name congchain-db -p 5432:5432 -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=congchain postgres:16
> # DATABASE_URL=postgresql://postgres:postgres@localhost:5432/congchain
> npx prisma db push
> ```

## 5. Rodar

```bash
npm run dev
# abra http://localhost:3000
```

Pronto: **chat multi-modelo · Forge (loop agêntico, upload de arquivos) · Mythos (agente com navegação web) · Memory Brain · /mythos/agent**.

## 6. O que funciona sem quê

| Recurso | Precisa de |
|---|---|
| Chat (modelos free NVIDIA: Llama/GLM/MiniMax/Qwen) | `NVIDIA_API_KEY` (grátis) |
| Forge agentic + Mythos agente + navegação web | `DEEPSEEK_API_KEY` (ou Ollama local, abaixo) |
| **Memórias (offline)** | `DATABASE_PROVIDER=sqlite` + `DATABASE_URL=file:../db/congchain-offline.db` (padrão no `.env` local) — **sem Postgres** |
| Salvar memória / Proof of Insight | `DATABASE_URL` (Postgres no Railway) + `SOLANA_PRIVATE_KEY` (âncora on-chain) |
| Modo local privado (Ollama) | Ollama instalado — `OLLAMA_BASE_URL` (padrão já cobre) |
| ZK proofs | `ZK_MVP_ENABLED=true` (modo simulado já funciona) |

## 6b. 100% offline (desktop, sem internet)

```bash
# 1. Banco local (uma vez)
npm run db:generate:sqlite         # gera o client SQLite
npm run db:push:sqlite             # cria db/congchain-offline.db (ou: node scripts/init-offline-db.cjs)

# 2. Agente Mythos com modelo local (Ollama)
#    no .env:
#    MYTHOS_AGENT_MODEL=ollama
#    OLLAMA_AGENT_MODEL=qwen2.5-coder:7b   # modelo com function calling
#    OLLAMA_AGENT_ENABLED=true             # (alternativa ao MYTHOS_AGENT_MODEL)
# 3. Instale o modelo:  ollama pull qwen2.5-coder:7b
```

Com isso: **memórias gravam localmente (SQLite) e o agente Mythos roda com Ollama** —
se o Ollama não estiver disponível, o agente cai automaticamente para DeepSeek (se houver chave)
ou para o plano determinístico read-only.

## 7. Produção local (build)

```bash
npm run build
npm start          # servidor otimizado (mesmo do Railway), http://localhost:3000
```

## 8. Comandos extras úteis

```bash
npm run mcp        # servidor MCP (Memory Internet Protocol) p/ agentes externos
npm run db:push    # sincroniza o schema Prisma com o banco
npm run zk:build   # compila o circuito ZK (Groth16) — opcional
```

## 9. Desinstalar / resetar

```bash
rm -rf node_modules .next
npm install        # reinstala do zero
```
