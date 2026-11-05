import { useSyncExternalStore } from 'react';

/* ------------------------------------------------------------------ */
/* Layout: portrait (scrolling column of widgets) or landscape         */
/* (full-width dashboard that fits the screen). Per device, not synced:*/
/* a laptop and a wall monitor usually want different layouts.         */
/* ------------------------------------------------------------------ */

export type Layout = 'portrait' | 'landscape';
const KEY = 'lifeos:layout';
const subs = new Set<() => void>();

function read(): Layout {
  try {
    return localStorage.getItem(KEY) === 'landscape' ? 'landscape' : 'portrait';
  } catch {
    return 'portrait';
  }
}

let layout: Layout = read();

export function setLayout(next: Layout) {
  layout = next;
  try {
    localStorage.setItem(KEY, next);
  } catch {
    /* private mode: keep it for this session */
  }
  subs.forEach((f) => f());
}

export const getLayout = () => layout;
export const toggleLayout = () => setLayout(layout === 'landscape' ? 'portrait' : 'landscape');

export function useLayout(): Layout {
  return useSyncExternalStore(
    (f) => (subs.add(f), () => subs.delete(f)),
    () => layout,
  );
}

/* ------------------------------------------------------------------ */
/* App windows: fit their content (default) or open wide; click outside */
/* the window to go back to the desktop (default on). Per device.     */
/* ------------------------------------------------------------------ */

export interface WindowPrefs {
  size: 'fit' | 'wide';
  clickOut: boolean;
}
const WKEY = 'lifeos:windows';
const wsubs = new Set<() => void>();
let wprefs: WindowPrefs = (() => {
  try {
    return { size: 'fit', clickOut: true, ...JSON.parse(localStorage.getItem(WKEY) ?? '{}') } as WindowPrefs;
  } catch {
    return { size: 'fit', clickOut: true };
  }
})();
export function setWindowPrefs(p: Partial<WindowPrefs>) {
  wprefs = { ...wprefs, ...p };
  try {
    localStorage.setItem(WKEY, JSON.stringify(wprefs));
  } catch {
    /* ignore */
  }
  wsubs.forEach((f) => f());
}
export const useWindowPrefs = () =>
  useSyncExternalStore(
    (f) => (wsubs.add(f), () => wsubs.delete(f)),
    () => wprefs,
  );

/* ------------------------------------------------------------------ */
/* Fullscreen                                                          */
/* ------------------------------------------------------------------ */

type FsDoc = Document & { webkitFullscreenElement?: Element | null; webkitExitFullscreen?: () => Promise<void> };
type FsEl = HTMLElement & { webkitRequestFullscreen?: () => Promise<void> };

const fsDoc = () => document as FsDoc;
const isFs = () => !!(fsDoc().fullscreenElement ?? fsDoc().webkitFullscreenElement);

export const fullscreenSupported = () => {
  const el = document.documentElement as FsEl;
  return !!(el.requestFullscreen || el.webkitRequestFullscreen);
};

export async function toggleFullscreen() {
  try {
    if (isFs()) await (fsDoc().exitFullscreen?.() ?? fsDoc().webkitExitFullscreen?.());
    else {
      const el = document.documentElement as FsEl;
      await (el.requestFullscreen?.({ navigationUI: 'hide' }) ?? el.webkitRequestFullscreen?.());
    }
  } catch {
    /* blocked by the browser (e.g. inside an iframe) */
  }
}

export function useFullscreen(): boolean {
  return useSyncExternalStore(
    (f) => {
      document.addEventListener('fullscreenchange', f);
      document.addEventListener('webkitfullscreenchange', f);
      return () => {
        document.removeEventListener('fullscreenchange', f);
        document.removeEventListener('webkitfullscreenchange', f);
      };
    },
    isFs,
  );
}
