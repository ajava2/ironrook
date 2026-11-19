# Fit AI Tracker

App web (PWA) para registrar entrenamientos de fuerza y nutrición, con IA opcional. Funciona sin
servidor: todos los datos se guardan en el propio móvil (IndexedDB), así que cada persona tiene
sus datos y no hay cuentas ni registros.

- **Entreno**: crea tus rutinas, apunta series con el peso anterior a la vista, temporizador de
  descanso, récords personales y volumen.
- **Nutrición**: comidas favoritas en un toque, texto libre, código de barras, etiquetas y foto del
  plato (IA opcional).
- **Coach IA**: chat con el contexto de tu día.
- **Progreso**: peso con tendencia, cumplimiento calórico, volumen semanal y 1RM estimado.

## Usarla en el móvil

1. Abre la dirección de la app en el navegador del móvil (Safari en iPhone).
2. Pulsa **Compartir → Añadir a pantalla de inicio**. Así se instala y funciona sin conexión.
3. En **Entreno** pulsa **Crear rutina**, o pega el código que te haya pasado alguien con
   **Pegar código**.

Tus datos están solo en ese móvil. Para cambiar de móvil o hacer copia, usa
**Ajustes → Exportar copia completa**.

### Compartir una rutina

Abre la rutina → **Editar** → **Compartir** y manda el código por mensaje. Quien lo reciba lo
pega en **Entreno → Pegar código**. Cada uno guarda su propia copia.

### IA (opcional)

Sin configurar nada, la app funciona con un modo local (texto libre y coach basado en reglas).
Para usar IA real, crea una clave gratuita en <https://aistudio.google.com/apikey> y pégala en
**Ajustes → Inteligencia artificial**. La clave se queda en tu navegador y nunca se sube a ningún
sitio.

## Desarrollo

Requiere Node 20 o superior.

```bash
npm install
npm run dev       # http://localhost:5173
npm test          # tests de la lógica y de la base de datos
npm run build     # genera dist/
```

### Dónde tocar

| Quiero cambiar… | Mira en |
|---|---|
| Una pantalla | `src/features/<pestaña>/` |
| El catálogo de ejercicios | `src/data/catalog.ts` |
| Valores por defecto (perfil, favoritos) | `src/data/defaults.ts` |
| Una fórmula o cálculo | `src/core/` (lógica pura, con tests en `tests/core/`) |
| La base de datos | `src/data/db.ts` (migraciones) y `src/data/repository.ts` |
| Colores y estilos base | `src/styles/global.css` |

Regla de dependencias: `features → state → data/services → core`. `core` no importa nada del
resto, por eso se puede probar sin navegador.

Antes de abrir un cambio, ejecuta `npm test` y `npm run build`. Si cambias la forma de los
datos guardados, añade una migración en `src/data/db.ts` (nunca edites una versión anterior).

Guía completa del código, con diagramas y fórmulas: [`ARQUITECTURA.md`](./ARQUITECTURA.md).

## Publicar

Es una web estática: sirve cualquier hosting. Con Netlify, conecta el repositorio y listo
(`netlify.toml` ya trae el comando de build y la carpeta `dist`). También se puede arrastrar la
carpeta `dist/` generada con `npm run build` a <https://app.netlify.com/drop>.
