import { useCallback, useEffect, useMemo, useState } from 'react';
import { formatWeekday, today } from '../../core/dates';
import { detectPR, estimate1RM } from '../../core/oneRepMax';
import { createWorkout, finalizeWorkout, sessionStats } from '../../core/session';
import { dailyTargets } from '../../core/targets';
import type { Workout, WorkoutSet, WorkoutTemplate } from '../../core/types';
import { personalRecords, previousSets } from '../../core/volume';
import { EXERCISE_MAP, exerciseName, SHOULDER_SAFE_SWAPS } from '../../data/catalog';
import { useAppData, useQuery } from '../../state/AppData';
import { useRestTimer } from '../../state/RestTimer';
import { unlockAudio, vibrate } from '../../ui/feedback';
import { IconPlus, IconTrash } from '../../ui/icons';
import { ExercisePicker } from './ExercisePicker';
import { TemplatesSection } from './TemplatesSection';
import { ExerciseCard } from './ExerciseCard';
import './workout.css';


export function WorkoutView() {
  const { repo } = useAppData();
  const [active, setActive] = useState<Workout | null | undefined>(undefined);

  useEffect(() => {
    repo.getActiveWorkout().then((w) => setActive(w ?? null));
  }, [repo]);

  const update = useCallback(
    (w: Workout | null) => {
      setActive(w);
      void repo.setActiveWorkout(w ?? undefined);
    },
    [repo],
  );

  if (active === undefined) return <div className="spinner" />;
  return active ? <ActiveWorkout workout={active} onChange={update} /> : <WorkoutHome onStart={update} />;
}

/* ------------------------------------------------------------------ */

function WorkoutHome({ onStart }: { onStart: (w: Workout) => void }) {
  const { repo, invalidate, toast } = useAppData();
  const history = useQuery((r) => r.allWorkouts(), [], [] as Workout[]);
  const recent = useMemo(() => [...history].reverse().slice(0, 8), [history]);

  const start = (tpl?: WorkoutTemplate) => {
    unlockAudio();
    onStart(createWorkout(tpl, history, today()));
  };

  const remove = async (w: Workout) => {
    if (!confirm(`¿Borrar "${w.name}" del ${formatWeekday(w.date)}?`)) return;
    await repo.deleteWorkout(w.id);
    invalidate();
    toast('Entreno eliminado');
  };

  return (
    <>
    <TemplatesSection history={history} onStart={start} />
      <button className="btn btn-block" onClick={() => start()}>
        <IconPlus size={18} /> Entreno libre
      </button>

      <section className="card">
        <h2>Historial reciente</h2>
        {recent.length === 0 && <div className="empty">Aún no hay entrenos</div>}
        {recent.map((w) => {
          const s = sessionStats(w);
          return (
            <div key={w.id} className="session-row">
              <div>
                <div style={{ fontWeight: 650 }}>
                  {w.name} {w.demo && <span className="chip">demo</span>}
                </div>
                <div className="small faint">
                  {formatWeekday(w.date)} · {s.sets} series · <span className="num">{s.tonnage.toLocaleString('es-ES')}</span> kg ·{' '}
                  {s.minutes} min
                </div>
              </div>
              <button className="btn btn-sm btn-ghost" onClick={() => remove(w)} aria-label="Borrar entreno">
                <IconTrash size={16} />
              </button>
            </div>
          );
        })}
      </section>
    </>
  );
}

/* ------------------------------------------------------------------ */

interface ActiveProps {
  workout: Workout;
  onChange: (w: Workout | null) => void;
}

function ActiveWorkout({ workout, onChange }: ActiveProps) {
  const { repo, profile, invalidate, toast } = useAppData();
  const timer = useRestTimer();
  const history = useQuery((r) => r.allWorkouts(), [], [] as Workout[]);
  const [picker, setPicker] = useState<{ mode: 'add' } | { mode: 'swap'; index: number } | null>(null);
  const [elapsed, setElapsed] = useState(() => Date.now() - workout.startedAt);

  useEffect(() => {
    const id = window.setInterval(() => setElapsed(Date.now() - workout.startedAt), 1000);
    return () => window.clearInterval(id);
  }, [workout.startedAt]);

  const records = useMemo(() => personalRecords(history.filter((w) => w.id !== workout.id)), [history, workout.id]);
  const stats = sessionStats(workout);

  const mutate = useCallback(
    (fn: (w: Workout) => Workout) => onChange({ ...fn(workout), updatedAt: Date.now() }),
    [workout, onChange],
  );

  const updateSet = useCallback(
    (exIdx: number, setIdx: number, patch: Partial<WorkoutSet>) =>
      mutate((w) => ({
        ...w,
        exercises: w.exercises.map((ex, i) =>
          i !== exIdx ? ex : { ...ex, sets: ex.sets.map((s, j) => (j === setIdx ? { ...s, ...patch } : s)) },
        ),
      })),
    [mutate],
  );

  const toggleSet = useCallback(
    (exIdx: number, setIdx: number) => {
      unlockAudio();
      const ex = workout.exercises[exIdx]!;
      const set = ex.sets[setIdx]!;
      const done = !set.done;
      const nextSet: WorkoutSet = { ...set, done, completedAt: done ? Date.now() : undefined };
      updateSet(exIdx, setIdx, nextSet);
      if (!done) return;

      vibrate(30);
      timer.start(ex.restSec || profile.restSec);

      const sessionSets = ex.sets.map((s, j) => (j === setIdx ? nextSet : s));
      const rec = records.get(ex.exerciseId);
      const pr = detectPR(nextSet, sessionSets, rec);
      if (pr.any) {
        vibrate([60, 40, 60, 40, 120]);
        const name = exerciseName(ex.exerciseId);
        if (pr.e1rm) toast(`🏆 PR de 1RM estimado en ${name}: ${estimate1RM(nextSet)} kg`, 'success');
        else if (pr.weight) toast(`🏆 PR de peso en ${name}: ${nextSet.weight} kg`, 'success');
        else toast(`🏆 PR de volumen en ${name}`, 'success');
      }
    },
    [workout, updateSet, timer, profile.restSec, records, toast],
  );

  const addSet = useCallback(
    (exIdx: number) =>
      mutate((w) => ({
        ...w,
        exercises: w.exercises.map((ex, i) => {
          if (i !== exIdx) return ex;
          const last = ex.sets.at(-1);
          return { ...ex, sets: [...ex.sets, { weight: last?.weight ?? 0, reps: last?.reps ?? 8, done: false }] };
        }),
      })),
    [mutate],
  );

  const removeSet = useCallback(
    (exIdx: number, setIdx: number) =>
      mutate((w) => ({
        ...w,
        exercises: w.exercises.map((ex, i) => (i !== exIdx ? ex : { ...ex, sets: ex.sets.filter((_, j) => j !== setIdx) })),
      })),
    [mutate],
  );

  const removeExercise = useCallback(
    (exIdx: number) => {
      if (!confirm(`¿Quitar ${exerciseName(workout.exercises[exIdx]!.exerciseId)} de la sesión?`)) return;
      mutate((w) => ({ ...w, exercises: w.exercises.filter((_, i) => i !== exIdx) }));
    },
    [mutate, workout.exercises],
  );

  const swap = useCallback((exIdx: number) => setPicker({ mode: 'swap', index: exIdx }), []);

  const pickExercise = (exerciseId: string) => {
    const prev = previousSets(history, exerciseId);
    const sets: WorkoutSet[] = Array.from({ length: 3 }, (_, i) => {
      const ref = prev[i] ?? prev.at(-1);
      return { weight: ref?.weight ?? 0, reps: ref?.reps ?? 10, done: false };
    });
    if (picker?.mode === 'swap') {
      const idx = picker.index;
      mutate((w) => ({
        ...w,
        exercises: w.exercises.map((ex, i) => (i === idx ? { exerciseId, restSec: ex.restSec, sets } : ex)),
      }));
    } else {
      mutate((w) => ({ ...w, exercises: [...w.exercises, { exerciseId, restSec: profile.restSec, sets }] }));
    }
    setPicker(null);
  };

  const finish = async () => {
    const final = finalizeWorkout(workout);
    if (final.exercises.length === 0) {
      if (!confirm('No has marcado ninguna serie. ¿Descartar el entreno?')) return;
      onChange(null);
      timer.stop();
      return;
    }
    await repo.saveWorkout(final);
    onChange(null);
    timer.stop();
    invalidate();
    const todays = await repo.workoutsOn(final.date);
    const d = dailyTargets(profile, todays, EXERCISE_MAP);
    const s = sessionStats(final);
    toast(`Entreno guardado · ${s.sets} series · ${s.tonnage.toLocaleString('es-ES')} kg`, 'success');
    if (d.legDay) {
      window.setTimeout(
        () => toast(`🍝 Día de pierna pesada: objetivo de hoy +${d.bonusKcal} kcal en carbohidratos`, 'warn'),
        900,
      );
    }
  };

  const discard = () => {
    if (!confirm('¿Descartar el entreno en curso? Se perderán las series marcadas.')) return;
    onChange(null);
    timer.stop();
  };

  const minutes = Math.floor(elapsed / 60000);
  const seconds = Math.floor((elapsed % 60000) / 1000);

  return (
    <>
      <div className="workout-head">
        <div className="stat">
          Tiempo
          <strong className="num">
            {minutes}:{String(seconds).padStart(2, '0')}
          </strong>
        </div>
        <div className="stat">
          Series
          <strong className="num">{stats.sets}</strong>
        </div>
        <div className="stat">
          Volumen
          <strong className="num">{stats.tonnage.toLocaleString('es-ES')} kg</strong>
        </div>
        <button className="btn btn-primary btn-sm" onClick={finish}>
          Terminar
        </button>
      </div>

      <div className="small muted" style={{ fontWeight: 650 }}>
        {workout.name}
      </div>

      {workout.exercises.map((ex, i) => (
        <ExerciseCard
          key={`${ex.exerciseId}-${i}`}
          index={i}
          meta={EXERCISE_MAP.get(ex.exerciseId)}
          exercise={ex}
          previous={previousSets(history, ex.exerciseId, workout.id)}
          record={records.get(ex.exerciseId)}
          canSwap={ex.exerciseId in SHOULDER_SAFE_SWAPS}
          onUpdateSet={updateSet}
          onToggleSet={toggleSet}
          onAddSet={addSet}
          onRemoveSet={removeSet}
          onRemoveExercise={removeExercise}
          onSwap={swap}
        />
      ))}

      <button className="btn btn-block" onClick={() => setPicker({ mode: 'add' })}>
        <IconPlus size={18} /> Añadir ejercicio
      </button>
      <button className="btn btn-block btn-danger" onClick={discard}>
        Descartar entreno
      </button>
      <div className="dock-spacer" />

      {picker && (
        <ExercisePicker
          title={picker.mode === 'swap' ? 'Sustituir sin cargar el hombro' : 'Añadir ejercicio'}
          options={
            picker.mode === 'swap'
              ? (SHOULDER_SAFE_SWAPS[workout.exercises[picker.index]!.exerciseId] ?? [])
              : undefined
          }
          onPick={pickExercise}
          onClose={() => setPicker(null)}
        />
      )}
    </>
  );
}

