import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { App } from './App';
import { AppDataProvider } from './state/AppData';
import { RestTimerProvider } from './state/RestTimer';
import './styles/global.css';

registerSW({ immediate: true });

// Pide al navegador que conserve los datos locales aunque falte espacio o pase tiempo sin abrir la app.
// No es una garantía (el navegador decide), por eso existe la copia de seguridad en Ajustes.
void navigator.storage?.persist?.();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppDataProvider>
      <RestTimerProvider>
        <App />
      </RestTimerProvider>
    </AppDataProvider>
  </StrictMode>,
);
