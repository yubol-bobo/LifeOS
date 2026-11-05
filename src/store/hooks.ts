import { useMemo } from 'react';
import { metrics } from './rules';
import { useStore } from './store';
import type { Attr } from './types';

export function useMetrics() {
  const s = useStore((x) => x);
  return useMemo(() => metrics(s), [s]);
}

export const ATTR_META: Record<Attr, { zh: string; en: string; icon: string }> = {
  mind: { zh: '智识', en: 'Mind', icon: 'brain' },
  body: { zh: '体魄', en: 'Body', icon: 'dumbbell' },
  wealth: { zh: '财富', en: 'Wealth', icon: 'coins' },
  craft: { zh: '创造', en: 'Craft', icon: 'hammer' },
  bond: { zh: '羁绊', en: 'Bond', icon: 'heart' },
  spirit: { zh: '心境', en: 'Spirit', icon: 'leaf' },
};
