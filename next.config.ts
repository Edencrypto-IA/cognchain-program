import type { NextConfig } from "next";

// ============================================================
// ⚠️ DÍVIDA TÉCNICA PENDENTE — NÃO RESOLVER EM PR DE SEGURANÇA
// ============================================================
// `typescript.ignoreBuildErrors` e `eslint.ignoreDuringBuilds`
// estão em `true` porque o projeto atualmente possui erros reais
// de tipo que impediriam o deploy. Manter até que a dívida abaixo
// seja quitada. Não aumentar a dívida — todo novo código deve
// passar `npx tsc --noEmit` limpo.
//
// Diagnóstico coletado em revisão de segurança/consistência:
//
// [tsc --noEmit] 66 erros TypeScript, principais grupos:
//   - .next/types/* (Next.js validation de route handlers)
//   - src/app/api/chat/stream/route.ts (stream/async iterator)
//   - src/app/api/forge/* (ChatCompletion streaming + Dirent/Buffer)
//   - src/app/api/memory/[hash]/route.ts (MemoryEntry sem poiTxHash)
//   - src/app/api/mythos/pumpfun/buy-builder/route.ts (tipos never)
//   - src/app/api/mythos/test-chat/route.ts (apiKeyEnv / ChatMessage)
//   - src/components/forge/code-viewer.tsx (imports CDN sem tipos)
//   - src/components/forge/forge-nexus-plan.tsx (merged declaration)
//   - src/features/agent-memory-bridge/* (nomes/types faltando)
//   - src/features/wallet-agent/* (propriedade 'warning' vs 'warnings')
//
// [eslint .] retorna 0 problemas porque eslint.config.mjs desliga
// quase todas as regras (no-unused-vars:off, no-explicit-any:off,
// no-unreachable:off, etc.). Reativar gradualmente em PR dedicado.
//
// Para revalidar este comentário após correções:
//   npx tsc --noEmit
//   npx eslint .
// ============================================================

const nextConfig: NextConfig = {
  // output: "standalone", // disabled for Railway — uses custom server.js
  reactStrictMode: true,
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
  // NOTE: cabeçalhos CORS foram REMOVIDOS daqui. O CORS de /api/* é
  // controlado exclusivamente por src/middleware.ts (lógica
  // ALLOWED_ORIGINS). Duplicar Access-Control-Allow-Origin: * aqui
  // sobrescrevia a restrição do middleware. Não re-adicionar.
};

export default nextConfig;
