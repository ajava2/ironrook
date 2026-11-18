# Fit AI Tracker

PWA personal de entrenamiento y nutrición con IA. Oscura, rápida, offline-first y gratis de usar:
todos los datos viven en el móvil (IndexedDB) y la IA funciona con la capa gratuita de
Google Gemini, Groq u Ollama en local.

| Entreno | Nutrición | Coach IA | Progreso |
|---|---|---|---|
| Plantillas de pierna (énfasis cuádriceps) y torso con hombro seguro, "Anterior: 100 kg × 8", botones ±2.5 kg / +1 rep, temporizador flotante y PRs de e1RM/volumen | Favoritos en 1 clic, foto del plato con Gemini 2.5 Flash, código de barras con OpenFoodFacts, lectura de etiquetas por foto y texto libre; +200 kcal en días de pierna pesada | Chat con tu estado real del día inyectado en el prompt y 3 consultas rápidas | Peso vs tendencia EMA 7 d, cumplimiento calórico, volumen semanal de pierna y 1RM estimado |

## Empezar

```bash
npm install
npm run dev       # http://localhost:5173
npm test          # 116 tests
npm run build     # dist/ listo para servir
```

Al abrir por primera vez se cargan 3 semanas de datos de demostración para que las gráficas tengan
vida. Se borran en **Ajustes ⚙ → Limpiar datos de demo y empezar de cero**.

Para la IA real, crea una API key gratuita en <https://aistudio.google.com/apikey> y pégala en
**Ajustes ⚙ → Inteligencia artificial**. Se guarda solo en el `localStorage` de tu navegador.
Sin key, la app funciona en modo simulación (parser de texto local y coach basado en reglas).

## Desplegar en GitHub Pages

1. En GitHub: *Settings → Pages → Build and deployment → Source: **GitHub Actions***.
2. Haz push (o merge) a `main`. El workflow `.github/workflows/deploy.yml` ejecuta los tests,
   construye y publica en `https://<usuario>.github.io/fit-ai-tracker/`.
3. En el móvil abre esa URL y "Añadir a pantalla de inicio".

## Cómo está hecho

Lee [`ARQUITECTURA.md`](./ARQUITECTURA.md): mapa de carpetas, flujo de datos con diagramas y
explicación de cada fórmula (Atwater, Epley, EMA con huecos, ajuste de día de pierna, ranking
de cenas, sincronización last-write-wins).
