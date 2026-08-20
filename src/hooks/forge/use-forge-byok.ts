'use client';

import { useCallback, useEffect, useState } from 'react';

/**
 * Forge BYOK ("bring your own key") — user-owned provider credentials kept in
 * localStorage and sent per-request as headers (never stored server-side, never
 * logged). v1 supports DeepSeek key + Ollama base URL/model.
 */

const BYOK_STORAGE_KEY = 'congchain_forge_byok_v1';

export interface ForgeByokConfig {
  deepseekKey: string;
  ollamaBaseUrl: string;
  ollamaModel: string;
}

export const DEFAULT_BYOK_CONFIG: ForgeByokConfig = {
  deepseekKey: '',
  ollamaBaseUrl: 'http://127.0.0.1:11434',
  ollamaModel: 'qwen2.5-coder:7b',
};

function loadConfig(): ForgeByokConfig {
  if (typeof window === 'undefined') return DEFAULT_BYOK_CONFIG;
  try {
    const raw = window.localStorage.getItem(BYOK_STORAGE_KEY);
    if (!raw) return DEFAULT_BYOK_CONFIG;
    const parsed = JSON.parse(raw) as Partial<ForgeByokConfig>;
    return {
      deepseekKey: typeof parsed.deepseekKey === 'string' ? parsed.deepseekKey : '',
      ollamaBaseUrl: typeof parsed.ollamaBaseUrl === 'string' && parsed.ollamaBaseUrl ? parsed.ollamaBaseUrl : DEFAULT_BYOK_CONFIG.ollamaBaseUrl,
      ollamaModel: typeof parsed.ollamaModel === 'string' && parsed.ollamaModel ? parsed.ollamaModel : DEFAULT_BYOK_CONFIG.ollamaModel,
    };
  } catch {
    return DEFAULT_BYOK_CONFIG;
  }
}

export function useForgeByok() {
  const [config, setConfig] = useState<ForgeByokConfig>(DEFAULT_BYOK_CONFIG);

  useEffect(() => {
    setConfig(loadConfig());
  }, []);

  const saveConfig = useCallback((next: ForgeByokConfig) => {
    const cleaned: ForgeByokConfig = {
      deepseekKey: (next.deepseekKey ?? '').trim(),
      ollamaBaseUrl: (next.ollamaBaseUrl ?? '').trim() || DEFAULT_BYOK_CONFIG.ollamaBaseUrl,
      ollamaModel: (next.ollamaModel ?? '').trim() || DEFAULT_BYOK_CONFIG.ollamaModel,
    };
    try {
      window.localStorage.setItem(BYOK_STORAGE_KEY, JSON.stringify(cleaned));
    } catch { /* storage unavailable */ }
    setConfig(cleaned);
  }, []);

  const clearKeys = useCallback(() => {
    const cleared = { ...config, deepseekKey: '' };
    saveConfig(cleared);
  }, [config, saveConfig]);

  return { config, saveConfig, clearKeys };
}
