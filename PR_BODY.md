chore(types): resolve 64 TypeScript errors (type-only changes)

- tsconfig: target ES2017 → ES2020 (fixes BigInt literals)
- deps: add @types/node@^20 to devDependencies
- memory.model.ts: add poiTxHash field to MemoryEntry
- solana-ecosystem-report: narrow sentiment to union type
- buy-builder/route.ts: declare result as T | null
- forge/files/route.ts: safe Dirent.name access for Node 22
- chat/stream + forge/chat: fix Stream<ChatCompletionChunk> typing
- wallet-agent-status-panel: warning → warnings (typo fix)
- cdn-modules.d.ts: ambient declarations for CDN imports
- [+N more files]: cast/alignment fixes, no logic changes

No runtime behavior was changed. All fixes are type-only except `@types/node` bump and `tsconfig` target.
Remaining: 2 errors in .next/types/* (Next.js generated, ignored).

Refactor adicional (mesmo PR)

- `solana-dev-engine.ts`: substituídos `as any` por union types (`TokenCamel | TokenSnake`) + type guards baseados no discriminante `'token_symbol' in item` já existente no código.
- Para `percent_change_24h`: union `CoinMarketCapQuoteUsd | { price_change_24h?: number }` com guard inline.
- Nenhum bug de runtime encontrado durante a revisão estática.

Dívida técnica registrada: `TokenCamel` e `TokenSnake` ainda são declarados localmente. Futura oportunidade: mover para tipo compartilhado se outros módulos precisarem do mesmo shape.

Estado:
- Branch: `fix/types-64`
- Commit principal: "chore(types): resolve 64 TypeScript errors (type-only changes)"
- Commit adicional: "refactor(types): replace any casts with union types in solana-dev-engine"
- Build: `npm run build` completed successfully (warnings only)
- `npx tsc --noEmit`: 0 acionáveis (apenas 2 erros gerados em `.next/types/*`)

Observação sobre os `any` anteriores: foram removidos e substituídos por verificações discriminantes que preservam comportamento e adicionam segurança estática.

Recomendação: após merge, considerar mover os tipos de token para um arquivo compartilhado e adicionar um pequeno typeguard reutilizável para esse shape.
