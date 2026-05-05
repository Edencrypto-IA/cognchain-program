'use client';
import { useEffect, useState } from 'react';

interface ConfidenceRingProps {
  value: number;
  size?: 'sm' | 'md' | 'lg';
}

const SIZES = { sm: 32, md: 48, lg: 64 };
const STROKE = { sm: 3, md: 4, lg: 5 };

export default function ConfidenceRing({ value, size = 'md' }: ConfidenceRingProps) {
  const [animated, setAnimated] = useState(0);
  const px = SIZES[size];
  const sw = STROKE[size];
  const r = (px - sw * 2) / 2;
  const circ = 2 * Math.PI * r;
  const color = value >= 71 ? '#00d4aa' : value >= 41 ? '#f59e0b' : '#ef4444';

  useEffect(() => {
    const t = requestAnimationFrame(() => setAnimated(value));
    return () => cancelAnimationFrame(t);
  }, [value]);

  const offset = circ - (animated / 100) * circ;
  const fontSize = size === 'sm' ? 8 : size === 'md' ? 11 : 14;

  return (
    <svg width={px} height={px} viewBox={`0 0 ${px} ${px}`} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={px/2} cy={px/2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={sw} />
      <circle
        cx={px/2} cy={px/2} r={r}
        fill="none"
        stroke={color}
        strokeWidth={sw}
        strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={offset}
        style={{ transition: 'stroke-dashoffset 600ms ease-out' }}
      />
      <text
        x={px/2} y={px/2}
        textAnchor="middle"
        dominantBaseline="central"
        fill={color}
        fontSize={fontSize}
        fontWeight="700"
        fontFamily="Inter, sans-serif"
        style={{ transform: `rotate(90deg)`, transformOrigin: `${px/2}px ${px/2}px` }}
      >
        {Math.round(value)}%
      </text>
    </svg>
  );
}
