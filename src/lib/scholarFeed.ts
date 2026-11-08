import { useEffect, useState } from 'react';

/** Shape of public/data/scholar.json written by scripts/scholar-sync.mjs. */
export interface FeedPaper {
  id: string;
  title: string;
  venue: string;
  year: number | null;
  authors: string;
  link: string;
  firstSeen: string;
  lastSeen: string;
  removed?: string;
  citations: number | null;
  d1: number | null;
  d7: number | null;
  d30: number | null;
  series: (number | null)[];
}

export interface ScholarFeed {
  version: 1;
  authorId: string;
  profile: { name?: string; affiliations?: string; thumbnail?: string; byYear?: { year: number; citations: number }[] };
  lastFetch: number | null;
  callsThisMonth: number;
  /** Written by newer versions of the sync script. */
  monthlyLimit?: number;
  intervalHours?: number;
  /** Actual spacing this month: the interval, stretched if needed so the budget lasts. */
  paceHours?: number | null;
  nextFetch?: number | null;
  totals: { citations: number; h: number | null; i10: number | null } | null;
  deltas: { d1: number | null; d7: number | null; d30: number | null };
  history: { date: string; total: number }[];
  dates: string[];
  changes: { since: string | null; added: string[]; removed: string[] };
  papers: FeedPaper[];
}

let cache: ScholarFeed | null | undefined;
let inflight: Promise<ScholarFeed | null> | null = null;
const subs = new Set<(f: ScholarFeed | null) => void>();

/** Fetch the bundled feed (at most once per page load unless forced). Missing file → null. */
export function loadFeed(force = false): Promise<ScholarFeed | null> {
  if (!force && cache !== undefined) return Promise.resolve(cache);
  inflight ??= fetch(`./data/scholar.json?t=${Math.floor(Date.now() / 600_000)}`, { cache: 'no-cache' })
    .then((r) => (r.ok ? r.json() : null))
    .then((j: ScholarFeed | null) => (j && j.version === 1 && j.papers ? j : null))
    .catch(() => null)
    .then((f) => {
      cache = f;
      inflight = null;
      subs.forEach((s) => s(f));
      return f;
    });
  return inflight;
}

export function useScholarFeed() {
  const [feed, setFeed] = useState<ScholarFeed | null | undefined>(cache);
  useEffect(() => {
    subs.add(setFeed);
    loadFeed().then(setFeed);
    return () => {
      subs.delete(setFeed);
    };
  }, []);
  return feed;
}
