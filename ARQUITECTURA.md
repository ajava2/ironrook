# Arquitectura de IronRook

Notas sobre cómo está montada la app: qué hay en cada carpeta, por dónde pasan los datos y de dónde
sale cada número de la pantalla. Pensado para leerlo con el código abierto al lado; cada sección
indica los ficheros donde está la implementación.

---

## 1. Visión general

IronRook es una **PWA offline-first**: una web estática (HTML + JS + CSS) que el navegador instala
como app. Los datos se guardan en **IndexedDB**, dentro del propio móvil, y solo se sale a Internet
para tres cosas opcionales: la IA (Gemini, Groq u Ollama), OpenFoodFacts y PocketBase.

| Pieza | Elección | Motivo |
|---|---|---|
| UI | React 19 + TypeScript | Componentes y estado local sin framework pesado. |
| Build | Vite 7 | Arranque rápido en desarrollo y bundle estático para publicar. |
| PWA | vite-plugin-pwa (Workbox) | Genera el `manifest` y un service worker que precachea la app. |
| Base de datos | IndexedDB vía `idb` | Transaccional, con índices y sin el límite de 5 MB de `localStorage`. |
| Validación | zod | Todo lo que entra de fuera (IA, OpenFoodFacts, ficheros, códigos de rutina) se valida antes de llegar a la base de datos. |
| Gráficas | SVG propio (`src/ui/charts.tsx`) | Pocas líneas y sin dependencia. |
| Tests | Vitest + Testing Library + fake-indexeddb | Lógica pura, repositorio contra una IndexedDB simulada y pantallas clave. |

No hay backend. El "servidor" son los ficheros estáticos publicados en Netlify.

---

## 2. Mapa de carpetas

```
ironrook/
├── index.html                 punto de entrada; carga src/main.tsx
├── vite.config.ts             build, PWA (manifest + service worker) y config de Vitest
├── netlify.toml               comando de build y carpeta a publicar
├── public/                    iconos de la app (se copian tal cual a dist/)
├── tests/                     tests automáticos
│   ├── core/                  matemáticas y lógica pura
│   ├── data/                  repositorio sobre IndexedDB simulada
│   └── *.test.tsx             pantallas (editor de rutinas, crear ejercicio)
└── src/
    ├── main.tsx               monta React, registra el service worker y pide almacenamiento persistente
    ├── App.tsx                barra superior, rutas por hash y barra inferior
    │
    ├── core/                  LÓGICA PURA. Sin React, sin navegador, sin red.
    │   ├── types.ts           modelo de dominio (Workout, MealEntry, Macros…)
    │   ├── schemas.ts         esquemas zod (plantillas, ejercicios propios, copias) y extractor de JSON
    │   ├── templates.ts       mover ejercicios y codificar/decodificar el código de una rutina
    │   ├── macros.ts          Atwater, escalado por gramos, restantes, adherencia
    │   ├── oneRepMax.ts       Epley y detección de récords
    │   ├── volume.ts          series efectivas, volumen semanal, historial de e1RM
    │   ├── targets.ts         objetivo dinámico (extra en día de pierna)
    │   ├── trend.ts           media móvil exponencial y pendiente por mínimos cuadrados
    │   ├── session.ts         crear y cerrar un entreno a partir de una plantilla
    │   ├── progress.ts        cumplimiento calórico diario
    │   ├── suggest.ts         ranking de comidas según los macros que faltan
    │   ├── coach.ts           prompt de sistema del coach y respuestas locales
    │   ├── foodText.ts        parser de texto libre ("120 g de arroz") sin IA
    │   ├── openFoodFacts.ts   traduce la respuesta de OpenFoodFacts a un alimento
    │   ├── csv.ts, exportCsv.ts   exportación CSV
    │   ├── merge.ts, pbId.ts  fusión last-write-wins e ids para PocketBase
    │   └── dates.ts, id.ts    fechas locales y generación de ids
    │
    ├── data/                  PERSISTENCIA Y DATOS DE REFERENCIA
    │   ├── db.ts              esquema de IndexedDB y migraciones
    │   ├── repository.ts      único acceso a IndexedDB (leer, guardar, copias, reinicio)
    │   ├── catalog.ts         catálogo de ejercicios; los propios se registran al arrancar
    │   ├── foodDb.ts          alimentos base por 100 g (modo sin IA)
    │   ├── defaults.ts        perfil inicial y comidas favoritas
    │   └── demo.ts            generador determinista de datos de ejemplo
    │
    ├── services/              ENTRADA/SALIDA CON EL EXTERIOR
    │   ├── ai/                clientes Gemini, Groq (formato OpenAI) y Ollama
    │   ├── nutritionAI.ts     prompts de visión/texto/etiqueta y plan B local
    │   ├── openFoodFacts.ts   petición a la API de OpenFoodFacts
    │   ├── barcode.ts         cámara → código (BarcodeDetector nativo o ZXing)
    │   ├── image.ts           comprime la foto a ≤1024 px JPEG y la pasa a base64
    │   ├── pocketbase.ts      login y sincronización
    │   └── settings.ts        claves y URLs en localStorage
    │
    ├── state/                 PEGAMENTO ENTRE DATOS Y REACT
    │   ├── AppData.tsx        abre la BD, siembra, carga ejercicios propios y expone repo/perfil/avisos
    │   ├── RestTimer.tsx      temporizador de descanso global
    │   ├── useDaySummary.ts   comidas + entrenos + objetivo dinámico de un día
    │   └── useAISettings.ts   configuración de IA reactiva
    │
    ├── features/              PANTALLAS (una carpeta por pestaña)
    │   ├── workout/           rutinas, editor, ejercicios propios, sesión activa, temporizador
    │   ├── nutrition/         favoritos, foto, código de barras, etiqueta, texto
    │   ├── coach/             chat y consultas rápidas
    │   ├── progress/          gráficas y récords
    │   └── settings/          perfil, IA, copias de seguridad, sincronización
    │
    ├── ui/                    componentes genéricos (Sheet, gráficas, iconos, Markdown)
    └── styles/global.css      tokens de diseño y piezas base
```

### Regla de dependencias

Las flechas indican "puede importar a". Nunca al revés.

```
  features/  ──►  state/  ──►  data/  ──►  core/
      │              │          ▲            ▲
      │              └────► services/ ───────┘
      └──────────► ui/
```

- `core/` no importa nada del resto, por eso se prueba en Node sin navegador.
- `data/repository.ts` es el único módulo que habla con IndexedDB. Cambiar el almacenamiento
  implica tocar solo ese fichero.
- `services/` encapsula la red. Las pantallas no hacen `fetch` directamente.

---

## 3. Cómo viajan los datos

### 3.1 Apuntar una serie

```
 Marcar ✓ en una serie
          │
          ▼
 ExerciseCard ──onToggleSet──► ActiveWorkout.toggleSet()          features/workout/WorkoutView.tsx
                                  │
          ┌───────────────────────┼─────────────────────────────┬───────────────────────────┐
          ▼                       ▼                             ▼                           ▼
 set.done = true          timer.start(restSec)          detectPR(serie, sesión,       onChange(workout)
 completedAt = now        state/RestTimer.tsx           récords históricos)                │
                          guarda la HORA DE FIN         core/oneRepMax.ts                  ▼
                          (no los segundos)                  │                   repo.setActiveWorkout()
                                                             ▼                   IndexedDB · meta/activeWorkout
                                                      aviso de récord + vibración  (sobrevive a recargas)

 Terminar
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
 dailyTargets(perfil, entrenos de hoy)  ── series de pierna ≥ umbral ──► objetivo extra en Nutrición
```

### 3.2 Rutinas, ejercicios propios y códigos para compartir

- Las rutinas viven en el store `templates`. Se crean y editan desde `TemplatesSection` y
  `TemplateEditor` (series, rango de repeticiones, descanso, orden con ↑/↓).
- El catálogo (`data/catalog.ts`) es un `Map` mutable. Al arrancar, `AppData` lee el store
  `customExercises` y llama a `registerExercises()`. Los ids propios empiezan por `custom_` y no
  pueden pisar a los del catálogo base.
- Un ejercicio nuevo se crea desde el selector (`CreateExerciseSheet`): nombre, músculo principal,
  secundarios (máximo 3), equipo, incremento de peso y si es amable con el hombro. Todo pasa por
  `CustomExerciseSchema` antes de guardarse.
- **Código de rutina**: `FITAI1:` + JSON en base64 con `{ name, focus, weekday, exercises }`
  (`core/templates.ts`). Al pegarlo se valida con `TemplateSchema`, se genera un id nuevo y los
  ejercicios que no existan en el catálogo se descartan avisando al usuario. El prefijo `FITAI1`
  se mantiene por compatibilidad con los códigos ya compartidos.

### 3.3 Foto del plato

```
 <input type="file" capture="environment">          features/nutrition/NutritionView.tsx
          │  File (4 MB, 4000×3000)
          ▼
 fileToAIImage()                                      services/image.ts
   createImageBitmap → canvas 1024 px → JPEG 0.8 → base64   (~150 KB)
          │
          ▼
 analyzeMealPhoto(client, image)                      services/nutritionAI.ts
   ├─ client == null (sin clave) ──► plato simulado según la hora (modo simulación)
   └─ GeminiClient.json(system, prompt, image)        services/ai/gemini.ts
          │  POST generativelanguage.googleapis.com/v1beta/models/<modelo>:generateContent
          │  body: { contents:[{parts:[{inlineData:{mimeType,data}}, {text: prompt}]}],
          │          generationConfig:{ responseMimeType:"application/json" } }
          ▼
 texto del modelo ──► extractJson() ──► FoodAnalysisSchema.parse()     core/schemas.ts
                       (quita ```json,   (acepta "calorias"→kcal, "12,5"→12.5,
                        cuenta llaves)    recalcula kcal si faltan, rechaza negativos)
          │
          ▼
 ReviewSheet: un deslizador de gramos por ingrediente
   rescaleItem(item, g) mantiene macros/gramo constantes             core/macros.ts
          │  "Añadir a hoy"
          ▼
 repo.saveMeal({ date, time, source:"photo", items })  ──►  IndexedDB · store "meals"
```

### 3.4 Código de barras y etiqueta

```
 cámara ──► BarcodeDetector nativo (Chrome Android)   ─┐       services/barcode.ts
        └─► ZXing cargado bajo demanda (iOS/Firefox)  ─┤
 teclado ──────────────────────────────────────────────┘
          │  "8480000123456"
          ▼
 repo.foodByBarcode()  ── hit ──────────────────────────────►  ficha del producto
          │ miss                                                     ▲
          ▼                                                          │
 fetchProduct()  GET world.openfoodfacts.org/api/v2/product/{code}.json
          │      parseOpenFoodFacts(): nutriments.*_100g, kJ→kcal si hace falta
          ├─ encontrado ──► repo.saveFood() (caché permanente) ──────┘
          └─ no existe ──► "Leer tabla nutricional por foto"
                              readNutritionLabel(): la IA lee la columna por 100 g
                              ──► repo.saveFood({ barcode, source:"label" }) ──┘

 ficha ──► deslizador de gramos ──► scaleMacros(per100g, g) ──► repo.saveMeal()
```

La consulta a OpenFoodFacts necesita conexión. Un producto ya consultado queda en la caché local y
se encuentra sin red.

### 3.5 Coach IA

```
 useDaySummary(hoy) ─┐  objetivo dinámico, consumido, restante, comidas de hoy
 workoutsBetween()   ├──► buildCoachSystemPrompt()   core/coach.ts
 allWeights()        │      texto con el estado real del día
 allFavorites()     ─┘
          │
          ▼
 [system, …últimos 12 mensajes, user]  ──►  client.chat()  ──►  respuesta
          │                                    │ error o sin clave
          │                                    ▼
          │                         coach local determinista:
          │                         localDinnerAdvice / localLegAnalysis / localShoulderSwap
          ▼
 repo.saveChatMessage()  ──►  IndexedDB · store "chat"
```

El prompt se reconstruye en cada mensaje, así el modelo siempre razona con lo que falta en ese
momento y no con lo que faltaba al empezar la conversación.

### 3.6 Reactividad sin librería de estado

`state/AppData.tsx` mantiene un contador `version`. Cada escritura llama a `invalidate()`, que lo
incrementa; `useQuery(fn, deps)` incluye `version` entre sus dependencias, de modo que todas las
lecturas visibles se repiten. Es el patrón más simple que funciona con una base de datos asíncrona:
no hay caché que invalidar a mano ni pantallas con datos viejos.

---

## 4. La base de datos (IndexedDB)

IndexedDB es una base de datos clave-valor transaccional del navegador. Cada "tabla" es un
*object store* que guarda objetos JavaScript tal cual.

```
 BD "fit-ai-tracker" · versión 3                                     src/data/db.ts

 store             clave (keyPath)   índices        contenido
 ───────────────   ───────────────   ───────────    ──────────────────────────────────────────
 workouts          id                by_date        sesiones terminadas con ejercicios y series
 meals             id                by_date        comidas con su lista de ingredientes y macros
 weights           date              —              un pesaje por día (la fecha es la clave)
 foods             id                by_barcode     caché de OpenFoodFacts y etiquetas leídas
 favorites         id                —              comidas de un toque
 chat              id                —              conversación con el coach
 templates         id                —              rutinas del usuario (v2)
 customExercises   id                —              ejercicios creados por el usuario (v3)
 meta              (clave externa)   —              perfil · entreno activo · marcas de sincronización
```

El nombre interno de la base (`fit-ai-tracker`) se conserva a propósito: cambiarlo haría que los
dispositivos que ya tienen datos abrieran una base vacía.

- **Índice `by_date`**: `mealsOn('2026-10-28')` no recorre todas las comidas; IndexedDB va directa a
  las de esa fecha. `mealsBetween(a, b)` usa `IDBKeyRange.bound(a, b)` sobre el mismo índice (las
  fechas `YYYY-MM-DD` ordenan bien como texto).
- **Migraciones**: `upgrade(db, oldVersion)` ejecuta `if (oldVersion < N)` en orden, así que quien
  salta de la v1 a la v3 pasa por los dos bloques. Para añadir un store, se sube `DB_VERSION` y se
  añade un bloque nuevo.
- **Transacciones**: `importBackup` valida todo el fichero con zod antes de abrir la transacción y
  escribe dentro de una sola: o entra la copia entera o no entra nada. Los campos añadidos después
  (`templates`, `customExercises`) llevan `.default([])`, por lo que las copias antiguas siguen
  funcionando.
- **Datos de ejemplo**: llevan `demo: true`. "Limpiar datos de demo" recorre los stores con un
  cursor y borra solo esos registros. En una instalación nueva no se crean.
- **Fuera de IndexedDB**: las claves de API y URLs (`localStorage`, `services/settings.ts`). Por eso
  nunca acaban en una copia de seguridad exportada.
- **Almacenamiento persistente**: `main.tsx` llama a `navigator.storage.persist()`. Es una petición,
  no una garantía: el navegador puede rechazarla, y Safari puede borrar datos de sitios sin uso. La
  copia de seguridad en JSON es la protección real.

---

## 5. Las matemáticas

Los números de los ejemplos usan el perfil inicial de `data/defaults.ts`: 2400 kcal, 140 g de
proteína, 280 g de carbohidratos y 70 g de grasa.

### 5.1 Calorías a partir de macros (Atwater) — `core/macros.ts`

```
kcal = 4·proteína + 4·carbohidratos + 9·grasa        (gramos)
```

Con el perfil inicial: 4·140 + 4·280 + 9·70 = 560 + 1120 + 630 = **2310 kcal**, cerca de las 2400
declaradas (la diferencia es fibra y redondeo). Ajustes avisa si la suma de los macros se aleja más
de 100 kcal del objetivo.

### 5.2 Escalado por gramos

Las etiquetas dan valores por 100 g, así que es una regla de tres:

```
macro(g) = macro_100g · g / 100
```

Para el deslizador de la revisión se usa `rescaleItem`: primero recupera la densidad estimada por la
IA (`macro / gramos_originales · 100`) y luego escala. Si la IA dice "lomo 120 g, 30 g de proteína",
al subir a 150 g salen 37,5 g: cambia la cantidad, no la composición.

### 5.3 1RM estimado (Epley) — `core/oneRepMax.ts`

```
1RM ≈ w · (1 + reps / 30)          con reps = 1  →  1RM = w
```

Ejemplo: 100 kg × 8 → 100 · (1 + 8/30) = **126,7 kg**. Con 30 repeticiones la fórmula duplica el
peso, lo que indica que por encima de unas 12 repeticiones deja de ser fiable. Se usa como
**tendencia** para comparar sesiones con rangos de repeticiones parecidos, no como marca real.

**Detección de récord** al marcar una serie (`detectPR`):

| Récord | Condición |
|---|---|
| e1RM | `epley(serie) > mejor e1RM histórico del ejercicio` |
| Peso | `peso de la serie > peso máximo histórico` |
| Volumen | `Σ peso·reps de hoy en ese ejercicio > mejor sesión previa` |

Sin historial no se marca nada: la primera sesión es la línea base, no un récord.

### 5.4 Series efectivas y volumen — `core/volume.ts`

Una serie cuenta como **efectiva** si está completada y su peso es ≥ 50 % del peso máximo usado ese
día en el ejercicio. Así, 20 kg × 10 de calentamiento antes de 100 kg × 8 no infla el volumen.

```
tonelaje = Σ peso · reps          (solo series efectivas)
```

El volumen semanal agrupa por **semana ISO** (lunes a domingo): `startOfWeek` calcula el lunes con
`(díaSemana + 6) % 7`, que convierte el domingo=0 de JavaScript en lunes=0.

### 5.5 Objetivo dinámico en día de pierna — `core/targets.ts`

```
series_pierna = Σ series efectivas cuyo músculo principal ∈ {cuádriceps, femoral, glúteo, aductores, gemelo}

si series_pierna ≥ umbral (12 por defecto):
    kcal_objetivo   = 2400 + 200            = 2600
    carbos_objetivo = 280 + 200 / 4         = 330 g
```

El extra va entero a carbohidratos, porque una sesión de pierna de volumen alto es la que más
glucógeno vacía. Una sesión de torso no lo activa. El entreno **en curso** ya cuenta, así que el
objetivo de Nutrición sube mientras se entrena. Tanto el extra como el umbral se cambian en Ajustes.

### 5.6 Tendencia de peso: media móvil exponencial de 7 días — `core/trend.ts`

El peso diario oscila ±0,5–1 kg por agua, sal y glucógeno. Para ver la tendencia real se suaviza
con una EMA:

```
α = 2 / (N + 1)            N = 7  →  α = 0,25

EMA₀ = x₀
EMAₜ = EMAₜ₋₁ + α · (xₜ − EMAₜ₋₁)
```

Cada día la tendencia se mueve un 25 % hacia el pesaje nuevo. Ejemplo: tendencia 75,00 y pesaje de
76,00 → 75,25. Al día siguiente, con 74,00 → 75,25 + 0,25·(74 − 75,25) = 74,94.

**Días sin pesaje.** Aplicada tal cual, la fórmula daría el mismo peso a un hueco de 3 días que a
uno de 1 día. Se corrige así:

```
α_ef = 1 − (1 − α)^Δ          Δ = días desde el último pesaje
```

Con pesajes diarios, el peso de la tendencia antigua se multiplica por (1 − α) cada día. Tras Δ días
sin datos ha decaído (1 − α)^Δ, y lo que falta hasta 1 es lo que debe pesar la medida nueva. Con
Δ = 1 se recupera α; con Δ = 3, α_ef = 1 − 0,75³ ≈ 0,58.

Frente a una media simple de 7 días, la EMA reacciona antes a un cambio real, no da saltos cuando un
día sale de la ventana y solo necesita el valor anterior.

**Ritmo semanal**: pendiente de la recta de mínimos cuadrados sobre los últimos 14 puntos de la
tendencia, multiplicada por 7:

```
m = Σ (xᵢ − x̄)(yᵢ − ȳ) / Σ (xᵢ − x̄)²          x = días desde el primer punto, y = kg
kg/semana = 7 · m
```

### 5.7 Cumplimiento calórico — `core/progress.ts`

```
cumplimiento(día) = round(kcal consumidas / kcal objetivo dinámico del día · 100)
```

Un día de pierna se mide contra su objetivo ampliado. Los días sin comidas registradas no aparecen:
son un dato que falta, no un 0 %.

### 5.8 Qué cenar: ranking por macros restantes — `core/suggest.ts`

Para cada favorito c y lo que falta r:

```
error(c) = Σₘ wₘ · kₘ · ((cₘ − rₘ) / max(rₘ, sₘ))²        m ∈ {kcal, proteína, carbos, grasa}

w = {kcal 1, proteína 1.5, carbos 0.6, grasa 0.6}     (la proteína pesa más)
s = {150, 15, 20, 8}                                  (suelo: evita dividir entre ~0)
k = 3 si la comida se pasa de kcal, 1 en otro caso    (pasarse penaliza el triple)
```

Es un error cuadrático **relativo**: desviarse 20 g de proteína importa mucho si faltan 25 g y poco
si faltan 120 g. Se ordena de menor a mayor error.

### 5.9 OpenFoodFacts: kJ a kcal — `core/openFoodFacts.ts`

Muchos productos europeos solo traen energía en kJ: `kcal = kJ / 4,184`.

### 5.10 Sincronización: last-write-wins — `core/merge.ts`

Cada registro lleva `updatedAt`. Al fusionar dos listas, para cada id gana el `updatedAt` mayor. La
operación es **conmutativa** (el orden no importa) e **idempotente** (sincronizar dos veces no
cambia nada), que es lo que hace falta para que dos dispositivos converjan.

Los ids remotos se calculan con `pbRecordId(store, clave)`: dos hashes FNV-1a de 32 bits con semillas
distintas, pasados a base 36, dan 15 caracteres `[a-z0-9]`, el formato que exige PocketBase. Como
el id es determinista, subir un registro es un `PATCH` directo (y `POST` si devuelve 404), sin
buscarlo antes.

### 5.11 Datos de ejemplo reproducibles — `data/demo.ts`

Usa `mulberry32`, un generador pseudoaleatorio de 32 bits con semilla. Misma semilla, mismos números:
el generador es idéntico en cada instalación y los tests pueden comprobarlo.

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
plan B viven fuera (`nutritionAI.ts`, `core/coach.ts`), así que añadir un proveedor son unas 40
líneas.

- **Modo JSON**: Gemini con `responseMimeType: "application/json"`, Groq con
  `response_format: json_object`, Ollama con `format: "json"`. Aun así el texto pasa por
  `extractJson` + zod, porque un modelo puede devolver JSON válido con números como texto o con
  claves en español.
- **Sin "thinking"** en Gemini 2.5 Flash (`thinkingBudget: 0`): para estimar un plato no aporta y
  duplica la latencia.
- **Modo simulación** (sin clave): el texto se desglosa con el parser local contra `data/foodDb.ts`
  (funciona de verdad); la foto propone el plato típico de esa hora para poder probar el flujo; el
  coach responde las consultas rápidas con reglas y los datos del día.
- **Claves de cada usuario**: cada persona usa la suya. Se guarda en el `localStorage` del navegador
  y no entra en la base de datos, ni en las copias, ni en el repositorio. Ofrecer IA sin que cada
  usuario ponga su clave exigiría un servidor intermedio con cuentas y control de gasto, que ahora no
  existe.
- **Privacidad**: la foto y el contexto del día solo salen del móvil hacia el proveedor configurado.

Clave gratuita de Gemini: <https://aistudio.google.com/apikey> → "Create API key" → pegarla en
Ajustes → Inteligencia artificial → "Probar conexión".

---

## 7. Offline y PWA

- El service worker (generado por Workbox) **precachea** HTML, JS, CSS e iconos. Tras la primera
  visita la app abre sin conexión.
- Todo lo que se registra va a IndexedDB, así que entrenar, usar favoritos, el parser de texto, las
  gráficas y el coach local funcionan en modo avión.
- Necesitan red: la IA real, OpenFoodFacts (salvo productos ya guardados) y PocketBase.
- El temporizador de descanso guarda la **hora de fin**, no "quedan 90 s". Si el móvil congela la
  pestaña o se recarga, el tiempo restante sigue siendo exacto.
- Los datos pertenecen al **origen** (la dirección web). Si la app cambia de dirección, los datos
  guardados en la anterior no se ven desde la nueva; la copia JSON permite llevarlos.
- Instalar: en Chrome Android, menú ⋮ → "Instalar aplicación"; en iOS Safari, Compartir → "Añadir a
  pantalla de inicio".

---

## 8. Tests

```bash
npm test            # una pasada
npm run test:watch  # modo vigilancia mientras se programa
```

| Ubicación | Qué comprueba |
|---|---|
| `tests/core/` | Atwater y escalado, Epley y récords, objetivo dinámico, EMA y pendiente, volumen por semana ISO, esquemas zod y `extractJson`, parser de texto, sesiones, coach, cumplimiento, CSV, fusión LWW, códigos de rutina y ejercicios propios |
| `tests/data/` | Repositorio contra IndexedDB simulada: siembra, índices, copias, reinicio, plantillas y ejercicios propios |
| `tests/services/` | Formato de las peticiones a Gemini/Groq/Ollama y flujo de nutrición con IA falsa |
| `tests/editor.test.tsx`, `tests/createExercise.test.tsx` | Pantallas: crear y editar rutinas, crear un ejercicio desde el selector |

---

## 9. Ejecutar y publicar

```bash
npm install
npm run dev        # http://localhost:5173 (en el móvil: npm run dev -- --host y abrir la IP del PC)
npm run build      # genera dist/ (tsc + vite)
npm run preview    # sirve dist/ como en producción
```

**Netlify**: `netlify.toml` define el comando (`npm run build`), la carpeta (`dist`) y la versión de
Node. Hay dos formas de publicar:

1. Conectar el repositorio en Netlify: cada push a `main` genera y publica la web.
2. Arrastrar la carpeta `dist/` a <https://app.netlify.com/drop> tras ejecutar `npm run build`.

Los usuarios no hacen nada: abren la dirección y, si la tienen instalada, la app se actualiza sola
en la siguiente apertura. Como el service worker sirve primero lo guardado, una versión nueva suele
verse a la segunda apertura.

---

## 10. PocketBase (opcional)

1. Descargar PocketBase y arrancarlo: `./pocketbase serve --http 0.0.0.0:8090`.
2. En el panel (`/_/`), crear un usuario en la colección `users`.
3. Crear la colección **`fit_records`** (tipo *Base*) con estos campos:

| Campo | Tipo |
|---|---|
| `store` | Text |
| `key` | Text |
| `payload` | JSON |
| `updatedAt` | Number |

4. Reglas de API (list/view/create/update): `@request.auth.id != ""`.
5. En la app: Ajustes → Sincronización → URL, email, contraseña → "Sincronizar ahora".

Si la app se sirve por HTTPS (Netlify) y PocketBase por HTTP en la red local, el navegador bloquea la
petición por *mixed content*: PocketBase tiene que ir detrás de HTTPS (Caddy, Tailscale) o la app
abrirse desde el propio servidor.

---

## 11. Limitaciones conocidas

- **Borrados no sincronizados**: la sincronización sube altas y cambios, pero un registro borrado en
  un dispositivo no se borra en el otro. La solución habitual son *tombstones* (`deleted: true` +
  `updatedAt`) en lugar de borrar.
- **Epley** sobreestima con muchas repeticiones; para series de más de 12 convendría Brzycki o
  limitar la estimación.
- **Volumen por grupo muscular**: solo cuenta el músculo principal. Contar los secundarios a 0,5
  series daría una imagen más fiel.
- **Códigos de rutina**: no incluyen la definición de los ejercicios propios, solo su id. Al
  importarlos en otro dispositivo, un ejercicio propio que allí no exista se descarta.
- **Ejercicios propios**: se pueden crear, pero todavía no editar ni borrar desde la app.
- **Estimación visual de raciones**: la IA acierta el tipo de alimento mucho mejor que los gramos,
  por eso existe la pantalla de revisión con deslizadores.
