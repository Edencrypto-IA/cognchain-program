export const MYTHOS_DESIGN_TOKENS = {
  colors: {
    black: '#000000',
    matte: '#050705',
    graphite: '#101410',
    graphiteSoft: '#171d18',
    neonGreen: '#76ff03',
    neonGreenSoft: '#a7ff3d',
    cyan: '#7de4ff',
    cyanSoft: '#9aeaff',
    white: '#f7fff2',
    muted: '#89958a',
    warning: '#ffd166',
    danger: '#ff5c7a',
  },
  spacing: {
    xs: '0.5rem',
    sm: '0.75rem',
    md: '1rem',
    lg: '1.5rem',
    xl: '2rem',
    xxl: '3rem',
    section: 'clamp(3rem, 7vw, 6rem)',
  },
  typography: {
    display: 'clamp(2.75rem, 8vw, 6.8rem)',
    title: 'clamp(1.8rem, 4vw, 3.4rem)',
    subtitle: 'clamp(1rem, 2vw, 1.28rem)',
    body: '1rem',
    small: '0.875rem',
    micro: '0.72rem',
    lineHeightTight: '1.05',
    lineHeightBody: '1.65',
  },
  radius: {
    sm: '10px',
    md: '16px',
    lg: '22px',
    xl: '28px',
  },
  borders: {
    subtle: '1px solid rgba(255,255,255,0.09)',
    green: '1px solid rgba(118,255,3,0.22)',
    cyan: '1px solid rgba(125,228,255,0.2)',
    warning: '1px solid rgba(255,209,102,0.22)',
  },
  glows: {
    green: '0 0 42px rgba(118,255,3,0.14)',
    cyan: '0 0 42px rgba(125,228,255,0.12)',
    panel: '0 28px 90px rgba(0,0,0,0.58)',
    restrained: '0 16px 48px rgba(0,0,0,0.34)',
  },
  cards: {
    glass: 'border:1px solid rgba(255,255,255,0.09); background:linear-gradient(180deg,rgba(255,255,255,0.055),rgba(255,255,255,0.025)); border-radius:22px;',
    terminal: 'border:1px solid rgba(118,255,3,0.18); background:rgba(5,12,5,0.82); border-radius:22px;',
    cyan: 'border:1px solid rgba(125,228,255,0.18); background:rgba(125,228,255,0.055); border-radius:22px;',
  },
  buttons: {
    primary: 'border:1px solid rgba(118,255,3,0.32); background:rgba(118,255,3,0.14); color:#a7ff3d;',
    secondary: 'border:1px solid rgba(255,255,255,0.12); background:rgba(255,255,255,0.045); color:#f7fff2;',
    cyan: 'border:1px solid rgba(125,228,255,0.26); background:rgba(125,228,255,0.1); color:#9aeaff;',
  },
  terminalPalette: {
    background: 'radial-gradient(circle at 20% 0%, rgba(118,255,3,0.11), transparent 30%), #000',
    grid: 'linear-gradient(rgba(118,255,3,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(118,255,3,0.035) 1px, transparent 1px)',
    gridSize: '64px 64px',
  },
} as const;

export const MYTHOS_PREMIUM_CSS_GUIDE = `
:root {
  --bg: ${MYTHOS_DESIGN_TOKENS.colors.black};
  --surface: ${MYTHOS_DESIGN_TOKENS.colors.graphite};
  --green: ${MYTHOS_DESIGN_TOKENS.colors.neonGreen};
  --green-soft: ${MYTHOS_DESIGN_TOKENS.colors.neonGreenSoft};
  --cyan: ${MYTHOS_DESIGN_TOKENS.colors.cyan};
  --text: ${MYTHOS_DESIGN_TOKENS.colors.white};
  --muted: ${MYTHOS_DESIGN_TOKENS.colors.muted};
  --radius: ${MYTHOS_DESIGN_TOKENS.radius.lg};
  --section: ${MYTHOS_DESIGN_TOKENS.spacing.section};
}
* { box-sizing: border-box; }
html { background: var(--bg); color: var(--text); }
body { margin: 0; min-width: 0; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
img, svg { max-width: 100%; }
a, button { min-height: 44px; }
section { padding: var(--section) clamp(1rem, 4vw, 4rem); }
.shell { width: min(1180px, 100%); margin: 0 auto; }
.grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(240px, 100%), 1fr)); gap: clamp(0.9rem, 2vw, 1.4rem); }
@media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation: none !important; transition: none !important; } }
`.trim();

export type MythosDesignTokens = typeof MYTHOS_DESIGN_TOKENS;
