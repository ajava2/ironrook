import { useState } from 'react';
import { CustomExerciseSchema } from '../../core/schemas';
import { uid } from '../../core/id';
import type { Exercise, MuscleGroup } from '../../core/types';
import { GROUP_LABEL } from '../../data/catalog';
import { Sheet } from '../../ui/Sheet';

const MUSCLE_ORDER = Object.keys(GROUP_LABEL) as MuscleGroup[];

const EQUIPMENT: { value: Exercise['equipment']; label: string }[] = [
  { value: 'machine', label: 'Máquina' },
  { value: 'cable', label: 'Polea' },
  { value: 'dumbbell', label: 'Mancuernas' },
  { value: 'barbell', label: 'Barra' },
  { value: 'smith', label: 'Multipower' },
  { value: 'bodyweight', label: 'Peso corporal' },
];

interface Props {
  /** Nombre que ya había escrito el usuario en el buscador, para no hacerle teclearlo dos veces. */
  initialName?: string;
  onSave: (e: Exercise) => void;
  onClose: () => void;
}

export function CreateExerciseSheet({ initialName = '', onSave, onClose }: Props) {
  const [name, setName] = useState(initialName);
  const [primary, setPrimary] = useState<MuscleGroup>('chest');
  const [secondary, setSecondary] = useState<MuscleGroup[]>([]);
  const [equipment, setEquipment] = useState<Exercise['equipment']>('machine');
  const [incrementText, setIncrementText] = useState('5');
  const [shoulderFriendly, setShoulderFriendly] = useState(true);
  const [error, setError] = useState<string>();

  const toggleSecondary = (m: MuscleGroup) =>
    setSecondary((list) => (list.includes(m) ? list.filter((x) => x !== m) : list.length < 3 ? [...list, m] : list));

  const save = () => {
    const candidate = {
      id: uid('custom'),
      name: name.trim(),
      primary,
      secondary: secondary.filter((m) => m !== primary),
      equipment,
      shoulderFriendly,
      increment: Number.parseFloat(incrementText.replace(',', '.')),
    };
    const parsed = CustomExerciseSchema.safeParse(
      candidate.secondary.length === 0 ? { ...candidate, secondary: undefined } : candidate,
    );
    if (!parsed.success) {
      setError(name.trim() ? 'Revisa el salto de peso: tiene que ser un número entre 0,25 y 50.' : 'Ponle un nombre al ejercicio.');
      return;
    }
    onSave(parsed.data as Exercise);
  };

  return (
    <Sheet title="Crear ejercicio" onClose={onClose}>
      <div className="editor">
        <label className="field">
          Nombre
          <input className="input" value={name} maxLength={60} placeholder="Ej: Press en máquina Hammer" onChange={(e) => setName(e.target.value)} />
        </label>

        <label className="field">
          Músculo principal
          <select className="input" value={primary} onChange={(e) => setPrimary(e.target.value as MuscleGroup)}>
            {MUSCLE_ORDER.map((m) => (
              <option key={m} value={m}>
                {GROUP_LABEL[m]}
              </option>
            ))}
          </select>
        </label>

        <div className="field">
          Músculos secundarios (opcional, máx. 3)
          <div className="row" style={{ flexWrap: 'wrap', marginTop: 6 }}>
            {MUSCLE_ORDER.filter((m) => m !== primary).map((m) => (
              <button
                key={m}
                type="button"
                className={`chip ${secondary.includes(m) ? 'chip-accent' : ''}`}
                aria-pressed={secondary.includes(m)}
                onClick={() => toggleSecondary(m)}
              >
                {GROUP_LABEL[m]}
              </button>
            ))}
          </div>
        </div>

        <div className="grid-2">
          <label className="field">
            Equipo
            <select className="input" value={equipment} onChange={(e) => setEquipment(e.target.value as Exercise['equipment'])}>
              {EQUIPMENT.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Salto de peso (kg)
            <input className="input num" inputMode="decimal" value={incrementText} onChange={(e) => setIncrementText(e.target.value)} />
          </label>
        </div>

        <label className="row small">
          <input type="checkbox" checked={shoulderFriendly} onChange={(e) => setShoulderFriendly(e.target.checked)} />
          Es cómodo para el hombro (sin forzar rotación interna ni por encima de la cabeza)
        </label>

        {error && (
          <p className="small" style={{ color: 'var(--danger)', margin: 0 }}>
            {error}
          </p>
        )}
        <button className="btn btn-primary btn-block" onClick={save}>
          Guardar ejercicio
        </button>
      </div>
    </Sheet>
  );
}
