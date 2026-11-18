import { useEffect, useRef, useState } from 'react';
import { uid } from '../../core/id';
import { scaleMacros } from '../../core/macros';
import type { FoodItem, MealItem } from '../../core/types';
import { startBarcodeScanner, type ScannerHandle } from '../../services/barcode';
import { fileToAIImage } from '../../services/image';
import { readNutritionLabel } from '../../services/nutritionAI';
import { fetchProduct } from '../../services/openFoodFacts';
import { useAppData, useQuery } from '../../state/AppData';
import { useAISettings } from '../../state/useAISettings';
import { IconCamera, IconLabel } from '../../ui/icons';
import { Sheet } from '../../ui/Sheet';
import { MacroInline } from './MacroInline';

type Phase =
  | { kind: 'scan' }
  | { kind: 'loading'; text: string }
  | { kind: 'found'; food: FoodItem; simulated?: boolean }
  | { kind: 'notfound'; barcode?: string; error?: string };

interface FoodSheetProps {
  mode: 'barcode' | 'label';
  onAdd: (name: string, item: MealItem, source: 'barcode' | 'label') => void;
  onClose: () => void;
}

/**
 * Flujo de alimento envasado:
 *   código → caché local (foods) → OpenFoodFacts → [no está] → foto de la etiqueta con IA → caché
 * Todo lo encontrado se guarda en `foods`, así que el segundo escaneo es instantáneo y offline.
 */
export function FoodSheet({ mode, onAdd, onClose }: FoodSheetProps) {
  const { repo, invalidate } = useAppData();
  const { client } = useAISettings();
  const [phase, setPhase] = useState<Phase>(mode === 'barcode' ? { kind: 'scan' } : { kind: 'notfound' });
  const [manual, setManual] = useState('');
  const [grams, setGrams] = useState(100);
  const [cameraError, setCameraError] = useState<string>();
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const recent = useQuery((r) => r.allFoods(), [], [] as FoodItem[]);

  const lookup = async (barcode: string) => {
    const code = barcode.trim();
    if (!/^\d{6,14}$/.test(code)) {
      setPhase({ kind: 'notfound', error: 'Código no válido (6-14 dígitos)' });
      return;
    }
    setPhase({ kind: 'loading', text: `Buscando ${code}…` });
    try {
      const cached = await repo.foodByBarcode(code);
      if (cached) return setPhase({ kind: 'found', food: cached });
      const product = await fetchProduct(code);
      if (product) {
        await repo.saveFood(product);
        invalidate();
        return setPhase({ kind: 'found', food: product });
      }
      setPhase({ kind: 'notfound', barcode: code });
    } catch (e) {
      setPhase({ kind: 'notfound', barcode: code, error: e instanceof Error ? e.message : String(e) });
    }
  };

  useEffect(() => {
    if (phase.kind !== 'scan' || !videoRef.current) return;
    let handle: ScannerHandle | undefined;
    let cancelled = false;
    startBarcodeScanner(videoRef.current, (code) => void lookup(code))
      .then((h) => {
        if (cancelled) h.stop();
        else handle = h;
      })
      .catch((e: unknown) => setCameraError(e instanceof Error ? e.message : 'Cámara no disponible'));
    return () => {
      cancelled = true;
      handle?.stop();
    };
  }, [phase.kind]);

  const readLabel = async (file: File) => {
    const barcode = phase.kind === 'notfound' ? phase.barcode : undefined;
    setPhase({ kind: 'loading', text: client ? 'Leyendo la tabla nutricional…' : 'Simulando lectura…' });
    try {
      const { image } = await fileToAIImage(file);
      const label = await readNutritionLabel(client, image);
      const food: FoodItem = {
        id: barcode ? `off_${barcode}` : uid('food'),
        name: label.name,
        brand: label.brand ?? undefined,
        barcode,
        per100g: label.per100g,
        source: 'label',
        updatedAt: Date.now(),
      };
      if (!label.simulated) {
        await repo.saveFood(food);
        invalidate();
      }
      setPhase({ kind: 'found', food, simulated: label.simulated });
    } catch (e) {
      setPhase({ kind: 'notfound', barcode, error: e instanceof Error ? e.message : String(e) });
    }
  };

  return (
    <Sheet title={mode === 'barcode' ? 'Código de barras' : 'Etiqueta nutricional'} onClose={onClose}>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) void readLabel(f);
        }}
      />

      {phase.kind === 'scan' && (
        <>
          {cameraError ? (
            <div className="note">Cámara no disponible ({cameraError}). Escribe el código a mano.</div>
          ) : (
            <video ref={videoRef} className="scanner-video" muted playsInline />
          )}
          <div className="row" style={{ marginTop: 10 }}>
            <input
              className="input num"
              inputMode="numeric"
              placeholder="8480000123456"
              value={manual}
              onChange={(e) => setManual(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void lookup(manual)}
            />
            <button className="btn btn-primary" onClick={() => void lookup(manual)}>
              Buscar
            </button>
          </div>
        </>
      )}

      {phase.kind === 'loading' && (
        <div className="empty row" style={{ justifyContent: 'center' }}>
          <div className="spinner" /> {phase.text}
        </div>
      )}

      {phase.kind === 'notfound' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {phase.error && <div className="note">{phase.error}</div>}
          {phase.barcode && !phase.error && (
            <div className="note">El código {phase.barcode} no está en OpenFoodFacts.</div>
          )}
          <p className="muted small" style={{ margin: 0 }}>
            Haz una foto a la tabla de valores por 100 g del envase. La IA la lee y el alimento queda guardado en tu caché
            local para siempre{phase.barcode ? ' asociado a este código' : ''}.
          </p>
          <button className="btn btn-primary btn-block" onClick={() => fileRef.current?.click()}>
            <IconLabel size={18} /> Leer tabla nutricional por foto
          </button>
          {mode === 'barcode' && (
            <button className="btn btn-block" onClick={() => setPhase({ kind: 'scan' })}>
              <IconCamera size={18} /> Volver a escanear
            </button>
          )}
        </div>
      )}

      {phase.kind === 'found' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {phase.simulated && (
            <div className="note">Modo simulación: valores de ejemplo. Configura Gemini en Ajustes para leer la etiqueta real.</div>
          )}
          <div>
            <div style={{ fontWeight: 750, fontSize: 17 }}>{phase.food.name}</div>
            <div className="small faint">
              {phase.food.brand ? `${phase.food.brand} · ` : ''}por 100 g: {phase.food.per100g.kcal} kcal
            </div>
            <MacroInline m={phase.food.per100g} />
          </div>
          <div className="row">
            <input type="range" min={5} max={500} step={5} value={grams} onChange={(e) => setGrams(Number(e.target.value))} />
            <span className="num" style={{ minWidth: 60, textAlign: 'right', fontWeight: 700 }}>
              {grams} g
            </span>
          </div>
          <div className="card spread" style={{ background: 'var(--surface-2)' }}>
            <span className="num" style={{ fontWeight: 800, fontSize: 20 }}>
              {scaleMacros(phase.food.per100g, grams).kcal} kcal
            </span>
            <MacroInline m={scaleMacros(phase.food.per100g, grams)} />
          </div>
          <button
            className="btn btn-primary btn-block"
            onClick={() =>
              onAdd(
                phase.food.name,
                { name: phase.food.name, grams, ...scaleMacros(phase.food.per100g, grams) },
                mode,
              )
            }
          >
            Añadir {grams} g
          </button>
        </div>
      )}

      {(phase.kind === 'scan' || phase.kind === 'notfound') && recent.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div className="section-title">Mis alimentos guardados</div>
          <div className="picker-list">
            {[...recent]
              .sort((a, b) => b.updatedAt - a.updatedAt)
              .slice(0, 6)
              .map((f) => (
                <button key={f.id} className="picker-item" onClick={() => setPhase({ kind: 'found', food: f })}>
                  <span>
                    <div style={{ fontWeight: 650 }}>{f.name}</div>
                    <div className="small faint">{f.brand ?? f.source}</div>
                  </span>
                  <span className="num small">{f.per100g.kcal} kcal/100g</span>
                </button>
              ))}
          </div>
        </div>
      )}
    </Sheet>
  );
}
