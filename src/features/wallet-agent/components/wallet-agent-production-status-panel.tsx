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

type ProductionVerificationHandoff = {
  status: 'blocked' | 'review' | 'ready_for_discussion';
  label: string;
  detail: string;
};

type ProductionVerificationPacketItem = {
  id: string;
  complete: boolean;
  label: string;
  detail: string;
};

type ProductionVerificationDecisionItem = {
  id: string;
  severity: 'blocker' | 'review' | 'safe';
  label: string;
  detail: string;
};

type ProductionVerificationTimelineItem = {
  id: string;
  complete: boolean;
  label: string;
  detail: string;
};

type ProductionVerificationSmokeItem = {
  id: string;
  passed: boolean;
  label: string;
  detail: string;
};

type ProductionVerificationBriefItem = {
  id: string;
  complete: boolean;
  label: string;
  detail: string;
};

type ProductionVerificationCloseoutItem = {
  id: string;
  complete: boolean;
  label: string;
  detail: string;
};

type ProductionObservabilityStatus = 'ready' | 'watch' | 'blocked';

type ProductionObservabilityItem = {
  id: string;
  status: ProductionObservabilityStatus;
  label: string;
  detail: string;
};

type ProductionRunbookItem = ProductionObservabilityItem;

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

function hasAuditAction(
  auditEvents: ProductionStatusAuditEvent[],
  action: ProductionStatusAuditEvent['action'],
) {
  return auditEvents.some(event => event.action === action);
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
  const noWarnings = status.audit.summary.warnings === 0;

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

function buildProductionVerificationHandoff(status: WalletAgentProductionMonitoringStatus): ProductionVerificationHandoff {
  const focusItems = buildProductionVerificationFocus(status).filter(item => item.severity === 'review');
  const criticalFlagsEnabled = status.featureFlags.summary.criticalEnabled > 0;
  const requiredAuditActions = status.audit.summary.actionRequired > 0;

  if (status.health === 'unsafe' || criticalFlagsEnabled || requiredAuditActions) {
    return {
      status: 'blocked',
      label: 'Blocked before rollout discussion',
      detail: 'Unsafe health, critical execution exposure, or required audit actions must be reviewed before any rollout discussion.',
    };
  }

  if (focusItems.length > 0 || status.audit.summary.warnings > 0) {
    return {
      status: 'review',
      label: 'Human review needed',
      detail: 'The drill is available for handoff, but remaining review or warning items should be resolved by an operator first.',
    };
  }

  return {
    status: 'ready_for_discussion',
    label: 'Ready for rollout discussion',
    detail: 'The redacted drill has no open review items, but production approval still requires a separate human decision.',
  };
}

function buildProductionVerificationPacket(
  status: WalletAgentProductionMonitoringStatus,
  auditEvents: ProductionStatusAuditEvent[] = [],
): ProductionVerificationPacketItem[] {
  const handoff = buildProductionVerificationHandoff(status);

  return [
    {
      id: 'verification-drill',
      complete: true,
      label: 'Verification drill',
      detail: 'Pass and review checks are derived from the current redacted admin status snapshot.',
    },
    {
      id: 'review-focus',
      complete: true,
      label: 'Review focus',
      detail: 'Operator focus items are included so handoff notes do not require scanning the full drill first.',
    },
    {
      id: 'handoff-note',
      complete: true,
      label: 'Handoff note',
      detail: `Current handoff classification is ${handoff.status.replaceAll('_', ' ')}.`,
    },
    {
      id: 'local-activity',
      complete: auditEvents.length > 0,
      label: 'Local operator activity',
      detail: auditEvents.length > 0
        ? 'This browser session has local operator activity available for the copied production brief.'
        : 'No local operator activity has been recorded in this browser session yet.',
    },
    {
      id: 'read-only-boundary',
      complete: true,
      label: 'Read-only boundary',
      detail: 'The packet cannot approve rollout, change configuration, run migrations, sign, submit, schedule, or move funds.',
    },
  ];
}

function buildProductionVerificationDecisionContext(status: WalletAgentProductionMonitoringStatus): ProductionVerificationDecisionItem[] {
  const items: ProductionVerificationDecisionItem[] = [];

  if (status.health === 'unsafe') {
    items.push({
      id: 'unsafe-health',
      severity: 'blocker',
      label: 'Unsafe health',
      detail: 'Production status is unsafe and must be reviewed before any rollout discussion.',
    });
  }

  if (status.featureFlags.summary.criticalEnabled > 0) {
    items.push({
      id: 'critical-flags-enabled',
      severity: 'blocker',
      label: 'Critical execution exposure',
      detail: `${status.featureFlags.summary.criticalEnabled} critical execution flag(s) are enabled and require review.`,
    });
  }

  if (status.audit.summary.actionRequired > 0) {
    items.push({
      id: 'required-audit-actions',
      severity: 'blocker',
      label: 'Required audit actions',
      detail: `${status.audit.summary.actionRequired} readiness audit item(s) require action.`,
    });
  }

  if (status.audit.summary.warnings > 0) {
    items.push({
      id: 'audit-warnings',
      severity: 'review',
      label: 'Audit warnings',
      detail: `${status.audit.summary.warnings} readiness warning(s) should be reviewed by an operator.`,
    });
  }

  const reviewFocusCount = buildProductionVerificationFocus(status).filter(item => item.severity === 'review').length;
  if (reviewFocusCount > 0) {
    items.push({
      id: 'drill-review-focus',
      severity: 'review',
      label: 'Drill review focus',
      detail: `${reviewFocusCount} verification drill item(s) need operator review.`,
    });
  }

  if (items.length > 0) {
    return items.slice(0, 6);
  }

  return [{
    id: 'no-decision-blockers',
    severity: 'safe',
    label: 'No decision blockers in snapshot',
    detail: 'The redacted snapshot reports no blockers or warnings, but rollout still requires a separate human approval process.',
  }];
}

function buildProductionVerificationTimeline(
  auditEvents: ProductionStatusAuditEvent[] = [],
): ProductionVerificationTimelineItem[] {
  return [
    {
      id: 'status-loaded',
      complete: hasAuditAction(auditEvents, 'status_loaded'),
      label: 'Status loaded',
      detail: hasAuditAction(auditEvents, 'status_loaded')
        ? 'The current browser activity includes a redacted status load for this admin session.'
        : 'No local status-load event is present in the bounded browser activity trail.',
    },
    {
      id: 'manual-refresh',
      complete: hasAuditAction(auditEvents, 'refresh_requested'),
      label: 'Manual refresh',
      detail: hasAuditAction(auditEvents, 'refresh_requested')
        ? 'An admin requested a manual refresh before handoff.'
        : 'Manual refresh has not been recorded in this local session yet.',
    },
    {
      id: 'production-brief-copy',
      complete: hasAuditAction(auditEvents, 'brief_copied'),
      label: 'Production brief copy',
      detail: hasAuditAction(auditEvents, 'brief_copied')
        ? 'The redacted production brief was copied from this browser session.'
        : 'The redacted production brief has not been copied in this browser session yet.',
    },
    {
      id: 'drill-report-copy',
      complete: hasAuditAction(auditEvents, 'drill_report_copied'),
      label: 'Drill report copy',
      detail: hasAuditAction(auditEvents, 'drill_report_copied')
        ? 'The focused verification drill report was copied from this browser session.'
        : 'The focused drill report has not been copied in this browser session yet.',
    },
  ];
}

function buildProductionVerificationSmokeChecklist(
  status: WalletAgentProductionMonitoringStatus,
  auditEvents: ProductionStatusAuditEvent[] = [],
): ProductionVerificationSmokeItem[] {
  const coreReadinessReady = status.operations.durableHistoryReady
    && status.operations.emailReady
    && status.operations.sessionSecretReady;
  const criticalFlagsBlocked = status.featureFlags.summary.criticalEnabled === 0;
  const copiedHandoffMaterials = hasAuditAction(auditEvents, 'brief_copied')
    && hasAuditAction(auditEvents, 'drill_report_copied');

  return [
    {
      id: 'admin-status-snapshot',
      passed: status.health !== 'unsafe',
      label: 'Admin status snapshot',
      detail: status.health === 'unsafe'
        ? 'The redacted production status is unsafe and needs review before smoke testing.'
        : 'The redacted production status is available for a safe smoke test discussion.',
    },
    {
      id: 'core-readiness',
      passed: coreReadinessReady,
      label: 'Core readiness signals',
      detail: coreReadinessReady
        ? 'Durable history, email provider, and session secret readiness are reported as ready.'
        : 'One or more durable history, email provider, or session secret readiness signals need review.',
    },
    {
      id: 'critical-flags-blocked',
      passed: criticalFlagsBlocked,
      label: 'Critical execution flags',
      detail: criticalFlagsBlocked
        ? 'Scheduled actions and mainnet execution are not reported as enabled.'
        : 'At least one critical execution flag is enabled and must be reviewed before rollout.',
    },
    {
      id: 'manual-refresh-recorded',
      passed: hasAuditAction(auditEvents, 'refresh_requested'),
      label: 'Manual refresh recorded',
      detail: hasAuditAction(auditEvents, 'refresh_requested')
        ? 'A local manual refresh was recorded before using the handoff materials.'
        : 'Manual refresh is still pending in this browser-local smoke checklist.',
    },
    {
      id: 'handoff-materials-copied',
      passed: copiedHandoffMaterials,
      label: 'Handoff materials copied',
      detail: copiedHandoffMaterials
        ? 'Both the production brief and focused drill report were copied in this local session.'
        : 'Copy both the production brief and focused drill report before a rollout discussion.',
    },
    {
      id: 'read-only-boundary',
      passed: true,
      label: 'Read-only safety boundary',
      detail: 'The smoke checklist cannot run migrations, test providers, send email, sign, submit, schedule, or move funds.',
    },
  ];
}

function buildProductionVerificationBriefChecklist(
  auditEvents: ProductionStatusAuditEvent[] = [],
): ProductionVerificationBriefItem[] {
  return [
    {
      id: 'brief-core-status',
      complete: true,
      label: 'Core status summary',
      detail: 'The copied brief includes health, mode, operation readiness, readiness audit items, and critical flags.',
    },
    {
      id: 'brief-verification-drill',
      complete: true,
      label: 'Verification drill package',
      detail: 'The brief includes drill checks, review focus, handoff note, handoff packet, and decision context.',
    },
    {
      id: 'brief-local-context',
      complete: auditEvents.length > 0,
      label: 'Local operator context',
      detail: auditEvents.length > 0
        ? 'Browser-local operator activity is available for the copied brief.'
        : 'No browser-local operator activity is available for the copied brief yet.',
    },
    {
      id: 'brief-smoke-materials',
      complete: true,
      label: 'Smoke and timeline materials',
      detail: 'The brief includes the local verification timeline and pre-rollout smoke checklist.',
    },
    {
      id: 'brief-copy-action',
      complete: hasAuditAction(auditEvents, 'brief_copied'),
      label: 'Brief copy recorded',
      detail: hasAuditAction(auditEvents, 'brief_copied')
        ? 'A redacted production brief copy action is recorded in this browser session.'
        : 'The redacted production brief has not been copied in this browser session yet.',
    },
    {
      id: 'brief-read-only-safety',
      complete: true,
      label: 'Read-only safety notes',
      detail: 'The brief states that the admin surface cannot change configuration, sign, submit, schedule, or move funds.',
    },
  ];
}

function buildProductionVerificationCloseout(
  status: WalletAgentProductionMonitoringStatus,
  auditEvents: ProductionStatusAuditEvent[] = [],
): ProductionVerificationCloseoutItem[] {
  const drillReviewCount = buildProductionVerificationDrill(status).filter(item => !item.passed).length;
  const decisionReviewCount = buildProductionVerificationDecisionContext(status).filter(item => item.severity !== 'safe').length;
  const smokeReviewCount = buildProductionVerificationSmokeChecklist(status, auditEvents).filter(item => !item.passed).length;
  const briefReviewCount = buildProductionVerificationBriefChecklist(auditEvents).filter(item => !item.complete).length;

  return [
    {
      id: 'verification-surfaces',
      complete: true,
      label: 'Verification surfaces covered',
      detail: 'Drill, review focus, handoff note, packet, decision context, local timeline, smoke checklist, and copied brief checklist are represented.',
    },
    {
      id: 'open-review-signals',
      complete: drillReviewCount + decisionReviewCount + smokeReviewCount + briefReviewCount === 0,
      label: 'Open review signals',
      detail: drillReviewCount + decisionReviewCount + smokeReviewCount + briefReviewCount === 0
        ? 'The current redacted snapshot and local activity show no Phase 13 review signals.'
        : `${drillReviewCount + decisionReviewCount + smokeReviewCount + briefReviewCount} Phase 13 review signal(s) remain for human review.`,
    },
    {
      id: 'handoff-materials',
      complete: hasAuditAction(auditEvents, 'brief_copied') && hasAuditAction(auditEvents, 'drill_report_copied'),
      label: 'Handoff materials copied',
      detail: hasAuditAction(auditEvents, 'brief_copied') && hasAuditAction(auditEvents, 'drill_report_copied')
        ? 'Both the production brief and focused drill report were copied in this browser session.'
        : 'Copy the production brief and focused drill report before treating the handoff packet as complete.',
    },
    {
      id: 'read-only-closeout',
      complete: true,
      label: 'Read-only closeout',
      detail: 'Phase 13 closes verification context only; it cannot approve rollout, change configuration, run tests, sign, submit, schedule, or move funds.',
    },
  ];
}

function buildProductionObservabilitySnapshot(status: WalletAgentProductionMonitoringStatus): ProductionObservabilityItem[] {
  return [
    {
      id: 'health-state',
      status: status.health === 'unsafe' ? 'blocked' : status.health === 'attention_required' ? 'watch' : 'ready',
      label: 'Health state',
      detail: `Current redacted health is ${status.health}.`,
    },
    {
      id: 'readiness-distribution',
      status: status.audit.summary.actionRequired > 0 ? 'blocked' : status.audit.summary.warnings > 0 ? 'watch' : 'ready',
      label: 'Readiness distribution',
      detail: `${status.audit.summary.ready} ready, ${status.audit.summary.actionRequired} required, ${status.audit.summary.warnings} warning, ${status.audit.summary.safeDefaults} safe-default item(s).`,
    },
    {
      id: 'flag-distribution',
      status: status.featureFlags.summary.criticalEnabled > 0 ? 'blocked' : status.featureFlags.summary.enabled > 0 ? 'watch' : 'ready',
      label: 'Feature flag distribution',
      detail: `${status.featureFlags.summary.enabled} enabled, ${status.featureFlags.summary.disabled} disabled, ${status.featureFlags.summary.safeDefaults} safe-default, ${status.featureFlags.summary.criticalEnabled} critical enabled.`,
    },
  ];
}

function buildProductionObservabilityMetrics(
  status: WalletAgentProductionMonitoringStatus,
  auditEvents: ProductionStatusAuditEvent[] = [],
): ProductionObservabilityItem[] {
  const operationReadyCount = [
    status.operations.durableHistoryReady,
    status.operations.emailReady,
    status.operations.sessionSecretReady,
    status.operations.devnetConfigured,
    status.operations.criticalFlagsEnabled === 0,
  ].filter(Boolean).length;

  return [
    {
      id: 'operation-readiness-score',
      status: operationReadyCount >= 4 ? 'ready' : operationReadyCount >= 3 ? 'watch' : 'blocked',
      label: 'Operation readiness score',
      detail: `${operationReadyCount}/5 read-only operation signals are in the preferred state.`,
    },
    {
      id: 'local-activity-count',
      status: auditEvents.length > 0 ? 'ready' : 'watch',
      label: 'Local activity count',
      detail: `${auditEvents.length} browser-local admin activity event(s) are available in the bounded trail.`,
    },
    {
      id: 'handoff-copy-count',
      status: hasAuditAction(auditEvents, 'brief_copied') && hasAuditAction(auditEvents, 'drill_report_copied')
        ? 'ready'
        : 'watch',
      label: 'Handoff copy count',
      detail: `${[hasAuditAction(auditEvents, 'brief_copied'), hasAuditAction(auditEvents, 'drill_report_copied')].filter(Boolean).length}/2 handoff copy actions are recorded locally.`,
    },
  ];
}

function buildProductionObservabilityWatchlist(status: WalletAgentProductionMonitoringStatus): ProductionObservabilityItem[] {
  const requiredCount = status.audit.summary.actionRequired;
  const warningCount = status.audit.summary.warnings;
  const criticalFlagCount = status.featureFlags.summary.criticalEnabled;

  return [
    {
      id: 'required-audit-watch',
      status: requiredCount > 0 ? 'blocked' : 'ready',
      label: 'Required audit actions',
      detail: requiredCount > 0
        ? `${requiredCount} required audit item(s) need operator action.`
        : 'No required audit actions are reported in the redacted snapshot.',
    },
    {
      id: 'warning-audit-watch',
      status: warningCount > 0 ? 'watch' : 'ready',
      label: 'Audit warnings',
      detail: warningCount > 0
        ? `${warningCount} warning item(s) should remain visible in the handoff.`
        : 'No warning items are reported in the redacted snapshot.',
    },
    {
      id: 'critical-flag-watch',
      status: criticalFlagCount > 0 ? 'blocked' : 'ready',
      label: 'Critical execution flags',
      detail: criticalFlagCount > 0
        ? `${criticalFlagCount} critical execution flag(s) are enabled.`
        : 'Critical execution flags are not reported as enabled.',
    },
  ];
}

function buildProductionObservabilityHandoff(
  status: WalletAgentProductionMonitoringStatus,
  auditEvents: ProductionStatusAuditEvent[] = [],
): ProductionObservabilityItem[] {
  const closeoutReviewCount = buildProductionVerificationCloseout(status, auditEvents).filter(item => !item.complete).length;

  return [
    {
      id: 'phase-13-closeout',
      status: closeoutReviewCount > 0 ? 'watch' : 'ready',
      label: 'Phase 13 closeout',
      detail: closeoutReviewCount > 0
        ? `${closeoutReviewCount} closeout item(s) remain in review.`
        : 'Phase 13 closeout has no open local review items.',
    },
    {
      id: 'copied-brief-presence',
      status: hasAuditAction(auditEvents, 'brief_copied') ? 'ready' : 'watch',
      label: 'Copied production brief',
      detail: hasAuditAction(auditEvents, 'brief_copied')
        ? 'A redacted production brief copy action is recorded locally.'
        : 'The redacted production brief has not been copied in this browser session.',
    },
    {
      id: 'copied-drill-presence',
      status: hasAuditAction(auditEvents, 'drill_report_copied') ? 'ready' : 'watch',
      label: 'Copied drill report',
      detail: hasAuditAction(auditEvents, 'drill_report_copied')
        ? 'A focused drill report copy action is recorded locally.'
        : 'The focused drill report has not been copied in this browser session.',
    },
  ];
}

function buildProductionObservabilityReviewQueue(
  status: WalletAgentProductionMonitoringStatus,
  auditEvents: ProductionStatusAuditEvent[] = [],
): ProductionObservabilityItem[] {
  const reviewSignals = [
    ...buildProductionObservabilitySnapshot(status),
    ...buildProductionObservabilityMetrics(status, auditEvents),
    ...buildProductionObservabilityWatchlist(status),
    ...buildProductionObservabilityHandoff(status, auditEvents),
  ].filter(item => item.status !== 'ready');

  if (reviewSignals.length === 0) {
    return [{
      id: 'no-observability-review',
      status: 'ready',
      label: 'No observability review queue',
      detail: 'The current redacted snapshot and local activity do not create observability review items.',
    }];
  }

  return reviewSignals.slice(0, 6).map(item => ({
    id: `review-${item.id}`,
    status: item.status,
    label: item.label,
    detail: item.detail,
  }));
}

function buildProductionObservabilityCloseout(
  status: WalletAgentProductionMonitoringStatus,
  auditEvents: ProductionStatusAuditEvent[] = [],
): ProductionObservabilityItem[] {
  const reviewQueue = buildProductionObservabilityReviewQueue(status, auditEvents).filter(item => item.status !== 'ready');

  return [
    {
      id: 'observability-surfaces',
      status: 'ready',
      label: 'Observability surfaces',
      detail: 'Snapshot, metrics, watchlist, handoff artifacts, review queue, copied brief context, and safety boundary are represented.',
    },
    {
      id: 'observability-review-state',
      status: reviewQueue.length > 0 ? 'watch' : 'ready',
      label: 'Observability review state',
      detail: reviewQueue.length > 0
        ? `${reviewQueue.length} observability review item(s) remain visible for humans.`
        : 'No observability review items remain in the current redacted snapshot.',
    },
    {
      id: 'observability-safety',
      status: 'ready',
      label: 'Read-only observability',
      detail: 'Phase 14 can summarize and copy redacted context only; it cannot monitor providers, change settings, sign, submit, schedule, or move funds.',
    },
  ];
}

function buildProductionRunbookSummary(
  status: WalletAgentProductionMonitoringStatus,
  auditEvents: ProductionStatusAuditEvent[] = [],
): ProductionRunbookItem[] {
  const observabilityReviewCount = buildProductionObservabilityReviewQueue(status, auditEvents)
    .filter(item => item.status !== 'ready').length;

  return [
    {
      id: 'runbook-scope',
      status: 'ready',
      label: 'Operator runbook scope',
      detail: 'Phase 15 packages rollout, rollback, incident, smoke, provider, database, and critical-flag guidance for admins.',
    },
    {
      id: 'runbook-health',
      status: status.health === 'unsafe' ? 'blocked' : status.health === 'attention_required' ? 'watch' : 'ready',
      label: 'Current rollout posture',
      detail: `The redacted production health is ${status.health}; operators still make the final deployment decision.`,
    },
    {
      id: 'runbook-inputs',
      status: observabilityReviewCount > 0 ? 'watch' : 'ready',
      label: 'Runbook input signals',
      detail: observabilityReviewCount > 0
        ? `${observabilityReviewCount} observability review item(s) should be checked before using the runbook as a handoff.`
        : 'Phase 14 observability has no open review queue in this browser session.',
    },
  ];
}

function buildProductionRolloutChecklist(status: WalletAgentProductionMonitoringStatus): ProductionRunbookItem[] {
  return [
    {
      id: 'rollout-admin-status',
      status: status.health === 'unsafe' ? 'blocked' : 'ready',
      label: 'Admin status check',
      detail: status.health === 'unsafe'
        ? 'Do not proceed while admin status reports unsafe health.'
        : 'Review the admin-gated redacted status before rollout discussion.',
    },
    {
      id: 'rollout-durable-history',
      status: status.operations.durableHistoryReady ? 'ready' : 'watch',
      label: 'Durable history posture',
      detail: status.operations.durableHistoryReady
        ? 'Durable alert history readiness is reported as ready.'
        : 'Durable history is not ready; keep storage fallback behavior visible before rollout.',
    },
    {
      id: 'rollout-email',
      status: status.operations.emailReady ? 'ready' : 'watch',
      label: 'Email delivery posture',
      detail: status.operations.emailReady
        ? 'Email provider readiness is reported as ready.'
        : 'Email provider readiness needs human review before enabling real delivery.',
    },
    {
      id: 'rollout-critical-flags',
      status: status.operations.criticalFlagsEnabled > 0 ? 'blocked' : 'ready',
      label: 'Critical execution flags',
      detail: status.operations.criticalFlagsEnabled > 0
        ? `${status.operations.criticalFlagsEnabled} critical execution flag(s) are enabled; treat rollout as blocked.`
        : 'Critical scheduled-action and mainnet execution exposure remains blocked.',
    },
  ];
}

function buildProductionRollbackChecklist(status: WalletAgentProductionMonitoringStatus): ProductionRunbookItem[] {
  return [
    {
      id: 'rollback-critical-flags',
      status: status.operations.criticalFlagsEnabled > 0 ? 'blocked' : 'ready',
      label: 'Disable risky exposure first',
      detail: status.operations.criticalFlagsEnabled > 0
        ? 'Critical execution exposure is enabled; rollback notes should start with disabling risky flags.'
        : 'Critical execution flags are already reported as blocked.',
    },
    {
      id: 'rollback-email',
      status: status.operations.emailReady ? 'watch' : 'ready',
      label: 'Email delivery rollback',
      detail: status.operations.emailReady
        ? 'If alert delivery misbehaves, remove provider exposure before investigating non-critical UI issues.'
        : 'Email delivery is not ready, so provider rollback remains a prepared checklist item.',
    },
    {
      id: 'rollback-database',
      status: status.operations.durableHistoryReady ? 'watch' : 'ready',
      label: 'Database adapter fallback',
      detail: status.operations.durableHistoryReady
        ? 'If durable writes fail, disable the database adapter and preserve metadata-only safety boundaries.'
        : 'Durable database history is not ready, so memory fallback remains the default safe posture.',
    },
  ];
}

function buildProductionIncidentNotes(status: WalletAgentProductionMonitoringStatus): ProductionRunbookItem[] {
  const requiredAuditCount = status.audit.summary.actionRequired;
  const warningCount = status.audit.summary.warnings;

  return [
    {
      id: 'incident-critical-flags',
      status: status.featureFlags.summary.criticalEnabled > 0 ? 'blocked' : 'ready',
      label: 'Critical flag incident rule',
      detail: status.featureFlags.summary.criticalEnabled > 0
        ? 'Enabled critical execution flags should be treated as an incident until reviewed.'
        : 'No critical execution flags are reported as enabled.',
    },
    {
      id: 'incident-audit-actions',
      status: requiredAuditCount > 0 ? 'blocked' : warningCount > 0 ? 'watch' : 'ready',
      label: 'Audit escalation signals',
      detail: requiredAuditCount > 0
        ? `${requiredAuditCount} required audit action(s) need escalation before rollout.`
        : warningCount > 0
          ? `${warningCount} warning item(s) should remain in the incident handoff notes.`
          : 'No required audit actions or warnings are reported.',
    },
    {
      id: 'incident-secret-boundary',
      status: 'ready',
      label: 'Secret handling boundary',
      detail: 'Do not paste API keys, session secrets, database URLs, wallet keys, signatures, or signed payloads into tickets or chat.',
    },
  ];
}

function buildProductionSmokeManualChecklist(
  status: WalletAgentProductionMonitoringStatus,
  auditEvents: ProductionStatusAuditEvent[] = [],
): ProductionRunbookItem[] {
  return [
    {
      id: 'smoke-status-refresh',
      status: hasAuditAction(auditEvents, 'refresh_requested') ? 'ready' : 'watch',
      label: 'Manual status refresh',
      detail: hasAuditAction(auditEvents, 'refresh_requested')
        ? 'A manual refresh was recorded in this local admin session.'
        : 'Refresh the redacted production status before final handoff.',
    },
    {
      id: 'smoke-brief-copy',
      status: hasAuditAction(auditEvents, 'brief_copied') ? 'ready' : 'watch',
      label: 'Production brief copied',
      detail: hasAuditAction(auditEvents, 'brief_copied')
        ? 'The redacted production brief was copied locally.'
        : 'Copy the production brief for deployment notes before handoff.',
    },
    {
      id: 'smoke-drill-copy',
      status: hasAuditAction(auditEvents, 'drill_report_copied') ? 'ready' : 'watch',
      label: 'Drill report copied',
      detail: hasAuditAction(auditEvents, 'drill_report_copied')
        ? 'The focused drill report was copied locally.'
        : 'Copy the focused drill report for operator review.',
    },
    {
      id: 'smoke-no-execution',
      status: status.operations.criticalFlagsEnabled > 0 ? 'blocked' : 'ready',
      label: 'No execution smoke boundary',
      detail: status.operations.criticalFlagsEnabled > 0
        ? 'Critical execution exposure is enabled; do not treat smoke context as safe.'
        : 'Smoke context remains read-only and cannot sign, submit, schedule, or move funds.',
    },
  ];
}

function buildProductionProviderCheckContext(status: WalletAgentProductionMonitoringStatus): ProductionRunbookItem[] {
  return [
    {
      id: 'provider-email',
      status: status.operations.emailReady ? 'ready' : 'watch',
      label: 'Email provider check',
      detail: status.operations.emailReady
        ? 'Email provider readiness is reported as configured, but delivery uptime is not tested here.'
        : 'Email provider readiness needs manual setup or review before real delivery.',
    },
    {
      id: 'provider-session',
      status: status.operations.sessionSecretReady ? 'ready' : 'blocked',
      label: 'Session secret check',
      detail: status.operations.sessionSecretReady
        ? 'Session secret readiness is reported as ready.'
        : 'Session secret readiness is missing and should block production rollout.',
    },
    {
      id: 'provider-devnet-rpc',
      status: status.operations.devnetConfigured ? 'ready' : 'watch',
      label: 'Devnet RPC check',
      detail: status.operations.devnetConfigured
        ? 'Devnet RPC configuration is present; live RPC health is not tested by this panel.'
        : 'Devnet RPC configuration is not reported as ready.',
    },
  ];
}

function buildProductionMigrationChecklist(status: WalletAgentProductionMonitoringStatus): ProductionRunbookItem[] {
  return [
    {
      id: 'migration-prisma',
      status: status.operations.durableHistoryReady ? 'ready' : 'watch',
      label: 'Prisma migration confirmation',
      detail: status.operations.durableHistoryReady
        ? 'Durable history readiness implies schema and adapter posture have been prepared for operator review.'
        : 'Confirm Prisma schema and migrations before enabling durable database history.',
    },
    {
      id: 'migration-adapter-gate',
      status: status.operations.durableHistoryReady ? 'ready' : 'watch',
      label: 'Database adapter gate',
      detail: status.operations.durableHistoryReady
        ? 'Database adapter readiness is reported through the redacted production status.'
        : 'Keep database adapter disabled or in fallback until schema and backups are verified.',
    },
    {
      id: 'migration-retention',
      status: status.audit.summary.actionRequired > 0 ? 'watch' : 'ready',
      label: 'Retention policy review',
      detail: status.audit.summary.actionRequired > 0
        ? 'Required audit actions may include storage or retention work; review before rollout.'
        : 'No required audit action is reported for the current retention and storage posture.',
    },
  ];
}

function buildProductionCriticalFlagPolicy(status: WalletAgentProductionMonitoringStatus): ProductionRunbookItem[] {
  const criticalFlags = status.featureFlags.flags.filter(flag => flag.productionRisk === 'critical');
  const enabledCriticalFlags = criticalFlags.filter(flag => flag.status === 'enabled');

  return [
    {
      id: 'critical-flag-policy',
      status: enabledCriticalFlags.length > 0 ? 'blocked' : 'ready',
      label: 'Critical flag policy',
      detail: enabledCriticalFlags.length > 0
        ? `${enabledCriticalFlags.length} critical flag(s) are enabled; require incident-level human review.`
        : 'Critical execution flags remain disabled or safe-default in the redacted snapshot.',
    },
    {
      id: 'scheduled-actions-policy',
      status: criticalFlags.some(flag => flag.id.includes('scheduled') && flag.status === 'enabled') ? 'blocked' : 'ready',
      label: 'Scheduled actions policy',
      detail: 'Scheduled value-moving actions must remain blocked until a future audited execution phase.',
    },
    {
      id: 'mainnet-policy',
      status: criticalFlags.some(flag => flag.id.includes('mainnet') && flag.status === 'enabled') ? 'blocked' : 'ready',
      label: 'Mainnet execution policy',
      detail: 'Mainnet execution must remain blocked until proposal, approval, signing, submission, and rollback policies are audited.',
    },
  ];
}

function buildProductionRunbookCloseout(
  status: WalletAgentProductionMonitoringStatus,
  auditEvents: ProductionStatusAuditEvent[] = [],
): ProductionRunbookItem[] {
  const runbookItems = [
    ...buildProductionRunbookSummary(status, auditEvents),
    ...buildProductionRolloutChecklist(status),
    ...buildProductionRollbackChecklist(status),
    ...buildProductionIncidentNotes(status),
    ...buildProductionSmokeManualChecklist(status, auditEvents),
    ...buildProductionProviderCheckContext(status),
    ...buildProductionMigrationChecklist(status),
    ...buildProductionCriticalFlagPolicy(status),
  ];
  const blockedCount = runbookItems.filter(item => item.status === 'blocked').length;
  const watchCount = runbookItems.filter(item => item.status === 'watch').length;

  return [
    {
      id: 'runbook-coverage',
      status: 'ready',
      label: 'Runbook coverage',
      detail: 'Rollout, rollback, incident, smoke, provider, database, critical flag, copied packet, and closeout guidance are represented.',
    },
    {
      id: 'runbook-review-state',
      status: blockedCount > 0 ? 'blocked' : watchCount > 0 ? 'watch' : 'ready',
      label: 'Runbook review state',
      detail: blockedCount > 0
        ? `${blockedCount} blocked runbook item(s) require human review.`
        : watchCount > 0
          ? `${watchCount} watch item(s) remain visible for operator review.`
          : 'No runbook watch or blocked items remain in the current redacted snapshot.',
    },
    {
      id: 'runbook-final-boundary',
      status: 'ready',
      label: 'Final read-only boundary',
      detail: 'Phase 15 closes the planned handoff package; it cannot approve rollout, change production, send alerts, sign, submit, schedule, or move funds.',
    },
  ];
}

function buildProductionVerificationDrillReport(
  status: WalletAgentProductionMonitoringStatus,
  auditEvents: ProductionStatusAuditEvent[] = [],
) {
  const drillItems = buildProductionVerificationDrill(status);
  const focusItems = buildProductionVerificationFocus(status);
  const handoff = buildProductionVerificationHandoff(status);
  const packetItems = buildProductionVerificationPacket(status, auditEvents);
  const decisionItems = buildProductionVerificationDecisionContext(status);
  const timelineItems = buildProductionVerificationTimeline(auditEvents);
  const smokeItems = buildProductionVerificationSmokeChecklist(status, auditEvents);
  const briefItems = buildProductionVerificationBriefChecklist(auditEvents);
  const closeoutItems = buildProductionVerificationCloseout(status, auditEvents);
  const observabilityItems = [
    ...buildProductionObservabilitySnapshot(status),
    ...buildProductionObservabilityMetrics(status, auditEvents),
    ...buildProductionObservabilityWatchlist(status),
    ...buildProductionObservabilityHandoff(status, auditEvents),
    ...buildProductionObservabilityReviewQueue(status, auditEvents),
    ...buildProductionObservabilityCloseout(status, auditEvents),
  ];
  const runbookItems = [
    ...buildProductionRunbookSummary(status, auditEvents),
    ...buildProductionRolloutChecklist(status),
    ...buildProductionRollbackChecklist(status),
    ...buildProductionIncidentNotes(status),
    ...buildProductionSmokeManualChecklist(status, auditEvents),
    ...buildProductionProviderCheckContext(status),
    ...buildProductionMigrationChecklist(status),
    ...buildProductionCriticalFlagPolicy(status),
    ...buildProductionRunbookCloseout(status, auditEvents),
  ];
  const passedCount = drillItems.filter(item => item.passed).length;
  const reviewCount = drillItems.length - passedCount;
  const drillLines = drillItems.map(item => (
    `- [${item.passed ? 'pass' : 'review'}] ${item.label}: ${item.detail}`
  ));
  const focusLines = focusItems.map(item => (
    `- [${item.severity}] ${item.label}: ${item.detail}`
  ));
  const packetLines = packetItems.map(item => (
    `- [${item.complete ? 'complete' : 'review'}] ${item.label}: ${item.detail}`
  ));
  const decisionLines = decisionItems.map(item => (
    `- [${item.severity}] ${item.label}: ${item.detail}`
  ));
  const timelineLines = timelineItems.map(item => (
    `- [${item.complete ? 'recorded' : 'pending'}] ${item.label}: ${item.detail}`
  ));
  const smokeLines = smokeItems.map(item => (
    `- [${item.passed ? 'pass' : 'review'}] ${item.label}: ${item.detail}`
  ));
  const briefLines = briefItems.map(item => (
    `- [${item.complete ? 'complete' : 'review'}] ${item.label}: ${item.detail}`
  ));
  const closeoutLines = closeoutItems.map(item => (
    `- [${item.complete ? 'complete' : 'review'}] ${item.label}: ${item.detail}`
  ));
  const observabilityLines = observabilityItems.map(item => (
    `- [${item.status}] ${item.label}: ${item.detail}`
  ));
  const runbookLines = runbookItems.map(item => (
    `- [${item.status}] ${item.label}: ${item.detail}`
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
    'Handoff note',
    `- [${handoff.status}] ${handoff.label}: ${handoff.detail}`,
    '',
    'Handoff packet',
    ...packetLines,
    '',
    'Decision context',
    ...decisionLines,
    '',
    'Local verification timeline',
    ...timelineLines,
    '',
    'Smoke checklist',
    ...smokeLines,
    '',
    'Copied brief checklist',
    ...briefLines,
    '',
    'Phase 13 closeout',
    ...closeoutLines,
    '',
    'Phase 14 observability handoff',
    ...observabilityLines,
    '',
    'Phase 15 production operator runbook',
    ...runbookLines,
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
  const verificationHandoff = buildProductionVerificationHandoff(status);
  const verificationPacketLines = buildProductionVerificationPacket(status, auditEvents).map(item => (
    `- [${item.complete ? 'complete' : 'review'}] ${item.label}: ${item.detail}`
  ));
  const verificationDecisionLines = buildProductionVerificationDecisionContext(status).map(item => (
    `- [${item.severity}] ${item.label}: ${item.detail}`
  ));
  const verificationTimelineLines = buildProductionVerificationTimeline(auditEvents).map(item => (
    `- [${item.complete ? 'recorded' : 'pending'}] ${item.label}: ${item.detail}`
  ));
  const verificationSmokeLines = buildProductionVerificationSmokeChecklist(status, auditEvents).map(item => (
    `- [${item.passed ? 'pass' : 'review'}] ${item.label}: ${item.detail}`
  ));
  const verificationBriefLines = buildProductionVerificationBriefChecklist(auditEvents).map(item => (
    `- [${item.complete ? 'complete' : 'review'}] ${item.label}: ${item.detail}`
  ));
  const verificationCloseoutLines = buildProductionVerificationCloseout(status, auditEvents).map(item => (
    `- [${item.complete ? 'complete' : 'review'}] ${item.label}: ${item.detail}`
  ));
  const observabilityLines = [
    ...buildProductionObservabilitySnapshot(status),
    ...buildProductionObservabilityMetrics(status, auditEvents),
    ...buildProductionObservabilityWatchlist(status),
    ...buildProductionObservabilityHandoff(status, auditEvents),
    ...buildProductionObservabilityReviewQueue(status, auditEvents),
    ...buildProductionObservabilityCloseout(status, auditEvents),
  ].map(item => (
    `- [${item.status}] ${item.label}: ${item.detail}`
  ));
  const runbookLines = [
    ...buildProductionRunbookSummary(status, auditEvents),
    ...buildProductionRolloutChecklist(status),
    ...buildProductionRollbackChecklist(status),
    ...buildProductionIncidentNotes(status),
    ...buildProductionSmokeManualChecklist(status, auditEvents),
    ...buildProductionProviderCheckContext(status),
    ...buildProductionMigrationChecklist(status),
    ...buildProductionCriticalFlagPolicy(status),
    ...buildProductionRunbookCloseout(status, auditEvents),
  ].map(item => (
    `- [${item.status}] ${item.label}: ${item.detail}`
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
    'Phase 13.4 verification handoff note',
    `- [${verificationHandoff.status}] ${verificationHandoff.label}: ${verificationHandoff.detail}`,
    '',
    'Phase 13.5 verification handoff packet',
    ...verificationPacketLines,
    '',
    'Phase 13.6 verification decision context',
    ...verificationDecisionLines,
    '',
    'Phase 13.7 local verification timeline',
    ...verificationTimelineLines,
    '',
    'Phase 13.8 pre-rollout smoke checklist',
    ...verificationSmokeLines,
    '',
    'Phase 13.9 copied brief checklist',
    ...verificationBriefLines,
    '',
    'Phase 13.10 verification closeout',
    ...verificationCloseoutLines,
    '',
    'Phase 14 production observability handoff',
    ...observabilityLines,
    '',
    'Phase 15 production operator runbook',
    ...runbookLines,
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

function getObservabilityClassName(status: ProductionObservabilityStatus) {
  if (status === 'blocked') return 'border-[#FF5C7A]/18 bg-[#FF5C7A]/[0.055] text-[#FF8A9E]';
  if (status === 'watch') return 'border-[#F5A524]/18 bg-[#F5A524]/[0.055] text-[#F5A524]';
  return 'border-[#14F195]/14 bg-[#14F195]/[0.045] text-[#14F195]';
}

function getObservabilityIcon(status: ProductionObservabilityStatus) {
  if (status === 'blocked') return XCircle;
  if (status === 'watch') return AlertTriangle;
  return CheckCircle2;
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
  const productionVerificationHandoff = useMemo(() => buildProductionVerificationHandoff(status), [status]);
  const productionVerificationPacket = useMemo(
    () => buildProductionVerificationPacket(status, auditEvents),
    [auditEvents, status],
  );
  const productionVerificationPacketReviewCount = productionVerificationPacket.filter(item => !item.complete).length;
  const productionVerificationDecisionContext = useMemo(() => buildProductionVerificationDecisionContext(status), [status]);
  const productionVerificationDecisionReviewCount = productionVerificationDecisionContext
    .filter(item => item.severity !== 'safe').length;
  const productionVerificationTimeline = useMemo(
    () => buildProductionVerificationTimeline(auditEvents),
    [auditEvents],
  );
  const productionVerificationTimelinePendingCount = productionVerificationTimeline.filter(item => !item.complete).length;
  const productionVerificationSmokeChecklist = useMemo(
    () => buildProductionVerificationSmokeChecklist(status, auditEvents),
    [auditEvents, status],
  );
  const productionVerificationSmokeReviewCount = productionVerificationSmokeChecklist.filter(item => !item.passed).length;
  const productionVerificationBriefChecklist = useMemo(
    () => buildProductionVerificationBriefChecklist(auditEvents),
    [auditEvents],
  );
  const productionVerificationBriefReviewCount = productionVerificationBriefChecklist.filter(item => !item.complete).length;
  const productionVerificationCloseout = useMemo(
    () => buildProductionVerificationCloseout(status, auditEvents),
    [auditEvents, status],
  );
  const productionVerificationCloseoutReviewCount = productionVerificationCloseout.filter(item => !item.complete).length;
  const productionObservabilitySnapshot = useMemo(() => buildProductionObservabilitySnapshot(status), [status]);
  const productionObservabilityMetrics = useMemo(
    () => buildProductionObservabilityMetrics(status, auditEvents),
    [auditEvents, status],
  );
  const productionObservabilityWatchlist = useMemo(() => buildProductionObservabilityWatchlist(status), [status]);
  const productionObservabilityHandoff = useMemo(
    () => buildProductionObservabilityHandoff(status, auditEvents),
    [auditEvents, status],
  );
  const productionObservabilityReviewQueue = useMemo(
    () => buildProductionObservabilityReviewQueue(status, auditEvents),
    [auditEvents, status],
  );
  const productionObservabilityCloseout = useMemo(
    () => buildProductionObservabilityCloseout(status, auditEvents),
    [auditEvents, status],
  );
  const productionObservabilityReviewCount = [
    ...productionObservabilitySnapshot,
    ...productionObservabilityMetrics,
    ...productionObservabilityWatchlist,
    ...productionObservabilityHandoff,
    ...productionObservabilityCloseout,
  ].filter(item => item.status !== 'ready').length;
  const productionObservabilitySections = [
    {
      id: 'snapshot',
      eyebrow: 'Phase 14.1 snapshot',
      title: 'Redacted observability snapshot',
      items: productionObservabilitySnapshot,
    },
    {
      id: 'metrics',
      eyebrow: 'Phase 14.2 metrics',
      title: 'Read-only operation metrics',
      items: productionObservabilityMetrics,
    },
    {
      id: 'watchlist',
      eyebrow: 'Phase 14.3-14.4 watchlist',
      title: 'Audit and critical flag watchlist',
      items: productionObservabilityWatchlist,
    },
    {
      id: 'handoff',
      eyebrow: 'Phase 14.5 handoff evidence',
      title: 'Copied handoff artifacts',
      items: productionObservabilityHandoff,
    },
    {
      id: 'review-queue',
      eyebrow: 'Phase 14.6-14.8 review queue',
      title: 'Human review and escalation context',
      items: productionObservabilityReviewQueue,
    },
    {
      id: 'closeout',
      eyebrow: 'Phase 14.9-14.10 closeout',
      title: 'Copied observability brief boundary',
      items: productionObservabilityCloseout,
    },
  ];
  const productionRunbookSummary = useMemo(
    () => buildProductionRunbookSummary(status, auditEvents),
    [auditEvents, status],
  );
  const productionRolloutChecklist = useMemo(() => buildProductionRolloutChecklist(status), [status]);
  const productionRollbackChecklist = useMemo(() => buildProductionRollbackChecklist(status), [status]);
  const productionIncidentNotes = useMemo(() => buildProductionIncidentNotes(status), [status]);
  const productionSmokeManualChecklist = useMemo(
    () => buildProductionSmokeManualChecklist(status, auditEvents),
    [auditEvents, status],
  );
  const productionProviderCheckContext = useMemo(() => buildProductionProviderCheckContext(status), [status]);
  const productionMigrationChecklist = useMemo(() => buildProductionMigrationChecklist(status), [status]);
  const productionCriticalFlagPolicy = useMemo(() => buildProductionCriticalFlagPolicy(status), [status]);
  const productionRunbookCloseout = useMemo(
    () => buildProductionRunbookCloseout(status, auditEvents),
    [auditEvents, status],
  );
  const productionRunbookReviewCount = [
    ...productionRunbookSummary,
    ...productionRolloutChecklist,
    ...productionRollbackChecklist,
    ...productionIncidentNotes,
    ...productionSmokeManualChecklist,
    ...productionProviderCheckContext,
    ...productionMigrationChecklist,
    ...productionCriticalFlagPolicy,
    ...productionRunbookCloseout,
  ].filter(item => item.status !== 'ready').length;
  const productionRunbookSections = [
    {
      id: 'summary',
      eyebrow: 'Phase 15.1 summary',
      title: 'Operator runbook package',
      items: productionRunbookSummary,
    },
    {
      id: 'rollout',
      eyebrow: 'Phase 15.2 rollout',
      title: 'Safe rollout checklist',
      items: productionRolloutChecklist,
    },
    {
      id: 'rollback',
      eyebrow: 'Phase 15.3 rollback',
      title: 'Rollback checklist',
      items: productionRollbackChecklist,
    },
    {
      id: 'incident',
      eyebrow: 'Phase 15.4 incidents',
      title: 'Incident response notes',
      items: productionIncidentNotes,
    },
    {
      id: 'smoke',
      eyebrow: 'Phase 15.5 smoke',
      title: 'Manual smoke checklist',
      items: productionSmokeManualChecklist,
    },
    {
      id: 'provider',
      eyebrow: 'Phase 15.6 providers',
      title: 'Provider readiness context',
      items: productionProviderCheckContext,
    },
    {
      id: 'migration',
      eyebrow: 'Phase 15.7 database',
      title: 'Migration safety checklist',
      items: productionMigrationChecklist,
    },
    {
      id: 'critical-flags',
      eyebrow: 'Phase 15.8 flags',
      title: 'Critical flag policy',
      items: productionCriticalFlagPolicy,
    },
    {
      id: 'closeout',
      eyebrow: 'Phase 15.9-15.10 closeout',
      title: 'Copied packet and final boundary',
      items: productionRunbookCloseout,
    },
  ];
  const productionIssues = useMemo(() => buildProductionIssueChecklist(status), [status]);
  const requiredIssueCount = productionIssues.filter(item => item.severity === 'required').length;
  const warningIssueCount = productionIssues.filter(item => item.severity === 'warning').length;
  const productionBrief = useMemo(() => buildProductionBrief(status, auditEvents), [auditEvents, status]);
  const productionVerificationDrillReport = useMemo(
    () => buildProductionVerificationDrillReport(status, auditEvents),
    [auditEvents, status],
  );

  function recordAuditEvent(action: ProductionStatusAuditEvent['action'], label: string) {
    setAuditEvents(current => ([
      {
        id: `${action}-${Date.now()}`,
        action,
        label,
        createdAt: new Date().toISOString(),
        health: status.health,
      },
      ...current,
    ].slice(0, MAX_AUDIT_EVENTS)) as ProductionStatusAuditEvent[]);
  }

  useEffect(() => {
    setAuditEvents(current => ([
      {
        id: `status_loaded-${Date.now()}`,
        action: 'status_loaded',
        label: `Status loaded as ${status.health}`,
        createdAt: new Date().toISOString(),
        health: status.health,
      },
      ...current,
    ].slice(0, MAX_AUDIT_EVENTS)) as ProductionStatusAuditEvent[]);
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

          <div className={`rounded-xl border p-2.5 sm:p-3 ${
            productionVerificationHandoff.status === 'blocked'
              ? 'border-[#FF5C7A]/18 bg-[#FF5C7A]/[0.055]'
              : productionVerificationHandoff.status === 'review'
                ? 'border-[#F5A524]/18 bg-[#F5A524]/[0.055]'
                : 'border-[#14F195]/14 bg-[#14F195]/[0.045]'
          }`}>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <p className={`text-xs font-semibold uppercase tracking-[0.14em] ${
                  productionVerificationHandoff.status === 'blocked'
                    ? 'text-[#FF8A9E]'
                    : productionVerificationHandoff.status === 'review'
                      ? 'text-[#F5A524]'
                      : 'text-[#14F195]'
                }`}>Phase 13.4 handoff note</p>
                <p className="mt-1 text-[11px] leading-relaxed text-white/34">Read-only next-step summary for operator handoff.</p>
              </div>
              <span className={`rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] ${
                productionVerificationHandoff.status === 'blocked'
                  ? 'border-[#FF5C7A]/18 bg-[#FF5C7A]/10 text-[#FF8A9E]'
                  : productionVerificationHandoff.status === 'review'
                    ? 'border-[#F5A524]/18 bg-[#F5A524]/10 text-[#F5A524]'
                    : 'border-[#14F195]/18 bg-[#14F195]/10 text-[#14F195]'
              }`}>
                {productionVerificationHandoff.status.replaceAll('_', ' ')}
              </span>
            </div>
            <div className="rounded-xl border border-white/[0.055] bg-black/20 p-2.5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/58">{productionVerificationHandoff.label}</p>
              <p className="mt-1 text-[10px] leading-relaxed text-white/46">{productionVerificationHandoff.detail}</p>
            </div>
          </div>

          <div className="rounded-xl border border-[#9945FF]/14 bg-[#9945FF]/[0.04] p-2.5 sm:p-3">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#C4A2FF]">Phase 13.5 handoff packet</p>
                <p className="mt-1 text-[11px] leading-relaxed text-white/34">Read-only materials included in the verification handoff.</p>
              </div>
              <span className={`rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] ${
                productionVerificationPacketReviewCount > 0
                  ? 'border-[#F5A524]/18 bg-[#F5A524]/10 text-[#F5A524]'
                  : 'border-[#14F195]/18 bg-[#14F195]/10 text-[#14F195]'
              }`}>
                {productionVerificationPacketReviewCount > 0 ? `${productionVerificationPacketReviewCount} review` : 'complete'}
              </span>
            </div>
            <div className="space-y-2">
              {productionVerificationPacket.map(item => {
                const PacketIcon = item.complete ? CheckCircle2 : AlertTriangle;
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
                      <PacketIcon className="h-3.5 w-3.5 shrink-0" />
                      <p className="truncate text-[10px] font-semibold uppercase tracking-[0.12em]">{item.label}</p>
                    </div>
                    <p className="line-clamp-2 text-[10px] leading-relaxed text-white/46 sm:line-clamp-none">{item.detail}</p>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-xl border border-white/[0.06] bg-black/20 p-2.5 sm:p-3">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/52">Phase 13.6 decision context</p>
                <p className="mt-1 text-[11px] leading-relaxed text-white/34">Signals behind the current handoff state.</p>
              </div>
              <span className={`rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] ${
                productionVerificationDecisionReviewCount > 0
                  ? 'border-[#F5A524]/18 bg-[#F5A524]/10 text-[#F5A524]'
                  : 'border-[#14F195]/18 bg-[#14F195]/10 text-[#14F195]'
              }`}>
                {productionVerificationDecisionReviewCount > 0 ? `${productionVerificationDecisionReviewCount} signal` : 'clear'}
              </span>
            </div>
            <div className="space-y-2">
              {productionVerificationDecisionContext.map(item => {
                const DecisionIcon = item.severity === 'safe' ? CheckCircle2 : AlertTriangle;
                return (
                  <div
                    key={item.id}
                    className={`rounded-xl border p-2.5 ${
                      item.severity === 'blocker'
                        ? 'border-[#FF5C7A]/18 bg-[#FF5C7A]/[0.055] text-[#FF8A9E]'
                        : item.severity === 'review'
                          ? 'border-[#F5A524]/18 bg-[#F5A524]/[0.055] text-[#F5A524]'
                          : 'border-[#14F195]/14 bg-[#14F195]/[0.045] text-[#14F195]'
                    }`}
                  >
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <DecisionIcon className="h-3.5 w-3.5 shrink-0" />
                        <p className="truncate text-[10px] font-semibold uppercase tracking-[0.12em]">{item.label}</p>
                      </div>
                      <span className="shrink-0 text-[9px] font-semibold uppercase tracking-[0.1em]">{item.severity}</span>
                    </div>
                    <p className="line-clamp-2 text-[10px] leading-relaxed text-white/46 sm:line-clamp-none">{item.detail}</p>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-xl border border-[#00D1FF]/14 bg-[#00D1FF]/[0.035] p-2.5 sm:p-3">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#7DE3FF]">Phase 13.7 local timeline</p>
                <p className="mt-1 text-[11px] leading-relaxed text-white/34">Browser-local verification activity for this admin handoff.</p>
              </div>
              <span className={`rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] ${
                productionVerificationTimelinePendingCount > 0
                  ? 'border-[#F5A524]/18 bg-[#F5A524]/10 text-[#F5A524]'
                  : 'border-[#14F195]/18 bg-[#14F195]/10 text-[#14F195]'
              }`}>
                {productionVerificationTimelinePendingCount > 0 ? `${productionVerificationTimelinePendingCount} pending` : 'recorded'}
              </span>
            </div>
            <div className="space-y-2">
              {productionVerificationTimeline.map(item => {
                const TimelineIcon = item.complete ? CheckCircle2 : AlertTriangle;
                return (
                  <div
                    key={item.id}
                    className={`rounded-xl border p-2.5 ${
                      item.complete
                        ? 'border-[#14F195]/14 bg-[#14F195]/[0.045] text-[#14F195]'
                        : 'border-[#F5A524]/18 bg-[#F5A524]/[0.055] text-[#F5A524]'
                    }`}
                  >
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <TimelineIcon className="h-3.5 w-3.5 shrink-0" />
                        <p className="truncate text-[10px] font-semibold uppercase tracking-[0.12em]">{item.label}</p>
                      </div>
                      <span className="shrink-0 text-[9px] font-semibold uppercase tracking-[0.1em]">
                        {item.complete ? 'recorded' : 'pending'}
                      </span>
                    </div>
                    <p className="line-clamp-2 text-[10px] leading-relaxed text-white/46 sm:line-clamp-none">{item.detail}</p>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-xl border border-[#14F195]/14 bg-[#14F195]/[0.035] p-2.5 sm:p-3">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#14F195]">Phase 13.8 smoke checklist</p>
                <p className="mt-1 text-[11px] leading-relaxed text-white/34">Read-only pre-rollout checks before operator discussion.</p>
              </div>
              <span className={`rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] ${
                productionVerificationSmokeReviewCount > 0
                  ? 'border-[#F5A524]/18 bg-[#F5A524]/10 text-[#F5A524]'
                  : 'border-[#14F195]/18 bg-[#14F195]/10 text-[#14F195]'
              }`}>
                {productionVerificationSmokeReviewCount > 0 ? `${productionVerificationSmokeReviewCount} review` : 'pass'}
              </span>
            </div>
            <div className="space-y-2">
              {productionVerificationSmokeChecklist.map(item => {
                const SmokeIcon = item.passed ? CheckCircle2 : AlertTriangle;
                return (
                  <div
                    key={item.id}
                    className={`rounded-xl border p-2.5 ${
                      item.passed
                        ? 'border-[#14F195]/14 bg-[#14F195]/[0.045] text-[#14F195]'
                        : 'border-[#F5A524]/18 bg-[#F5A524]/[0.055] text-[#F5A524]'
                    }`}
                  >
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <SmokeIcon className="h-3.5 w-3.5 shrink-0" />
                        <p className="truncate text-[10px] font-semibold uppercase tracking-[0.12em]">{item.label}</p>
                      </div>
                      <span className="shrink-0 text-[9px] font-semibold uppercase tracking-[0.1em]">
                        {item.passed ? 'pass' : 'review'}
                      </span>
                    </div>
                    <p className="line-clamp-2 text-[10px] leading-relaxed text-white/46 sm:line-clamp-none">{item.detail}</p>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-2.5 sm:p-3">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/58">Phase 13.9 copied brief checklist</p>
                <p className="mt-1 text-[11px] leading-relaxed text-white/34">Read-only contents expected in the production brief.</p>
              </div>
              <span className={`rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] ${
                productionVerificationBriefReviewCount > 0
                  ? 'border-[#F5A524]/18 bg-[#F5A524]/10 text-[#F5A524]'
                  : 'border-[#14F195]/18 bg-[#14F195]/10 text-[#14F195]'
              }`}>
                {productionVerificationBriefReviewCount > 0 ? `${productionVerificationBriefReviewCount} review` : 'complete'}
              </span>
            </div>
            <div className="space-y-2">
              {productionVerificationBriefChecklist.map(item => {
                const BriefIcon = item.complete ? CheckCircle2 : AlertTriangle;
                return (
                  <div
                    key={item.id}
                    className={`rounded-xl border p-2.5 ${
                      item.complete
                        ? 'border-[#14F195]/14 bg-[#14F195]/[0.045] text-[#14F195]'
                        : 'border-[#F5A524]/18 bg-[#F5A524]/[0.055] text-[#F5A524]'
                    }`}
                  >
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <BriefIcon className="h-3.5 w-3.5 shrink-0" />
                        <p className="truncate text-[10px] font-semibold uppercase tracking-[0.12em]">{item.label}</p>
                      </div>
                      <span className="shrink-0 text-[9px] font-semibold uppercase tracking-[0.1em]">
                        {item.complete ? 'complete' : 'review'}
                      </span>
                    </div>
                    <p className="line-clamp-2 text-[10px] leading-relaxed text-white/46 sm:line-clamp-none">{item.detail}</p>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-xl border border-[#C4A2FF]/14 bg-[#9945FF]/[0.035] p-2.5 sm:p-3">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#C4A2FF]">Phase 13.10 verification closeout</p>
                <p className="mt-1 text-[11px] leading-relaxed text-white/34">Read-only closeout for the production verification package.</p>
              </div>
              <span className={`rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] ${
                productionVerificationCloseoutReviewCount > 0
                  ? 'border-[#F5A524]/18 bg-[#F5A524]/10 text-[#F5A524]'
                  : 'border-[#14F195]/18 bg-[#14F195]/10 text-[#14F195]'
              }`}>
                {productionVerificationCloseoutReviewCount > 0 ? `${productionVerificationCloseoutReviewCount} review` : 'closed'}
              </span>
            </div>
            <div className="space-y-2">
              {productionVerificationCloseout.map(item => {
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
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <CloseoutIcon className="h-3.5 w-3.5 shrink-0" />
                        <p className="truncate text-[10px] font-semibold uppercase tracking-[0.12em]">{item.label}</p>
                      </div>
                      <span className="shrink-0 text-[9px] font-semibold uppercase tracking-[0.1em]">
                        {item.complete ? 'complete' : 'review'}
                      </span>
                    </div>
                    <p className="line-clamp-2 text-[10px] leading-relaxed text-white/46 sm:line-clamp-none">{item.detail}</p>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-xl border border-[#7DE3FF]/14 bg-[#00D1FF]/[0.03] p-2.5 sm:p-3">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#7DE3FF]">Phase 14 production observability</p>
                <p className="mt-1 text-[11px] leading-relaxed text-white/34">Read-only observability handoff for admin rollout review.</p>
              </div>
              <span className={`rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] ${
                productionObservabilityReviewCount > 0
                  ? 'border-[#F5A524]/18 bg-[#F5A524]/10 text-[#F5A524]'
                  : 'border-[#14F195]/18 bg-[#14F195]/10 text-[#14F195]'
              }`}>
                {productionObservabilityReviewCount > 0 ? `${productionObservabilityReviewCount} watch` : 'clear'}
              </span>
            </div>
            <div className="grid gap-2 lg:grid-cols-2">
              {productionObservabilitySections.map(section => (
                <div key={section.id} className="rounded-xl border border-white/[0.055] bg-black/20 p-2.5">
                  <div className="mb-2 min-w-0">
                    <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-[#7DE3FF]/80">{section.eyebrow}</p>
                    <p className="mt-0.5 truncate text-[11px] font-semibold text-white/64">{section.title}</p>
                  </div>
                  <div className="space-y-2">
                    {section.items.map(item => {
                      const ObservabilityIcon = getObservabilityIcon(item.status);
                      return (
                        <div key={item.id} className={`rounded-xl border p-2.5 ${getObservabilityClassName(item.status)}`}>
                          <div className="mb-1 flex items-center justify-between gap-2">
                            <div className="flex min-w-0 items-center gap-2">
                              <ObservabilityIcon className="h-3.5 w-3.5 shrink-0" />
                              <p className="truncate text-[10px] font-semibold uppercase tracking-[0.12em]">{item.label}</p>
                            </div>
                            <span className="shrink-0 text-[9px] font-semibold uppercase tracking-[0.1em]">{item.status}</span>
                          </div>
                          <p className="line-clamp-2 text-[10px] leading-relaxed text-white/46 sm:line-clamp-none">{item.detail}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-[#14F195]/14 bg-[#14F195]/[0.025] p-2.5 sm:p-3">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#14F195]">Phase 15 production operator runbook</p>
                <p className="mt-1 text-[11px] leading-relaxed text-white/34">Final read-only admin runbook for rollout, rollback, smoke, incidents, providers, database, and critical flags.</p>
              </div>
              <span className={`rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] ${
                productionRunbookReviewCount > 0
                  ? 'border-[#F5A524]/18 bg-[#F5A524]/10 text-[#F5A524]'
                  : 'border-[#14F195]/18 bg-[#14F195]/10 text-[#14F195]'
              }`}>
                {productionRunbookReviewCount > 0 ? `${productionRunbookReviewCount} review` : 'closed'}
              </span>
            </div>
            <div className="grid gap-2 lg:grid-cols-3">
              {productionRunbookSections.map(section => (
                <div key={section.id} className="rounded-xl border border-white/[0.055] bg-black/20 p-2.5">
                  <div className="mb-2 min-w-0">
                    <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-[#14F195]/80">{section.eyebrow}</p>
                    <p className="mt-0.5 truncate text-[11px] font-semibold text-white/64">{section.title}</p>
                  </div>
                  <div className="space-y-2">
                    {section.items.map(item => {
                      const RunbookIcon = getObservabilityIcon(item.status);
                      return (
                        <div key={item.id} className={`rounded-xl border p-2.5 ${getObservabilityClassName(item.status)}`}>
                          <div className="mb-1 flex items-center justify-between gap-2">
                            <div className="flex min-w-0 items-center gap-2">
                              <RunbookIcon className="h-3.5 w-3.5 shrink-0" />
                              <p className="truncate text-[10px] font-semibold uppercase tracking-[0.12em]">{item.label}</p>
                            </div>
                            <span className="shrink-0 text-[9px] font-semibold uppercase tracking-[0.1em]">{item.status}</span>
                          </div>
                          <p className="line-clamp-2 text-[10px] leading-relaxed text-white/46 sm:line-clamp-none">{item.detail}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
