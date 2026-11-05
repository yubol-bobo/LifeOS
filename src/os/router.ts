import { useSyncExternalStore } from 'react';
import { APPS, type AppId } from './apps';

const read = (): AppId => {
  const id = location.hash.replace(/^#\/?/, '').split('?')[0] as AppId;
  return APPS.some((a) => a.id === id) ? id : 'home';
};

export function useRoute(): AppId {
  return useSyncExternalStore(
    (f) => {
      window.addEventListener('hashchange', f);
      return () => window.removeEventListener('hashchange', f);
    },
    read,
  );
}

export function open(id: AppId) {
  location.hash = id === 'home' ? '/' : `/${id}`;
}
