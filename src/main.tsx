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
import { Shell } from './os/Shell';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Shell />
  </StrictMode>,
);
