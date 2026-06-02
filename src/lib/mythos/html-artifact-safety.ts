export type MythosHtmlViolationSeverity = 'block' | 'warn' | 'info';

export type MythosHtmlSafetyViolation = {
  rule: string;
  severity: MythosHtmlViolationSeverity;
  description: string;
  matchedPattern?: string;
};

export type MythosHtmlSafetyResult = {
  safe: boolean;
  riskScore: number;
  violations: MythosHtmlSafetyViolation[];
  blockers: MythosHtmlSafetyViolation[];
  warnings: MythosHtmlSafetyViolation[];
};

type SafetyRule = {
  id: string;
  severity: MythosHtmlViolationSeverity;
  description: string;
  patterns: RegExp[];
};

// These rules are lightweight risk heuristics, not a complete HTML parser.
// Final rendering still relies on a strict sandbox, no scripts, no dependencies,
// and server-side validation before the artifact reaches the iframe preview.
const MYTHOS_HTML_SAFETY_RULES: SafetyRule[] = [
  {
    id: 'external-script',
    severity: 'block',
    description: 'External script tag detected.',
    patterns: [/<script[^>]+src\s*=\s*["'][^"']*["']/gi],
  },
  {
    id: 'inline-script',
    severity: 'block',
    description: 'Inline script block detected.',
    patterns: [/<script(?![^>]*src)[^>]*>[\s\S]*?<\/script>/gi],
  },
  {
    id: 'dynamic-code-execution',
    severity: 'block',
    description: 'eval() or Function() dynamic code execution detected.',
    patterns: [/\beval\s*\(/gi, /\bnew\s+Function\s*\(/gi, /\bFunction\s*\(/gi],
  },
  {
    id: 'external-stylesheet',
    severity: 'block',
    description: 'External stylesheet or font import detected.',
    patterns: [
      /<link[^>]+rel\s*=\s*["']stylesheet["'][^>]*>/gi,
      /@import\s+url\s*\(/gi,
      /@import\s+["'][^"']+["']/gi,
    ],
  },
  {
    id: 'external-iframe',
    severity: 'block',
    description: 'External iframe detected.',
    patterns: [/<iframe[^>]+src\s*=\s*["']https?:\/\/[^"']+["']/gi],
  },
  {
    id: 'wallet-connect',
    severity: 'block',
    description: 'Wallet or browser-chain API reference detected.',
    patterns: [
      /window\.solana/gi,
      /window\.ethereum/gi,
      /@solana\/wallet-adapter/gi,
      /WalletMultiButton/gi,
      /connectWallet\s*\(/gi,
      /requestAccounts/gi,
      />\s*(connect\s+wallet|connect\s+phantom|connect\s+solflare|claim\s+airdrop)\s*</gi,
    ],
  },
  {
    id: 'wallet-phishing-copy',
    severity: 'block',
    description: 'Wallet phishing or fake connect-wallet language detected.',
    patterns: [
      /\b(connect\s+(your\s+)?wallet\s+to\s+(claim|unlock|verify|receive))/gi,
      /\b(phantom|solflare)\s+(login|password|seed|phrase|private\s+key)/gi,
      /\b(claim|unlock|verify)\s+(airdrop|reward|allocation)\b/gi,
    ],
  },
  {
    id: 'sensitive-form-fields',
    severity: 'block',
    description: 'Sensitive form field detected.',
    patterns: [
      /name\s*=\s*["'][^"']*(seed|mnemonic|private|secret|api[_-]?key|signed)[^"']*["']/gi,
      /placeholder\s*=\s*["'][^"']*(seed phrase|private key|secret key|mnemonic|api key)[^"']*["']/gi,
      /type\s*=\s*["']password["']/gi,
      /\b(seed phrase|private key|secret key|mnemonic phrase|recovery phrase)\b/gi,
    ],
  },
  {
    id: 'hidden-input',
    severity: 'block',
    description: 'Hidden input detected.',
    patterns: [/<input[^>]+type\s*=\s*["']hidden["'][^>]*\/?>/gi],
  },
  {
    id: 'auto-submit',
    severity: 'block',
    description: 'Auto-submit pattern detected.',
    patterns: [
      /document\.forms\[[^\]]+\]\.submit\s*\(/gi,
      /\.submit\s*\(\s*\)\s*;?/gi,
      /window\.onload\s*=[\s\S]{0,120}\.submit/gi,
    ],
  },
  {
    id: 'auto-redirect',
    severity: 'block',
    description: 'Auto redirect pattern detected.',
    patterns: [
      /window\.location\s*=/gi,
      /location\.href\s*=/gi,
      /location\.replace\s*\(/gi,
      /<meta[^>]+http-equiv\s*=\s*["']refresh["'][^>]*>/gi,
    ],
  },
  {
    id: 'clipboard-write',
    severity: 'block',
    description: 'Clipboard write detected.',
    patterns: [
      /navigator\.clipboard\.writeText\s*\(/gi,
      /document\.execCommand\s*\(\s*['"]copy['"]/gi,
    ],
  },
  {
    id: 'storage-sensitive',
    severity: 'block',
    description: 'Sensitive localStorage/sessionStorage write detected.',
    patterns: [
      /localStorage\.setItem\s*\(\s*["'][^"']*(key|secret|seed|token|private|mnemonic|api|signed)[^"']*["']/gi,
      /sessionStorage\.setItem\s*\(\s*["'][^"']*(key|secret|seed|token|private|mnemonic|api|signed)[^"']*["']/gi,
    ],
  },
  {
    id: 'javascript-protocol',
    severity: 'block',
    description: 'javascript: href detected.',
    patterns: [/href\s*=\s*["']javascript:/gi],
  },
  {
    id: 'external-network',
    severity: 'warn',
    description: 'External network request detected.',
    patterns: [
      /fetch\s*\(\s*["']https?:\/\//gi,
      /XMLHttpRequest/gi,
      /navigator\.sendBeacon/gi,
    ],
  },
  {
    id: 'hidden-overlay',
    severity: 'block',
    description: 'Hidden full-screen overlay or click hijacking pattern detected.',
    patterns: [
      /position\s*:\s*fixed[\s\S]{0,160}opacity\s*:\s*0/gi,
      /opacity\s*:\s*0[\s\S]{0,160}position\s*:\s*fixed/gi,
      /pointer-events\s*:\s*auto[\s\S]{0,160}z-index\s*:\s*999/gi,
    ],
  },
  {
    id: 'financial-claim',
    severity: 'warn',
    description: 'Potential financial guarantee language detected.',
    patterns: [
      /\b(guaranteed\s+return|guaranteed\s+profit|risk[-\s]?free\s+profit|100x\s+guaranteed|moon\s+guaranteed)\b/gi,
    ],
  },
  {
    id: 'external-image',
    severity: 'info',
    description: 'External image URL detected.',
    patterns: [/<img[^>]+src\s*=\s*["']https?:\/\/[^"']+["']/gi],
  },
];

export function checkMythosHtmlSafety(html: string): MythosHtmlSafetyResult {
  const violations: MythosHtmlSafetyViolation[] = [];

  for (const rule of MYTHOS_HTML_SAFETY_RULES) {
    for (const pattern of rule.patterns) {
      const match = html.match(pattern);
      if (match) {
        violations.push({
          rule: rule.id,
          severity: rule.severity,
          description: rule.description,
          matchedPattern: match[0]?.slice(0, 120),
        });
        break;
      }
    }
  }

  const blockers = violations.filter(item => item.severity === 'block');
  const warnings = violations.filter(item => item.severity === 'warn');
  const riskScore = Math.min(100, violations.reduce((sum, item) => {
    if (item.severity === 'block') return sum + 35;
    if (item.severity === 'warn') return sum + 12;
    return sum + 3;
  }, 0));
  return {
    safe: blockers.length === 0,
    riskScore,
    violations,
    blockers,
    warnings,
  };
}

export function sanitizeMythosHtml(html: string): { html: string; removals: string[] } {
  let sanitized = html;
  const removals: string[] = [];
  const replacements: Array<{ id: string; pattern: RegExp; replacement: string }> = [
    {
      id: 'external-script',
      pattern: /<script[^>]+src\s*=\s*["'][^"']*["'][^>]*>[\s\S]*?<\/script>/gi,
      replacement: '<!-- MYTHOS SAFETY: external script removed -->',
    },
    {
      id: 'inline-script',
      pattern: /<script(?![^>]*src)[^>]*>[\s\S]*?<\/script>/gi,
      replacement: '<!-- MYTHOS SAFETY: inline script removed -->',
    },
    {
      id: 'external-stylesheet',
      pattern: /<link[^>]+rel\s*=\s*["']stylesheet["'][^>]*>/gi,
      replacement: '<!-- MYTHOS SAFETY: external stylesheet removed -->',
    },
    {
      id: 'css-import',
      pattern: /@import[^;]+;/gi,
      replacement: '/* MYTHOS SAFETY: external CSS import removed */',
    },
    {
      id: 'external-iframe',
      pattern: /<iframe[^>]+src\s*=\s*["']https?:\/\/[^"']+["'][^>]*>[\s\S]*?<\/iframe>/gi,
      replacement: '<!-- MYTHOS SAFETY: external iframe removed -->',
    },
    {
      id: 'wallet-solana',
      pattern: /window\.solana[^;]*;?/gi,
      replacement: '/* MYTHOS SAFETY: wallet API removed */',
    },
    {
      id: 'wallet-ethereum',
      pattern: /window\.ethereum[^;]*;?/gi,
      replacement: '/* MYTHOS SAFETY: wallet API removed */',
    },
    {
      id: 'hidden-input',
      pattern: /<input[^>]+type\s*=\s*["']hidden["'][^>]*\/?>/gi,
      replacement: '<!-- MYTHOS SAFETY: hidden input removed -->',
    },
    {
      id: 'password-input',
      pattern: /<input[^>]+type\s*=\s*["']password["'][^>]*\/?>/gi,
      replacement: '<!-- MYTHOS SAFETY: sensitive input removed -->',
    },
    {
      id: 'clipboard-write',
      pattern: /navigator\.clipboard\.writeText\s*\([^)]*\)\s*;?/gi,
      replacement: '/* MYTHOS SAFETY: clipboard write removed */',
    },
    {
      id: 'auto-submit',
      pattern: /\.submit\s*\(\s*\)\s*;?/gi,
      replacement: '/* MYTHOS SAFETY: auto-submit removed */',
    },
    {
      id: 'auto-redirect',
      pattern: /(window\.location\s*=|location\.href\s*=|location\.replace\s*\()[^;]+;?/gi,
      replacement: '/* MYTHOS SAFETY: redirect removed */',
    },
    {
      id: 'javascript-protocol',
      pattern: /href\s*=\s*["']javascript:[^"']*["']/gi,
      replacement: 'href="#"',
    },
    {
      id: 'sensitive-storage',
      pattern: /(localStorage|sessionStorage)\.setItem\s*\(\s*["'][^"']*(key|secret|seed|token|private|mnemonic|api|signed)[^;]+;?/gi,
      replacement: '/* MYTHOS SAFETY: sensitive storage write removed */',
    },
  ];

  for (const replacement of replacements) {
    const before = sanitized;
    sanitized = sanitized.replace(replacement.pattern, replacement.replacement);
    if (sanitized !== before) removals.push(replacement.id);
  }

  return { html: sanitized, removals };
}

export function extractMythosArtifactHtml(response: string): { title: string; html: string; text: string } {
  const artifact = response.match(/<artifact\s+type=["']html["'](?:\s+title=["']([^"']*)["'])?\s*>([\s\S]*?)<\/artifact>/i);
  if (artifact) {
    return {
      title: artifact[1]?.trim() || 'Mythos Artifact',
      html: artifact[2]?.trim() || '',
      text: response.replace(artifact[0], '').trim(),
    };
  }

  const fenced = response.match(/```html\s*([\s\S]*?)```/i);
  if (fenced?.[1]?.trim()) {
    return {
      title: 'Mythos HTML Preview',
      html: fenced[1].trim(),
      text: response.replace(fenced[0], '').trim(),
    };
  }

  const rawHtml = response.match(/(<!doctype\s+html[\s\S]*|<html[\s\S]*<\/html>|<(?:main|section|div)\b[\s\S]*<\/(?:main|section|div)>)/i);
  if (rawHtml?.[1]?.trim()) {
    return {
      title: 'Mythos HTML Preview',
      html: rawHtml[1].trim(),
      text: response.replace(rawHtml[1], '').trim(),
    };
  }

  return {
    title: 'Mythos Artifact',
    html: '',
    text: response.trim(),
  };
}

export const MYTHOS_HTML_SAFETY_CHECKLIST = MYTHOS_HTML_SAFETY_RULES.map(rule => ({
  id: rule.id,
  severity: rule.severity,
  check: rule.description,
}));

export type SafetyViolation = MythosHtmlSafetyViolation;
export type SafetyCheckResult = MythosHtmlSafetyResult;

export const BLOCKED_PATTERNS = MYTHOS_HTML_SAFETY_RULES
  .filter(rule => rule.severity === 'block')
  .flatMap(rule => rule.patterns);

export const SUSPICIOUS_PATTERNS = MYTHOS_HTML_SAFETY_RULES
  .filter(rule => rule.severity !== 'block')
  .flatMap(rule => rule.patterns);

export function detectUnsafeHtml(html: string) {
  return checkMythosHtmlSafety(html);
}

export function validateHtmlArtifact(html: string) {
  return checkMythosHtmlSafety(html);
}

export function sanitizeHtmlArtifact(html: string) {
  return sanitizeMythosHtml(html);
}

export function generateSafetyReport(html: string) {
  const result = checkMythosHtmlSafety(html);
  return {
    safe: result.safe,
    riskScore: result.riskScore,
    blockers: result.blockers.map(item => item.rule),
    warnings: result.warnings.map(item => item.rule),
    violations: result.violations,
  };
}
