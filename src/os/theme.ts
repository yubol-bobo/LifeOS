import { useEffect, useState } from 'react';
import { useStore } from '../store/store';

const mq = () => window.matchMedia('(prefers-color-scheme: dark)');

/** Resolves the theme preference, writes it to <html data-theme>, returns whether dark. */
export function useTheme() {
  const pref = useStore((s) => s.profile.theme);
  const [sysDark, setSysDark] = useState(() => mq().matches);
  useEffect(() => {
    const m = mq();
    const f = () => setSysDark(m.matches);
    m.addEventListener('change', f);
    return () => m.removeEventListener('change', f);
  }, []);
  const dark = pref === 'dark' || (pref === 'system' && sysDark);
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute('content', dark ? '#0F0E15' : '#EEE8DE'));
  }, [dark]);
  return dark;
}
