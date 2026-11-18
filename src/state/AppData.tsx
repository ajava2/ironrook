import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Profile } from '../core/types';
import { openFitDb } from '../data/db';
import { DEFAULT_PROFILE } from '../data/defaults';
import { Repository } from '../data/repository';
import { registerExercises } from '../data/catalog';

export type ToastKind = 'info' | 'success' | 'warn' | 'error';

interface Toast {
  id: number;
  text: string;
  kind: ToastKind;
}

interface AppDataValue {
  repo: Repository;
  profile: Profile;
  /** Contador que sube tras cada escritura: los hooks de lectura lo usan como dependencia. */
  version: number;
  invalidate: () => void;
  setProfile: (p: Profile) => Promise<void>;
  toast: (text: string, kind?: ToastKind) => void;
}

const AppDataContext = createContext<AppDataValue | null>(null);

export function AppDataProvider({ children }: { children: ReactNode }) {
  const [repo, setRepo] = useState<Repository>();
  const [profile, setProfileState] = useState<Profile>(DEFAULT_PROFILE);
  const [version, setVersion] = useState(0);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [error, setError] = useState<string>();
  const toastId = useRef(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = new Repository(await openFitDb());
        await r.seedIfEmpty(undefined, { demo: false });
        registerExercises(await r.allCustomExercises());
        const p = await r.getProfile();
        if (!cancelled) {
          setProfileState(p);
          setRepo(r);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const invalidate = useCallback(() => setVersion((v) => v + 1), []);

  const toast = useCallback((text: string, kind: ToastKind = 'info') => {
    const id = ++toastId.current;
    setToasts((t) => [...t.slice(-2), { id, text, kind }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  }, []);

  const setProfile = useCallback(
    async (p: Profile) => {
      if (!repo) return;
      setProfileState(await repo.saveProfile(p));
      invalidate();
    },
    [repo, invalidate],
  );

  const value = useMemo(
    () => (repo ? { repo, profile, version, invalidate, setProfile, toast } : null),
    [repo, profile, version, invalidate, setProfile, toast],
  );

  if (error) {
    return (
      <div className="app">
        <div className="view" style={{ paddingTop: 40 }}>
          <div className="card">
            <h2>No se pudo abrir la base de datos local</h2>
            <p className="muted">{error}</p>
            <p className="small faint">En modo incógnito algunos navegadores bloquean IndexedDB.</p>
          </div>
        </div>
      </div>
    );
  }

  if (!value) {
    return (
      <div className="app" style={{ display: 'grid', placeItems: 'center' }}>
        <div className="spinner" />
      </div>
    );
  }

  return (
    <AppDataContext.Provider value={value}>
      {children}
      <div className="toast-stack" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.kind}`}>
            {t.text}
          </div>
        ))}
      </div>
    </AppDataContext.Provider>
  );
}

export function useAppData(): AppDataValue {
  const ctx = useContext(AppDataContext);
  if (!ctx) throw new Error('useAppData fuera de AppDataProvider');
  return ctx;
}

/**
 * Lectura asíncrona reactiva: se repite cuando cambian `deps` o tras cualquier escritura
 * (`version`). Mantiene el último valor mientras recarga para evitar parpadeos.
 */
export function useQuery<T>(fn: (repo: Repository) => Promise<T>, deps: readonly unknown[], initial: T): T {
  const { repo, version } = useAppData();
  const [data, setData] = useState<T>(initial);
  useEffect(() => {
    let alive = true;
    fn(repo).then((d) => {
      if (alive) setData(d);
    });
    return () => {
      alive = false;
    };
  }, [repo, version, ...deps]);
  return data;
}
