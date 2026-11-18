import type { Macros } from '../../core/types';

export function MacroInline({ m, showKcal = false }: { m: Macros; showKcal?: boolean }) {
  return (
    <div className="macro-inline num">
      {showKcal && <span>{Math.round(m.kcal)} kcal</span>}
      <span className="p">P {Math.round(m.protein)}</span>
      <span className="c">C {Math.round(m.carbs)}</span>
      <span className="f">G {Math.round(m.fat)}</span>
    </div>
  );
}
