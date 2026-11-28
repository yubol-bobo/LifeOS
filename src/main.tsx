import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/bricolage-grotesque';
import '@fontsource-variable/manrope';
import './styles/tokens.css';
import './styles/base.css';
import './styles/shell.css';
import './styles/apps.css';
import './styles/pet.css';
import './styles/round3.css';
import './styles/plans.css';
import './styles/growth.css';
import './styles/layout.css';
import './styles/review.css';
import './styles/focus.css';
import './styles/report.css';
import { Shell } from './os/Shell';

import { hydrateStorage } from './store/store';

// Load saved data from IndexedDB before the first render (never wait more than a moment).
void Promise.race([hydrateStorage().catch(() => {}), new Promise((r) => setTimeout(r, 2500))]).then(() =>
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <Shell />
    </StrictMode>,
  ),
);

// Offline + "install as an app": only in the built site (the dev server must never be cached).
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => void navigator.serviceWorker.register('./sw.js').catch(() => {}));
}
