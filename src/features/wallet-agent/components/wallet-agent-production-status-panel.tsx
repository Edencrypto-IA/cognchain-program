'use client';

import {
  AlertTriangle,
  CheckCircle2,
  Database,
  Flag,
  LockKeyhole,
  Mail,
  RadioTower,
  ShieldCheck,
  Wallet,
  XCircle,
} from 'lucide-react';
import type {
  WalletAgentFeatureFlag,
  WalletAgentProductionAuditItem,
  WalletAgentProductionMonitoringStatus,
} from '../production-readiness';

type WalletAgentProductionStatusPanelProps = {
  status: WalletAgentProductionMonitoringStatus;
};

const HEALTH_STYLES: Record<WalletAgentProductionMonitoringStatus['health'], {
  label: string;
  className: string;
  icon: typeof CheckCircle2;
}> = {
  ready: {
    label: 'ready',
    className: 'border-[#14F195]/24 bg-[#14F195]/10 text-[#14F195]',
    icon: CheckCircle2,
  },
  attention_required: {
    label: 'attention required',
    className: 'border-[#F5A524]/24 bg-[#F5A524]/10 text-[#F5A524]',
    icon: AlertTriangle,
  },
  unsafe: {
    label: 'unsafe',
    className: 'border-[#FF5C7A]/28 bg-[#FF5C7A]/10 text-[#FF8A9E]',
    icon: XCircle,
  },
};

const AUDIT_STATUS_STYLES: Record<WalletAgentProductionAuditItem['status'], string> = {
  ready: 'border-[#14F195]/16 bg-[#14F195]/[0.055] text-[#14F195]',
  action_required: 'border-[#FF5C7A]/18 bg-[#FF5C7A]/[0.055] text-[#FF8A9E]',
  warning: 'border-[#F5A524]/18 bg-[#F5A524]/[0.055] text-[#F5A524]',
  safe_default: 'border-[#00D1FF]/14 bg-[#00D1FF]/[0.045] text-[#7DE3FF]',
};

const FLAG_STATUS_STYLES: Record<WalletAgentFeatureFlag['status'], string> = {
  enabled: 'border-[#14F195]/16 bg-[#14F195]/[0.055] text-[#14F195]',
  disabled: 'border-white/[0.07] bg-white/[0.025] text-white/42',
  safe_default: 'border-[#00D1FF]/14 bg-[#00D1FF]/[0.045] text-[#7DE3FF]',
};

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function OperationTile({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: boolean | number;
  icon: typeof Database;
}) {
  const ok = typeof value === 'number' ? value === 0 : value;
  return (
    <div className={`rounded-xl border p-3 ${ok ? 'border-[#14F195]/14 bg-[#14F195]/[0.045]' : 'border-[#F5A524]/14 bg-[#F5A524]/[0.045]'}`}>
      <div className="mb-2 flex items-center gap-2">
        <Icon className={`h-3.5 w-3.5 ${ok ? 'text-[#14F195]' : 'text-[#F5A524]'}`} />
        <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-white/32">{label}</p>
      </div>
      <p className={`text-sm font-semibold ${ok ? 'text-[#14F195]' : 'text-[#F5A524]'}`}>
        {typeof value === 'number' ? value : value ? 'ready' : 'needs setup'}
      </p>
    </div>
  );
}

export function WalletAgentProductionStatusPanel({ status }: WalletAgentProductionStatusPanelProps) {
  const health = HEALTH_STYLES[status.health];
  const HealthIcon = health.icon;
  const criticalFlags = status.featureFlags.flags.filter(flag => flag.productionRisk === 'critical');

  return (
    <section className="w-full overflow-hidden rounded-2xl border border-white/[0.08] bg-[#07070d]/95 shadow-[0_24px_90px_rgba(0,0,0,0.45)]">
      <div className="border-b border-white/[0.06] bg-gradient-to-r from-[#14F195]/10 via-[#00D1FF]/6 to-[#9945FF]/10 px-4 py-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[#14F195]/20 bg-[#14F195]/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#14F195]">
                <ShieldCheck className="h-3 w-3" />
                Wallet Agent
              </span>
              <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${health.className}`}>
                <HealthIcon className="h-3 w-3" />
                {health.label}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.035] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/42">
                <LockKeyhole className="h-3 w-3" />
                read-only
              </span>
            </div>
            <h3 className="text-base font-semibold text-white/88">Production status</h3>
            <p className="mt-1 max-w-2xl text-xs leading-relaxed text-white/45">
              Admin monitoring surface for readiness, feature exposure, and operational safety. Secrets stay redacted.
            </p>
          </div>

          <div className="rounded-xl border border-white/[0.06] bg-black/25 px-3 py-2 text-right">
            <p className="text-[9px] uppercase tracking-[0.18em] text-white/28">Updated</p>
            <p className="mt-1 text-xs font-semibold text-white/70">{formatDate(status.generatedAt)}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-3 p-4 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <OperationTile label="Durable history" value={status.operations.durableHistoryReady} icon={Database} />
            <OperationTile label="Email provider" value={status.operations.emailReady} icon={Mail} />
            <OperationTile label="Session secret" value={status.operations.sessionSecretReady} icon={LockKeyhole} />
            <OperationTile label="Critical flags" value={status.operations.criticalFlagsEnabled} icon={Flag} />
          </div>

          <div className="rounded-xl border border-[#00D1FF]/14 bg-[#00D1FF]/[0.045] p-3">
            <div className="mb-2 flex items-center gap-2">
              <RadioTower className="h-4 w-4 text-[#00D1FF]" />
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#00D1FF]/85">Monitoring contract</p>
            </div>
            <p className="text-sm leading-relaxed text-white/58">
              This panel can inspect redacted readiness only. It cannot change flags, send email, run migrations, sign, submit, buy, sell, pay, schedule, or move funds.
            </p>
          </div>

          <div className="rounded-xl border border-white/[0.06] bg-black/20 p-3">
            <div className="mb-2 flex items-center gap-2">
              <Wallet className="h-4 w-4 text-[#9945FF]" />
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/48">Safety</p>
            </div>
            <div className="space-y-1.5">
              {status.safety.notes.slice(0, 3).map(note => (
                <p key={note} className="text-xs leading-relaxed text-white/42">{note}</p>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="rounded-xl border border-white/[0.06] bg-black/20 p-3">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/48">Readiness audit</p>
              <span className="rounded-full border border-white/[0.08] bg-white/[0.035] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-white/38">
                {status.audit.summary.ready} ready / {status.audit.summary.actionRequired} action
              </span>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {status.audit.items.map(item => (
                <div key={item.id} className={`rounded-xl border p-2.5 ${AUDIT_STATUS_STYLES[item.status]}`}>
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <p className="truncate text-[10px] font-semibold uppercase tracking-[0.12em]">{item.label}</p>
                    <span className="shrink-0 text-[9px] font-semibold uppercase tracking-[0.1em]">{item.status}</span>
                  </div>
                  <p className="line-clamp-2 text-[10px] leading-relaxed text-white/46">{item.publicDetail}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-white/[0.06] bg-black/20 p-3">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/48">Critical flags</p>
              <span className="rounded-full border border-[#FF5C7A]/16 bg-[#FF5C7A]/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-[#FF8A9E]">
                {status.featureFlags.summary.criticalEnabled} critical enabled
              </span>
            </div>
            <div className="space-y-2">
              {criticalFlags.map(flag => (
                <div key={flag.id} className={`rounded-xl border p-2.5 ${FLAG_STATUS_STYLES[flag.status]}`}>
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <p className="truncate text-[10px] font-semibold uppercase tracking-[0.12em]">{flag.label}</p>
                    <span className="shrink-0 text-[9px] font-semibold uppercase tracking-[0.1em]">{flag.status}</span>
                  </div>
                  <p className="text-[10px] leading-relaxed text-white/46">{flag.publicDetail}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
