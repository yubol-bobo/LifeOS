import { useLang } from '../lib/i18n';
import { attrName } from './defaults';
import { useStore } from './store';
import type { Attr } from './types';

export * from './defaults';

export function useAttrs() {
  const list = useStore((s) => s.attributes);
  const lang = useLang();
  const find = (id: Attr) => list.find((a) => a.id === id);
  return {
    list,
    find,
    label: (id: Attr) => attrName(find(id), lang),
    icon: (id: Attr) => find(id)?.icon ?? 'sparkles',
  };
}

