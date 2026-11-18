import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { App } from './App';
import { AppDataProvider } from './state/AppData';
import { RestTimerProvider } from './state/RestTimer';
import './styles/global.css';

registerSW({ immediate: true });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppDataProvider>
      <RestTimerProvider>
        <App />
      </RestTimerProvider>
    </AppDataProvider>
  </StrictMode>,
);
