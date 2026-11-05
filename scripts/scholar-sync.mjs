#!/usr/bin/env node
/**
 * Google Scholar → LifeOS sync (via SerpAPI's google_scholar_author engine).
 *
 * Runs inside the Pages workflow. It is rate-limited by design:
 *   - at most one fetch per SCHOLAR_INTERVAL_HOURS (default 8 h), no matter how often the workflow runs
 *   - never more than SCHOLAR_MONTHLY_LIMIT SerpAPI calls per calendar month (default 100, the free plan)
 *
 * Usage: node scripts/scholar-sync.mjs <data-dir>
 * Env:   SERPAPI_KEY (secret), SCHOLAR_ID (variable), optional SCHOLAR_INTERVAL_HOURS, SCHOLAR_MONTHLY_LIMIT,
 *        SCHOLAR_TZ (IANA zone for "today", default UTC), SERPAPI_MOCK (path to a JSON fixture, for tests)
 *
 * Files in <data-dir>:
 *   scholar-history.json — full history (daily snapshots, per-paper metadata, fetch log)
 *   scholar.json         — compact view the web app reads
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = process.argv[2] || '.scholar-data';
const KEY = process.env.SERPAPI_KEY || '';
const ID = (process.env.SCHOLAR_ID || '').trim();
const INTERVAL_H = Number(process.env.SCHOLAR_INTERVAL_HOURS || 8);
const MONTHLY_LIMIT = Number(process.env.SCHOLAR_MONTHLY_LIMIT || 100);
const TZ = process.env.SCHOLAR_TZ || 'UTC';
const MOCK = process.env.SERPAPI_MOCK || '';
const MAX_PAGES = 5;

const log = (...a) => console.log('[scholar]', ...a);
const histPath = join(dir, 'scholar-history.json');
const viewPath = join(dir, 'scholar.json');

const now = new Date();
const dayOf = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
const today = dayOf(now);
const month = today.slice(0, 7);

function load() {
  if (!existsSync(histPath)) return { version: 1, authorId: ID, profile: {}, papers: {}, days: [], fetches: [] };
  return JSON.parse(readFileSync(histPath, 'utf8'));
}

async function main() {
  if (!ID) return log('SCHOLAR_ID not set — skipping.');
  if (!KEY && !MOCK) return log('SERPAPI_KEY not set — skipping.');
  mkdirSync(dir, { recursive: true });
  const h = load();
  if (h.authorId && h.authorId !== ID) {
    log(`SCHOLAR_ID changed (${h.authorId} → ${ID}); starting a fresh history.`);
    Object.assign(h, { authorId: ID, profile: {}, papers: {}, days: [], fetches: [] });
  }

  // ---- rate limits ----
  const last = h.fetches.at(-1);
  if (last && now.getTime() - last.ts < INTERVAL_H * 3600_000 - 10 * 60_000) {
    return log(`Last fetch ${((now.getTime() - last.ts) / 3600_000).toFixed(1)} h ago (< ${INTERVAL_H} h) — skipping.`);
  }
  const used = h.fetches.filter((f) => f.month === month).reduce((a, f) => a + f.calls, 0);
  if (used >= MONTHLY_LIMIT) return log(`Monthly budget reached (${used}/${MONTHLY_LIMIT} calls in ${month}) — skipping.`);

  // ---- fetch (paginated, 100 per page) ----
  const articles = [];
  let profile = null;
  let calls = 0;
  for (let page = 0; page < MAX_PAGES; page++) {
    if (used + calls >= MONTHLY_LIMIT) {
      log('Monthly budget would be exceeded mid-pagination — stopping early.');
      break;
    }
    let res;
    if (MOCK) res = JSON.parse(readFileSync(MOCK, 'utf8'));
    else {
      const url = new URL('https://serpapi.com/search.json');
      url.search = new URLSearchParams({ engine: 'google_scholar_author', author_id: ID, hl: 'en', num: '100', start: String(page * 100), api_key: KEY }).toString();
      const r = await fetch(url);
      calls++;
      res = await r.json().catch(() => ({ error: `HTTP ${r.status}` }));
      if (!r.ok && !res.error) res.error = `HTTP ${r.status}`;
    }
    if (MOCK) calls++;
    if (res.error) throw new Error(`SerpAPI: ${res.error}`);
    if (page === 0) profile = res;
    const batch = res.articles || [];
    articles.push(...batch);
    if (MOCK || batch.length < 100 || !res.serpapi_pagination?.next) break;
  }
  h.fetches.push({ ts: now.getTime(), date: today, month, calls, papers: articles.length });
  h.fetches = h.fetches.slice(-400);

  if (!articles.length) {
    save(h);
    throw new Error('SerpAPI returned no articles — keeping previous data.');
  }

  // ---- totals ----
  const table = profile.cited_by?.table || [];
  const pick = (key) => {
    const row = table.find((r) => r[key]);
    return row ? Number(row[key].all ?? 0) : null;
  };
  const totals = { citations: pick('citations'), h: pick('h_index'), i10: pick('i10_index') };
  const byYear = (profile.cited_by?.graph || []).map((g) => ({ year: Number(g.year), citations: Number(g.citations) || 0 }));
  h.profile = {
    name: profile.author?.name ?? h.profile.name,
    affiliations: profile.author?.affiliations ?? h.profile.affiliations,
    thumbnail: profile.author?.thumbnail ?? h.profile.thumbnail,
    byYear,
  };

  // ---- per-paper snapshot ----
  const cites = {};
  for (const a of articles) {
    const id = a.citation_id || `t:${(a.title || '').toLowerCase().replace(/\W+/g, '').slice(0, 60)}`;
    cites[id] = Number(a.cited_by?.value) || 0;
    const prev = h.papers[id] || {};
    h.papers[id] = {
      title: a.title ?? prev.title,
      venue: a.publication ?? prev.venue ?? '',
      year: Number(a.year) || prev.year || null,
      authors: a.authors ?? prev.authors ?? '',
      link: a.link ?? prev.link ?? '',
      firstSeen: prev.firstSeen ?? today,
      lastSeen: today,
      removed: undefined,
    };
  }

  // Guard against a partial/odd response wiping out papers: only mark removals if most papers came back.
  const prevActive = Object.entries(h.papers).filter(([, p]) => !p.removed && p.lastSeen !== today).map(([id]) => id);
  const prevCount = Object.values(h.papers).filter((p) => !p.removed).length;
  if (articles.length >= prevCount * 0.6) for (const id of prevActive) h.papers[id].removed = today;
  else log(`Only ${articles.length} papers returned vs ${prevCount} known — not marking any as removed.`);

  // One snapshot per day (later fetches the same day overwrite it).
  const total = totals.citations ?? Object.values(cites).reduce((a, b) => a + b, 0);
  const snap = { date: today, total, h: totals.h, i10: totals.i10, cites };
  if (h.days.at(-1)?.date === today) h.days[h.days.length - 1] = snap;
  else h.days.push(snap);

  save(h);
  const prevDay = h.days.at(-2);
  log(`Fetched ${articles.length} papers in ${calls} call(s); total citations ${total}${prevDay ? ` (${total - prevDay.total >= 0 ? '+' : ''}${total - prevDay.total} since ${prevDay.date})` : ''}. Month usage ${used + calls}/${MONTHLY_LIMIT}.`);
}

function save(h) {
  writeFileSync(histPath, JSON.stringify(h));
  writeFileSync(viewPath, JSON.stringify(view(h)));
}

/** Compact file for the browser: current state, deltas, and short per-paper series. */
function view(h) {
  const days = h.days;
  const cur = days.at(-1);
  const back = (n) => {
    if (!cur) return undefined;
    const cut = new Date(`${cur.date}T00:00:00Z`);
    cut.setUTCDate(cut.getUTCDate() - n);
    const c = cut.toISOString().slice(0, 10);
    return [...days].reverse().find((d) => d.date <= c);
  };
  const d1 = days.at(-2);
  const d7 = back(7);
  const d30 = back(30);
  const recent = days.slice(-60);
  const papers = Object.entries(h.papers).map(([id, p]) => {
    const now = cur?.cites[id];
    const diff = (d) => (now != null && d?.cites[id] != null ? now - d.cites[id] : null);
    return {
      id,
      ...p,
      citations: now ?? null,
      d1: diff(d1),
      d7: diff(d7),
      d30: diff(d30),
      series: recent.map((d) => d.cites[id] ?? null),
    };
  });
  const month = new Date().toISOString().slice(0, 7);
  return {
    version: 1,
    authorId: h.authorId,
    profile: h.profile,
    lastFetch: h.fetches.at(-1)?.ts ?? null,
    callsThisMonth: h.fetches.filter((f) => f.month === month).reduce((a, f) => a + f.calls, 0),
    totals: cur ? { citations: cur.total, h: cur.h, i10: cur.i10 } : null,
    deltas: { d1: d1 && cur ? cur.total - d1.total : null, d7: d7 && cur ? cur.total - d7.total : null, d30: d30 && cur ? cur.total - d30.total : null },
    history: days.map((d) => ({ date: d.date, total: d.total })),
    dates: recent.map((d) => d.date),
    changes: cur && d1 ? { since: d1.date, added: papers.filter((p) => p.firstSeen === cur.date && days.length > 1).map((p) => p.id), removed: papers.filter((p) => p.removed === cur.date).map((p) => p.id) } : { since: null, added: [], removed: [] },
    papers,
  };
}

main().catch((e) => {
  console.error('[scholar]', e.message);
  process.exitCode = 1;
});
