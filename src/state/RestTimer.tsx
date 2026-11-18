import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { beep, vibrate } from '../ui/feedback';

interface RestTimerValue {
  /** Marca de tiempo (ms) en la que acaba el descanso, o null si no hay temporizador. */
  endsAt: number | null;
  duration: number;
  remaining: number;
  finished: boolean;
  start: (seconds: number) => void;
  adjust: (deltaSeconds: number) => void;
  stop: () => void;
}

const RestTimerContext = createContext<RestTimerValue | null>(null);
const STORAGE_KEY = 'fit.restTimer';

/**
 * El temporizador guarda la hora de fin, no los segundos restantes: así sigue siendo exacto
 * aunque el navegador congele la pestaña en segundo plano o se recargue la página.
 */
export function RestTimerProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ endsAt: number | null; duration: number }>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as { endsAt: number; duration: number } | null;
      if (saved && saved.endsAt > Date.now()) return saved;
    } catch {
      /* almacenamiento no disponible: arrancamos sin temporizador */
    }
    return { endsAt: null, duration: 0 };
  });
  const [now, setNow] = useState(Date.now());
  const alerted = useRef(false);

  useEffect(() => {
    try {
      if (state.endsAt) localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      else localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* noop */
    }
  }, [state]);

  useEffect(() => {
    if (!state.endsAt) return;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [state.endsAt]);

  const remaining = state.endsAt ? Math.max(0, Math.ceil((state.endsAt - now) / 1000)) : 0;
  const finished = state.endsAt !== null && remaining === 0;

  useEffect(() => {
    if (finished && !alerted.current) {
      alerted.current = true;
      beep(3);
      vibrate([200, 100, 200, 100, 400]);
    }
  }, [finished]);

  const start = useCallback((seconds: number) => {
    alerted.current = false;
    setNow(Date.now());
    setState({ endsAt: Date.now() + seconds * 1000, duration: seconds });
  }, []);

  const adjust = useCallback((delta: number) => {
    setState((s) => {
      if (!s.endsAt) return s;
      const endsAt = Math.max(Date.now() + 1000, s.endsAt + delta * 1000);
      if (endsAt > Date.now()) alerted.current = false;
      return { endsAt, duration: Math.max(1, s.duration + delta) };
    });
  }, []);

  const stop = useCallback(() => setState({ endsAt: null, duration: 0 }), []);

  const value = useMemo(
    () => ({ endsAt: state.endsAt, duration: state.duration, remaining, finished, start, adjust, stop }),
    [state, remaining, finished, start, adjust, stop],
  );

  return <RestTimerContext.Provider value={value}>{children}</RestTimerContext.Provider>;
}

export function useRestTimer(): RestTimerValue {
  const ctx = useContext(RestTimerContext);
  if (!ctx) throw new Error('useRestTimer fuera de RestTimerProvider');
  return ctx;
}
