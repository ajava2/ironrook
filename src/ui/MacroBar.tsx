interface MacroBarProps {
  label: string;
  value: number;
  target: number;
  unit?: string;
  color: string;
}

export function MacroBar({ label, value, target, unit = 'g', color }: MacroBarProps) {
  const pct = target > 0 ? Math.min(100, (value / target) * 100) : 0;
  const over = value > target * 1.05;
  return (
    <div className="macro-bar">
      <div className="spread small">
        <span className="muted" style={{ fontWeight: 600 }}>
          {label}
        </span>
        <span className="num">
          {Math.round(value)}
          <span className="faint">
            /{Math.round(target)}
            {unit}
          </span>
        </span>
      </div>
      <div className="track">
        <div className={`fill${over ? ' over' : ''}`} style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}
