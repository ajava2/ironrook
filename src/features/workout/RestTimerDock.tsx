import { useRestTimer } from '../../state/RestTimer';
import { IconTimer, IconX } from '../../ui/icons';
import './workout.css';

const PRESETS = [90, 120, 180];

function mmss(sec: number): string {
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
}

export function RestTimerDock() {
  const { endsAt, duration, remaining, finished, start, adjust, stop } = useRestTimer();
  if (!endsAt) return null;
  const progress = duration > 0 ? 1 - remaining / duration : 1;

  return (
    <div className={`rest-dock${finished ? ' done' : ''}`} role="timer" aria-live="off">
      <div className="rest-progress" style={{ transform: `scaleX(${progress})` }} />
      <div className="rest-main">
        <div className="row">
          <IconTimer size={18} />
          <span className="rest-time num">{finished ? '¡A por la siguiente!' : mmss(remaining)}</span>
        </div>
        <div className="row">
          <button className="btn btn-sm" onClick={() => adjust(-15)} disabled={finished}>
            −15s
          </button>
          <button className="btn btn-sm" onClick={() => adjust(15)} disabled={finished}>
            +15s
          </button>
          <button className="btn btn-sm btn-ghost" onClick={stop} aria-label="Cerrar temporizador">
            <IconX size={18} />
          </button>
        </div>
      </div>
      <div className="rest-presets">
        {PRESETS.map((p) => (
          <button key={p} className={`chip${p === duration ? ' chip-accent' : ''}`} onClick={() => start(p)}>
            {p}s
          </button>
        ))}
      </div>
    </div>
  );
}
