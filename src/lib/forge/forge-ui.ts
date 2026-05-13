import type { ForgeRunStatus } from './types';

export const RUN_STATUS_LABELS: Record<ForgeRunStatus, string> = {
  idle: 'Pronto',
  connecting: 'A ligar ao modelo…',
  streaming: 'A receber resposta…',
  complete: 'Concluído',
  error: 'Erro',
  cancelled: 'Cancelado',
};
