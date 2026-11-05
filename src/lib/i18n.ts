import { useStore } from '../store/store';

/** Inline bilingual strings: L('中文', 'English'). Keeps copy next to the UI it belongs to. */
export function useL() {
  const lang = useStore((s) => s.profile.lang);
  return (zh: string, en: string) => (lang === 'zh' ? zh : en);
}

export function useLang() {
  return useStore((s) => s.profile.lang);
}
