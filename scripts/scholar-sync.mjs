#!/usr/bin/env node
/**
 * Google Scholar → LifeOS sync (via SerpAPI's google_scholar_author engine).
 *
 * Runs inside the Pages workflow. It is rate-limited by design:
 *   - at most one fetch per SCHOLAR_INTERVAL_HOURS (default 8 h), no matter how often the workflow runs
 *     (the workflow wakes up hourly, so the interval is what decides)
 *   - paced so the month's budget lasts: if the interval would use up the budget before the month ends,
 *     fetches are spaced out a little more (remaining hours ÷ remaining fetches)
 *   - never more than SCHOLAR_MONTHLY_LIMIT SerpAPI calls per calendar month (default 100, the free plan)
 *   - SCHOLAR_FORCE=true (a manual "Run workflow") skips the interval and pacing, not the monthly limit
 *   - per-paper "citations per year" graphs (one extra call per paper) are fetched only from spare budget:
 *     what's left after reserving enough calls for the regular fetches until the month ends. Up to
 *     SCHOLAR_PAPER_GRAPHS (default 3) per run, papers without a graph first, then graphs older than 30 days.
 *
 * Usage: node scripts/scholar-sync.mjs <data-dir>
 * Config: lifeos.config.json → scholar.{id, intervalHours, monthlyLimit, timezone}; env vars override.
 * Env:   SERPAPI_KEY (secret), SCHOLAR_ID (variable), optional SCHOLAR_INTERVAL_HOURS, SCHOLAR_MONTHLY_LIMIT,
 *        SCHOLAR_TZ (IANA zone for "today", default UTC), SCHOLAR_FORCE, SERPAPI_MOCK (path to a JSON fixture, for tests)
 * Output: writes fetched=true to $GITHUB_OUTPUT after a successful fetch (the workflow skips the
 *         rebuild on scheduled runs that fetched nothing).
 *
 * Files in <data-dir>:
 *   scholar-history.json — full history (daily snapshots, per-paper metadata, fetch log)
 *   scholar.json         — compact view the web app reads
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = process.argv[2] || '.scholar-data';
// Settings: environment (repo variables/secrets) first, then lifeos.config.json in the repo root.
let cfg = {};
try {
  cfg = JSON.parse(readFileSync(new URL('../lifeos.config.json', import.meta.url), 'utf8')).scholar || {};
} catch {
  /* no config file */
}
const KEY = process.env.SERPAPI_KEY || '';
const ID = (process.env.SCHOLAR_ID || cfg.id || '').trim();
const INTERVAL_H = Number(process.env.SCHOLAR_INTERVAL_HOURS || cfg.intervalHours || 8);
const MONTHLY_LIMIT = Number(process.env.SCHOLAR_MONTHLY_LIMIT || cfg.monthlyLimit || 100);
const TZ = process.env.SCHOLAR_TZ || cfg.timezone || 'UTC';
const MOCK = process.env.SERPAPI_MOCK || '';
const FORCE = process.env.SCHOLAR_FORCE === 'true';
// An unset repo variable arrives as an empty string, so treat '' as "not set".
const GRAPHS_PER_RUN = Number(process.env.SCHOLAR_PAPER_GRAPHS || (cfg.paperGraphsPerRun ?? 3));
const GRAPH_MAX_AGE_DAYS = 30;
const MAX_PAGES = 5;

const log = (...a) => console.log('[scholar]', ...a);
const histPath = join(dir, 'scholar-history.json');
const viewPath = join(dir, 'scholar.json');

const now = new Date();
const dayOf = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
const today = dayOf(now);
const month = today.slice(0, 7);

const monthCalls = (h, m = month) => h.fetches.filter((f) => f.month === m).reduce((a, f) => a + f.calls + (f.extra || 0), 0);

/** Hours between fetches right now: the configured interval, stretched if the budget wouldn't last the month. */
function paceHours(h, at = now) {
  const left = MONTHLY_LIMIT - monthCalls(h);
  const perFetch = Math.max(1, h.fetches.at(-1)?.calls || 1);
  const fetchesLeft = Math.floor(left / perFetch);
  const end = new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth() + 1, 1));
  const hoursLeft = (end.getTime() - at.getTime()) / 3600_000;
  if (fetchesLeft <= 0) return Infinity;
  return Math.max(INTERVAL_H, hoursLeft / fetchesLeft);
}

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
  const pace = paceHours(h);
  if (FORCE) log('Manual run — fetching now (the monthly limit still applies).');
  else if (last && now.getTime() - last.ts < pace * 3600_000 - 10 * 60_000) {
    const why = pace > INTERVAL_H ? ` (interval ${INTERVAL_H} h, stretched to ${pace.toFixed(1)} h so this month's budget lasts)` : '';
    return log(`Last fetch ${((now.getTime() - last.ts) / 3600_000).toFixed(1)} h ago (< ${pace.toFixed(1)} h${why}) — skipping.`);
  }
  const used = monthCalls(h);
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
      ...prev, // keeps byYear / graphAt
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

  await fetchGraphs(h, articles);
  save(h);
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, 'fetched=true\n');
  const prevDay = h.days.at(-2);
  log(`Fetched ${articles.length} papers in ${calls} call(s); total citations ${total}${prevDay ? ` (${total - prevDay.total >= 0 ? '+' : ''}${total - prevDay.total} since ${prevDay.date})` : ''}. Month usage ${used + calls}/${MONTHLY_LIMIT}.`);
}

/** Pull a "citations per year" table out of a view_citation response, whatever shape it comes in. */
function yearTable(res) {
  const c = res.citation || {};
  const raw = c.total_citations?.table || c.total_citations?.graph || c.cited_by?.graph || c.cited_by?.table || res.cited_by?.graph || [];
  return raw
    .map((r) => ({ year: Number(r.year), citations: Number(r.citations ?? r.cited_by ?? r.value) || 0 }))
    .filter((r) => r.year > 1900)
    .sort((a, b) => a.year - b.year);
}

/** Per-paper yearly graphs, from spare budget only (see the header). */
async function fetchGraphs(h, articles) {
  if (GRAPHS_PER_RUN <= 0 || MOCK) return;
  const fetch0 = h.fetches.at(-1);
  const left = MONTHLY_LIMIT - monthCalls(h);
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  const hoursLeft = (end.getTime() - now.getTime()) / 3600_000;
  const reserve = Math.ceil(hoursLeft / Math.max(INTERVAL_H, 1)) * Math.max(1, fetch0.calls);
  const spare = left - reserve;
  if (spare <= 0) return log(`No spare budget for per-paper graphs this run (${left} left, ${reserve} reserved).`);
  const stale = (id) => {
    const at = h.papers[id]?.graphAt;
    return !at || (now.getTime() - new Date(`${at}T00:00:00Z`).getTime()) / 86_400_000 > GRAPH_MAX_AGE_DAYS;
  };
  const queue = articles
    .filter((a) => a.citation_id && stale(a.citation_id) && (Number(a.cited_by?.value) || 0) > 0)
    .sort((a, b) => Number(!!h.papers[a.citation_id]?.graphAt) - Number(!!h.papers[b.citation_id]?.graphAt) || (h.papers[a.citation_id]?.graphAt || '').localeCompare(h.papers[b.citation_id]?.graphAt || '') || (Number(b.cited_by?.value) || 0) - (Number(a.cited_by?.value) || 0))
    .slice(0, Math.min(GRAPHS_PER_RUN, spare));
  let extra = 0;
  for (const a of queue) {
    const url = new URL('https://serpapi.com/search.json');
    url.search = new URLSearchParams({ engine: 'google_scholar_author', view_op: 'view_citation', citation_id: a.citation_id, hl: 'en', api_key: KEY }).toString();
    try {
      const r = await fetch(url);
      extra++;
      const res = await r.json().catch(() => ({ error: `HTTP ${r.status}` }));
      if (res.error) {
        log(`Graph for "${(a.title || '').slice(0, 50)}": ${res.error}`);
        continue;
      }
      const table = yearTable(res);
      const p = h.papers[a.citation_id];
      p.graphAt = today; // even if empty, don't ask again for a month
      if (table.length) p.byYear = table;
      else log(`Graph for "${(a.title || '').slice(0, 50)}": no yearly table (keys: ${Object.keys(res.citation || res).join(', ')})`);
    } catch (e) {
      log(`Graph fetch failed: ${e.message}`);
    }
  }
  fetch0.extra = extra;
  const missing = articles.filter((a) => a.citation_id && !h.papers[a.citation_id]?.graphAt && (Number(a.cited_by?.value) || 0) > 0).length;
  if (extra) log(`Per-paper graphs: ${extra} call(s) this run, ${missing} paper(s) still without one.`);
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
    // Every day's count, kept only where it changed (plus the latest day), as [date, citations].
    const hist = [];
    for (const d of days) {
      const v = d.cites[id];
      if (v == null) continue;
      if (!hist.length || hist[hist.length - 1][1] !== v) hist.push([d.date, v]);
      else if (d === cur) hist.push([d.date, v]);
    }
    return {
      id,
      ...p,
      hist,
      citations: now ?? null,
      d1: diff(d1),
      d7: diff(d7),
      d30: diff(d30),
      series: recent.map((d) => d.cites[id] ?? null),
    };
  });
  const lastFetch = h.fetches.at(-1)?.ts ?? null;
  const pace = paceHours(h);
  return {
    version: 1,
    authorId: h.authorId,
    profile: h.profile,
    lastFetch,
    callsThisMonth: monthCalls(h),
    monthlyLimit: MONTHLY_LIMIT,
    intervalHours: INTERVAL_H,
    paceHours: Number.isFinite(pace) ? Math.round(pace * 10) / 10 : null,
    // Earliest time the hourly workflow will fetch again (it runs at a random-ish minute each hour).
    nextFetch: lastFetch && Number.isFinite(pace) ? lastFetch + pace * 3600_000 : null,
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
