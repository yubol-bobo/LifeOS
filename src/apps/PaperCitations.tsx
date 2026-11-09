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
          <p className="muted small">
            {L('每年新增的引用来自 OpenAlex（按标题匹配，每周刷新）。它收录的引用和 Google Scholar 不完全一样，所以总数可能略少。', 'Citations per year come from OpenAlex (matched by title, refreshed weekly). It indexes citations a little differently from Google Scholar, so totals can be somewhat lower.')}
            {fp.openalexId && (
              <>
                {' '}
                <a href={fp.openalexId} target="_blank" rel="noreferrer">
                  {L('在 OpenAlex 查看', 'View on OpenAlex')}
                </a>
              </>
            )}
          </p>
        </>
      ) : (
        <p className="muted small pc-empty">
          {(fp.citations ?? 0) === 0
            ? L('还没有引用，等有了引用就会出现每年的柱状图。', 'No citations yet; a per-year chart appears once it has some.')
            : fp.byYearMiss
              ? L('在 OpenAlex 里没找到这篇论文（可能刚发布、还没被收录），每周会再找一次。', 'This paper wasn’t found on OpenAlex yet (it may be too new to be indexed); it’s looked up again weekly.')
              : L('每年引用会在下一次自动抓取时补上（来自 OpenAlex，免费，不占 SerpAPI 额度）。', 'Citations per year are filled in at the next automatic fetch (from OpenAlex: free, no SerpAPI calls).')}
        </p>
      )}
    </section>
  );
}
