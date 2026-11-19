import { useRef, useState, type ReactNode } from 'react';
import { today } from '../../core/dates';
import { mealsToCSV, setsToCSV, weightsToCSV } from '../../core/exportCsv';
import { kcalFromMacros } from '../../core/macros';
import type { Profile } from '../../core/types';
import { EXERCISE_MAP } from '../../data/catalog';
import { createAIClient } from '../../services/ai';
import { getPbToken, pbLogin, pbLogout, syncWithPocketBase } from '../../services/pocketbase';
import type { AIProviderId, AISettings } from '../../services/settings';
import { useAppData } from '../../state/AppData';
import { useAISettings } from '../../state/useAISettings';
import { downloadFile } from '../../ui/download';

function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="field">
      {label}
      {children}
      {hint && <span className="faint" style={{ fontWeight: 400 }}>{hint}</span>}
    </label>
  );
}

function NumberInput({ value, onChange, step = 1 }: { value: number; onChange: (n: number) => void; step?: number }) {
  return (
    <input
      className="input num"
      type="number"
      inputMode="decimal"
      step={step}
      value={Number.isFinite(value) ? value : ''}
      onChange={(e) => onChange(Number(e.target.value))}
    />
  );
}

export function SettingsView({ onClose }: { onClose: () => void }) {
  return (
    <>
      <button className="btn btn-sm btn-ghost" style={{ alignSelf: 'flex-start' }} onClick={onClose}>
        ← Volver
      </button>
      <ProfileSection />
      <AISection />
      <DataSection />
      <SyncSection />
      <p className="small faint" style={{ textAlign: 'center' }}>
        IronRook · datos 100 % locales en IndexedDB · v1.0
      </p>
    </>
  );
}

/* ------------------------------------------------------------------ */

function ProfileSection() {
  const { profile, setProfile, toast } = useAppData();
  const [draft, setDraft] = useState<Profile>(profile);
  const set = <K extends keyof Profile>(k: K, v: Profile[K]) => setDraft((d) => ({ ...d, [k]: v }));
  const setTarget = (k: keyof Profile['targets'], v: number) => setDraft((d) => ({ ...d, targets: { ...d.targets, [k]: v } }));
  const atwater = Math.round(kcalFromMacros(draft.targets));

  const save = async () => {
    try {
      await setProfile(draft);
      toast('Perfil guardado', 'success');
    } catch {
      toast('Revisa los valores: alguno está fuera de rango', 'error');
    }
  };

  return (
    <section className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <h2>Perfil y objetivos</h2>
      <div className="grid-2">
        <Field label="Altura (cm)">
          <NumberInput value={draft.heightCm} onChange={(n) => set('heightCm', n)} />
        </Field>
        <Field label="Peso (kg)">
          <NumberInput value={draft.weightKg} step={0.1} onChange={(n) => set('weightKg', n)} />
        </Field>
      </div>
      <Field label="Objetivo">
        <input className="input" value={draft.goal} onChange={(e) => set('goal', e.target.value)} />
      </Field>
      <div className="grid-4">
        <Field label="kcal">
          <NumberInput value={draft.targets.kcal} onChange={(n) => setTarget('kcal', n)} />
        </Field>
        <Field label="Prot. g">
          <NumberInput value={draft.targets.protein} onChange={(n) => setTarget('protein', n)} />
        </Field>
        <Field label="Carb. g">
          <NumberInput value={draft.targets.carbs} onChange={(n) => setTarget('carbs', n)} />
        </Field>
        <Field label="Grasa g">
          <NumberInput value={draft.targets.fat} onChange={(n) => setTarget('fat', n)} />
        </Field>
      </div>
      <div className="small faint">
        Tus macros suman {atwater} kcal (4·P + 4·C + 9·G){Math.abs(atwater - draft.targets.kcal) > 100 ? ' · revisa la coherencia' : ''}.
      </div>
      <div className="grid-2">
        <Field label="Bonus día de pierna (kcal)" hint={`= +${Math.round(draft.legDayBonusKcal / 4)} g de carbos`}>
          <NumberInput value={draft.legDayBonusKcal} onChange={(n) => set('legDayBonusKcal', n)} />
        </Field>
        <Field label="Umbral (series de pierna)" hint="series efectivas para activarlo">
          <NumberInput value={draft.legDaySetThreshold} onChange={(n) => set('legDaySetThreshold', Math.round(n))} />
        </Field>
      </div>
      <Field label="Descanso por defecto">
        <select className="input" value={draft.restSec} onChange={(e) => set('restSec', Number(e.target.value))}>
          {[90, 120, 150, 180].map((s) => (
            <option key={s} value={s}>
              {s} s
            </option>
          ))}
        </select>
      </Field>
      <button className="btn btn-primary" onClick={() => void save()}>
        Guardar perfil
      </button>
    </section>
  );
}

/* ------------------------------------------------------------------ */

const PROVIDERS: { id: AIProviderId; label: string }[] = [
  { id: 'gemini', label: 'Google Gemini (gratis)' },
  { id: 'groq', label: 'Groq (gratis)' },
  { id: 'ollama', label: 'Ollama (servidor local)' },
  { id: 'local', label: 'Sin IA (modo simulación)' },
];

function AISection() {
  const { settings, save } = useAISettings();
  const { toast } = useAppData();
  const [draft, setDraft] = useState<AISettings>(settings);
  const [reveal, setReveal] = useState(false);
  const [testing, setTesting] = useState(false);
  const set = <K extends keyof AISettings>(k: K, v: AISettings[K]) => setDraft((d) => ({ ...d, [k]: v }));

  const test = async () => {
    const client = createAIClient(draft);
    if (!client) {
      toast('Falta la API key o la URL del proveedor', 'warn');
      return;
    }
    setTesting(true);
    try {
      const reply = await client.chat([{ role: 'user', content: 'Responde solo con la palabra OK.' }]);
      toast(`${client.label}: ${reply.trim().slice(0, 40)}`, 'success');
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), 'error');
    } finally {
      setTesting(false);
    }
  };

  return (
    <section className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <h2>Inteligencia artificial</h2>
      <Field label="Proveedor">
        <select className="input" value={draft.provider} onChange={(e) => set('provider', e.target.value as AIProviderId)}>
          {PROVIDERS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
      </Field>

      {draft.provider === 'gemini' && (
        <>
          <Field label="GEMINI_API_KEY" hint="Gratis en aistudio.google.com/apikey">
            <input
              className="input num"
              type={reveal ? 'text' : 'password'}
              autoComplete="off"
              value={draft.geminiKey}
              onChange={(e) => set('geminiKey', e.target.value)}
              placeholder="AIza…"
            />
          </Field>
          <Field label="Modelo">
            <input className="input" value={draft.geminiModel} onChange={(e) => set('geminiModel', e.target.value)} />
          </Field>
        </>
      )}

      {draft.provider === 'groq' && (
        <>
          <Field label="GROQ_API_KEY" hint="Gratis en console.groq.com/keys">
            <input
              className="input num"
              type={reveal ? 'text' : 'password'}
              autoComplete="off"
              value={draft.groqKey}
              onChange={(e) => set('groqKey', e.target.value)}
              placeholder="gsk_…"
            />
          </Field>
          <div className="grid-2">
            <Field label="Modelo texto">
              <input className="input" value={draft.groqModel} onChange={(e) => set('groqModel', e.target.value)} />
            </Field>
            <Field label="Modelo visión">
              <input className="input" value={draft.groqVisionModel} onChange={(e) => set('groqVisionModel', e.target.value)} />
            </Field>
          </div>
        </>
      )}

      {draft.provider === 'ollama' && (
        <>
          <Field label="URL de Ollama" hint="Arranca con OLLAMA_ORIGINS=* para permitir el navegador">
            <input className="input num" value={draft.ollamaUrl} onChange={(e) => set('ollamaUrl', e.target.value)} />
          </Field>
          <div className="grid-2">
            <Field label="Modelo texto">
              <input className="input" value={draft.ollamaModel} onChange={(e) => set('ollamaModel', e.target.value)} />
            </Field>
            <Field label="Modelo visión">
              <input className="input" value={draft.ollamaVisionModel} onChange={(e) => set('ollamaVisionModel', e.target.value)} />
            </Field>
          </div>
        </>
      )}

      {(draft.provider === 'gemini' || draft.provider === 'groq') && (
        <label className="row small muted">
          <input type="checkbox" checked={reveal} onChange={(e) => setReveal(e.target.checked)} /> Mostrar clave
        </label>
      )}

      <div className="note" style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}>
        Las claves se guardan solo en el localStorage de este navegador. No entran en la base de datos, ni en las copias
        de seguridad, ni en el repositorio.
      </div>

      <div className="grid-2">
        <button className="btn" disabled={testing} onClick={() => void test()}>
          {testing ? <div className="spinner" /> : 'Probar conexión'}
        </button>
        <button
          className="btn btn-primary"
          onClick={() => {
            save(draft);
            toast('Configuración de IA guardada', 'success');
          }}
        >
          Guardar
        </button>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */

function DataSection() {
  const { repo, invalidate, toast } = useAppData();
  const fileRef = useRef<HTMLInputElement>(null);
  const stamp = today();

  const exportJson = async () => {
    const backup = await repo.exportBackup();
    downloadFile(`fit-ai-backup-${stamp}.json`, JSON.stringify(backup, null, 2), 'application/json');
  };

  const exportCsv = async (kind: 'meals' | 'sets' | 'weights') => {
    const backup = await repo.exportBackup();
    const csv =
      kind === 'meals' ? mealsToCSV(backup.meals) : kind === 'sets' ? setsToCSV(backup.workouts, EXERCISE_MAP) : weightsToCSV(backup.weights);
    downloadFile(`fit-ai-${kind}-${stamp}.csv`, csv, 'text/csv;charset=utf-8');
  };

  const importJson = async (file: File) => {
    try {
      const data: unknown = JSON.parse(await file.text());
      if (!confirm('Se fusionarán los datos de la copia con los actuales (mismo id = se sobrescribe). ¿Continuar?')) return;
      const { records } = await repo.importBackup(data);
      invalidate();
      toast(`Importados ${records} registros`, 'success');
    } catch (e) {
      toast(e instanceof SyntaxError ? 'El fichero no es JSON válido' : 'La copia no tiene el formato esperado', 'error');
    }
  };

  const clearDemo = async () => {
    if (!confirm('Se borrarán los entrenos, comidas y pesajes de demostración. Lo que hayas registrado tú se conserva. ¿Continuar?')) return;
    const n = await repo.clearDemoData();
    invalidate();
    toast(`Demo eliminada (${n} registros). ¡A empezar de cero!`, 'success');
  };

  const resetAll = async () => {
    if (!confirm('Esto borra TODOS tus datos locales (entrenos, comidas, peso, alimentos y chat). ¿Seguro?')) return;
    await repo.resetAll();
    invalidate();
    toast('Datos borrados', 'success');
  };

  return (
    <section className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <h2>Datos y copias de seguridad</h2>
      <button className="btn btn-primary" onClick={() => void exportJson()}>
        Exportar copia completa (.json)
      </button>
      <div className="grid-2" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        <button className="btn btn-sm" onClick={() => void exportCsv('meals')}>
          CSV comidas
        </button>
        <button className="btn btn-sm" onClick={() => void exportCsv('sets')}>
          CSV series
        </button>
        <button className="btn btn-sm" onClick={() => void exportCsv('weights')}>
          CSV peso
        </button>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) void importJson(f);
        }}
      />
      <button className="btn" onClick={() => fileRef.current?.click()}>
        Importar copia (.json)
      </button>
      <button className="btn btn-amber" onClick={() => void clearDemo()}>
        Limpiar datos de demo y empezar de cero
      </button>
      <button className="btn btn-danger" onClick={() => void resetAll()}>
        Borrar todos los datos
      </button>
    </section>
  );
}

/* ------------------------------------------------------------------ */

function SyncSection() {
  const { settings, save } = useAISettings();
  const { repo, invalidate, toast } = useAppData();
  const [url, setUrl] = useState(settings.pocketbaseUrl);
  const [email, setEmail] = useState(settings.pocketbaseEmail);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [logged, setLogged] = useState(Boolean(getPbToken()));

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <h2>Sincronización (PocketBase)</h2>
      <p className="small faint" style={{ margin: 0 }}>
        Opcional. Para cuando tengas tu servidor casero: la app sigue funcionando offline y sube/baja cambios al pulsar
        sincronizar (last-write-wins por registro).
      </p>
      <Field label="URL del servidor">
        <input className="input num" placeholder="http://192.168.1.50:8090" value={url} onChange={(e) => setUrl(e.target.value)} />
      </Field>
      {!logged && (
        <div className="grid-2">
          <Field label="Email">
            <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Field label="Contraseña">
            <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
        </div>
      )}
      <div className="grid-2">
        {logged ? (
          <button
            className="btn"
            onClick={() => {
              pbLogout();
              setLogged(false);
            }}
          >
            Cerrar sesión
          </button>
        ) : (
          <button
            className="btn"
            disabled={busy || !url || !email || !password}
            onClick={() =>
              void run(async () => {
                await pbLogin(url, email, password);
                save({ ...settings, pocketbaseUrl: url, pocketbaseEmail: email });
                setPassword('');
                setLogged(true);
                toast('Conectado a PocketBase', 'success');
              })
            }
          >
            Iniciar sesión
          </button>
        )}
        <button
          className="btn btn-primary"
          disabled={busy || !url}
          onClick={() =>
            void run(async () => {
              save({ ...settings, pocketbaseUrl: url, pocketbaseEmail: email });
              const r = await syncWithPocketBase(url, repo);
              invalidate();
              toast(`Sincronizado: ↑${r.pushed} ↓${r.pulled}`, 'success');
            })
          }
        >
          {busy ? <div className="spinner" /> : 'Sincronizar ahora'}
        </button>
      </div>
    </section>
  );
}
