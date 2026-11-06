import { useMemo, useState } from 'react';
import { dayKey, parseDay } from '../lib/date';
import { money } from '../lib/format';
import { useL, useLang } from '../lib/i18n';
import { useStore } from '../store/store';
import { buildTimeline, TL_CATS, type TlCat, type TlEntry } from '../store/timeline';
import { Icon } from '../ui/Icon';
import { MoodFace } from '../ui/MoodFace';
import { Button, Card, Empty, Stat } from '../ui/kit';
import { openDay } from './DayXp';

const PAGE = 14; // days per page

/** Everything LifeOS has recorded, newest first — searchable, filterable, every day clickable. */
export function Timeline() {
  const L = useL();
  const lang = useLang();
  const s = useStore((x) => x);
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<TlCat | 'all'>(() => {
    const preset = sessionStorage.getItem('lifeos:timeline-cat') as TlCat | null;
    sessionStorage.removeItem('lifeos:timeline-cat');
    return preset ?? 'all';
  });
  const [until, setUntil] = useState('');
  const [pages, setPages] = useState(1);
  const all = useMemo(() => buildTimeline(s, lang, (v) => money(v, s.profile.currency, 0)), [s, lang]);

  const needle = q.trim().toLowerCase();
  const filtered = all.filter(
    (e) => (cat === 'all' || e.cat === cat) && (!until || e.day <= until) && (!needle || `${e.title} ${e.detail ?? ''} ${e.value ?? ''}`.toLowerCase().includes(needle)),
  );
  const days: string[] = [];
  const byDay = new Map<string, TlEntry[]>();
  for (const e of filtered) {
    if (!byDay.has(e.day)) {
      byDay.set(e.day, []);
      days.push(e.day);
    }
    byDay.get(e.day)!.push(e);
  }
  const shown = days.slice(0, pages * PAGE);
  const first = all.length ? all[all.length - 1].day : null;
  const dayCount = new Set(all.map((e) => e.day)).size;
  const xpOf = (d: string) => s.events.filter((e) => e.xp > 0 && dayKey(e.ts) === d).reduce((a, e) => a + e.xp, 0);
  const counts = Object.fromEntries(TL_CATS.map((c) => [c.id, all.filter((e) => e.cat === c.id).length]));
  const fmtDay = (d: string) => parseDay(d).toLocaleDateString(lang === 'zh' ? 'zh-CN' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' });
  const time = (ts: number) => new Date(ts).toLocaleTimeString(lang === 'zh' ? 'zh-CN' : 'en-US', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="app">
      <div className="app-head">
        <div>
          <h1>{L('足迹', 'Timeline')}</h1>
          <p className="muted">{L('LifeOS 记下的一切，按时间排好：任务、专注、计划进展、复盘、心情、身体、资产、学术、成就……每一天都能点进去看。记录越久，越有意义。', 'Everything LifeOS has recorded, in order — quests, focus, plan notes, reviews, mood, body, money, research, achievements. Open any day. The longer you keep it, the more it means.')}</p>
        </div>
      </div>

      <div className="stats-row">
        <Stat label={L('全部记录', 'Records')} value={all.length.toLocaleString()} />
        <Stat label={L('有记录的天数', 'Days recorded')} value={dayCount} />
        <Stat label={L('从这天开始', 'Since')} value={first ? parseDay(first).toLocaleDateString(lang === 'zh' ? 'zh-CN' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '—'} />
        <Stat label={L('笔记与文字', 'Notes written')} value={all.filter((e) => e.detail && (e.cat === 'plan' || e.cat === 'review' || e.cat === 'mood')).length} tone="violet" />
      </div>

      <Card>
        <div className="tl-controls">
          <label className="quick-add is-compact tl-search">
            <Icon name="search" size={16} />
            <input value={q} onChange={(e) => (setQ(e.target.value), setPages(1))} placeholder={L('搜索：书名、电影、任务、笔记里的任何字…', 'Search titles and notes — a book, a film, anything…')} aria-label={L('搜索', 'Search')} />
          </label>
          <label className="tl-jump">
            <span className="muted small">{L('跳到', 'Jump to')}</span>
            <input className="input" type="date" max={dayKey()} value={until} onChange={(e) => (setUntil(e.target.value), setPages(1))} />
            {until && (
              <button className="icon-btn" onClick={() => setUntil('')} aria-label={L('清除日期', 'Clear date')}>
                <Icon name="x" size={14} />
              </button>
            )}
          </label>
        </div>
        <div className="tl-cats">
          <button className={`chip ${cat === 'all' ? 'is-active' : ''}`} onClick={() => (setCat('all'), setPages(1))}>
            {L('全部', 'All')} <span className="num muted">{all.length}</span>
          </button>
          {TL_CATS.filter((c) => counts[c.id] > 0).map((c) => (
            <button key={c.id} className={`chip ${cat === c.id ? 'is-active' : ''}`} onClick={() => (setCat(c.id), setPages(1))}>
              <Icon name={c.icon} size={12} /> {L(c.zh, c.en)} <span className="num muted">{counts[c.id]}</span>
            </button>
          ))}
        </div>
      </Card>

      {shown.length === 0 ? (
        <Card>
          <Empty icon="route" title={needle || cat !== 'all' || until ? L('没有符合条件的记录', 'Nothing matches') : L('还没有记录', 'Nothing recorded yet')} body={L('完成任务、专注一会儿、写一句复盘，这里就会开始生长。', 'Finish a quest, focus for a while, write a review line — and this starts to grow.')} />
        </Card>
      ) : (
        <div className="tl-days">
          {shown.map((d) => {
            const list = byDay.get(d)!;
            const mood = s.moods?.[d];
            const xp = xpOf(d);
            return (
              <section key={d} className="tl-day">
                <header>
                  <button className="tl-date" onClick={() => openDay(d)}>
                    <strong>{fmtDay(d)}</strong>
                    {d === dayKey() && <span className="chip">{L('今天', 'Today')}</span>}
                  </button>
                  {mood && <MoodFace v={mood.v} size={22} />}
                  {xp > 0 && <span className="tl-xp num">+{xp} XP</span>}
                  <span className="spacer" />
                  <button className="link-btn" onClick={() => openDay(d)}>
                    {L('这一天 →', 'Open day →')}
                  </button>
                </header>
                <ol className="dx-log tl-log">
                  {list.map((e) => (
                    <li key={e.id}>
                      <span className="dx-time num">{time(e.ts)}</span>
                      <span className="dx-ic" style={{ color: `var(--p-${e.color})`, background: `color-mix(in oklab, var(--p-${e.color}) 14%, transparent)` }}>
                        {e.mood ? <MoodFace v={e.mood as 1 | 2 | 3 | 4 | 5} size={18} /> : <Icon name={e.icon} size={14} />}
                      </span>
                      <span className="dx-label tl-label">
                        {e.title}
                        {e.detail && <small className="muted"> · {e.detail}</small>}
                      </span>
                      <span className="dx-attr muted small">{e.value ?? ''}</span>
                      <span className={`dx-xp num ${e.xp ? '' : 'is-zero'}`}>{e.xp ? `+${e.xp} XP` : ''}</span>
                    </li>
                  ))}
                </ol>
              </section>
            );
          })}
          {days.length > shown.length && (
            <Button icon="hourglass" onClick={() => setPages((n) => n + 1)}>
              {L(`加载更早的 ${Math.min(PAGE, days.length - shown.length)} 天`, `Load ${Math.min(PAGE, days.length - shown.length)} earlier days`)}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
