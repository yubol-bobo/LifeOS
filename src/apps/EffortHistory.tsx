import { useState } from 'react';
import { addDays, dayKey, parseDay, startOfWeek } from '../lib/date';
import { money } from '../lib/format';
import { useL, useLang } from '../lib/i18n';
import type { Project, WorkSession } from '../store/types';
import { Segmented } from '../ui/kit';

/* ---------------- ranges ---------------- */

export type RangeId = 'today' | 'yesterday' | 'week' | 'lastWeek' | 'month' | 'lastMonth' | 'all' | 'custom';
export interface Range {
  id: RangeId;
  from?: string; // custom: YYYY-MM-DD, inclusive
  to?: string;
}
/** A time window: [from, to) in ms, plus its first and last day. */
export interface Win {
  from: number;
  to: number;
  first: string;
  last: string;
}

const dayStart = (k: string) => parseDay(k).getTime();
const win = (first: string, last: string): Win => ({ from: dayStart(first), to: dayStart(addDays(last, 1)), first, last });
const monthFirst = (d: Date) => dayKey(new Date(d.getFullYear(), d.getMonth(), 1));
const monthLast = (d: Date) => dayKey(new Date(d.getFullYear(), d.getMonth() + 1, 0));

export function rangeWindow(r: Range, sessions: WorkSession[]): Win {
  const today = dayKey();
  const now = new Date();
  const wk = dayKey(startOfWeek());
  switch (r.id) {
    case 'today':
      return win(today, today);
    case 'yesterday':
      return win(addDays(today, -1), addDays(today, -1));
    case 'week':
      return win(wk, addDays(wk, 6));
    case 'lastWeek':
      return win(addDays(wk, -7), addDays(wk, -1));
    case 'month':
      return win(monthFirst(now), monthLast(now));
    case 'lastMonth': {
      const p = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      return win(monthFirst(p), monthLast(p));
    }
    case 'all': {
      const first = sessions.length ? dayKey(Math.min(...sessions.map((x) => x.start))) : today;
      return win(first, today);
    }
    case 'custom': {
      const a = r.from || today;
      const b = r.to || a;
      return a <= b ? win(a, b) : win(b, a);
    }
  }
}

/** Range picker: Today / Yesterday / This week as buttons, the rest in a menu, custom dates inline. */
export function RangePicker({ value, onChange }: { value: Range; onChange: (r: Range) => void }) {
  const L = useL();
  const quick: RangeId[] = ['today', 'yesterday', 'week'];
  const isQuick = quick.includes(value.id);
  const today = dayKey();
  return (
    <div className="range-pick row-gap wrap">
      <Segmented
        size="sm"
        value={isQuick ? value.id : ('' as RangeId)}
        onChange={(v) => onChange({ id: v })}
        options={[
          { value: 'today', label: L('今天', 'Today') },
          { value: 'yesterday', label: L('昨天', 'Yesterday') },
          { value: 'week', label: L('本周', 'This week') },
        ]}
      />
      <select
        className={`input input-sm ${!isQuick ? 'is-on' : ''}`}
        value={isQuick ? '' : value.id}
        aria-label={L('更多时间范围', 'More ranges')}
        onChange={(e) => {
          const id = e.target.value as RangeId;
          if (!id) return;
          onChange(id === 'custom' ? { id, from: addDays(today, -13), to: today } : { id });
        }}
      >
        <option value="">{L('更多范围…', 'More…')}</option>
        <option value="lastWeek">{L('上周', 'Last week')}</option>
        <option value="month">{L('本月', 'This month')}</option>
        <option value="lastMonth">{L('上个月', 'Last month')}</option>
        <option value="all">{L('全部', 'All time')}</option>
        <option value="custom">{L('自选日期…', 'Custom dates…')}</option>
      </select>
      {value.id === 'custom' && (
        <span className="range-dates">
          <input className="input input-sm input-date" type="date" max={today} value={value.from ?? ''} aria-label={L('开始日期', 'From')} onChange={(e) => e.target.value && onChange({ ...value, from: e.target.value })} />
          <span className="muted">–</span>
          <input className="input input-sm input-date" type="date" max={today} value={value.to ?? ''} aria-label={L('结束日期', 'To')} onChange={(e) => e.target.value && onChange({ ...value, to: e.target.value })} />
        </span>
      )}
    </div>
  );
}

/* ---------------- buckets (days, or weeks / months for long ranges) ---------------- */

export interface Bucket {
  key: string;
  label: string;
  win: Win;
}

export function buckets(w: Win, lang: 'zh' | 'en'): Bucket[] {
  const last = w.last < dayKey() ? w.last : dayKey(); // nothing to show after today
  const days: string[] = [];
  for (let d = w.first; d <= last && days.length < 4000; d = addDays(d, 1)) days.push(d);
  const fmt = (d: string, o: Intl.DateTimeFormatOptions) => parseDay(d).toLocaleDateString(lang === 'zh' ? 'zh-CN' : 'en-US', o);
  if (days.length <= 62) return days.map((d) => ({ key: d, label: days.length <= 14 ? fmt(d, { month: 'numeric', day: 'numeric', weekday: 'narrow' }) : fmt(d, { month: 'numeric', day: 'numeric' }), win: win(d, d) }));
  if (days.length <= 62 * 7) {
    const out: Bucket[] = [];
    for (const d of days) {
      const wk = dayKey(startOfWeek(parseDay(d)));
      const b = out.at(-1);
      if (b?.key === wk) b.win = win(b.win.first, d);
      else out.push({ key: wk, label: fmt(wk, { month: 'numeric', day: 'numeric' }), win: win(d, d) });
    }
    return out;
  }
  const out: Bucket[] = [];
  for (const d of days) {
    const m = d.slice(0, 7);
    const b = out.at(-1);
    if (b?.key === m) b.win = win(b.win.first, d);
    else out.push({ key: m, label: fmt(d, { year: '2-digit', month: 'short' }), win: win(d, d) });
  }
  return out;
}

/* ---------------- stacked bars ---------------- */

export interface Seg {
  id: string;
  ms: number;
  color: string;
  label: string;
}

/** One bar per bucket, stacked by activity. Click a bar to look at that day (or week / month). */
export function StackedBars({ data, picked, onPick }: { data: { b: Bucket; segs: Seg[] }[]; picked?: string; onPick: (b: Bucket) => void }) {
  const L = useL();
  const [hov, setHov] = useState<string | null>(null);
  const max = Math.max(1, ...data.map((d) => d.segs.reduce((a, s) => a + s.ms, 0)));
  const h = (ms: number) => (ms / 3_600_000).toFixed(1);
  const every = Math.ceil(data.length / 16); // thin out the labels on long ranges
  const tip = data.find((d) => d.b.key === hov);
  return (
    <div className="sbars-wrap">
      <div className="sbars-axis num muted">
        <span>{h(max)}h</span>
        <span>0</span>
      </div>
      <div className="sbars" role="list" aria-label={L('每日专注', 'Focus per day')}>
        {data.map(({ b, segs }, i) => {
          const tot = segs.reduce((a, s) => a + s.ms, 0);
          return (
            <button
              key={b.key}
              type="button"
              role="listitem"
              className={`sbar ${picked === b.key ? 'is-picked' : ''} ${picked && picked !== b.key ? 'is-dim' : ''}`}
              onClick={() => onPick(b)}
              onMouseEnter={() => setHov(b.key)}
              onMouseLeave={() => setHov(null)}
              aria-label={`${b.label} · ${h(tot)}h`}
            >
              <span className="sbar-stack" style={{ height: `${(tot / max) * 100}%` }}>
                {segs.map((s) => (
                  <i key={s.id} style={{ flex: s.ms, background: s.color }} />
                ))}
              </span>
              <small className={i % every === 0 || picked === b.key ? '' : 'is-hidden'}>{b.label}</small>
            </button>
          );
        })}
      </div>
      {tip && (
        <div className="sbars-tip">
          <b>{tip.b.label}</b> · <span className="num">{h(tip.segs.reduce((a, s) => a + s.ms, 0))}h</span>
          {tip.segs
            .slice()
            .sort((a, z) => z.ms - a.ms)
            .slice(0, 4)
            .map((s) => (
              <span key={s.id}>
                <i style={{ background: s.color }} /> {s.label} <span className="num">{h(s.ms)}h</span>
              </span>
            ))}
        </div>
      )}
    </div>
  );
}

/** Split sessions into stacked segments per bucket, using the same activity ids and colours as the donut. */
export function bucketSegs(bs: Bucket[], sessions: WorkSession[], idOf: (x: WorkSession) => string, colorOf: (id: string) => string, labelOf: (id: string) => string, keep: (x: WorkSession) => boolean) {
  return bs.map((b) => {
    const m = new Map<string, number>();
    for (const x of sessions) if (x.start >= b.win.from && x.start < b.win.to && keep(x)) m.set(idOf(x), (m.get(idOf(x)) ?? 0) + x.activeMs);
    const segs = [...m.entries()].map(([id, ms]) => ({ id, ms, color: colorOf(id), label: labelOf(id) })).sort((a, z) => z.ms - a.ms);
    return { b, segs };
  });
}

/* ---------------- one day's sessions ---------------- */

export function SessionList({ sessions, projects, colorOf, idOf, cur, fallback }: { sessions: WorkSession[]; projects: Project[]; colorOf: (id: string) => string; idOf: (x: WorkSession) => string; cur: string; fallback: string }) {
  const L = useL();
  const lang = useLang();
  const t = (ms: number) => new Date(ms).toLocaleTimeString(lang === 'zh' ? 'zh-CN' : 'en-US', { hour: '2-digit', minute: '2-digit' });
  const dur = (ms: number) => {
    const m = Math.round(ms / 60_000);
    return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`;
  };
  if (!sessions.length) return <p className="muted small">{L('这段时间没有专注记录。', 'No focus sessions in this range.')}</p>;
  const label = (x: WorkSession) => x.note || projects.find((p) => p.id === x.projectId)?.name || fallback;
  return (
    <ul className="sess-list">
      {[...sessions]
        .sort((a, b) => a.start - b.start)
        .map((x) => (
          <li key={x.id}>
            <span className="num muted sl-time">
              {t(x.start)}–{t(x.end)}
            </span>
            <i style={{ background: colorOf(idOf(x)) }} />
            <span className="sl-name">
              {label(x)} {!(x.rate > 0) && <small className="muted">📂</small>}
            </span>
            <span className="num muted small">{dur(x.activeMs)}</span>
            <strong className="num">{x.rate > 0 ? money(x.earned, cur, 0) : `+${Math.round(x.activeMs / 60_000)} XP`}</strong>
          </li>
        ))}
    </ul>
  );
}
