# IronRook

Una app para apuntar tus entrenos de fuerza y tu comida desde el móvil. Funciona sin conexión,
no necesita cuenta y todo lo que registras se queda en tu propio teléfono.

Empecé a hacerla porque quería algo parecido a Hevy y MyFitnessPal pero en una sola app, sin
suscripción y con mis rutinas bajo mi control. La fui ampliando para que pudiera usarla también
mi familia, así que cada persona crea sus rutinas y tiene sus propios datos.

## Qué hace

- **Entreno.** Creas tus rutinas (ejercicios, series, rango de repeticiones, descanso), las
  ordenas y las compartes con un código que se pega en otro móvil. Mientras entrenas ves lo que
  hiciste la última vez, tienes temporizador de descanso y la app te avisa de récords personales.
- **Nutrición.** Comidas favoritas en un toque, texto libre ("120 g de arroz"), código de barras,
  etiquetas y foto del plato. Tiene un objetivo de calorías y macros que se ajusta los días de
  pierna.
- **Coach.** Un chat que conoce lo que has comido y entrenado ese día.
- **Progreso.** Peso con línea de tendencia, cumplimiento de calorías, volumen semanal y 1RM
  estimado.

Los ejercicios que no estén en el catálogo se crean desde el propio selector.

## Usarla en el móvil

Abre la dirección de la app en Safari (iPhone) o Chrome (Android) y elige **Añadir a pantalla de
inicio**. Una vez instalada funciona sin internet.

Como los datos viven en el navegador del móvil, si lo cambias o borras los datos del sitio los
pierdes. Haz copia de vez en cuando en **Ajustes → Exportar copia completa**.

### La IA es opcional

Sin configurar nada, la app usa un modo local (el texto libre se interpreta con reglas y el coach
responde con plantillas). Si quieres IA de verdad, crea una clave gratuita de Gemini en
<https://aistudio.google.com/apikey> y pégala en **Ajustes → Inteligencia artificial**. La clave
se guarda solo en tu navegador. También funciona con Groq y con Ollama en local.

## Desarrollo

Hace falta Node 20 o superior.

```bash
npm install
npm run dev      # http://localhost:5173
npm test
npm run build    # genera dist/
```

El código está dividido en capas que solo se pueden llamar en un sentido:
`features → state → data / services → core`. En `core/` está toda la lógica (cálculos,
formatos, validación) sin nada de React ni de navegador, así se prueba sin más. Si cambias la
forma de los datos guardados, añade una migración nueva en `src/data/db.ts` y no toques las
anteriores.

| Para tocar... | Mira en |
|---|---|
| una pantalla | `src/features/` |
| el catálogo de ejercicios | `src/data/catalog.ts` |
| los valores iniciales | `src/data/defaults.ts` |
| una fórmula | `src/core/` y sus tests en `tests/core/` |
| la base de datos | `src/data/db.ts` y `src/data/repository.ts` |

Hay una explicación más larga, con los diagramas de cómo viajan los datos, en
[`ARQUITECTURA.md`](./ARQUITECTURA.md).

## Publicar

Es una web estática. En Netlify basta con conectar el repositorio (el `netlify.toml` ya trae la
configuración), o arrastrar la carpeta `dist/` a <https://app.netlify.com/drop>.

## Sobre este proyecto

Lo estoy desarrollando mientras aprendo programación, con ayuda de IA (Claude) como asistente
para escribir código, revisarlo y explicarme las partes que no conozco.

## Licencia

MIT. Mira el archivo [`LICENSE`](./LICENSE).
