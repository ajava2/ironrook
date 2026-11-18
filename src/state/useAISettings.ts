import { useCallback, useMemo, useSyncExternalStore } from 'react';
import { createAIClient, type AIClient } from '../services/ai';
import { loadAISettings, saveAISettings, type AISettings } from '../services/settings';

let current = loadAISettings();
const listeners = new Set<() => void>();

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function useAISettings(): { settings: AISettings; save: (s: AISettings) => void; client: AIClient | null } {
  const settings = useSyncExternalStore(subscribe, () => current);
  const save = useCallback((s: AISettings) => {
    saveAISettings(s);
    current = s;
    listeners.forEach((l) => l());
  }, []);
  const client = useMemo(() => createAIClient(settings), [settings]);
  return { settings, save, client };
}
