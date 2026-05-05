'use client';
import { useState } from 'react';
import type { StructuredResponse } from '@/lib/grounding/types';

function isStructuredResponse(obj: unknown): obj is StructuredResponse {
  if (typeof obj !== 'object' || obj === null) return false;
  const o = obj as Record<string, unknown>;
  return typeof o.query === 'string' && typeof o.meta === 'object' && Array.isArray(o.facts);
}

export function useStructuredResponse() {
  const [structuredData, setStructuredData] = useState<StructuredResponse | null>(null);

  const parseResponse = (rawResponse: unknown) => {
    if (isStructuredResponse(rawResponse)) {
      setStructuredData(rawResponse);
      return;
    }
    setStructuredData(null);
  };

  const clear = () => setStructuredData(null);

  return { structuredData, parseResponse, clear };
}
