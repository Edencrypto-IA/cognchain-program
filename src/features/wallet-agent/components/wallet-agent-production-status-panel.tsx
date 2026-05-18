'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  Database,
  Flag,
  LockKeyhole,
  Mail,
  RadioTower,
  RefreshCw,
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
  onRefresh?: () => void;
  refreshing?: boolean;
};

type ProductionStatusAuditEvent = {
  id: string;
  action: 'status_loaded' | 'refresh_requested' | 'brief_copied' | 'drill_report_copied';
  label: string;
  createdAt: string;
  health: WalletAgentProductionMonitoringStatus['health'];
};

const MAX_AUDIT_EVENTS = 4;

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

type ProductionIssueSeverity = 'required' | 'warning' | 'safe';

type ProductionIssueChecklistItem = {
  id: string;
  severity: ProductionIssueSeverity;
  label: string;
  detail: string;
};

type Phase12CloseoutChecklistItem = {
  id: string;
  complete: boolean;
  label: string;
  detail: string;
};

type ProductionVerificationDrillItem = {
  id: string;
  passed: boolean;
  label: string;
  detail: string;
};

type ProductionVerificationFocusItem = {
  id: string;
  severity: 'review' | 'safe';
  label: string;
  detail: string;
};

const ISSUE_STYLES: Record<ProductionIssueSeverity, {
  label: string;
  className: string;
  icon: typeof CheckCircle2;
}> = {
  required: {
    label: 'required',
    className: 'border-[#FF5C7A]/18 bg-[#FF5C7A]/[0.055] text-[#FF8A9E]',
    icon: XCircle,
  },
  warning: {
    label: 'warning',
    className: 'border-[#F5A524]/18 bg-[#F5A524]/[0.055] text-[#F5A524]',
    icon: AlertTriangle,
  },
  safe: {
    label: 'safe',
    className: 'border-[#14F195]/16 bg-[#14F195]/[0.055] text-[#14F195]',
    icon: CheckCircle2,
  },
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

function formatActivityAction(action: ProductionStatusAuditEvent['action']) {
  return action.replaceAll('_', ' ');
}

function buildPhase12CloseoutChecklist(status: WalletAgentProductionMonitoringStatus): Phase12CloseoutChecklistItem[] {
  const criticalFlagsBlocked = status.featureFlags.summary.criticalEnabled === 0;

  return [
    {
      id: 'admin-status',
      complete: true,
      label: 'Admin status surface',
      detail: 'Redacted production status is available only through the admin-gated review surface.',
    },
    {
      id: 'issue-checklist',
      complete: true,
      label: 'Issue checklist',
      detail: 'Required actions, warnings, and safe guardrails are derived from the current redacted snapshot.',
    },
    {
      id: 'operator-handoff',
      complete: true,
      label: 'Operator handoff',
      detail: 'The copied brief includes operations, audit items, critical flags, checklist, safety notes, and local activity.',
    },
    {
      id: 'critical-execution',
      complete: criticalFlagsBlocked,
      label: 'Critical execution flags',
      detail: criticalFlagsBlocked
        ? 'Scheduled actions and mainnet execution are not reported as enabled.'
        : 'At least one critical execution flag is enabled and must be reviewed before rollout.',
    },
    {
      id: 'read-only-boundary',
      complete: true,
      label: 'Read-only boundary',
      detail: 'The Phase 12 panel cannot change configuration, send email, run migrations, sign, submit, schedule, or move funds.',
    },
  ];
}

function buildProductionVerificationDrill(status: WalletAgentProductionMonitoringStatus): ProductionVerificationDrillItem[] {
  const criticalFlagsBlocked = status.featureFlags.summary.criticalEnabled === 0;
  const noRequiredAuditActions = status.audit.summary.actionRequired === 0;
  const noWarnings = status.audit.summary.warning === 0;

  return [
    {
      id: 'admin-status-health',
      passed: status.health !== 'unsafe',
      label: 'Admin status health',
      detail: status.health === 'unsafe'
        ? 'The redacted production status is unsafe and must be reviewed before rollout.'
        : 'The redacted production status is available for operator review.',
    },
    {
      id: 'durable-history',
      passed: status.operations.durableHistoryReady,
      label: 'Durable history readiness',
      detail: status.operations.durableHistoryReady
        ? 'Durable alert history is reported as ready in the current snapshot.'
        : 'Durable alert history is not ready or not enabled for production use.',
    },
    {
      id: 'email-delivery',
      passed: status.operations.emailReady,
      label: 'Email delivery readiness',
      detail: status.operations.emailReady
        ? 'Email provider readiness is reported as ready.'
        : 'Email provider readiness still needs setup or review.',
    },
    {
      id: 'session-secret',
      passed: status.operations.sessionSecretReady,
      label: 'Session secret readiness',
      detail: status.operations.sessionSecretReady
        ? 'Session secret readiness is reported as ready.'
        : 'Session secret readiness is not confirmed by the current snapshot.',
    },
    {
      id: 'critical-flags',
      passed: criticalFlagsBlocked,
      label: 'Critical execution flags',
      detail: criticalFlagsBlocked
        ? 'Critical execution features remain blocked in the current snapshot.'
        : 'One or more critical execution flags are enabled and require review.',
    },
    {
      id: 'audit-actions',
      passed: noRequiredAuditActions && noWarnings,
      label: 'Readiness audit review',
      detail: noRequiredAuditActions && noWarnings
        ? 'The readiness audit reports no required actions or warnings.'
        : 'The readiness audit still reports required actions or warnings.',
    },
  ];
}

function buildProductionVerificationFocus(status: WalletAgentProductionMonitoringStatus): ProductionVerificationFocusItem[] {
  const reviewItems = buildProductionVerificationDrill(status)
    .filter(item => !item.passed)
    .map(item => ({
      id: `focus-${item.id}`,
      severity: 'review' as const,
      label: item.label,
      detail: item.detail,
    }));

  if (reviewItems.length > 0) {
    return reviewItems;
  }

  return [{
    id: 'focus-no-open-review',
    severity: 'safe',
    label: 'No drill review items',
    detail: 'The current redacted verification drill reports all checks as pass, but rollout approval still requires human review.',
  }];
}

function buildProductionVerificationDrillReport(status: WalletAgentProductionMonitoringStatus) {
  const drillItems = buildProductionVerificationDrill(status);
  const focusItems = buildProductionVerificationFocus(status);
  const passedCount = drillItems.filter(item => item.passed).length;
  const reviewCount = drillItems.length - passedCount;
  const drillLines = drillItems.map(item => (
    `- [${item.passed ? 'pass' : 'review'}] ${item.label}: ${item.detail}`
  ));
  const focusLines = focusItems.map(item => (
    `- [${item.severity}] ${item.label}: ${item.detail}`
  ));

  return [
    'CongChain Wallet Agent - Production Verification Drill',
    `Generated: ${formatDate(status.generatedAt)}`,
    `Health: ${status.health}`,
    `Mode: ${status.mode}`,
    `Result: ${passedCount} pass / ${reviewCount} review`,
    '',
    'Verification checks',
    ...drillLines,
    '',
    'Review focus',
    ...focusLines,
    '',
    'Safety',
    '- This drill is read-only and redacted.',
    '- It cannot approve rollout, change configuration, run migrations, send email, sign, submit, schedule, or move funds.',
  ].join('\n');
}

function buildProductionIssueChecklist(status: WalletAgentProductionMonitoringStatus): ProductionIssueChecklistItem[] {
  const requiredAuditItems = status.audit.items
    .filter(item => item.status === 'action_required')
    .map(item => ({
      id: `audit-${item.id}`,
      severity: 'required' as const,
      label: item.label,
      detail: item.publicDetail,
    }));
  const warningAuditItems = status.audit.items
    .filter(item => item.status === 'warning')
    .map(item => ({
      id: `audit-${item.id}`,
      severity: 'warning' as const,
      label: item.label,
      detail: item.publicDetail,
    }));
  const criticalFlagItems = status.featureFlags.flags
    .filter(flag => flag.productionRisk === 'critical' && flag.status === 'enabled')
    .map(flag => ({
      id: `flag-${flag.id}`,
      severity: 'required' as const,
      label: flag.label,
      detail: 'Critical production flag is enabled. Review immediately before any rollout.',
    }));

  const safeCriticalFlags = status.featureFlags.flags
    .filter(flag => flag.productionRisk === 'critical' && flag.status !== 'enabled');
  const safetyItems: ProductionIssueChecklistItem[] = [];

  if (safeCriticalFlags.length > 0) {
    safetyItems.push({
      id: 'critical-flags-disabled',
      severity: 'safe',
      label: 'Critical execution flags',
      detail: 'Scheduled actions and mainnet execution remain blocked unless explicitly enabled and audited.',
    });
  }

  if (status.operations.durableHistoryReady && status.operations.emailReady && status.operations.sessionSecretReady) {
    safetyItems.push({
      id: 'core-ops-ready',
      severity: 'safe',
      label: 'Core production operations',
      detail: 'Durable history, email provider, and session secret readiness are reported as ready.',
    });
  }

  const issues = [...criticalFlagItems, ...requiredAuditItems, ...warningAuditItems, ...safetyItems];

  if (issues.length === 0) {
    return [{
      id: 'no-open-issues',
      severity: 'safe',
      label: 'No open production blockers',
      detail: 'The current redacted snapshot does not report required actions or warnings.',
    }];
  }

  return issues.slice(0, 7);
}

function buildProductionBrief(
  status: WalletAgentProductionMonitoringStatus,
  auditEvents: ProductionStatusAuditEvent[] = [],
) {
  const drillLines = buildProductionVerificationDrill(status).map(item => (
    `- [${item.passed ? 'pass' : 'review'}] ${item.label}: ${item.detail}`
  ));
  const verificationFocusLines = buildProductionVerificationFocus(status).map(item => (
    `- [${item.severity}] ${item.label}: ${item.detail}`
  ));
  const closeoutLines = buildPhase12CloseoutChecklist(status).map(item => (
    `- [${item.complete ? 'complete' : 'review'}] ${item.label}: ${item.detail}`
  ));
  const productionIssueLines = buildProductionIssueChecklist(status).map(item => (
    `- [${item.severity}] ${item.label}: ${item.detail}`
  ));
  const auditLines = status.audit.items.map(item => (
    `- ${item.label}: ${item.status} | ${item.publicDetail}`
  ));
  const criticalFlagLines = status.featureFlags.flags
    .filter(flag => flag.productionRisk === 'critical')
    .map(flag => `- ${flag.label}: ${flag.status} | ${flag.publicDetail}`);
  const operatorActivityLines = auditEvents.length > 0
    ? auditEvents.map(event => (
      `- ${formatDate(event.createdAt)} | ${formatActivityAction(event.action)} | ${event.health} | ${event.label}`
    ))
    : ['- No local operator activity has been recorded in this browser session yet.'];

  return [
    'CongChain Wallet Agent - Production Brief',
    `Generated: ${formatDate(status.generatedAt)}`,
    `Health: ${status.health}`,
    `Mode: ${status.mode}`,
    '',
    'Operations',
    `- Durable history ready: ${status.operations.durableHistoryReady ? 'yes' : 'no'}`,
    `- Email ready: ${status.operations.emailReady ? 'yes' : 'no'}`,
    `- Session secret ready: ${status.operations.sessionSecretReady ? 'yes' : 'no'}`,
    `- Devnet configured: ${status.operations.devnetConfigured ? 'yes' : 'no'}`,
    `- Critical flags enabled: ${status.operations.criticalFlagsEnabled}`,
    '',
    'Phase 12 closeout',
    ...closeoutLines,
    '',
    'Phase 13.1 production verification drill',
    ...drillLines,
    '',
    'Phase 13.3 verification review focus',
    ...verificationFocusLines,
    '',
    'Production issue checklist',
    ...productionIssueLines,
    '',
    'Readiness audit',
    ...auditLines,
    '',
    'Critical flags',
    ...criticalFlagLines,
    '',
    'Local operator activity',
    ...operatorActivityLines,
    '',
    'Safety',
    '- Secrets are redacted.',
    '- This status cannot sign, submit, buy, sell, pay, schedule, or move funds.',
    ...status.safety.notes.map(note => `- ${note}`),
  ].join('\n');
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
    <div className={`min-w-0 rounded-xl border p-2.5 sm:p-3 ${ok ? 'border-[#14F195]/14 bg-[#14F195]/[0.045]' : 'border-[#F5A524]/14 bg-[#F5A524]/[0.045]'}`}>
      <div className="mb-1.5 flex min-w-0 items-center gap-1.5 sm:mb-2 sm:gap-2">
        <Icon className={`h-3.5 w-3.5 shrink-0 ${ok ? 'text-[#14F195]' : 'text-[#F5A524]'}`} />
        <p className="min-w-0 truncate text-[8.5px] font-semibold uppercase tracking-[0.12em] text-white/32 sm:text-[9px] sm:tracking-[0.14em]">{label}</p>
      </div>
      <p className={`truncate text-xs font-semibold sm:text-sm ${ok ? 'text-[#14F195]' : 'text-[#F5A524]'}`}>
        {typeof value === 'number' ? value : value ? 'ready' : 'needs setup'}
      </p>
    </div>
  );
}

export function WalletAgentProductionStatusPanel({
  status,
  onRefresh,
  refreshing = false,
}: WalletAgentProductionStatusPanelProps) {
  const [copied, setCopied] = useState(false);
  const [drillCopied, setDrillCopied] = useState(false);
  const [auditEvents, setAuditEvents] = useState<ProductionStatusAuditEvent[]>([]);
  const health = HEALTH_STYLES[status.health];
  const HealthIcon = health.icon;
  const criticalFlags = status.featureFlags.flags.filter(flag => flag.productionRisk === 'critical');
  const phase12Closeout = useMemo(() => buildPhase12CloseoutChecklist(status), [status]);
  const phase12ReviewCount = phase12Closeout.filter(item => !item.complete).length;
  const productionVerificationDrill = useMemo(() => buildProductionVerificationDrill(status), [status]);
  const productionVerificationReviewCount = productionVerificationDrill.filter(item => !item.passed).length;
  const productionVerificationFocus = useMemo(() => buildProductionVerificationFocus(status), [status]);
  const productionIssues = useMemo(() => buildProductionIssueChecklist(status), [status]);
  const requiredIssueCount = productionIssues.filter(item => item.severity === 'required').length;
  const warningIssueCount = productionIssues.filter(item => item.severity === 'warning').length;
  const productionBrief = useMemo(() => buildProductionBrief(status, auditEvents), [auditEvents, status]);
  const productionVerificationDrillReport = useMemo(() => buildProductionVerificationDrillReport(status), [status]);

  function recordAuditEvent(action: ProductionStatusAuditEvent['action'], label: string) {
    setAuditEvents(current => [
      {
        id: `${action}-${Date.now()}`,
        action,
        label,
        createdAt: new Date().toISOString(),
        health: status.health,
      },
      ...current,
    ].slice(0, MAX_AUDIT_EVENTS));
  }

  useEffect(() => {
    setAuditEvents(current => [
      {
        id: `status_loaded-${Date.now()}`,
        action: 'status_loaded',
        label: `Status loaded as ${status.health}`,
        createdAt: new Date().toISOString(),
        health: status.health,
      },
      ...current,
    ].slice(0, MAX_AUDIT_EVENTS));
  }, [status.generatedAt, status.health]);

  function copyProductionBrief() {
    navigator.clipboard?.writeText(productionBrief).then(() => {
      setCopied(true);
      recordAuditEvent('brief_copied', 'Redacted production brief copied');
      window.setTimeout(() => setCopied(false), 1600);
    }).catch(() => {});
  }

  function copyProductionVerificationDrillReport() {
    navigator.clipboard?.writeText(productionVerificationDrillReport).then(() => {
      setDrillCopied(true);
      recordAuditEvent('drill_report_copied', 'Production verification drill report copied');
      window.setTimeout(() => setDrillCopied(false), 1600);
    }).catch(() => {});
  }

  function requestRefresh() {
    recordAuditEvent('refresh_requested', 'Manual status refresh requested');
    onRefresh?.();
  }

  return (
    <section className="w-full overflow-hidden rounded-xl border border-white/[0.08] bg-[#07070d]/95 shadow-[0_24px_90px_rgba(0,0,0,0.45)] sm:rounded-2xl">
      <div className="border-b border-white/[0.06] bg-gradient-to-r from-[#14F195]/10 via-[#00D1FF]/6 to-[#9945FF]/10 px-3 py-3 sm:px-4">
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
            <h3 className="text-sm font-semibold text-white/88 sm:text-base">Production status</h3>
            <p className="mt-1 max-w-2xl text-xs leading-relaxed text-white/45">
              Admin monitoring surface for readiness, feature exposure, and operational safety. Secrets stay redacted.
            </p>
          </div>

          <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:items-end">
            <div className="rounded-xl border border-white/[0.06] bg-black/25 px-3 py-2 text-left sm:text-right">
              <p className="text-[9px] uppercase tracking-[0.18em] text-white/28">Updated</p>
              <p className="mt-1 text-xs font-semibold text-white/70">{formatDate(status.generatedAt)}</p>
            </div>
            <div className={`grid gap-2 sm:flex sm:flex-wrap sm:justify-end ${onRefresh ? 'grid-cols-2' : 'grid-cols-1'}`}>
              {onRefresh && (
                <button
                  type="button"
                  onClick={requestRefresh}
                  disabled={refreshing}
                  className="inline-flex min-w-0 items-center justify-center gap-1.5 rounded-xl border border-white/[0.08] bg-white/[0.035] px-2.5 py-2 text-xs font-semibold text-white/52 transition-colors hover:bg-white/[0.06] hover:text-white/78 disabled:cursor-wait disabled:opacity-60 sm:gap-2 sm:px-3"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
                  <span className="truncate">{refreshing ? 'Refreshing' : 'Refresh'}</span>
                </button>
              )}
              <button
                type="button"
                onClick={copyProductionBrief}
                className="inline-flex min-w-0 items-center justify-center gap-1.5 rounded-xl border border-[#00D1FF]/16 bg-[#00D1FF]/10 px-2.5 py-2 text-xs font-semibold text-[#7DE3FF] transition-colors hover:bg-[#00D1FF]/15 sm:gap-2 sm:px-3"
              >
                <Copy className="h-3.5 w-3.5" />
                <span className="truncate">{copied ? 'Brief copied' : 'Copy brief'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-2.5 p-3 sm:gap-3 sm:p-4 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="space-y-2.5 sm:space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <OperationTile label="Durable history" value={status.operations.durableHistoryReady} icon={Database} />
            <OperationTile label="Email provider" value={status.operations.emailReady} icon={Mail} />
            <OperationTile label="Session secret" value={status.operations.sessionSecretReady} icon={LockKeyhole} />
            <OperationTile label="Critical flags" value={status.operations.criticalFlagsEnabled} icon={Flag} />
          </div>

          <div className="rounded-xl border border-[#00D1FF]/14 bg-[#00D1FF]/[0.045] p-2.5 sm:p-3">
            <div className="mb-2 flex items-center gap-2">
              <RadioTower className="h-4 w-4 text-[#00D1FF]" />
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#00D1FF]/85">Monitoring contract</p>
            </div>
            <p className="text-sm leading-relaxed text-white/58">
              This panel can inspect redacted readiness only. It cannot change flags, send email, run migrations, sign, submit, buy, sell, pay, schedule, or move funds.
            </p>
          </div>

          <div className="rounded-xl border border-white/[0.06] bg-black/20 p-2.5 sm:p-3">
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

          <div className="rounded-xl border border-white/[0.06] bg-black/20 p-2.5 sm:p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/48">Operator activity</p>
              <span className="rounded-full border border-white/[0.07] bg-white/[0.035] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-white/34">
                local
              </span>
            </div>
            <div className="space-y-2">
              {auditEvents.map(event => (
                <div key={event.id} className="rounded-lg border border-white/[0.055] bg-white/[0.025] px-2.5 py-2">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <p className="truncate text-[10px] font-semibold uppercase tracking-[0.12em] text-white/48">{formatActivityAction(event.action)}</p>
                    <span className="shrink-0 text-[9px] font-semibold uppercase tracking-[0.1em] text-white/28">
                      {formatDate(event.createdAt)}
                    </span>
                  </div>
                  <p className="text-[11px] leading-relaxed text-white/42">{event.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-2.5 sm:space-y-3">
          <div className="rounded-xl border border-white/[0.06] bg-black/20 p-2.5 sm:p-3">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/48">Production issue checklist</p>
                <p className="mt-1 text-[11px] leading-relaxed text-white/34">Next actions derived from the redacted status snapshot.</p>
              </div>
              <span className={`rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] ${
                requiredIssueCount > 0
                  ? 'border-[#FF5C7A]/18 bg-[#FF5C7A]/10 text-[#FF8A9E]'
                  : warningIssueCount > 0
                    ? 'border-[#F5A524]/18 bg-[#F5A524]/10 text-[#F5A524]'
                    : 'border-[#14F195]/18 bg-[#14F195]/10 text-[#14F195]'
              }`}>
                {requiredIssueCount} required / {warningIssueCount} warning
              </span>
            </div>
            <div className="space-y-2">
              {productionIssues.map(item => {
                const style = ISSUE_STYLES[item.severity];
                const IssueIcon = style.icon;
                return (
                  <div key={item.id} className={`rounded-xl border p-2.5 ${style.className}`}>
                    <div className="mb-1.5 flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <IssueIcon className="h-3.5 w-3.5 shrink-0" />
                        <p className="truncate text-[10px] font-semibold uppercase tracking-[0.12em]">{item.label}</p>
                      </div>
                      <span className="shrink-0 text-[9px] font-semibold uppercase tracking-[0.1em]">{style.label}</span>
                    </div>
                    <p className="line-clamp-3 text-[10px] leading-relaxed text-white/46 sm:line-clamp-none">{item.detail}</p>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-xl border border-white/[0.06] bg-black/20 p-2.5 sm:p-3">
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

          <div className="rounded-xl border border-white/[0.06] bg-black/20 p-2.5 sm:p-3">
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
                  <p className="line-clamp-3 text-[10px] leading-relaxed text-white/46 sm:line-clamp-none">{flag.publicDetail}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-[#14F195]/12 bg-[#14F195]/[0.035] p-2.5 sm:p-3">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#14F195]/80">Phase 12 closeout</p>
                <p className="mt-1 text-[11px] leading-relaxed text-white/34">Read-only admin monitoring package summary.</p>
              </div>
              <span className={`rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] ${
                phase12ReviewCount > 0
                  ? 'border-[#F5A524]/18 bg-[#F5A524]/10 text-[#F5A524]'
                  : 'border-[#14F195]/18 bg-[#14F195]/10 text-[#14F195]'
              }`}>
                {phase12ReviewCount > 0 ? `${phase12ReviewCount} review` : 'complete'}
              </span>
            </div>
            <div className="space-y-2">
              {phase12Closeout.map(item => {
                const CloseoutIcon = item.complete ? CheckCircle2 : AlertTriangle;
                return (
                  <div
                    key={item.id}
                    className={`rounded-xl border p-2.5 ${
                      item.complete
                        ? 'border-[#14F195]/14 bg-[#14F195]/[0.045] text-[#14F195]'
                        : 'border-[#F5A524]/18 bg-[#F5A524]/[0.055] text-[#F5A524]'
                    }`}
                  >
                    <div className="mb-1 flex items-center gap-2">
                      <CloseoutIcon className="h-3.5 w-3.5 shrink-0" />
                      <p className="truncate text-[10px] font-semibold uppercase tracking-[0.12em]">{item.label}</p>
                    </div>
                    <p className="line-clamp-2 text-[10px] leading-relaxed text-white/46 sm:line-clamp-none">{item.detail}</p>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-xl border border-[#00D1FF]/14 bg-[#00D1FF]/[0.04] p-2.5 sm:p-3">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#7DE3FF]">Phase 13.1 verification drill</p>
                <p className="mt-1 text-[11px] leading-relaxed text-white/34">Pre-rollout checks derived from the redacted status snapshot.</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] ${
                  productionVerificationReviewCount > 0
                    ? 'border-[#F5A524]/18 bg-[#F5A524]/10 text-[#F5A524]'
                    : 'border-[#14F195]/18 bg-[#14F195]/10 text-[#14F195]'
                }`}>
                  {productionVerificationReviewCount > 0 ? `${productionVerificationReviewCount} review` : 'all pass'}
                </span>
                <button
                  type="button"
                  onClick={copyProductionVerificationDrillReport}
                  className="inline-flex items-center justify-center gap-1.5 rounded-full border border-[#00D1FF]/16 bg-[#00D1FF]/10 px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-[#7DE3FF] transition-colors hover:bg-[#00D1FF]/15"
                >
                  <Copy className="h-3 w-3" />
                  {drillCopied ? 'copied' : 'copy drill'}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              {productionVerificationDrill.map(item => {
                const DrillIcon = item.passed ? CheckCircle2 : AlertTriangle;
                return (
                  <div
                    key={item.id}
                    className={`rounded-xl border p-2.5 ${
                      item.passed
                        ? 'border-[#14F195]/14 bg-[#14F195]/[0.045] text-[#14F195]'
                        : 'border-[#F5A524]/18 bg-[#F5A524]/[0.055] text-[#F5A524]'
                    }`}
                  >
                    <div className="mb-1 flex items-center gap-2">
                      <DrillIcon className="h-3.5 w-3.5 shrink-0" />
                      <p className="truncate text-[10px] font-semibold uppercase tracking-[0.12em]">{item.label}</p>
                    </div>
                    <p className="line-clamp-2 text-[10px] leading-relaxed text-white/46 sm:line-clamp-none">{item.detail}</p>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-xl border border-[#F5A524]/14 bg-[#F5A524]/[0.035] p-2.5 sm:p-3">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#F5A524]">Phase 13.3 review focus</p>
                <p className="mt-1 text-[11px] leading-relaxed text-white/34">Focused items from the verification drill for operator handoff.</p>
              </div>
              <span className={`rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] ${
                productionVerificationReviewCount > 0
                  ? 'border-[#F5A524]/18 bg-[#F5A524]/10 text-[#F5A524]'
                  : 'border-[#14F195]/18 bg-[#14F195]/10 text-[#14F195]'
              }`}>
                {productionVerificationReviewCount > 0 ? `${productionVerificationReviewCount} focus` : 'no focus'}
              </span>
            </div>
            <div className="space-y-2">
              {productionVerificationFocus.map(item => {
                const FocusIcon = item.severity === 'review' ? AlertTriangle : CheckCircle2;
                return (
                  <div
                    key={item.id}
                    className={`rounded-xl border p-2.5 ${
                      item.severity === 'review'
                        ? 'border-[#F5A524]/18 bg-[#F5A524]/[0.055] text-[#F5A524]'
                        : 'border-[#14F195]/14 bg-[#14F195]/[0.045] text-[#14F195]'
                    }`}
                  >
                    <div className="mb-1 flex items-center gap-2">
                      <FocusIcon className="h-3.5 w-3.5 shrink-0" />
                      <p className="truncate text-[10px] font-semibold uppercase tracking-[0.12em]">{item.label}</p>
                    </div>
                    <p className="line-clamp-2 text-[10px] leading-relaxed text-white/46 sm:line-clamp-none">{item.detail}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
