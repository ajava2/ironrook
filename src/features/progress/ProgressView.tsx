import { useMemo, useState } from 'react';
import { addDays, formatShort, today } from '../../core/dates';
import { averageAdherence, dailyAdherence } from '../../core/progress';
import { emaTrend, weeklyRate } from '../../core/trend';
import type { BodyWeight, MealEntry, Workout } from '../../core/types';
import { e1rmHistory, personalRecords, weeklyVolume } from '../../core/volume';
import { EXERCISE_MAP, exerciseName } from '../../data/catalog';
import { useAppData, useQuery } from '../../state/AppData';
import { BarChart, ChartCard, Legend, LineChart, NEUTRAL_MARK, SERIES_COLORS, type LineSeries } from '../../ui/charts';

const RANGES = [
  { days: 21, label: '3 sem' },
  { days: 42, label: '6 sem' },
  { days: 90, label: '3 meses' },
] as const;

const KEY_LIFTS = ['v_squat', 'smith_squat', 'hack_squat'];

export function ProgressView() {
  const { repo, profile, invalidate, toast } = useAppData();
  const [range, setRange] = useState<number>(21);
  const end = today();
  const start = addDays(end, -range);
  const domain: [string, string] = [start, end];

  const weights = useQuery((r) => r.allWeights(), [], [] as BodyWeight[]);
  const meals = useQuery((r) => r.mealsBetween(start, end), [start, end], [] as MealEntry[]);
  const workouts = useQuery((r) => r.allWorkouts(), [], [] as Workout[]);
  const [weightInput, setWeightInput] = useState('');

  const ema = useMemo(() => emaTrend(weights.map((w) => ({ date: w.date, value: w.kg }))), [weights]);
  const inRange = <T extends { date: string }>(xs: readonly T[]) => xs.filter((p) => p.date >= start && p.date <= end);
  const trendNow = ema.at(-1)?.value;
  const rate = weeklyRate(ema.slice(-14));

  const adherenceDays = useMemo(() => dailyAdherence(meals, workouts, profile, EXERCISE_MAP), [meals, workouts, profile]);
  const avgAdh7 = averageAdherence(adherenceDays.filter((d) => d.date > addDays(end, -7)));

  const volume = useMemo(() => weeklyVolume(workouts.filter((w) => w.date >= start), EXERCISE_MAP), [workouts, start]);
  const records = useMemo(() => personalRecords(workouts), [workouts]);
  const prsThisMonth = [...records.values()].filter((r) => r.bestE1RMDate > addDays(end, -30)).length;

  const weightSeries: LineSeries[] = [
    { id: 'raw', label: 'Peso diario', color: NEUTRAL_MARK, kind: 'dots', points: inRange(weights).map((w) => ({ x: w.date, y: w.kg })) },
    { id: 'ema', label: 'Tendencia 7 d (EMA)', color: SERIES_COLORS[0], kind: 'line', points: inRange(ema).map((p) => ({ x: p.date, y: p.value })) },
  ];

  const liftSeries: LineSeries[] = KEY_LIFTS.map((id, i) => ({
    id,
    label: exerciseName(id),
    color: SERIES_COLORS[i]!,
    kind: 'line' as const,
    points: e1rmHistory(workouts, id)
      .filter((p) => p.date >= start)
      .map((p) => ({ x: p.date, y: p.e1rm })),
  })).filter((s) => s.points.length > 0);

  const logWeight = async () => {
    const kg = Number.parseFloat(weightInput.replace(',', '.'));
    if (!Number.isFinite(kg) || kg < 30 || kg > 300) {
      toast('Peso no válido', 'error');
      return;
    }
    await repo.saveWeight(end, kg);
    setWeightInput('');
    invalidate();
    toast(`Peso de hoy: ${kg} kg`, 'success');
  };

  const todayWeight = weights.find((w) => w.date === end);

  return (
    <>
      <div className="range-tabs" role="tablist" aria-label="Rango temporal">
        {RANGES.map((r) => (
          <button
            key={r.days}
            role="tab"
            aria-selected={range === r.days}
            className={`chip${range === r.days ? ' chip-accent' : ''}`}
            style={{ padding: '6px 12px', fontSize: 12 }}
            onClick={() => setRange(r.days)}
          >
            {r.label}
          </button>
        ))}
      </div>

      <div className="stat-tiles">
        <div className="stat-tile">
          <div className="label">Tendencia</div>
          <div className="value num">{trendNow ?? '—'}</div>
          <div className="delta num">
            {rate >= 0 ? '+' : ''}
            {rate} kg/sem
          </div>
        </div>
        <div className="stat-tile">
          <div className="label">Cumplim. 7 d</div>
          <div className="value num">{avgAdh7}%</div>
          <div className="delta">de las kcal objetivo</div>
        </div>
        <div className="stat-tile">
          <div className="label">PR e1RM 30 d</div>
          <div className="value num">{prsThisMonth}</div>
          <div className="delta">ejercicios</div>
        </div>
      </div>

      <section className="card row">
        <input
          className="input num"
          inputMode="decimal"
          placeholder={todayWeight ? `Hoy: ${todayWeight.kg} kg` : 'Peso de hoy (kg)'}
          value={weightInput}
          onChange={(e) => setWeightInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void logWeight()}
        />
        <button className="btn btn-primary" onClick={() => void logWeight()} disabled={!weightInput}>
          Guardar
        </button>
      </section>

      <ChartCard title="Peso corporal vs tendencia real" subtitle="Pesajes diarios y media móvil exponencial de 7 días (kg)">
        <Legend
          items={[
            { label: 'Peso diario', color: NEUTRAL_MARK, kind: 'dot' },
            { label: 'Tendencia 7 d', color: SERIES_COLORS[0], kind: 'line' },
          ]}
        />
        <LineChart series={weightSeries} domain={domain} unit="kg" ariaLabel="Peso corporal diario y su tendencia EMA de 7 días" />
        <div className="small muted" style={{ margin: '12px 0 4px', fontWeight: 600 }}>
          Cumplimiento calórico (% del objetivo dinámico del día)
        </div>
        <BarChart
          bars={adherenceDays
            .filter((d) => d.date >= start)
            .map((d) => ({
              key: d.date,
              x: d.date,
              value: d.pct,
              title: `${formatShort(d.date)} · ${d.kcal}/${d.target} kcal${d.legDay ? ' · pierna' : ''}`,
            }))}
          domain={domain}
          color={SERIES_COLORS[1]}
          unit="%"
          label="del objetivo"
          refLine={{ value: 100, label: '100 %' }}
          ariaLabel="Porcentaje de las kcal objetivo consumidas cada día"
        />
        <details>
          <summary>Ver tabla</summary>
          <table className="data-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th className="num">Peso</th>
                <th className="num">Tendencia</th>
                <th className="num">kcal</th>
              </tr>
            </thead>
            <tbody>
              {inRange(ema)
                .slice()
                .reverse()
                .map((p) => {
                  const raw = weights.find((w) => w.date === p.date);
                  const adh = adherenceDays.find((d) => d.date === p.date);
                  return (
                    <tr key={p.date}>
                      <td>{formatShort(p.date)}</td>
                      <td className="num">{raw?.kg ?? '—'}</td>
                      <td className="num">{p.value}</td>
                      <td className="num">{adh ? `${adh.kcal} (${adh.pct}%)` : '—'}</td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </details>
      </ChartCard>

      <ChartCard title="Volumen semanal de pierna" subtitle="Series efectivas de tren inferior y tonelaje total (kg × reps)">
        <div className="stack">
          <div>
            <div className="small muted" style={{ fontWeight: 600 }}>Series efectivas</div>
            <BarChart
              bars={volume.map((v) => ({ key: v.weekStart, x: formatShort(v.weekStart), value: v.sets, title: `Semana del ${formatShort(v.weekStart)}` }))}
              color={SERIES_COLORS[0]}
              unit="series"
              label="efectivas"
              height={130}
              ariaLabel="Series efectivas de pierna por semana"
            />
          </div>
          <div>
            <div className="small muted" style={{ fontWeight: 600, marginTop: 8 }}>Tonelaje (kg)</div>
            <BarChart
              bars={volume.map((v) => ({ key: v.weekStart, x: formatShort(v.weekStart), value: v.tonnage, title: `Semana del ${formatShort(v.weekStart)}` }))}
              color={SERIES_COLORS[2]}
              unit="kg"
              label="kg × reps"
              height={130}
              ariaLabel="Tonelaje semanal de pierna"
            />
          </div>
        </div>
      </ChartCard>

      <ChartCard title="1RM estimado (Epley)" subtitle="Mejor serie de cada sesión: w · (1 + reps/30)">
        <Legend items={liftSeries.map((s) => ({ label: s.label, color: s.color, kind: 'line' as const }))} />
        <LineChart series={liftSeries} domain={domain} unit="kg" endLabels ariaLabel="Evolución del 1RM estimado en los básicos de pierna" />
      </ChartCard>

      <section className="card">
        <h2>Récords personales</h2>
        <table className="data-table">
          <thead>
            <tr>
              <th>Ejercicio</th>
              <th className="num">e1RM</th>
              <th className="num">Peso máx</th>
              <th className="num">Fecha</th>
            </tr>
          </thead>
          <tbody>
            {[...records.values()]
              .sort((a, b) => b.bestE1RM - a.bestE1RM)
              .map((r) => (
                <tr key={r.exerciseId}>
                  <td>{exerciseName(r.exerciseId)}</td>
                  <td className="num">{r.bestE1RM}</td>
                  <td className="num">{r.bestWeight}</td>
                  <td className="num faint">{formatShort(r.bestE1RMDate)}</td>
                </tr>
              ))}
          </tbody>
        </table>
        {records.size === 0 && <div className="empty">Sin récords todavía</div>}
      </section>
    </>
  );
}
