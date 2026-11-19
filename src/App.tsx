import { useEffect, useState, type ComponentType } from 'react';
import { CoachView } from './features/coach/CoachView';
import { NutritionView } from './features/nutrition/NutritionView';
import { ProgressView } from './features/progress/ProgressView';
import { SettingsView } from './features/settings/SettingsView';
import { RestTimerDock } from './features/workout/RestTimerDock';
import { WorkoutView } from './features/workout/WorkoutView';
import { IconChart, IconDumbbell, IconFood, IconGear, IconSpark } from './ui/icons';

type Tab = 'workout' | 'nutrition' | 'coach' | 'progress';
type Route = Tab | 'settings';

const TABS: { id: Tab; label: string; icon: ComponentType<{ size?: number }> }[] = [
  { id: 'workout', label: 'Entreno', icon: IconDumbbell },
  { id: 'nutrition', label: 'Nutrición', icon: IconFood },
  { id: 'coach', label: 'Coach IA', icon: IconSpark },
  { id: 'progress', label: 'Progreso', icon: IconChart },
];

/** La ruta vive en el hash: funciona en GitHub Pages sin reescrituras y el botón atrás del móvil la respeta. */
function readRoute(): Route {
  const hash = window.location.hash.replace('#', '');
  if (hash === 'settings') return 'settings';
  return TABS.some((t) => t.id === hash) ? (hash as Tab) : 'workout';
}

function navigate(route: Route) {
  window.location.hash = route;
}

export function App() {
  const [route, setRoute] = useState<Route>(readRoute);
  const [lastTab, setLastTab] = useState<Tab>('workout');

  useEffect(() => {
    if (route !== 'settings') setLastTab(route);
  }, [route]);

  useEffect(() => {
    const onHash = () => {
      setRoute(readRoute());
      window.scrollTo({ top: 0 });
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const title = route === 'settings' ? 'Ajustes' : TABS.find((t) => t.id === route)!.label;

  return (
    <div className="app">
      <header className="topbar">
        <div>
          <div className="sub">IronRook</div>
          <h1>{title}</h1>
        </div>
        {route !== 'settings' && (
          <button className="btn btn-ghost btn-sm" aria-label="Ajustes" onClick={() => navigate('settings')}>
            <IconGear />
          </button>
        )}
      </header>

      <main className="view" key={route}>
        {route === 'workout' && <WorkoutView />}
        {route === 'nutrition' && <NutritionView />}
        {route === 'coach' && <CoachView />}
        {route === 'progress' && <ProgressView />}
        {route === 'settings' && <SettingsView onClose={() => navigate(lastTab)} />}
      </main>

      <RestTimerDock />

      <nav className="bottom-nav">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} aria-current={route === id ? 'page' : undefined} onClick={() => navigate(id)}>
            <Icon size={22} />
            {label}
          </button>
        ))}
      </nav>
    </div>
  );
}
