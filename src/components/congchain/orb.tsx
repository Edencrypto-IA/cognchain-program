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
    colors: ['#9945FF', '#14F195', '#9945FF'],
    glowColor: 'rgba(153, 69, 255, 0.4)',
    speed: 0.003,
    particleCount: 20,
    pulseIntensity: 0.15,
  },
  thinking: {
    colors: ['#9945FF', '#00D1FF', '#14F195', '#9945FF'],
    glowColor: 'rgba(0, 209, 255, 0.5)',
    speed: 0.01,
    particleCount: 40,
    pulseIntensity: 0.3,
  },
  typing: {
    colors: ['#14F195', '#00D1FF', '#14F195'],
    glowColor: 'rgba(20, 241, 149, 0.4)',
    speed: 0.006,
    particleCount: 30,
    pulseIntensity: 0.2,
  },
  error: {
    colors: ['#FF4458', '#FF6B35', '#FF4458'],
    glowColor: 'rgba(255, 68, 88, 0.5)',
    speed: 0.015,
    particleCount: 35,
    pulseIntensity: 0.4,
  },
  success: {
    colors: ['#14F195', '#00FF88', '#14F195'],
    glowColor: 'rgba(20, 241, 149, 0.5)',
    speed: 0.004,
    particleCount: 25,
    pulseIntensity: 0.2,
  },
  listening: {
    colors: ['#9945FF', '#00D1FF', '#9945FF'],
    glowColor: 'rgba(153, 69, 255, 0.5)',
    speed: 0.008,
    particleCount: 35,
    pulseIntensity: 0.35,
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
    const speed = 0.2 + Math.random() * 0.8;
    const dist = (orbSize / 2) * (0.3 + Math.random() * 0.3);
    return {
      x: Math.cos(angle) * dist,
      y: Math.sin(angle) * dist,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      size: 1 + Math.random() * 2.5,
      life: time,
      maxLife: 60 + Math.random() * 120,
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
      const pulseScale = 1 + Math.sin(t * cfg.speed * 10) * cfg.pulseIntensity;
      const glowRadius = radius * 1.8 * pulseScale;
      const outerGlow = ctx.createRadialGradient(
        centerX, centerY, radius * 0.5,
        centerX, centerY, glowRadius
      );
      outerGlow.addColorStop(0, cfg.glowColor);
      outerGlow.addColorStop(0.5, cfg.glowColor.replace(/[\d.]+\)$/, '0.15)'));
      outerGlow.addColorStop(1, 'transparent');
      ctx.fillStyle = outerGlow;
      ctx.fillRect(0, 0, canvasSize, canvasSize);

      // Draw particles (behind the orb)
      particlesRef.current.forEach(p => {
        const age = (t - p.life) / p.maxLife;
        const alpha = Math.sin(age * Math.PI) * 0.7;
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
        const pullForce = 0.02;
        p.vx += Math.cos(pullAngle) * pullForce;
        p.vy += Math.sin(pullAngle) * pullForce;

        if (mode === 'error') {
          p.vx += (Math.random() - 0.5) * 0.3;
          p.vy += (Math.random() - 0.5) * 0.3;
        }

        p.x += p.vx;
        p.y += p.vy;

        // Respawn if too far
        const dist = Math.sqrt(p.x * p.x + p.y * p.y);
        if (dist > radius * 2) {
          Object.assign(p, createParticle(t));
        }
      });

      // Draw main orb sphere
      const gradient = ctx.createRadialGradient(
        centerX - radius * 0.3,
        centerY - radius * 0.3,
        radius * 0.1,
        centerX,
        centerY,
        radius
      );

      // Animated color cycling
      const colorProgress = (Math.sin(t * cfg.speed) + 1) / 2;
      const colorIdx = colorProgress * (cfg.colors.length - 1);
      const c1Idx = Math.floor(colorIdx);
      const c2Idx = Math.min(c1Idx + 1, cfg.colors.length - 1);
      const blend = colorIdx - c1Idx;

      gradient.addColorStop(0, '#ffffff');
      gradient.addColorStop(0.15, blendColor(cfg.colors[c1Idx], cfg.colors[c2Idx], blend * 0.3));
      gradient.addColorStop(0.5, blendColor(cfg.colors[c1Idx], cfg.colors[c2Idx], blend * 0.7));
      gradient.addColorStop(1, blendColor(cfg.colors[c1Idx], cfg.colors[c2Idx], blend));

      ctx.beginPath();
      ctx.arc(centerX, centerY, radius * pulseScale, 0, Math.PI * 2);
      ctx.fillStyle = gradient;
      ctx.fill();

      // Inner neural network lines
      ctx.save();
      ctx.globalAlpha = 0.15 + Math.sin(t * cfg.speed * 5) * 0.1;
      const nodeCount = mode === 'thinking' ? 12 : 8;
      const nodes: { x: number; y: number }[] = [];
      for (let i = 0; i < nodeCount; i++) {
        const angle = (i / nodeCount) * Math.PI * 2 + t * cfg.speed * 2;
        const dist = radius * 0.4 * (0.5 + Math.sin(t * cfg.speed * 3 + i) * 0.3);
        nodes.push({
          x: centerX + Math.cos(angle) * dist,
          y: centerY + Math.sin(angle) * dist,
        });
      }

      ctx.strokeStyle = cfg.colors[0];
      ctx.lineWidth = 0.5;
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const d = Math.sqrt(
            (nodes[i].x - nodes[j].x) ** 2 + (nodes[i].y - nodes[j].y) ** 2
          );
          if (d < radius * 0.8) {
            ctx.beginPath();
            ctx.moveTo(nodes[i].x, nodes[i].y);
            ctx.lineTo(nodes[j].x, nodes[j].y);
            ctx.globalAlpha = (1 - d / (radius * 0.8)) * 0.2;
            ctx.stroke();
          }
        }
      }

      // Draw nodes
      nodes.forEach((node, i) => {
        ctx.beginPath();
        const nodeSize = 1.5 + Math.sin(t * cfg.speed * 4 + i) * 0.8;
        ctx.arc(node.x, node.y, nodeSize, 0, Math.PI * 2);
        ctx.fillStyle = cfg.colors[i % cfg.colors.length];
        ctx.globalAlpha = 0.6 + Math.sin(t * cfg.speed * 5 + i) * 0.3;
        ctx.fill();
      });
      ctx.restore();

      // Specular highlight
      ctx.save();
      const specGrad = ctx.createRadialGradient(
        centerX - radius * 0.25,
        centerY - radius * 0.25,
        0,
        centerX - radius * 0.25,
        centerY - radius * 0.25,
        radius * 0.6
      );
      specGrad.addColorStop(0, 'rgba(255, 255, 255, 0.35)');
      specGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.05)');
      specGrad.addColorStop(1, 'transparent');
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius * pulseScale, 0, Math.PI * 2);
      ctx.fillStyle = specGrad;
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
          const ringAlpha = Math.sin(ringPhase) * 0.15;
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
          ctx.lineWidth = 1.5;
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
        ctx.lineWidth = 2;
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
