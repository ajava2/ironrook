# Arquitectura de Fit AI Tracker

Documento para entender la app por dentro: qué hace cada carpeta, por dónde viajan los datos
y de dónde sale cada número que ves en pantalla. Está escrito para leerlo con el código abierto
al lado; cada sección nombra los ficheros donde está la implementación.

---

## 1. Visión general

Es una **PWA offline-first**: una web estática (HTML + JS + CSS) que el navegador instala como
app, guarda todos tus datos en **IndexedDB** dentro del propio móvil y solo sale a Internet para
tres cosas opcionales: la IA (Gemini / Groq / Ollama), OpenFoodFacts y PocketBase.

| Pieza | Elección | Por qué |
|---|---|---|
| UI | React 19 + TypeScript | Componentes y estado local sin framework pesado. |
| Build | Vite 7 | Arranque instantáneo en desarrollo y bundle estático para GitHub Pages. |
| PWA | vite-plugin-pwa (Workbox) | Genera el `manifest` y un service worker que precachea la app. |
| Base de datos | IndexedDB vía `idb` | Base de datos transaccional del navegador, con índices y sin límite práctico de 5 MB como `localStorage`. |
| Validación | zod | Todo lo que entra de fuera (IA, OpenFoodFacts, ficheros) se valida antes de tocar la base de datos. |
| Gráficas | SVG propio (`src/ui/charts.tsx`) | ~300 líneas, sin dependencia; así ves exactamente cómo se pinta cada punto. |
| Tests | Vitest + fake-indexeddb | Tests de la lógica pura y del repositorio contra una IndexedDB simulada en Node. |

No hay backend propio. "Servidor" = los ficheros estáticos de GitHub Pages.

---

## 2. Mapa de carpetas

```
fit-ai-tracker/
├── index.html                 punto de entrada; carga src/main.tsx
├── vite.config.ts             build, PWA (manifest + service worker) y config de Vitest
├── public/                    iconos de la app (se copian tal cual a dist/)
├── .github/workflows/         CI: tests + build + despliegue a GitHub Pages
├── tests/                     tests automáticos (espejo de src/)
│   ├── core/                  matemáticas y lógica pura
│   └── data/                  repositorio IndexedDB y generador de demo
└── src/
    ├── main.tsx               monta React y registra el service worker
    ├── App.tsx                shell: barra superior, rutas por hash, barra inferior
    │
    ├── core/                  ★ LÓGICA PURA. Sin React, sin navegador, sin red.
    │   ├── types.ts           modelo de dominio (Workout, MealEntry, Macros…)
    │   ├── macros.ts          Atwater, escalado por gramos, restantes, adherencia
    │   ├── oneRepMax.ts       Epley y detección de PRs
    │   ├── volume.ts          series efectivas, volumen semanal, historial de e1RM
    │   ├── targets.ts         objetivo dinámico (+200 kcal en día de pierna)
    │   ├── trend.ts           media móvil exponencial y pendiente por mínimos cuadrados
    │   ├── session.ts         crear/terminar un entreno a partir de una plantilla
    │   ├── progress.ts        cumplimiento calórico diario
    │   ├── suggest.ts         ranking de comidas según los macros que faltan
    │   ├── coach.ts           prompt de sistema del coach y respuestas locales
    │   ├── foodText.ts        parser de texto libre ("120g de lomo") sin IA
    │   ├── schemas.ts         esquemas zod + extractor de JSON de respuestas de LLM
    │   ├── openFoodFacts.ts   traduce la respuesta de OpenFoodFacts a FoodItem
    │   ├── csv.ts, exportCsv.ts   exportación CSV (RFC 4180)
    │   ├── merge.ts, pbId.ts  fusión last-write-wins e ids para PocketBase
    │   └── dates.ts, id.ts    fechas locales y generación de ids
    │
    ├── data/                  ★ PERSISTENCIA Y DATOS DE REFERENCIA
    │   ├── db.ts              esquema de IndexedDB y migraciones
    │   ├── repository.ts      ÚNICO acceso a IndexedDB (leer, guardar, backup, demo)
    │   ├── catalog.ts         ejercicios, plantillas y sustitutos "hombro seguro"
    │   ├── foodDb.ts          ~35 alimentos base por 100 g (para el modo sin IA)
    │   ├── defaults.ts        tu perfil por defecto y comidas favoritas iniciales
    │   └── demo.ts            generador determinista de 3 semanas de demo
    │
    ├── services/              ★ ENTRADA/SALIDA CON EL MUNDO EXTERIOR
    │   ├── ai/                clientes Gemini, Groq (formato OpenAI) y Ollama
    │   ├── nutritionAI.ts     prompts de visión/texto/etiqueta + fallback local
    │   ├── openFoodFacts.ts   fetch a la API de OpenFoodFacts
    │   ├── barcode.ts         cámara → código (BarcodeDetector nativo o ZXing)
    │   ├── image.ts           comprime la foto a ≤1024 px JPEG y la pasa a base64
    │   ├── pocketbase.ts      login y sincronización con tu PocketBase
    │   └── settings.ts        API keys y URLs en localStorage
    │
    ├── state/                 ★ PEGAMENTO ENTRE DATOS Y REACT
    │   ├── AppData.tsx        abre la BD, siembra, expone repo/perfil/toasts y useQuery
    │   ├── RestTimer.tsx      temporizador de descanso global
    │   ├── useDaySummary.ts   comidas + entrenos + objetivo dinámico de un día
    │   └── useAISettings.ts   configuración de IA reactiva
    │
    ├── features/              ★ PANTALLAS (una carpeta por pestaña)
    │   ├── workout/           Entreno: plantillas, sesión activa, temporizador
    │   ├── nutrition/         Nutrición: favoritos, foto, código, etiqueta, texto
    │   ├── coach/             Coach IA: chat y consultas rápidas
    │   ├── progress/          Progreso: gráficas y récords
    │   └── settings/          Ajustes: perfil, IA, copias, sincronización
    │
    ├── ui/                    componentes genéricos (Sheet, gráficas, iconos, Markdown)
    └── styles/global.css      tokens de diseño (colores, radios) y piezas base
```

### Regla de dependencias

Las flechas indican "puede importar a". Nunca al revés.

```
  features/  ──►  state/  ──►  data/  ──►  core/
      │              │          ▲            ▲
      │              └────► services/ ───────┘
      └──────────► ui/
```

- `core/` no importa nada del resto: por eso se testea en Node sin navegador.
- `data/repository.ts` es la única pieza que habla con IndexedDB. Si mañana cambias a SQLite o
  a PocketBase como fuente principal, solo cambia esa clase.
- `services/` encapsula la red. La UI nunca hace `fetch` directamente.

---

## 3. Cómo viajan los datos

### 3.1 Apuntar una serie

```
 Tocas ✓ en la serie 2 de V-Squat
          │
          ▼
 ExerciseCard ──onToggleSet──► ActiveWorkout.toggleSet()          features/workout/WorkoutView.tsx
                                  │
          ┌───────────────────────┼─────────────────────────────┬───────────────────────────┐
          ▼                       ▼                             ▼                           ▼
 set.done = true          timer.start(restSec)          detectPR(set, sesión,       onChange(workout)
 completedAt = now        state/RestTimer.tsx            récords históricos)              │
                          guarda la HORA DE FIN          core/oneRepMax.ts                ▼
                          (no los segundos)                  │                   repo.setActiveWorkout()
                                                             ▼                   IndexedDB · meta/activeWorkout
                                                      toast "🏆 PR" + vibración  (sobrevive a recargas)

 Tocas "Terminar"
          │
          ▼
 finalizeWorkout()  ── quita series sin marcar y ejercicios vacíos      core/session.ts
          │
          ▼
 repo.saveWorkout()  ──►  IndexedDB · store "workouts" (índice by_date)
          │
          ▼
 invalidate()  ── sube `version` ──► todos los useQuery se vuelven a ejecutar
          │
          ▼
 dailyTargets(perfil, entrenos de hoy)  ── ¿≥12 series de pierna? ──► +200 kcal en Nutrición
```

### 3.2 Foto del plato

```
 <input type="file" capture="environment">          features/nutrition/NutritionView.tsx
          │  File (4 MB, 4000×3000)
          ▼
 fileToAIImage()                                      services/image.ts
   createImageBitmap → canvas 1024 px → JPEG 0.8 → base64   (~150 KB)
          │
          ▼
 analyzeMealPhoto(client, image)                      services/nutritionAI.ts
   ├─ client == null (sin API key) ──► plato simulado según la hora (modo simulación)
   └─ GeminiClient.json(system, prompt, image)        services/ai/gemini.ts
          │  POST generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent
          │  body: { contents:[{parts:[{inlineData:{mimeType,data}}, {text: prompt}]}],
          │          generationConfig:{ responseMimeType:"application/json" } }
          ▼
 texto del modelo ──► extractJson() ──► FoodAnalysisSchema.parse()     core/schemas.ts
                       (quita ```json,   (traduce "calorias"→kcal, "12,5"→12.5,
                        cuenta llaves)    recalcula kcal si faltan, rechaza negativos)
          │
          ▼
 ReviewSheet: un deslizador de gramos por ingrediente
   rescaleItem(item, g) mantiene macros/gramo constantes             core/macros.ts
          │  "Añadir a hoy"
          ▼
 repo.saveMeal({ date, time, source:"photo", items })  ──►  IndexedDB · store "meals"
```

### 3.3 Código de barras y etiqueta

```
 cámara ──► BarcodeDetector nativo (Chrome Android)  ─┐       services/barcode.ts
        └─► ZXing cargado bajo demanda (iOS/Firefox) ─┤
 teclado ─────────────────────────────────────────────┘
          │  "8480000123456"
          ▼
 repo.foodByBarcode()  ── hit ──────────────────────────────►  ficha del producto
          │ miss                                                     ▲
          ▼                                                          │
 fetchProduct()  GET world.openfoodfacts.org/api/v2/product/{code}.json
          │      parseOpenFoodFacts(): nutriments.*_100g, kJ→kcal si hace falta
          ├─ encontrado ──► repo.saveFood() (caché permanente) ──────┘
          └─ no existe ──► "Leer tabla nutricional por foto"
                              readNutritionLabel(): IA lee la columna por 100 g
                              ──► repo.saveFood({ barcode, source:"label" }) ──┘

 ficha ──► deslizador de gramos ──► scaleMacros(per100g, g) ──► repo.saveMeal()
```

### 3.4 Coach IA

```
 useDaySummary(hoy) ─┐  objetivo dinámico, consumido, restante, comidas de hoy
 workoutsBetween()   ├──► buildCoachSystemPrompt()   core/coach.ts
 allWeights()        │      texto con el estado real (lo ves en "Contexto")
 allFavorites()     ─┘
          │
          ▼
 [system, …últimos 12 mensajes, user]  ──►  client.chat()  ──►  respuesta
          │                                    │ error o sin key
          │                                    ▼
          │                         coach local determinista:
          │                         localDinnerAdvice / localLegAnalysis / localShoulderSwap
          ▼
 repo.saveChatMessage()  ──►  IndexedDB · store "chat"
```

El prompt se reconstruye en **cada** mensaje, así el modelo siempre razona con lo que falta
*ahora*, no con lo que faltaba cuando empezó la conversación.

### 3.5 Reactividad sin librería de estado

`state/AppData.tsx` guarda un contador `version`. Cada escritura llama a `invalidate()`, que lo
incrementa; `useQuery(fn, deps)` tiene `version` entre sus dependencias, así que todas las
lecturas visibles se repiten. Es el patrón más simple que funciona con una base de datos
asíncrona: no hay caché que invalidar a mano ni riesgo de que una pantalla muestre datos viejos.

---

## 4. La base de datos (IndexedDB)

IndexedDB es una base de datos clave-valor transaccional del navegador. Cada "tabla" es un
*object store* y guarda objetos JavaScript tal cual.

```
 BD "fit-ai-tracker" · versión 1                                     src/data/db.ts

 store        clave (keyPath)   índices        contenido
 ─────────    ───────────────   ───────────    ──────────────────────────────────────────
 workouts     id                by_date        sesiones terminadas con ejercicios y series
 meals        id                by_date        comidas con su lista de ingredientes y macros
 weights      date              —              un pesaje por día (la fecha ES la clave)
 foods        id                by_barcode     caché de OpenFoodFacts y etiquetas leídas
 favorites    id                —              botones "1 clic"
 chat         id                —              conversación con el coach
 meta         (clave externa)   —              profile · activeWorkout · seeded · lastSync
```

- **Índice `by_date`**: `mealsOn('2026-10-28')` no recorre todas las comidas; IndexedDB va directa
  a las de esa fecha. `mealsBetween(a, b)` usa `IDBKeyRange.bound(a, b)` sobre el mismo índice
  (las fechas `YYYY-MM-DD` ordenan bien como texto).
- **Migraciones**: `upgrade(db, oldVersion)` ejecuta `if (oldVersion < N)` en orden. Para añadir un
  store en el futuro subes `DB_VERSION` a 2 y añades un bloque `if (oldVersion < 2)`.
- **Transacciones**: `importBackup` valida todo el fichero con zod *antes* de abrir la transacción
  y escribe todo dentro de una sola: o entra la copia entera o no entra nada.
- **Datos demo**: llevan `demo: true`. "Limpiar datos de demo" recorre los stores con un cursor y
  borra solo esos, así no pierdes lo que hayas registrado tú encima.
- **Lo que NO está en IndexedDB**: las API keys y URLs (`localStorage`, `services/settings.ts`).
  Por eso nunca acaban en una copia de seguridad exportada.

---

## 5. Las matemáticas, una a una

### 5.1 Calorías a partir de macros (Atwater) — `core/macros.ts`

```
kcal = 4·proteína + 4·carbohidratos + 9·grasa        (gramos)
```

Tus objetivos base: 4·150 + 4·220 + 9·65 = 600 + 880 + 585 = **2065 kcal**, coherente con las
2000 kcal declaradas (la diferencia es fibra y redondeo). Ajustes te avisa si la suma de tus
macros se aleja más de 100 kcal del objetivo.

### 5.2 Escalado por gramos

Las etiquetas dan valores por 100 g, así que es una regla de tres:

```
macro(g) = macro_100g · g / 100
```

Para el deslizador de la revisión se usa `rescaleItem`: primero recupera la densidad que estimó
la IA (`macro / gramos_originales · 100`) y luego escala. Si la IA dijo "lomo 120 g, 30 g de
proteína", al mover a 150 g obtienes 37,5 g: la composición no cambia, solo la cantidad.

### 5.3 1RM estimado (Epley) — `core/oneRepMax.ts`

```
1RM ≈ w · (1 + reps / 30)          con reps = 1  →  1RM = w
```

Ejemplo: 100 kg × 8 → 100 · (1 + 8/30) = **126,7 kg**. Propiedad curiosa: con 30 reps la fórmula
duplica el peso, lo que ya te dice que por encima de ~12 reps deja de ser fiable. Se usa como
**tendencia** para comparar sesiones con rangos de repeticiones parecidos, no como marca real.

**Detección de PR** al marcar una serie (`detectPR`):

| PR | Condición |
|---|---|
| e1RM | `epley(serie) > mejor e1RM histórico del ejercicio` |
| Peso | `peso de la serie > peso máximo histórico` |
| Volumen | `Σ peso·reps de hoy en ese ejercicio > mejor sesión previa` |

Sin historial no se marca nada: la primera sesión es tu línea base, no un récord.

### 5.4 Series efectivas y volumen — `core/volume.ts`

Una serie cuenta como **efectiva** si está completada y su peso es ≥ 50 % del peso máximo usado
ese día en el ejercicio. Así 20 kg × 10 de calentamiento antes de 100 kg × 8 no infla el volumen.

```
tonelaje = Σ peso · reps          (solo series efectivas)
```

El volumen semanal agrupa por **semana ISO** (lunes a domingo): `startOfWeek` calcula el lunes con
`(díaSemana + 6) % 7`, que convierte el domingo=0 de JavaScript en lunes=0.

### 5.5 Ajuste dinámico de calorías en día de pierna — `core/targets.ts`

```
series_pierna = Σ series efectivas cuyo músculo principal ∈ {cuádriceps, femoral, glúteo, aductores, gemelo}

si series_pierna ≥ umbral (12 por defecto):
    kcal_objetivo  = 2000 + 200            = 2200
    carbos_objetivo = 220 + 200 / 4        = 270 g
```

El bonus va entero a carbohidratos porque una sesión de pierna de alto volumen es la que más
glucógeno muscular vacía. Tu plantilla de pierna tiene 20 series, así que una sesión completa
activa el bonus; una de torso (todas las series fuera del tren inferior) no. El entreno **en curso**
ya cuenta, así que el objetivo de Nutrición sube mientras entrenas.

### 5.6 Tendencia de peso: media móvil exponencial de 7 días — `core/trend.ts`

El peso diario oscila ±0,5–1 kg por agua, sal y glucógeno. Para ver si ganas peso de verdad se
suaviza con una EMA:

```
α = 2 / (N + 1)            N = 7  →  α = 0,25

EMA₀ = x₀
EMAₜ = EMAₜ₋₁ + α · (xₜ − EMAₜ₋₁)
```

Cada día la tendencia se mueve un 25 % hacia el pesaje nuevo. Ejemplo: tendencia 75,00 y te
pesas 76,00 → 75,25. Al día siguiente 74,00 → 75,25 + 0,25·(74 − 75,25) = 74,94.

**Días sin pesarte.** Si aplicas la fórmula tal cual, un hueco de 3 días pesaría igual que uno de
1 día. Se corrige así:

```
α_ef = 1 − (1 − α)^Δ          Δ = días desde el último pesaje
```

Razonamiento: con pesajes diarios, el peso de la tendencia antigua se multiplica por (1 − α)
cada día. Tras Δ días sin datos ha "decaído" (1 − α)^Δ, y lo que falta hasta 1 es lo que debe
pesar la medida nueva. Con Δ = 1 se recupera α; con Δ = 3, α_ef = 1 − 0,75³ ≈ 0,58.

¿Por qué EMA y no media simple de 7 días? La EMA reacciona antes a un cambio real (el último dato
pesa más), no tiene saltos cuando un día "sale" de la ventana y solo necesita el valor anterior.

**Ritmo semanal**: pendiente de la recta de mínimos cuadrados sobre los últimos 14 puntos de la
tendencia, multiplicada por 7:

```
m = Σ (xᵢ − x̄)(yᵢ − ȳ) / Σ (xᵢ − x̄)²          x = días desde el primer punto, y = kg
kg/semana = 7 · m
```

Para una ganancia limpia de +2-3 kg en unos meses, lo razonable es +0,1 a +0,3 kg/semana.

### 5.7 Cumplimiento calórico — `core/progress.ts`

```
cumplimiento(día) = round(kcal consumidas / kcal objetivo dinámico del día · 100)
```

Un día de pierna se mide contra 2200, no contra 2000. Los días sin comidas registradas no
aparecen: no son un 0 %, son un dato que falta.

### 5.8 ¿Qué ceno? Ranking por macros restantes — `core/suggest.ts`

Para cada favorito c y lo que falta r:

```
error(c) = Σₘ wₘ · kₘ · ((cₘ − rₘ) / max(rₘ, sₘ))²        m ∈ {kcal, proteína, carbos, grasa}

w = {kcal 1, proteína 1.5, carbos 0.6, grasa 0.6}     (la proteína manda en recomposición)
s = {150, 15, 20, 8}                                  (suelo: evita dividir entre ~0)
k = 3 si la comida se pasa de kcal, 1 en otro caso    (pasarse penaliza el triple)
```

Es un error cuadrático **relativo**: desviarte 20 g de proteína importa mucho si te faltan 25 g y
poco si te faltan 120 g. Se ordena de menor a mayor error.

### 5.9 OpenFoodFacts: kJ → kcal — `core/openFoodFacts.ts`

Muchos productos europeos solo traen energía en kJ: `kcal = kJ / 4,184`.

### 5.10 Sincronización: last-write-wins — `core/merge.ts`

Cada registro lleva `updatedAt`. Al fusionar dos listas, para cada id gana el `updatedAt` mayor.
Esta operación es **conmutativa** (da igual el orden) e **idempotente** (sincronizar dos veces no
cambia nada), que es justo lo que necesitas para que dos dispositivos converjan.

Los ids remotos se calculan con `pbRecordId(store, clave)`: dos hashes FNV-1a de 32 bits con
semillas distintas, pasados a base 36 → 15 caracteres `[a-z0-9]`, el formato que exige
PocketBase. Como el id es determinista, subir un registro es un `PATCH` directo (y `POST` si
devuelve 404), sin tener que buscarlo antes.

### 5.11 Datos demo reproducibles — `data/demo.ts`

Usa `mulberry32`, un generador pseudoaleatorio de 32 bits con semilla. Misma semilla → mismos
números → la demo es idéntica en cada instalación y los tests pueden comprobarla.

---

## 6. La IA

```
                     createAIClient(settings)            services/ai/index.ts
                               │
     ┌─────────────────┬───────┴─────────┬────────────────────┐
     ▼                 ▼                 ▼                    ▼
 GeminiClient     OpenAICompat       OllamaClient          null
 x-goog-api-key   Bearer (Groq)      sin auth (LAN)        → modo simulación local
```

Todos implementan la misma interfaz `AIClient { chat(), json() }`. Los prompts, la validación y el
plan B viven fuera (`nutritionAI.ts`, `core/coach.ts`), así que añadir un proveedor nuevo son ~40
líneas.

- **Modo JSON**: Gemini con `responseMimeType: "application/json"`, Groq con
  `response_format: json_object`, Ollama con `format: "json"`. Aun así el texto se pasa por
  `extractJson` + zod, porque un modelo puede devolver JSON válido con números como string o
  claves en español.
- **Sin "thinking"** en Gemini 2.5 Flash (`thinkingBudget: 0`): para estimar un plato no aporta y
  duplica la latencia.
- **Modo simulación** (sin API key): el texto se desglosa con el parser local contra
  `data/foodDb.ts` (funciona de verdad); la foto propone el plato típico de esa hora para que
  puedas probar el flujo; el coach responde las 3 consultas rápidas con reglas y tus datos.
- **Privacidad**: la foto y el contexto del día solo salen del móvil hacia el proveedor que tú
  configures. La API key vive en `localStorage` de tu navegador y nunca se sube a GitHub.

**Conseguir la key gratis**: https://aistudio.google.com/apikey → "Create API key" → pégala en
Ajustes ⚙ → Inteligencia artificial → "Probar conexión".

---

## 7. Offline y PWA

- El service worker (generado por Workbox) **precachea** HTML, JS, CSS e iconos. Tras la primera
  visita la app abre sin conexión.
- Todo lo que registras va a IndexedDB, así que entrenar, apuntar comidas favoritas, el parser de
  texto, las gráficas y el coach local funcionan en modo avión.
- Necesitan red: IA real, OpenFoodFacts (salvo productos ya cacheados) y PocketBase.
- El temporizador de descanso guarda la **hora de fin**, no "quedan 90 s". Si el móvil congela la
  pestaña o la recargas, al volver el tiempo restante sigue siendo exacto.
- Instalar: en Chrome Android, menú ⋮ → "Instalar aplicación"; en iOS Safari, Compartir →
  "Añadir a pantalla de inicio".

---

## 8. Tests

```bash
npm test            # una pasada (lo que ejecuta la CI)
npm run test:watch  # modo vigilancia mientras programas
```

| Fichero | Qué comprueba |
|---|---|
| `tests/core/macros.test.ts` | Atwater, escalado, reescalado del deslizador, restantes, adherencia |
| `tests/core/oneRepMax.test.ts` | Epley (incluidos bordes) y las tres reglas de PR |
| `tests/core/targets.test.ts` | +200 kcal / +50 g de carbos, umbral, calentamientos excluidos |
| `tests/core/trend.test.ts` | EMA paso a paso, corrección por huecos, pendiente semanal |
| `tests/core/volume.test.ts` | volumen por semana ISO, historial de e1RM, récords, "Anterior" |
| `tests/core/schemas.test.ts` | validación de respuestas de IA, perfil y copias; `extractJson` |
| `tests/core/foodText.test.ts` | parser "Bocadillo con 100g de pan y 120g de lomo" |
| `tests/core/session.test.ts` | precarga desde la sesión anterior y cierre del entreno |
| `tests/core/coach.test.ts` | prompt de sistema con contexto real y coach local |
| `tests/core/progress.test.ts` | cumplimiento contra el objetivo dinámico |
| `tests/core/export.test.ts` | CSV e ids de PocketBase |
| `tests/core/misc.test.ts` | fechas (incluido el cambio de hora), CSV, LWW, OpenFoodFacts, ranking |
| `tests/data/repository.test.ts` | IndexedDB real simulada: siembra, índices, demo, backup, reinicio |
| `tests/services/*.test.ts` | formato de las peticiones a Gemini/Groq/Ollama y flujo de nutrición con IA falsa |

---

## 9. Ejecutar y desplegar

```bash
npm install
npm run dev        # http://localhost:5173 (en el móvil: npm run dev -- --host y abre la IP del PC)
npm run build      # genera dist/ (tsc + vite)
npm run preview    # sirve dist/ como en producción
```

**GitHub Pages** (`.github/workflows/deploy.yml`): en cada push a `main` (o `v1`) ejecuta los
tests, construye con `BASE_PATH=/<nombre-del-repo>/` y publica `dist/`. Las ramas de trabajo solo
pasan tests y build. Activación única: en GitHub, *Settings → Pages → Build and deployment →
Source: GitHub Actions*. La URL queda en `https://<usuario>.github.io/fit-ai-tracker/`.

---

## 10. PocketBase (cuando montes el servidor)

1. Descarga PocketBase y arráncalo: `./pocketbase serve --http 0.0.0.0:8090`.
2. En el panel (`/_/`) crea un usuario en la colección `users`.
3. Crea la colección **`fit_records`** (tipo *Base*) con estos campos:

| Campo | Tipo |
|---|---|
| `store` | Text |
| `key` | Text |
| `payload` | JSON |
| `updatedAt` | Number |

4. Reglas de API (list/view/create/update): `@request.auth.id != ""`.
5. En la app: Ajustes → Sincronización → URL, email, contraseña → "Sincronizar ahora".

Si sirves la app por HTTPS (GitHub Pages) y PocketBase por HTTP en tu red local, el navegador
bloqueará la petición por *mixed content*: pon PocketBase detrás de HTTPS (Caddy, Tailscale) o
abre la app desde tu propio servidor.

---

## 11. Limitaciones conocidas y siguientes pasos

- **Borrados no sincronizados**: la sincronización sube altas y cambios, pero un registro borrado
  en un dispositivo no se borra en el otro. Solución estándar: *tombstones* (`deleted: true` +
  `updatedAt`) en vez de borrar.
- **Epley** sobreestima con muchas repeticiones; para series de >12 reps convendría Brzycki o
  limitar la estimación.
- **Estimación visual de raciones**: la IA acierta el tipo de alimento mucho mejor que los gramos.
  Por eso existe la pantalla de revisión con deslizadores; úsala.
- **Volumen por grupo muscular**: ahora solo cuenta el músculo principal. Contar los secundarios
  a 0,5 series daría una imagen más fiel.
