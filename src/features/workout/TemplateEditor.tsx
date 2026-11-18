import { useState } from 'react';
import { exerciseName } from '../../data/catalog';
import { moveItem } from '../../core/templates';
import type { TemplateExercise, WorkoutTemplate } from '../../core/types';
import { IconPlus, IconTrash } from '../../ui/icons';
import { Sheet } from '../../ui/Sheet';
import { ExercisePicker } from './ExercisePicker';

const DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

interface Props {
  /** Rutina a editar. Si es `null` se crea una nueva. */
  initial: WorkoutTemplate | null;
  newId: string;
  onSave: (t: WorkoutTemplate) => void;
  onDelete?: (t: WorkoutTemplate) => void;
  onShare?: (t: WorkoutTemplate) => void;
  onClose: () => void;
}

/**
 * Campo numérico que deja el texto vacío mientras escribes (si no, no podrías borrar el "3"
 * para escribir un "5") y ajusta al rango permitido al salir del campo.
 */
function NumField({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (n: number) => void }) {
  const [text, setText] = useState(String(value));
  return (
    <label className="field">
      {label}
      <input
        className="input num"
        inputMode="numeric"
        value={text}
        onChange={(e) => {
          const t = e.target.value.replace(/\D/g, '');
          setText(t);
          if (t !== '') onChange(Math.min(max, Math.max(min, Number.parseInt(t, 10))));
        }}
        onBlur={() => {
          const n = Number.parseInt(text, 10);
          const fixed = Number.isNaN(n) ? min : Math.min(max, Math.max(min, n));
          setText(String(fixed));
          onChange(fixed);
        }}
      />
    </label>
  );
}

export function TemplateEditor({ initial, newId, onSave, onDelete, onShare, onClose }: Props) {
  const [name, setName] = useState(initial?.name ?? '');
  const [focus, setFocus] = useState<WorkoutTemplate['focus']>(initial?.focus ?? 'upper');
  const [weekday, setWeekday] = useState<number | undefined>(initial?.weekday);
  const [exercises, setExercises] = useState<TemplateExercise[]>(initial?.exercises ?? []);
  const [picking, setPicking] = useState(false);

  const patch = (i: number, p: Partial<TemplateExercise>) =>
    setExercises((list) => list.map((e, j) => (j === i ? { ...e, ...p } : e)));

  const canSave = name.trim().length > 0 && exercises.length > 0;

  const build = (): WorkoutTemplate => ({
    id: initial?.id ?? newId,
    name: name.trim().slice(0, 60),
    focus,
    weekday,
    order: initial?.order,
    updatedAt: Date.now(),
    exercises: exercises.map((e) => ({ ...e, repMax: Math.max(e.repMin, e.repMax) })),
  });

  return (
    <Sheet title={initial ? 'Editar rutina' : 'Nueva rutina'} onClose={onClose}>
      <div className="editor">
        <label className="field">
          Nombre
          <input
            className="input"
            value={name}
            maxLength={60}
            placeholder="Ej: Pierna A, Torso, Empuje…"
            onChange={(e) => setName(e.target.value)}
          />
        </label>

        <div className="grid-2">
          <label className="field">
            Tipo
            <select className="input" value={focus} onChange={(e) => setFocus(e.target.value as WorkoutTemplate['focus'])}>
              <option value="upper">Tren superior</option>
              <option value="legs">Pierna</option>
            </select>
          </label>
          <label className="field">
            Día (opcional)
            <select
              className="input"
              value={weekday ?? ''}
              onChange={(e) => setWeekday(e.target.value === '' ? undefined : Number(e.target.value))}
            >
              <option value="">Sin día fijo</option>
              {DAYS.map((d, i) => (
                <option key={d} value={i}>
                  {d}
                </option>
              ))}
            </select>
          </label>
        </div>

        <h2 className="section-title" style={{ marginTop: 14 }}>
          Ejercicios
        </h2>
        {exercises.length === 0 && <div className="empty">Añade al menos un ejercicio</div>}

        {exercises.map((e, i) => (
          <div key={`${e.exerciseId}-${i}`} className="editor-ex">
            <div className="spread">
              <strong>{exerciseName(e.exerciseId)}</strong>
              <div className="row">
                <button className="btn btn-sm btn-ghost" aria-label="Subir" disabled={i === 0} onClick={() => setExercises((l) => moveItem(l, i, i - 1))}>
                  ↑
                </button>
                <button
                  className="btn btn-sm btn-ghost"
                  aria-label="Bajar"
                  disabled={i === exercises.length - 1}
                  onClick={() => setExercises((l) => moveItem(l, i, i + 1))}
                >
                  ↓
                </button>
                <button className="btn btn-sm btn-ghost" aria-label="Quitar ejercicio" onClick={() => setExercises((l) => l.filter((_, j) => j !== i))}>
                  <IconTrash size={16} />
                </button>
              </div>
            </div>
            <div className="editor-nums">
              <NumField label="Series" value={e.sets} min={1} max={20} onChange={(n) => patch(i, { sets: n })} />
              <NumField label="Reps mín" value={e.repMin} min={1} max={100} onChange={(n) => patch(i, { repMin: n })} />
              <NumField label="Reps máx" value={e.repMax} min={1} max={100} onChange={(n) => patch(i, { repMax: n })} />
              <NumField label="Descanso (s)" value={e.restSec} min={0} max={600} onChange={(n) => patch(i, { restSec: n })} />
            </div>
            <input
              className="input"
              placeholder="Nota (opcional)"
              maxLength={120}
              value={e.note ?? ''}
              onChange={(ev) => patch(i, { note: ev.target.value || undefined })}
            />
          </div>
        ))}

        <button className="btn btn-block" onClick={() => setPicking(true)}>
          <IconPlus size={18} /> Añadir ejercicio
        </button>

        <button className="btn btn-primary btn-block" disabled={!canSave} onClick={() => onSave(build())}>
          Guardar rutina
        </button>
        {initial && onShare && (
          <button className="btn btn-block" onClick={() => onShare(initial)}>
            Compartir
          </button>
        )}
        {initial && onDelete && (
          <button className="btn btn-block btn-danger" onClick={() => onDelete(initial)}>
            Borrar rutina
          </button>
        )}
      </div>

      {picking && (
        <ExercisePicker
          title="Añadir ejercicio"
          onClose={() => setPicking(false)}
          onPick={(id) => {
            setExercises((l) => [...l, { exerciseId: id, sets: 3, repMin: 8, repMax: 12, restSec: 120 }]);
            setPicking(false);
          }}
        />
      )}
    </Sheet>
  );
}
