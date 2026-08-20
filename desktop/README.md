# CongChain Desktop (Electron)

App desktop do CongChain — abre o **Forge + Mythos** numa janela nativa, igual ao Cursor,
rodando o servidor localmente (sem depender do Railway).

## Como usar (desenvolvimento)

```bash
# 1. Na raiz do projeto (uma vez)
npm install

# 2. (opcional) build de produção — servidor otimizado em vez de dev
npm run build

# 3. No desktop
cd desktop
npm install
npm run dev        # abre a janela do CongChain
```

- Se o `.next/BUILD_ID` existir → usa `next start` (produção).
- Se não → usa `next dev` (desenvolvimento, com hot-reload).
- O servidor sobe na porta **3200** e a janela carrega `http://127.0.0.1:3200`.

## Gerar instalador (.exe / .dmg / .AppImage)

Pré-requisito: o build de produção da raiz (`npm run build`) e `npm install` no `desktop`.

```bash
cd desktop
npm run dist:win     # Windows: release/CongChain-Setup-*.exe
npm run dist:mac     # macOS: release/CongChain-*.dmg
npm run dist:linux   # Linux: release/CongChain-*.AppImage
```

O instalador inclui `.next/` e `public/` como recursos extra — o app roda o servidor
local e abre a janela.

## Configuração de chaves

O app lê o `.env` da **raiz** do projeto (mesmas variáveis do Railway:
`DEEPSEEK_API_KEY`, `NVIDIA_API_KEY`, `DATABASE_URL`...). Ou use o **BYOK** dentro do
Forge (Config → chave DeepSeek/Ollama), que fica só no seu navegador.

> Memórias verificadas precisam de Postgres (`DATABASE_URL`). Sem banco, o chat/Forge/
> Mythos funcionam; só o salvar memória fica indisponível (veja `docs/rodar-local.md`).

## Observações

- Este é o **esqueleto funcional**: o fluxo dev já funciona. O empacotamento
  (`electron-builder`) está configurado e é o próximo passo para distribuir o `.exe`.
- O `main.js` usa `ELECTRON_RUN_AS_NODE` para rodar o Next como processo filho —
  padrão seguro para sidecars no Electron.
