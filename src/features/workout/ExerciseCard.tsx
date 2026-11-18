import { memo } from 'react';
import { isSetPR, totalVolume, type ExerciseHistory } from '../../core/oneRepMax';
import type { Exercise, WorkoutExercise, WorkoutSet } from '../../core/types';
import { IconCheck, IconPlus, IconTrash } from '../../ui/icons';

const WEIGHT_STEP = 2.5;

interface ExerciseCardProps {
  index: number;
  meta: Exercise | undefined;
  exercise: WorkoutExercise;
  previous: WorkoutSet[];
  record: ExerciseHistory | undefined;
  canSwap: boolean;
  onUpdateSet: (exIdx: number, setIdx: number, patch: Partial<WorkoutSet>) => void;
  onToggleSet: (exIdx: number, setIdx: number) => void;
  onAddSet: (exIdx: number) => void;
  onRemoveSet: (exIdx: number, setIdx: number) => void;
  onRemoveExercise: (exIdx: number) => void;
  onSwap: (exIdx: number) => void;
}

function fmtKg(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(n * 10 === Math.round(n * 10) ? 1 : 2);
}

function ExerciseCardImpl({
  index,
  meta,
  exercise,
  previous,
  record,
  canSwap,
  onUpdateSet,
  onToggleSet,
  onAddSet,
  onRemoveSet,
  onRemoveExercise,
  onSwap,
}: ExerciseCardProps) {
  const volumePR = record && record.bestSessionVolume > 0 && totalVolume(exercise.sets) > record.bestSessionVolume;

  return (
    <section className="card exercise-card">
      <header className="spread">
        <div>
          <div className="exercise-name">
            {meta?.name ?? exercise.exerciseId}
            {volumePR && <span className="pr-badge">PR VOL</span>}
          </div>
          <div className="small faint">
            {record ? `Mejor e1RM ${fmtKg(record.bestE1RM)} kg` : 'Primera vez: hoy marcas la línea base'}
            {meta && !meta.shoulderFriendly && ' · ⚠ carga hombro'}
          </div>
        </div>
        <div className="row">
          {canSwap && (
            <button className="btn btn-sm btn-ghost" onClick={() => onSwap(index)}>
              Cambiar
            </button>
          )}
          <button className="btn btn-sm btn-ghost" onClick={() => onRemoveExercise(index)} aria-label="Quitar ejercicio">
            <IconTrash size={16} />
          </button>
        </div>
      </header>

      <ol className="set-list">
        {exercise.sets.map((set, i) => {
          const prev = previous[i] ?? previous.at(-1);
          const pr = isSetPR(set, record);
          return (
            <li key={i} className={`set-row${set.done ? ' done' : ''}`}>
              <div className="set-meta small">
                <span className="set-idx">{i + 1}</span>
                <span className="faint">
                  {prev ? `Anterior: ${fmtKg(prev.weight)} kg × ${prev.reps}` : 'Anterior: —'}
                </span>
                {pr && <span className="pr-badge">PR</span>}
                {!set.done && exercise.sets.length > 1 && (
                  <button className="set-remove faint" onClick={() => onRemoveSet(index, i)} aria-label="Quitar serie">
                    ×
                  </button>
                )}
              </div>
              <div className="set-controls">
                <div className="stepper">
                  <button onClick={() => onUpdateSet(index, i, { weight: Math.max(0, set.weight - WEIGHT_STEP) })}>
                    −2.5
                  </button>
                  <input
                    className="num"
                    type="number"
                    inputMode="decimal"
                    step="0.5"
                    min={0}
                    value={set.weight}
                    onChange={(e) => onUpdateSet(index, i, { weight: Math.max(0, Number(e.target.value) || 0) })}
                    aria-label={`Peso serie ${i + 1}`}
                  />
                  <button onClick={() => onUpdateSet(index, i, { weight: set.weight + WEIGHT_STEP })}>+2.5</button>
                </div>
                <div className="stepper reps">
                  <input
                    className="num"
                    type="number"
                    inputMode="numeric"
                    min={0}
                    value={set.reps}
                    onChange={(e) => onUpdateSet(index, i, { reps: Math.max(0, Math.round(Number(e.target.value) || 0)) })}
                    aria-label={`Repeticiones serie ${i + 1}`}
                  />
                  <button onClick={() => onUpdateSet(index, i, { reps: set.reps + 1 })}>+1</button>
                </div>
                <button
                  className={`check-btn${set.done ? ' on' : ''}`}
                  onClick={() => onToggleSet(index, i)}
                  aria-pressed={set.done}
                  aria-label={`Completar serie ${i + 1}`}
                >
                  <IconCheck size={20} />
                </button>
              </div>
            </li>
          );
        })}
      </ol>

      <button className="btn btn-sm btn-ghost btn-block" onClick={() => onAddSet(index)}>
        <IconPlus size={16} /> Añadir serie
      </button>
    </section>
  );
}

export const ExerciseCard = memo(ExerciseCardImpl);
