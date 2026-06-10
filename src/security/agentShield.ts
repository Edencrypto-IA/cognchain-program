export type SecuritySeverity = 'low' | 'medium' | 'high';

export type SecurityRuleId =
  | 'prompt_injection'
  | 'sensitive_data_exposure'
  | 'unsanitized_shell_command'
  | 'infinite_loop_pattern'
  | 'unauthorized_route_access';

export type SecurityFinding = {
  ruleId: SecurityRuleId;
  severity: SecuritySeverity;
  title: string;
  evidence: string;
  recommendation: string;
};

export type SecurityReport = {
  ok: boolean;
  mode: 'warn-only';
  findings: SecurityFinding[];
  scannedAt: string;
};

type StaticRule = {
  id: SecurityRuleId;
  severity: SecuritySeverity;
  title: string;
  patterns: RegExp[];
  recommendation: string;
};

const MAX_EVIDENCE_LENGTH = 160;

const STATIC_RULES: StaticRule[] = [
  {
    id: 'prompt_injection',
    severity: 'high',
    title: 'Possible prompt injection',
    patterns: [
      /ignore (all )?(previous|prior|above) instructions/i,
      /disregard (all )?(previous|prior|above) instructions/i,
      /system prompt/i,
      /developer message/i,
      /reveal (your|the) hidden/i,
      /jailbreak/i,
    ],
    recommendation: 'Keep system/developer instructions private and route through constrained tools only.',
  },
  {
    id: 'sensitive_data_exposure',
    severity: 'high',
    title: 'Possible sensitive data exposure',
    patterns: [
      /\b(seed phrase|mnemonic|private key|secret key|api[_ -]?key|access token|refresh token)\b/i,
      /\b[A-Za-z0-9_-]{32,}\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}\b/,
      /\b(?:sk|pk|api|secret|token)_(?:live|test|prod)?_[A-Za-z0-9]{16,}\b/i,
    ],
    recommendation: 'Mask secrets and refuse to store wallet seeds, private keys, tokens, or credentials.',
  },
  {
    id: 'unsanitized_shell_command',
    severity: 'medium',
    title: 'Possible unsanitized shell command',
    patterns: [
      /\b(rm\s+-rf|del\s+\/[fsq]|format\s+[a-z]:|powershell\s+-enc|curl\s+.+\|\s*(sh|bash|powershell))\b/i,
      /[`$]\([^)]{3,}\)/,
      /\b(eval|exec|spawn|child_process)\s*\(/i,
    ],
    recommendation: 'Require explicit review before shell execution and avoid interpolating user input into commands.',
  },
  {
    id: 'infinite_loop_pattern',
    severity: 'medium',
    title: 'Possible infinite loop pattern',
    patterns: [
      /\bwhile\s*\(\s*true\s*\)/i,
      /\bfor\s*\(\s*;\s*;\s*\)/i,
      /\bsetInterval\s*\([^,]+,\s*0\s*\)/i,
      /\brecursive\s+loop\b/i,
    ],
    recommendation: 'Require timeouts, iteration caps, cancellation, and bounded retries.',
  },
  {
    id: 'unauthorized_route_access',
    severity: 'medium',
    title: 'Possible unauthorized route access',
    patterns: [
      /\/api\/(?:admin|keys|auth|wallet\/sign|wallet-agent\/jupiter|blockchain\/store)\b/i,
      /\b(admin dashboard|bypass auth|disable auth|role escalation)\b/i,
    ],
    recommendation: 'Keep protected routes behind authentication, rate limits, and explicit human approval.',
  },
];

function compactEvidence(input: string, pattern: RegExp): string {
  const match = input.match(pattern);
  const value = match?.[0] || input.slice(0, MAX_EVIDENCE_LENGTH);
  return value.replace(/\s+/g, ' ').slice(0, MAX_EVIDENCE_LENGTH);
}

export function scanPrompt(input: string): SecurityReport {
  const findings = STATIC_RULES.flatMap<SecurityFinding>(rule => {
    const matchedPattern = rule.patterns.find(pattern => pattern.test(input));
    if (!matchedPattern) return [];
    return [{
      ruleId: rule.id,
      severity: rule.severity,
      title: rule.title,
      evidence: compactEvidence(input, matchedPattern),
      recommendation: rule.recommendation,
    }];
  });

  return {
    ok: findings.length === 0,
    mode: 'warn-only',
    findings,
    scannedAt: new Date().toISOString(),
  };
}

export function logAgentShieldReport(context: string, report: SecurityReport): void {
  if (report.ok) return;
  console.warn('[AgentShield] warn-only findings', {
    context,
    scannedAt: report.scannedAt,
    findings: report.findings,
  });
}
