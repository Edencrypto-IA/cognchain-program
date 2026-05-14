'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

export type OrbMode = 'idle' | 'thinking' | 'typing' | 'error' | 'success' | 'listening';

interface OrbProps {
  mode: OrbMode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  interactive?: boolean;
}

const MODE_CONFIG: Record<OrbMode, {
  colors: string[];
  glowColor: string;
  speed: number;
  particleCount: number;
  pulseIntensity: number;
}> = {
  idle: {
    colors: ['#8B5CF6', '#5AD7FF', '#14F195'],
    glowColor: 'rgba(139, 92, 246, 0.3)',
    speed: 0.0034,
    particleCount: 18,
    pulseIntensity: 0.1,
  },
  thinking: {
    colors: ['#8B5CF6', '#5AD7FF', '#14F195', '#C4B5FD'],
    glowColor: 'rgba(90, 215, 255, 0.42)',
    speed: 0.009,
    particleCount: 36,
    pulseIntensity: 0.24,
  },
  typing: {
    colors: ['#14F195', '#5AD7FF', '#A7F3D0'],
    glowColor: 'rgba(20, 241, 149, 0.34)',
    speed: 0.0066,
    particleCount: 30,
    pulseIntensity: 0.16,
  },
  error: {
    colors: ['#FF4458', '#FB7185', '#FFB86B'],
    glowColor: 'rgba(255, 68, 88, 0.34)',
    speed: 0.012,
    particleCount: 28,
    pulseIntensity: 0.24,
  },
  success: {
    colors: ['#14F195', '#A7F3D0', '#5AD7FF'],
    glowColor: 'rgba(20, 241, 149, 0.36)',
    speed: 0.0048,
    particleCount: 24,
    pulseIntensity: 0.14,
  },
  listening: {
    colors: ['#8B5CF6', '#5AD7FF', '#C4B5FD'],
    glowColor: 'rgba(139, 92, 246, 0.4)',
    speed: 0.008,
    particleCount: 34,
    pulseIntensity: 0.24,
  },
};

const SIZE_MAP = {
  sm: { orb: 32, glow: 48, font: 8 },
  md: { orb: 48, glow: 72, font: 10 },
  lg: { orb: 80, glow: 120, font: 14 },
  xl: { orb: 140, glow: 210, font: 18 },
};

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  life: number;
  maxLife: number;
  hue: number;
}

export default function Orb({ mode, size = 'lg', className = '', interactive = true }: OrbProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const particlesRef = useRef<Particle[]>([]);
  const timeRef = useRef(0);
  const [isHovered, setIsHovered] = useState(false);
  const prevModeRef = useRef<OrbMode>(mode);

  const { orb: orbSize, glow: glowSize } = SIZE_MAP[size];
  const config = MODE_CONFIG[mode];

  const createParticle = useCallback((time: number): Particle => {
    const angle = Math.random() * Math.PI * 2;
    const speed = 0.12 + Math.random() * 0.52;
    const dist = (orbSize / 2) * (0.22 + Math.random() * 0.42);
    return {
      x: Math.cos(angle) * dist,
      y: Math.sin(angle) * dist,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      size: 0.75 + Math.random() * 2.1,
      life: time,
      maxLife: 90 + Math.random() * 150,
      hue: Math.random(),
    };
  }, [orbSize]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const canvasSize = glowSize * 2;
    canvas.width = canvasSize * dpr;
    canvas.height = canvasSize * dpr;
    canvas.style.width = `${canvasSize}px`;
    canvas.style.height = `${canvasSize}px`;
    ctx.scale(dpr, dpr);

    const centerX = canvasSize / 2;
    const centerY = canvasSize / 2;
    const radius = orbSize / 2;

    const animate = () => {
      timeRef.current += 1;
      const t = timeRef.current;
      const cfg = MODE_CONFIG[mode];

      // Reset particles on mode change
      if (prevModeRef.current !== mode) {
        particlesRef.current = [];
        prevModeRef.current = mode;
      }

      ctx.clearRect(0, 0, canvasSize, canvasSize);

      // Manage particles
      while (particlesRef.current.length < cfg.particleCount) {
        particlesRef.current.push(createParticle(t));
      }
      particlesRef.current = particlesRef.current.filter(p => (t - p.life) < p.maxLife);

      // Draw outer glow
      const aliveWave = Math.sin(t * cfg.speed * 4.5) * 0.5 + Math.sin(t * cfg.speed * 9.3 + 1.4) * 0.5;
      const pulseScale = 1 + aliveWave * cfg.pulseIntensity;
      const surfaceScale = 1 + aliveWave * cfg.pulseIntensity * 0.42;
      const driftX = Math.sin(t * cfg.speed * 2.1) * radius * 0.025;
      const driftY = Math.cos(t * cfg.speed * 1.7) * radius * 0.025;
      const glowRadius = radius * 2.05 * pulseScale;
      const outerGlow = ctx.createRadialGradient(
        centerX + driftX, centerY + driftY, radius * 0.5,
        centerX + driftX, centerY + driftY, glowRadius
      );
      outerGlow.addColorStop(0, cfg.glowColor);
      outerGlow.addColorStop(0.42, cfg.glowColor.replace(/[\d.]+\)$/, '0.12)'));
      outerGlow.addColorStop(1, 'transparent');
      ctx.fillStyle = outerGlow;
      ctx.fillRect(0, 0, canvasSize, canvasSize);

      // Draw particles (behind the orb)
      particlesRef.current.forEach(p => {
        const age = (t - p.life) / p.maxLife;
        const alpha = Math.sin(age * Math.PI) * (mode === 'idle' ? 0.5 : 0.62);
        const colorIdx = Math.floor(p.hue * (cfg.colors.length - 1));
        const color = cfg.colors[Math.min(colorIdx, cfg.colors.length - 1)];

        ctx.beginPath();
        ctx.arc(
          centerX + p.x,
          centerY + p.y,
          p.size * (1 - age * 0.5),
          0,
          Math.PI * 2
        );
        ctx.fillStyle = withAlpha(color, alpha);
        ctx.fill();

        // Update particle position
        const pullAngle = Math.atan2(-p.y, -p.x);
        const pullForce = mode === 'idle' ? 0.01 : 0.014;
        p.vx += Math.cos(pullAngle) * pullForce;
        p.vy += Math.sin(pullAngle) * pullForce;

        if (mode === 'error') {
          p.vx += (Math.random() - 0.5) * 0.3;
          p.vy += (Math.random() - 0.5) * 0.3;
        }

        p.x += p.vx + Math.sin(t * 0.018 + p.hue * 8) * 0.08;
        p.y += p.vy + Math.cos(t * 0.015 + p.hue * 7) * 0.08;

        // Respawn if too far
        const dist = Math.sqrt(p.x * p.x + p.y * p.y);
        if (dist > radius * 2) {
          Object.assign(p, createParticle(t));
        }
      });

      // Draw main orb sphere
      const gradient = ctx.createRadialGradient(
        centerX - radius * (0.3 + Math.sin(t * cfg.speed * 2) * 0.04),
        centerY - radius * (0.3 + Math.cos(t * cfg.speed * 2.4) * 0.04),
        radius * 0.1,
        centerX,
        centerY,
        radius
      );

      // Animated color cycling
      const colorProgress = (Math.sin(t * cfg.speed * 1.6) + 1) / 2;
      const colorIdx = colorProgress * (cfg.colors.length - 1);
      const c1Idx = Math.floor(colorIdx);
      const c2Idx = Math.min(c1Idx + 1, cfg.colors.length - 1);
      const blend = colorIdx - c1Idx;

      gradient.addColorStop(0, 'rgba(255,255,255,0.96)');
      gradient.addColorStop(0.12, blendColor(cfg.colors[c1Idx], '#F8FAFF', 0.42));
      gradient.addColorStop(0.42, blendColor(cfg.colors[c1Idx], cfg.colors[c2Idx], blend * 0.55));
      gradient.addColorStop(0.74, blendColor(cfg.colors[c2Idx], cfg.colors[Math.min(c2Idx + 1, cfg.colors.length - 1)], blend * 0.5));
      gradient.addColorStop(1, blendColor('#14111F', cfg.colors[c2Idx], 0.42));

      ctx.beginPath();
      ctx.arc(centerX, centerY, radius * surfaceScale, 0, Math.PI * 2);
      ctx.fillStyle = gradient;
      ctx.fill();

      // Living core glow.
      ctx.save();
      const coreAngle = t * cfg.speed * 1.8;
      const coreX = centerX + Math.cos(coreAngle) * radius * 0.12;
      const coreY = centerY + Math.sin(coreAngle * 0.8) * radius * 0.1;
      const core = ctx.createRadialGradient(coreX, coreY, 0, coreX, coreY, radius * 0.55);
      core.addColorStop(0, 'rgba(255,255,255,0.32)');
      core.addColorStop(0.32, withAlpha(cfg.colors[(c1Idx + 1) % cfg.colors.length], 0.2));
      core.addColorStop(1, 'transparent');
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius * surfaceScale, 0, Math.PI * 2);
      ctx.fillStyle = core;
      ctx.fill();
      ctx.restore();

      // Glass edge and subtle inner shadow.
      ctx.save();
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius * surfaceScale, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255,255,255,0.18)';
      ctx.lineWidth = Math.max(0.8, radius * 0.018);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius * surfaceScale * 0.94, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(2,6,23,0.16)';
      ctx.lineWidth = Math.max(1, radius * 0.026);
      ctx.stroke();
      ctx.restore();

      // Inner neural network lines
      ctx.save();
      ctx.globalAlpha = 0.1 + Math.sin(t * cfg.speed * 5) * 0.06;
      const nodeCount = mode === 'thinking' ? 10 : 7;
      const nodes: { x: number; y: number }[] = [];
      for (let i = 0; i < nodeCount; i++) {
        const angle = (i / nodeCount) * Math.PI * 2 + t * cfg.speed * (mode === 'idle' ? 3.2 : 4.4);
        const dist = radius * 0.42 * (0.55 + Math.sin(t * cfg.speed * 4 + i) * 0.28);
        nodes.push({
          x: centerX + Math.cos(angle) * dist,
          y: centerY + Math.sin(angle) * dist,
        });
      }

      ctx.strokeStyle = cfg.colors[0];
      ctx.lineWidth = mode === 'idle' ? 0.5 : 0.65;
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const d = Math.sqrt(
            (nodes[i].x - nodes[j].x) ** 2 + (nodes[i].y - nodes[j].y) ** 2
          );
          if (d < radius * 0.8) {
            ctx.beginPath();
            ctx.moveTo(nodes[i].x, nodes[i].y);
            ctx.lineTo(nodes[j].x, nodes[j].y);
            ctx.globalAlpha = (1 - d / (radius * 0.8)) * (mode === 'idle' ? 0.18 : 0.26);
            ctx.stroke();
          }
        }
      }

      // Draw nodes
      nodes.forEach((node, i) => {
        ctx.beginPath();
        const nodeSize = 1.1 + Math.sin(t * cfg.speed * 6 + i) * 0.65;
        ctx.arc(node.x, node.y, nodeSize, 0, Math.PI * 2);
        ctx.fillStyle = cfg.colors[i % cfg.colors.length];
        ctx.globalAlpha = 0.5 + Math.sin(t * cfg.speed * 6 + i) * 0.28;
        ctx.fill();
      });
      ctx.restore();

      // Specular highlight
      ctx.save();
      const specGrad = ctx.createRadialGradient(
        centerX - radius * (0.32 + Math.sin(t * cfg.speed * 2.2) * 0.05),
        centerY - radius * (0.32 + Math.cos(t * cfg.speed * 2) * 0.04),
        0,
        centerX - radius * (0.32 + Math.sin(t * cfg.speed * 2.2) * 0.05),
        centerY - radius * (0.32 + Math.cos(t * cfg.speed * 2) * 0.04),
        radius * 0.46
      );
      specGrad.addColorStop(0, 'rgba(255, 255, 255, 0.62)');
      specGrad.addColorStop(0.35, 'rgba(255, 255, 255, 0.12)');
      specGrad.addColorStop(1, 'transparent');
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius * surfaceScale, 0, Math.PI * 2);
      ctx.fillStyle = specGrad;
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(
        centerX - radius * 0.18 + Math.sin(t * cfg.speed * 3) * radius * 0.04,
        centerY - radius * 0.35 + Math.cos(t * cfg.speed * 2.7) * radius * 0.035,
        radius * 0.2,
        radius * 0.08,
        -0.45,
        0,
        Math.PI * 2
      );
      ctx.fillStyle = 'rgba(255,255,255,0.32)';
      ctx.fill();
      ctx.restore();

      // Error glitch effect
      if (mode === 'error') {
        if (Math.random() > 0.92) {
          ctx.save();
          ctx.globalAlpha = 0.3;
          ctx.fillStyle = '#FF4458';
          const glitchY = centerY + (Math.random() - 0.5) * radius;
          ctx.fillRect(centerX - radius, glitchY, radius * 2, 2 + Math.random() * 4);
          ctx.restore();
        }
      }

      // Thinking speed rings
      if (mode === 'thinking') {
        ctx.save();
        for (let i = 0; i < 3; i++) {
          const ringPhase = (t * cfg.speed * 3 + i * 2) % (Math.PI * 2);
          const ringAlpha = Math.sin(ringPhase) * 0.16;
          const ringRadius = radius * (1.1 + i * 0.2) + Math.sin(ringPhase) * 5;
          ctx.beginPath();
          ctx.arc(centerX, centerY, ringRadius, 0, Math.PI * 2);
          ctx.strokeStyle = withAlpha(cfg.colors[i % cfg.colors.length], Math.abs(ringAlpha));
          ctx.lineWidth = 1;
          ctx.stroke();
        }
        ctx.restore();
      }

      // Typing wave effect
      if (mode === 'typing') {
        ctx.save();
        for (let i = 0; i < 4; i++) {
          const wave = (t * 0.08 + i * 1.2) % (Math.PI * 2);
          const waveRadius = radius * (1.05 + i * 0.12) + Math.sin(wave * 2) * 3;
          ctx.beginPath();
          ctx.arc(centerX, centerY, waveRadius, wave, wave + Math.PI * 0.5);
          ctx.strokeStyle = `rgba(20, 241, 149, ${0.2 - i * 0.04})`;
          ctx.lineWidth = 1.25;
          ctx.stroke();
        }
        ctx.restore();
      }

      // Listening pulse rings
      if (mode === 'listening') {
        ctx.save();
        const pulseWave = (t * 0.06) % (Math.PI * 2);
        const pulseR = radius * (1.2 + Math.sin(pulseWave) * 0.3);
        ctx.beginPath();
        ctx.arc(centerX, centerY, pulseR, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(153, 69, 255, ${0.3 - Math.sin(pulseWave) * 0.2})`;
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.restore();
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      cancelAnimationFrame(animationRef.current);
    };
  }, [mode, orbSize, glowSize, createParticle]);

  return (
    <div
      className={`relative flex items-center justify-center ${className}`}
      onMouseEnter={() => interactive && setIsHovered(true)}
      onMouseLeave={() => interactive && setIsHovered(false)}
    >
      <canvas
        ref={canvasRef}
        className="cursor-pointer"
        style={{
          width: glowSize * 2,
          height: glowSize * 2,
        }}
      />
      {isHovered && size !== 'sm' && (
        <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap">
          <span className="text-[10px] font-medium text-white/50 uppercase tracking-wider">
            {mode === 'idle' && 'Pronto'}
            {mode === 'thinking' && 'Pensando...'}
            {mode === 'typing' && 'Digitando...'}
            {mode === 'error' && 'Erro'}
            {mode === 'success' && 'Sucesso'}
            {mode === 'listening' && 'Ouvindo...'}
          </span>
        </div>
      )}
    </div>
  );
}

function withAlpha(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, alpha)).toFixed(3)})`;
}

function blendColor(c1: string, c2: string, t: number): string {
  const r1 = parseInt(c1.slice(1, 3), 16);
  const g1 = parseInt(c1.slice(3, 5), 16);
  const b1 = parseInt(c1.slice(5, 7), 16);
  const r2 = parseInt(c2.slice(1, 3), 16);
  const g2 = parseInt(c2.slice(3, 5), 16);
  const b2 = parseInt(c2.slice(5, 7), 16);

  const r = Math.round(r1 + (r2 - r1) * t);
  const g = Math.round(g1 + (g2 - g1) * t);
  const b = Math.round(b1 + (b2 - b1) * t);

  return `rgb(${r}, ${g}, ${b})`;
}
