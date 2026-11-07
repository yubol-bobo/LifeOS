import { useMemo, useState, useSyncExternalStore } from 'react';
import { money } from '../lib/format';
import { buildTimeline } from '../store/timeline';
import { MoodFace } from '../ui/MoodFace';
import { addDays, dayKey, parseDay } from '../lib/date';
import { useL, useLang } from '../lib/i18n';
import { open } from '../os/router';
import { useTheme } from '../os/theme';
import { Blocks3D } from '../scene/Blocks3D';
import { useAttrs } from '../store/attrs';
import { levelInfo } from '../store/rules';
import { useStore } from '../store/store';
import type { EventKind } from '../store/types';
import { Icon } from '../ui/Icon';
import { Button, Modal, Segmented } from '../ui/kit';

/** Where XP comes from: label, icon and colour for each ledger kind. */
const KINDS: Record<EventKind, { zh: string; en: string; icon: string; color: string }> = {
  quest: { zh: '任务', en: 'Quests', icon: 'list-checks', color: 'orange' },
  perfect: { zh: '全勤', en: 'Perfect day', icon: 'star', color: 'amber' },
  milestone: { zh: '里程碑', en: 'Milestones', icon: 'flag', color: 'indigo' },
  step: { zh: '目标步骤', en: 'Goal steps', icon: 'route', color: 'blue' },
  focus: { zh: '专注', en: 'Focus', icon: 'timer', color: 'jade' },
  paper: { zh: '论文', en: 'Papers', icon: 'graduation', color: 'violet' },
  tracker: { zh: '追踪', en: 'Trackers', icon: 'activity', color: 'pink' },
  reward: { zh: '兑换', en: 'Rewards', icon: 'gift', color: 'red' },
  achievement: { zh: '成就', en: 'Achievements', icon: 'trophy', color: 'amber' },
  mood: { zh: '心情', en: 'Mood', icon: 'smile', color: 'teal' },
  wellness: { zh: '健康', en: 'Wellness', icon: 'droplets', color: 'blue' },
  assets: { zh: '资产', en: 'Assets', icon: 'landmark', color: 'jade' },
  plan: { zh: '计划', en: 'Plans', icon: 'calendar', color: 'teal' },
  review: { zh: '复盘', en: 'Review', icon: 'notebook', color: 'violet' },
};

const cssVar = (name: string, fallback: string) => {
  try {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
  } catch {
    return fallback;
  }
};

/* ---- open the day view from anywhere: openDay('2026-11-05') ---- */
let current: string | null = null;
const subs = new Set<() => void>();
export function openDay(day: string | null) {
  current = day;
  subs.forEach((f) => f());
}
const useCurrentDay = () =>
  useSyncExternalStore(
    (f) => (subs.add(f), () => subs.delete(f)),
    () => current,
  );

/* ---- open a whole week from anywhere (e.g. a square in Life in weeks): openWeek('2025-03-03', 'Age 31 · week 12') ---- */
let curWeek: { start: string; label?: string; base?: string } | null = null;
const wsubs = new Set<() => void>();
export function openWeek(start: string | null, label?: string) {
  // `base` remembers which week the label belongs to, so ‹ › can keep counting
  curWeek = start ? { start, label, base: start } : null;
  wsubs.forEach((f) => f());
}
const shiftWeek = (n: number) => {
  if (!curWeek) return;
  curWeek = { ...curWeek, start: addDays(curWeek.start, 7 * n) };
  wsubs.forEach((f) => f());
};
const useCurrentWeek = () =>
  useSyncExternalStore(
    (f) => (wsubs.add(f), () => wsubs.delete(f)),
    () => curWeek,
  );

/** Mounted once in the shell. */
export function DayHost() {
  const day = useCurrentDay();
  const week = useCurrentWeek();
  return (
    <>
      <DayXpModal day={day} onClose={() => openDay(null)} onDay={openDay} />
      {week && !day && <WeekModal week={week} />}
    </>
  );
}

/** Seven days at once: totals, a strip of days (click one for the full day view) and every record. */
function WeekModal({ week }: { week: { start: string; label?: string; base?: string } }) {
  const L = useL();
  const lang = useLang();
  const attrs = useAttrs();
  const state = useStore((x) => x);
  const today = dayKey();
  const days = Array.from({ length: 7 }, (_, i) => addDays(week.start, i));
  const end = days[6];
  const feed = useMemo(
    () => buildTimeline(state, lang, (v) => money(v, state.profile.currency, 0)).filter((e) => e.day >= week.start && e.day <= end).sort((a, b) => a.ts - b.ts),
    [state, lang, week.start, end],
  );
  const xpOf = (d: string) => state.events.filter((e) => dayKey(e.ts) === d).reduce((a, e) => a + Math.max(0, e.xp), 0);
  const perDay = days.map((d) => ({ d, xp: xpOf(d), n: feed.filter((e) => e.day === d).length }));
  const xp = perDay.reduce((a, x) => a + x.xp, 0);
  const max = Math.max(1, ...perDay.map((x) => x.xp));
  const focusMs = state.sessions.filter((x) => dayKey(x.start) >= week.start && dayKey(x.start) <= end).reduce((a, x) => a + x.activeMs, 0);
  const goals = state.milestones.filter((m) => {
    const d = m.status === 'done' ? m.doneAt : m.targetDate;
    return d && d >= week.start && d <= end;
  });
  const loc = lang === 'zh' ? 'zh-CN' : 'en-US';
  const f = (d: string, o: Intl.DateTimeFormatOptions) => parseDay(d).toLocaleDateString(loc, o);
  const range = `${f(week.start, { year: 'numeric', month: 'short', day: 'numeric' })} – ${f(end, { month: 'short', day: 'numeric' })}`;
  const shiftN = week.base ? Math.round((parseDay(week.start).getTime() - parseDay(week.base).getTime()) / (7 * 86_400_000)) : 0;
  const label = week.label && shiftN === 0 ? week.label : undefined;
  const time = (ts: number) => new Date(ts).toLocaleTimeString(loc, { hour: '2-digit', minute: '2-digit' });
  const future = week.start > today;
  const firstUse = state.events.length ? dayKey(Math.min(...state.events.map((e) => e.ts))) : today;

  return (
    <Modal
      open
      onClose={() => openWeek(null)}
      width={760}
      title={
        <span className="dx-title">
          <button className="icon-btn" onClick={() => shiftWeek(-1)} aria-label={L('上一周', 'Previous week')}>
            <Icon name="chevron-left" size={18} />
          </button>
          <span>
            {range}
            {label && <small className="muted wk-label"> · {label}</small>}
          </span>
          <button className="icon-btn" onClick={() => shiftWeek(1)} disabled={end >= today} aria-label={L('下一周', 'Next week')}>
            <Icon name="chevron-right" size={18} />
          </button>
        </span>
      }
      footer={
        <>
          <span className="muted small">{L('点某一天看那天的完整记录', 'Click a day for its full record')}</span>
          <span className="spacer" />
          <Button variant="primary" onClick={() => openWeek(null)}>
            {L('好的', 'Done')}
          </Button>
        </>
      }
    >
      <div className="dx-sum">
        <div>
          <b className="num">+{xp}</b>
          <span>XP</span>
        </div>
        <div>
          <b className="num">{feed.length}</b>
          <span>{L('条记录', 'entries')}</span>
        </div>
        <div>
          <b className="num">{perDay.filter((x) => x.n > 0).length}/7</b>
          <span>{L('有记录的天', 'days recorded')}</span>
        </div>
        <div>
          <b className="num">{(focusMs / 3_600_000).toFixed(1)}h</b>
          <span>{L('专注', 'focus')}</span>
        </div>
      </div>

      {goals.length > 0 && (
        <div className="wk-goals">
          {goals.map((m) => (
            <span key={m.id} className="chip" style={{ color: `var(--c-${m.attr})` }}>
              <Icon name="flag" size={12} /> {m.title}
              <small className="muted"> · {m.status === 'done' ? L('达成', 'reached') : L('目标日', 'target')}</small>
            </span>
          ))}
        </div>
      )}

      <div className="wk-days">
        {perDay.map(({ d, xp: v, n }) => (
          <button key={d} className={`wk-day ${d === today ? 'is-today' : ''}`} disabled={d > today} onClick={() => (openWeek(null), openDay(d))}>
            <span className="wk-dow">{f(d, { weekday: 'short' })}</span>
            <span className="wk-date num">{f(d, { month: 'numeric', day: 'numeric' })}</span>
            <span className="wk-bar">
              <i style={{ height: `${Math.round((v / max) * 100)}%` }} />
            </span>
            <span className="wk-n num">{n ? L(`${n} 条`, `${n}`) : '—'}</span>
          </button>
        ))}
      </div>

      {feed.length ? (
        <ol className="dx-log wk-log">
          {feed.map((e, i) => (
            <li key={e.id} className={i === 0 || feed[i - 1].day !== e.day ? 'wk-first' : ''}>
              <span className="dx-time num">{i === 0 || feed[i - 1].day !== e.day ? f(e.day, { weekday: 'short', day: 'numeric' }) : ''} {time(e.ts)}</span>
              <span className="dx-ic" style={{ color: `var(--p-${e.color})`, background: `color-mix(in oklab, var(--p-${e.color}) 14%, transparent)` }}>
                {e.mood ? <MoodFace v={e.mood as 1 | 2 | 3 | 4 | 5} size={18} /> : <Icon name={e.icon} size={14} />}
              </span>
              <span className="dx-label">
                {e.title}
                {e.detail && <small className="muted"> · {e.detail}</small>}
              </span>
              <span className="dx-attr muted small">{e.value ?? (e.attr && attrs.list.some((x) => x.id === e.attr) ? attrs.label(e.attr) : '')}</span>
              <span className={`dx-xp num ${e.xp ? '' : 'is-zero'}`}>{e.xp ? `+${e.xp} XP` : ''}</span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="dx-empty muted">
          {future
            ? L('这一周还没到。', 'This week hasn’t come yet.')
            : end < firstUse
              ? L('那时候还没开始用 LifeOS，这一周没有记录。', 'This was before you started LifeOS, so there are no records.')
              : L('这一周没有记录，休息也很重要。', 'Nothing recorded this week. Rest matters too.')}
        </p>
      )}
    </Modal>
  );
}

/** One day, fully traceable: XP as a cute 3D block chart, then every record of that day in order. */
export function DayXpModal({ day, onClose, onDay }: { day: string | null; onClose: () => void; onDay: (d: string) => void }) {
  const L = useL();
  const lang = useLang();
  const dark = useTheme();
  const attrs = useAttrs();
  const events = useStore((s) => s.events);
  const reduce = useStore((s) => s.profile.reduceMotion);
  const hasReview = useStore((s) => !!(day && s.reviews?.[day]));
  const [by, setBy] = useState<'kind' | 'attr'>('kind');
  const [hov, setHov] = useState<string | null>(null);
  const today = dayKey();

  const list = useMemo(() => (day ? events.filter((e) => dayKey(e.ts) === day).sort((a, b) => a.ts - b.ts) : []), [events, day]);
  const state = useStore((x) => x);
  const feed = useMemo(() => (day ? buildTimeline(state, lang, (v) => money(v, state.profile.currency, 0)).filter((e) => e.day === day).reverse() : []), [state, day, lang]);
  if (!day) return null;

  const xp = list.reduce((a, e) => a + Math.max(0, e.xp), 0);
  const coins = list.reduce((a, e) => a + e.coins, 0);
  const start = new Date(day + 'T00:00:00').getTime();
  const before = levelInfo(events.filter((e) => e.ts < start).reduce((a, e) => a + e.xp, 0)).level;
  const after = levelInfo(events.filter((e) => e.ts < start + 86_400_000).reduce((a, e) => a + e.xp, 0)).level;

  // columns
  const groups = new Map<string, { id: string; label: string; icon: string; color: string; xp: number; n: number }>();
  for (const e of list) {
    if (e.xp <= 0) continue;
    const key = by === 'kind' ? e.kind : (e.attr ?? 'none');
    let g = groups.get(key);
    if (!g) {
      if (by === 'kind') {
        const k = KINDS[e.kind] ?? { zh: e.kind, en: e.kind, icon: 'sparkles', color: 'slate' };
        g = { id: key, label: L(k.zh, k.en), icon: k.icon, color: cssVar(`--p-${k.color}`, '#888'), xp: 0, n: 0 };
      } else {
        const a = attrs.list.find((x) => x.id === e.attr);
        g = { id: key, label: a ? attrs.label(a.id) : L('通用', 'General'), icon: a?.icon ?? 'sparkles', color: a ? cssVar(`--c-${a.id}`, '#888') : cssVar('--p-slate', '#888'), xp: 0, n: 0 };
      }
      groups.set(key, g);
    }
    g.xp += e.xp;
    g.n += 1;
  }
  const cols = [...groups.values()].sort((a, b) => b.xp - a.xp).slice(0, 8);
  const byId = new Map(cols.map((c) => [c.id, c]));
  const dateLabel = parseDay(day).toLocaleDateString(lang === 'zh' ? 'zh-CN' : 'en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  const time = (ts: number) => new Date(ts).toLocaleTimeString(lang === 'zh' ? 'zh-CN' : 'en-US', { hour: '2-digit', minute: '2-digit' });

  return (
    <Modal
      open
      onClose={onClose}
      width={760}
      title={
        <span className="dx-title">
          <button className="icon-btn" onClick={() => onDay(addDays(day, -1))} aria-label={L('前一天', 'Previous day')}>
            <Icon name="chevron-left" size={18} />
          </button>
          <span>{dateLabel}</span>
          <button className="icon-btn" onClick={() => onDay(addDays(day, 1))} disabled={day >= today} aria-label={L('后一天', 'Next day')}>
            <Icon name="chevron-right" size={18} />
          </button>
        </span>
      }
      footer={
        <>
          <Button variant="ghost" icon="notebook" onClick={() => (sessionStorage.setItem('lifeos:review-day', day), onClose(), open('review'))}>
            {hasReview ? L('看这天的复盘', 'Open that day’s review') : L('给这天写复盘', 'Review this day')}
          </Button>
          <span className="spacer" />
          <Button variant="primary" onClick={onClose}>
            {L('好的', 'Done')}
          </Button>
        </>
      }
    >
      <div className="dx-sum">
        <div>
          <b className="num">+{xp}</b>
          <span>XP</span>
        </div>
        <div>
          <b className="num">
            {coins >= 0 ? '+' : ''}
            {coins}
          </b>
          <span>{L('金币', 'coins')}</span>
        </div>
        <div>
          <b className="num">{feed.length}</b>
          <span>{L('条记录', 'entries')}</span>
        </div>
        {after > before && (
          <div className="dx-up">
            <b className="num">Lv.{after}</b>
            <span>{L('这天升级了 🎉', 'levelled up 🎉')}</span>
          </div>
        )}
      </div>

      {xp > 0 ? (
        <>
          <div className="dx-viz-head">
            <span className="muted small">{L('每一列是一种来源，方块越高经验越多 · 悬停看详情，拖动转一转', 'Each column is a source — taller means more XP · hover for details, drag to turn')}</span>
            <Segmented
              size="sm"
              value={by}
              onChange={setBy}
              options={[
                { value: 'kind', label: L('按来源', 'By source') },
                { value: 'attr', label: L('按属性', 'By attribute') },
              ]}
            />
          </div>
          <Blocks3D
            columns={cols.map((c) => ({ id: c.id, value: c.xp, color: c.color }))}
            dark={dark}
            height={280}
            still={reduce}
            onHover={setHov}
            tooltip={(id) => {
              const c = byId.get(id);
              return c ? (
                <>
                  <span className="tip-k">{c.label}</span>
                  <span className="tip-v num">
                    +{c.xp} XP · {Math.round((c.xp / xp) * 100)}% · {L(`${c.n} 条`, `${c.n} entries`)}
                  </span>
                </>
              ) : null;
            }}
          />
          <div className="dx-legend">
            {cols.map((c) => (
              <span key={c.id} className={hov === c.id ? 'is-on' : ''} onMouseEnter={() => setHov(c.id)} onMouseLeave={() => setHov(null)}>
                <i style={{ background: c.color }} />
                <Icon name={c.icon} size={13} /> {c.label} <b className="num">+{c.xp}</b>
              </span>
            ))}
          </div>
        </>
      ) : (
        <p className="dx-empty muted">{day === today ? L('今天还没有经验记录，去完成一个任务吧～', 'No XP yet today — go finish a quest!') : L('这一天没有经验记录，休息也很重要。', 'No XP that day. Rest matters too.')}</p>
      )}

      {feed.length > 0 && (
        <>
          <p className="dx-sub muted small">{L('这一天的全部记录', 'Everything recorded that day')}</p>
          <ol className="dx-log">
            {feed.map((e) => {
              const focus = hov && (by === 'kind' ? e.kind === hov : (e.attr ?? 'none') === hov);
              return (
                <li key={e.id} className={`${focus ? 'is-focus' : ''} ${hov && !focus ? 'is-dim' : ''}`}>
                  <span className="dx-time num">{time(e.ts)}</span>
                  <span className="dx-ic" style={{ color: `var(--p-${e.color})`, background: `color-mix(in oklab, var(--p-${e.color}) 14%, transparent)` }}>
                    {e.mood ? <MoodFace v={e.mood as 1 | 2 | 3 | 4 | 5} size={18} /> : <Icon name={e.icon} size={14} />}
                  </span>
                  <span className="dx-label">
                    {e.title}
                    {e.detail && <small className="muted"> · {e.detail}</small>}
                  </span>
                  <span className="dx-attr muted small">{e.value ?? (e.attr && attrs.list.some((x) => x.id === e.attr) ? attrs.label(e.attr) : '')}</span>
                  <span className={`dx-xp num ${e.xp ? '' : 'is-zero'}`}>{e.xp ? `+${e.xp} XP` : ''}</span>
                </li>
              );
            })}
          </ol>
        </>
      )}
    </Modal>
  );
}
