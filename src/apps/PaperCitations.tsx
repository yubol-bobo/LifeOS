import { useState } from 'react';
import { addDays, parseDay } from '../lib/date';
import { useL, useLang } from '../lib/i18n';
import { open } from '../os/router';
import { useScholarFeed, type FeedPaper } from '../lib/scholarFeed';
import type { Paper } from '../store/types';
import { AreaChart, Columns, Sparkline } from '../ui/charts';
import { Segmented } from '../ui/kit';

/** Open Research with one paper's page (and its citation curve) showing. */
export function openPaper(id: string) {
  try {
    sessionStorage.setItem('lifeos:paper-open', id);
  } catch {
    /* ignore */
  }
  open('research');
  window.dispatchEvent(new CustomEvent('lifeos:paper-open', { detail: id }));
}

/** The Google Scholar feed entry for a paper, if it came from (or was matched to) Scholar. */
export function useFeedPaper(p: Pick<Paper, 'scholarId'> | undefined): FeedPaper | undefined {
  const feed = useScholarFeed();
  if (!p?.scholarId || !feed) return undefined;
  return feed.papers.find((x) => x.id === p.scholarId);
}

/** Day-by-day totals since tracking began: change points expanded, gaps carried forward. */
export function dailySeries(fp: FeedPaper): { day: string; v: number }[] {
  const pts: [string, number][] = fp.hist?.length ? fp.hist : [];
  if (!pts.length) return [];
  const out: { day: string; v: number }[] = [];
  let i = 0;
  let v = pts[0][1];
  const last = pts[pts.length - 1][0];
  for (let d = pts[0][0]; d <= last; d = addDays(d, 1)) {
    while (i < pts.length && pts[i][0] <= d) v = pts[i++][1];
    out.push({ day: d, v });
    if (out.length > 4000) break; // safety
  }
  return out;
}

/** A tiny trend line for lists (project pages, tables). */
export function PaperSpark({ fp }: { fp: FeedPaper }) {
  const s = dailySeries(fp).map((x) => x.v);
  return s.length >= 2 ? <Sparkline values={s.slice(-90)} tone="spirit" width={64} height={20} /> : null;
}

/** A paper's own citation curve: per year from Google Scholar, and day by day since LifeOS started tracking it. */
export function PaperCitations({ fp }: { fp: FeedPaper }) {
  const L = useL();
  const lang = useLang();
  const daily = dailySeries(fp);
  const years = fp.byYear ?? [];
  const [view, setView] = useState<'daily' | 'years'>(() => (daily.length >= 7 || !years.length ? 'daily' : 'years'));
  const fmtDay = (d: string) => parseDay(d).toLocaleDateString(lang === 'zh' ? 'zh-CN' : 'en-US', { month: 'short', day: 'numeric' });
  const delta = (v: number | null, label: string) =>
    v != null && (
      <span className={`pc-delta ${v > 0 ? 'pos' : ''}`}>
        <b className="num">{v > 0 ? `+${v}` : v}</b> {label}
      </span>
    );
  return (
    <section className="paper-cites">
      <header className="pc-head">
        <div>
          <span className="pc-total num">{fp.citations ?? '—'}</span>
          <span className="muted small"> {L('次引用', 'citations')}</span>
        </div>
        <div className="pc-deltas">
          {delta(fp.d1, L('较上次', 'last fetch'))}
          {delta(fp.d7, L('近 7 天', '7 days'))}
          {delta(fp.d30, L('近 30 天', '30 days'))}
        </div>
        <Segmented
          size="sm"
          value={view}
          onChange={setView}
          options={[
            { value: 'daily', label: L('每日追踪', 'Daily') },
            { value: 'years', label: L('每年新增', 'Per year') },
          ]}
        />
      </header>
      {view === 'daily' ? (
        daily.length >= 2 ? (
          <>
            <AreaChart data={daily.map((x) => ({ x: fmtDay(x.day), y: x.v }))} tone="spirit" height={150} baseline="auto" />
            <p className="muted small">{L(`从 ${fmtDay(daily[0].day)} 开始追踪，每次抓取 Google Scholar 都会记一笔。`, `Tracked since ${fmtDay(daily[0].day)}; every Google Scholar fetch adds a point.`)}</p>
          </>
        ) : (
          <p className="muted small pc-empty">{L('刚开始追踪这篇论文，再抓取几次就能看到每日曲线。', 'Tracking just started for this paper; the daily curve appears after a few more fetches.')}</p>
        )
      ) : years.length ? (
        <>
          <Columns data={years.map((y) => ({ x: String(y.year), y: y.citations }))} tone="spirit" height={150} />
          <p className="muted small">{L('来自 Google Scholar 的论文页面，每月刷新一次。', 'From the paper’s Google Scholar page, refreshed monthly.')}</p>
        </>
      ) : (
        <p className="muted small pc-empty">
          {(fp.citations ?? 0) > 0
            ? L('每年引用会在接下来的几次自动抓取中补上（只用每月额度的富余部分，不影响常规抓取）。', 'Citations per year are filled in over the next few automatic fetches (using only spare monthly budget, never the regular fetches).')
            : L('还没有引用，等有了引用就会出现每年的柱状图。', 'No citations yet; a per-year chart appears once it has some.')}
        </p>
      )}
    </section>
  );
}
