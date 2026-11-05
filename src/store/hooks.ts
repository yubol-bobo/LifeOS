import { useMemo } from 'react';
import { metrics } from './rules';
import { useStore } from './store';

export function useMetrics() {
  const s = useStore((x) => x);
  return useMemo(() => metrics(s), [s]);
}
