import type { Metadata } from 'next';
import { MythosAgenticConsole } from '@/features/agent-memory-bridge/components/mythos-agentic-console';

export const metadata: Metadata = {
  title: 'Mythos Agent — Loop Agêntico',
  description: 'Mythos executa tarefas com ferramentas reais (web search DeepSeek, leitura de páginas, dados públicos, Solana read-only) e propõe ações para aprovação humana.',
};

export default function MythosAgentPage() {
  return <MythosAgenticConsole />;
}
