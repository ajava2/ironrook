import { useState } from 'react';
import { formatWeekday } from '../../core/dates';
import { exerciseName, EXERCISE_MAP } from '../../data/catalog';
import { uid } from '../../core/id';
import { decodeTemplate, encodeTemplate, moveItem } from '../../core/templates';
import type { Workout, WorkoutTemplate } from '../../core/types';
import { useAppData, useQuery } from '../../state/AppData';
import { IconPlus } from '../../ui/icons';
import { Sheet } from '../../ui/Sheet';
import { TemplateEditor } from './TemplateEditor';
import { useCreateExercise } from './useCreateExercise';

const DAY_SHORT = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

interface Props {
  history: Workout[];
  onStart: (tpl: WorkoutTemplate) => void;
}

type Dialog =
  | { kind: 'edit'; template: WorkoutTemplate | null }
  | { kind: 'share'; template: WorkoutTemplate }
  | { kind: 'import' }
  | null;

export function TemplatesSection({ history, onStart }: Props) {
  const { repo, invalidate, toast } = useAppData();
  const templates = useQuery((r) => r.allTemplates(), [], [] as WorkoutTemplate[]);
  const [dialog, setDialog] = useState<Dialog>(null);
  const createExercise = useCreateExercise();

  const save = async (t: WorkoutTemplate) => {
    const isNew = !templates.some((x) => x.id === t.id);
    await repo.saveTemplate(isNew ? { ...t, order: templates.length } : t);
    invalidate();
    setDialog(null);
    toast(isNew ? 'Rutina creada' : 'Rutina guardada', 'success');
  };

  const remove = async (t: WorkoutTemplate) => {
    if (!confirm(`¿Borrar la rutina "${t.name}"? Tu historial de entrenos no se toca.`)) return;
    await repo.deleteTemplate(t.id);
    invalidate();
    setDialog(null);
    toast('Rutina borrada');
  };

  const move = async (index: number, to: number) => {
    await repo.saveTemplateOrder(moveItem(templates, index, to).map((t) => t.id));
    invalidate();
  };

  return (
    <>
      {templates.length === 0 && (
        <section className="card empty-start">
          <div className="exercise-name">Empieza creando tu primera rutina</div>
          <p className="muted small">
            Elige los ejercicios, las series y el rango de repeticiones. Si un amigo te ha pasado un código, pégalo.
          </p>
          <div className="grid-2">
            <button className="btn btn-primary" onClick={() => setDialog({ kind: 'edit', template: null })}>
              <IconPlus size={18} /> Crear rutina
            </button>
            <button className="btn" onClick={() => setDialog({ kind: 'import' })}>
              Pegar código
            </button>
          </div>
        </section>
      )}

      {templates.map((tpl, index) => {
        const last = [...history].reverse().find((w) => w.templateId === tpl.id);
        return (
          <section key={tpl.id} className="card template-card">
            <div className="spread">
              <div>
                <div className="exercise-name">{tpl.name}</div>
                <div className="small faint">
                  {last ? `Último: ${formatWeekday(last.date)}` : 'Sin registros'} · {tpl.exercises.length} ejercicios
                </div>
              </div>
              {tpl.weekday !== undefined && <span className="chip chip-accent">{DAY_SHORT[tpl.weekday]}</span>}
            </div>
            <ul>
              {tpl.exercises.map((e, i) => (
                <li key={`${e.exerciseId}-${i}`}>
                  {exerciseName(e.exerciseId)}{' '}
                  <span className="faint">
                    {e.sets}×{e.repMin}-{e.repMax}
                  </span>
                </li>
              ))}
            </ul>
            <div className="row">
              <button className={`btn ${tpl.focus === 'legs' ? 'btn-primary' : 'btn-amber'}`} style={{ flex: 1 }} onClick={() => onStart(tpl)}>
                Empezar
              </button>
              <button className="btn btn-ghost" aria-label="Subir rutina" disabled={index === 0} onClick={() => move(index, index - 1)}>
                ↑
              </button>
              <button className="btn btn-ghost" aria-label="Bajar rutina" disabled={index === templates.length - 1} onClick={() => move(index, index + 1)}>
                ↓
              </button>
              <button className="btn" onClick={() => setDialog({ kind: 'edit', template: tpl })}>
                Editar
              </button>
            </div>
          </section>
        );
      })}

      {templates.length > 0 && (
        <div className="grid-2">
          <button className="btn" onClick={() => setDialog({ kind: 'edit', template: null })}>
            <IconPlus size={18} /> Nueva rutina
          </button>
          <button className="btn" onClick={() => setDialog({ kind: 'import' })}>
            Pegar código
          </button>
        </div>
      )}

      {dialog?.kind === 'edit' && (
        <TemplateEditor
          initial={dialog.template}
          newId={uid('tpl')}
          onSave={save}
          onDelete={remove}
          onShare={(t) => setDialog({ kind: 'share', template: t })}
          onClose={() => setDialog(null)}
          onCreateExercise={createExercise}
        />
      )}
      {dialog?.kind === 'share' && <ShareSheet template={dialog.template} onClose={() => setDialog(null)} />}
      {dialog?.kind === 'import' && (
        <ImportSheet
          onImport={async (t) => {
            await repo.saveTemplate({ ...t, order: templates.length });
            invalidate();
            setDialog(null);
            toast(`Rutina "${t.name}" añadida`, 'success');
          }}
          onClose={() => setDialog(null)}
        />
      )}
    </>
  );
}

function ShareSheet({ template, onClose }: { template: WorkoutTemplate; onClose: () => void }) {
  const { toast } = useAppData();
  const code = encodeTemplate(template);
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      toast('Código copiado', 'success');
    } catch {
      toast('No se pudo copiar: selecciona el texto y cópialo a mano', 'warn');
    }
  };

  const send = async () => {
    try {
      await navigator.share({ title: template.name, text: code });
    } catch {
      /* el usuario cerró el menú de compartir */
    }
  };

  return (
    <Sheet title={`Compartir "${template.name}"`} onClose={onClose}>
      <p className="muted small">
        Manda este código por WhatsApp. En su app: Entreno → Pegar código. Cada uno guarda su propia copia.
      </p>
      <textarea className="input" readOnly rows={5} value={code} onFocus={(e) => e.currentTarget.select()} />
      <div className="grid-2" style={{ marginTop: 10 }}>
        <button className="btn btn-primary" onClick={copy}>
          Copiar
        </button>
        {canShare && (
          <button className="btn" onClick={send}>
            Enviar…
          </button>
        )}
      </div>
    </Sheet>
  );
}

function ImportSheet({ onImport, onClose }: { onImport: (t: WorkoutTemplate) => void; onClose: () => void }) {
  const [text, setText] = useState('');
  const [error, setError] = useState<string>();
  const { toast } = useAppData();

  const known = new Set(EXERCISE_MAP.keys());

  const add = () => {
    const r = decodeTemplate(text, uid('tpl'), known);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    if (r.unknown.length > 0) {
      toast(`${r.unknown.length} ejercicio(s) no existen en tu app y se han quitado`, 'warn');
      const kept = r.template.exercises.filter((e) => known.has(e.exerciseId));
      if (kept.length === 0) {
        setError('Ningún ejercicio de esa rutina existe en tu app.');
        return;
      }
      onImport({ ...r.template, exercises: kept });
      return;
    }
    onImport(r.template);
  };

  return (
    <Sheet title="Pegar código de rutina" onClose={onClose}>
      <textarea
        className="input"
        rows={6}
        placeholder="Pega aquí el código que empieza por FITAI1:"
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setError(undefined);
        }}
      />
      {error && <p className="small" style={{ color: 'var(--danger)' }}>{error}</p>}
      <button className="btn btn-primary btn-block" style={{ marginTop: 10 }} disabled={!text.trim()} onClick={add}>
        Añadir rutina
      </button>
    </Sheet>
  );
}
