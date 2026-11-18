import { useMemo, useState } from 'react';
import type { Exercise } from '../../core/types';
import { EXERCISE_MAP, EXERCISES, GROUP_LABEL } from '../../data/catalog';
import { Sheet } from '../../ui/Sheet';
import { CreateExerciseSheet } from './CreateExerciseSheet';

interface Props {
  title: string;
  /** Ids a mostrar. Si no se pasa, se muestran todos los del catálogo. */
  options?: string[];
  onPick: (id: string) => void;
  onClose: () => void;
  /** Si se pasa, aparece el botón "Crear ejercicio". Debe guardar el ejercicio y resolver al terminar. */
  onCreate?: (e: Exercise) => Promise<void>;
}

export function ExercisePicker({ title, options, onPick, onClose, onCreate }: Props) {
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const ids = options ?? EXERCISES.map((e) => e.id);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return ids
      .map((id) => EXERCISE_MAP.get(id))
      .filter((e): e is NonNullable<typeof e> => e !== undefined)
      .filter((e) => !q || e.name.toLowerCase().includes(q) || GROUP_LABEL[e.primary].toLowerCase().includes(q));
  }, [ids, query]);

  return (
    <Sheet title={title} onClose={onClose}>
      {ids.length > 6 && (
        <input
          className="input"
          placeholder="Buscar ejercicio o músculo…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ marginBottom: 10 }}
        />
      )}
      <div className="picker-list">
        {shown.length === 0 && <div className="empty">Ningún ejercicio coincide</div>}
        {onCreate && (
          <button className="btn btn-block" onClick={() => setCreating(true)}>
            + Crear ejercicio{query.trim() ? ` "${query.trim()}"` : ''}
          </button>
        )}
        {shown.map((e) => (
          <button key={e.id} className="picker-item" onClick={() => onPick(e.id)}>
            <span>
              <div style={{ fontWeight: 650 }}>{e.name}</div>
              <div className="small faint">{GROUP_LABEL[e.primary]}</div>
            </span>
            {e.shoulderFriendly ? <span className="chip chip-accent">hombro OK</span> : <span className="chip chip-amber">precaución</span>}
          </button>
        ))}
      </div>
      {creating && onCreate && (
        <CreateExerciseSheet
          initialName={query.trim()}
          onClose={() => setCreating(false)}
          onSave={async (e) => {
            await onCreate(e);
            setCreating(false);
            onPick(e.id);
          }}
        />
      )}
    </Sheet>
  );
}
