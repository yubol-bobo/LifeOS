import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Human3View, Ladder, periodName } from './Human3';
import { QUAD_META, QUADS, assessmentFor, fmtPos, latestBefore, stepOf, LEVEL_NAME, isMetatype } from '../store/h3';
import { addDays, dayKey, dayOfWeek, parseDay, weekdayLetters } from '../lib/date';
import { compact, money } from '../lib/format';
import { useL, useLang } from '../lib/i18n';
import { notify } from '../os/notify';
import { useAttrs } from '../store/attrs';
import { TIER_LABEL } from '../store/achievements';
import { currentKey, hasContent, periodBounds, periodReport, shiftKey, type PeriodReport, type ReportKind } from '../store/report';
import { levelTitle } from '../store/rules';
import { useStore } from '../store/store';
import { Icon } from '../ui/Icon';
import { Button, Segmented } from '../ui/kit';
import { MoodFace } from '../ui/MoodFace';
import { sliceColor } from './effort';

const POSTER_W = 1080;
const h1 = (ms: number) => (ms / 3_600_000).toFixed(1);

/** Open the Reports app on a given period (used by the "your report is ready" notice). */
export function reportTarget(kind: ReportKind, key: string) {
  try {
    sessionStorage.setItem('lifeos:report-open', JSON.stringify({ kind, key }));
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent('lifeos:report-open', { detail: { kind, key } }));
}

export function Report() {
  const L = useL();
  const lang = useLang();
  const s = useStore((x) => x);
  const [kind, setKind] = useState<ReportKind>('month');
  const [key, setKey] = useState(currentKey('month'));
  useEffect(() => {
    const go = (k: ReportKind, v: string) => (setKind(k), setKey(v));
    try {
      const raw = sessionStorage.getItem('lifeos:report-open');
      sessionStorage.removeItem('lifeos:report-open');
      if (raw) {
        const t = JSON.parse(raw);
        go(t.kind, t.key);
      }
    } catch {
      /* ignore */
    }
    const f = (e: Event) => go((e as CustomEvent).detail.kind, (e as CustomEvent).detail.key);
    window.addEventListener('lifeos:report-open', f);
    return () => window.removeEventListener('lifeos:report-open', f);
  }, []);
  const r = useMemo(() => periodReport(s, kind, key, L('专注', 'Focus')), [s, kind, key, L]);
  const now = currentKey(kind);
  const poster = useRef<HTMLDivElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [posterH, setPosterH] = useState(0);
  useLayoutEffect(() => {
    const fit = () => {
      if (!wrap.current || !poster.current) return;
      setScale(Math.min(1, wrap.current.clientWidth / POSTER_W));
      setPosterH(poster.current.offsetHeight);
    };
    fit();
    const ro = new ResizeObserver(fit);
    if (wrap.current) ro.observe(wrap.current);
    if (poster.current) ro.observe(poster.current);
    return () => ro.disconnect();
  }, [r]);
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (!poster.current) return;
    setSaving(true);
    try {
      const { toBlob } = await import('html-to-image');
      const blob = await toBlob(poster.current, { pixelRatio: 2, cacheBust: true, width: POSTER_W, style: { transform: 'none' } });
      if (!blob) throw new Error('empty');
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `LifeOS-${kind}-${key}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
    } catch {
      notify({ title: L('没保存成功', 'Couldn’t save the image'), body: L('请稍后再试一次。', 'Please try again.'), icon: 'download', tone: 'info' });
    } finally {
      setSaving(false);
    }
  };
  const label = periodName(kind, key, lang);
  const [view, setView] = useState<'report' | 'h3'>('report');

  return (
    <div className="app report-app">
      <div className="app-head">
        <div>
          <h1>{L('成就报告', 'Reports')}</h1>
          <p className="muted">{L('每月、每季度、每年：做成了什么、时间去了哪里、在 Human 3.0 地图上走到了哪。', 'Every month, quarter and year: what you achieved, where the time went, and where you stand on the Human 3.0 map.')}</p>
        </div>
        <div className="row-gap wrap">
          <Segmented
            value={view}
            onChange={setView}
            options={[
              { value: 'report', label: L('报告', 'Report'), icon: 'chart' },
              { value: 'h3', label: 'Human 3.0', icon: 'target' },
            ]}
          />
          {view === 'report' && (
          <>
          <Segmented
            value={kind}
            onChange={(k) => (setKind(k), setKey(currentKey(k)))}
            options={[
              { value: 'month', label: L('月报', 'Monthly') },
              { value: 'quarter', label: L('季报', 'Quarterly') },
              { value: 'year', label: L('年报', 'Yearly') },
            ]}
          />
          <div className="rep-nav">
            <Button size="sm" variant="ghost" icon="chevron-left" title={L('上一期', 'Previous')} onClick={() => setKey(shiftKey(kind, key, -1))} />
            <b>{label}</b>
            <Button size="sm" variant="ghost" icon="chevron-right" title={L('下一期', 'Next')} disabled={key >= now} onClick={() => setKey(shiftKey(kind, key, 1))} />
          </div>
          <Button variant="primary" icon="download" disabled={saving} onClick={() => void save()}>
            {saving ? L('生成中…', 'Rendering…') : L('保存为图片', 'Save as image')}
          </Button>
          </>
          )}
        </div>
      </div>
      {view === 'h3' ? (
        <Human3View />
      ) : (
      <div className="rep-stage" ref={wrap} style={{ height: posterH * scale || undefined }}>
        <div className="rep-scale" style={{ transform: `scale(${scale})`, width: POSTER_W }}>
          <Poster r={r} ref_={poster} title={label} />
        </div>
      </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Poster({ r, ref_, title }: { r: PeriodReport; ref_: React.RefObject<HTMLDivElement | null>; title: string }) {
  const L = useL();
  const lang = useLang();
  const attrs = useAttrs();
  const name = useStore((s) => s.profile.name);
  const cur = useStore((s) => s.profile.currency);
  const base = useStore((s) => s.assets.base);
  const empty = !hasContent(r);
  const dueRate = r.dailiesDue ? r.dailiesDone / r.dailiesDue : 0;
  const nf = (n: number) => n.toLocaleString(lang === 'zh' ? 'zh-CN' : 'en-US');
  const dayLabel = (d: string) => parseDay(d).toLocaleDateString(lang === 'zh' ? 'zh-CN' : 'en-US', { month: 'short', day: 'numeric', weekday: 'short' });
  const kpis: { icon: string; v: string; unit?: string; label: string; tone: string }[] = [
    { icon: 'list-checks', v: nf(r.questsDone), label: L('完成任务', 'Quests done'), tone: '#ff8a5b' },
    { icon: 'timer', v: h1(r.focusMs), unit: 'h', label: L('专注时长', 'Focused'), tone: '#7c9cff' },
    { icon: 'sparkles', v: nf(r.xp), unit: 'XP', label: L('获得经验', 'XP earned'), tone: '#ffd166' },
    { icon: 'trophy', v: nf(r.achievements.length), label: L('解锁成就', 'Achievements'), tone: '#e9a8ff' },
    { icon: 'star', v: nf(r.perfectDays), label: L('全勤日', 'Perfect days'), tone: '#5fe0b4' },
    { icon: 'flame', v: nf(r.bestStreak), unit: L('天', 'd'), label: L('最长连续', 'Best streak'), tone: '#ff6b8a' },
  ];

  return (
    <div className="poster" ref={ref_}>
      <div className="pz-glow g1" />
      <div className="pz-glow g2" />
      <header className="pz-head">
        <div>
          <p className="pz-eyebrow">LIFEOS · {r.kind === 'year' ? L('年度成就报告', 'YEAR IN REVIEW') : r.kind === 'quarter' ? L('季度成就报告', 'QUARTER IN REVIEW') : L('月度成就报告', 'MONTHLY REPORT')}</p>
          <h1 className="pz-title">{title}</h1>
          <p className="pz-sub">
            {name ? `${name} · ` : ''}
            {r.levelTo > r.levelFrom ? L(`从 Lv.${r.levelFrom} 升到 Lv.${r.levelTo}`, `Lv.${r.levelFrom} → Lv.${r.levelTo}`) : `Lv.${r.levelTo}`} · {levelTitle(r.levelTo, lang)}
            {r.partial && <span className="pz-partial"> · {L(`进行中，截至 ${dayLabel(r.last)}`, `in progress, up to ${dayLabel(r.last)}`)}</span>}
          </p>
        </div>
        <div className="pz-xp">
          <b>+{compact(r.xp)}</b>
          <span>XP</span>
          {r.levelTo > r.levelFrom && <i>▲ {r.levelTo - r.levelFrom} {L('级', r.levelTo - r.levelFrom > 1 ? 'levels' : 'level')}</i>}
        </div>
      </header>

      {empty ? (
        <p className="pz-empty">{L('这段时间还没有记录。做完一件事、开一段专注，这里就会亮起来。', 'Nothing recorded in this period yet. Finish a quest or start a focus session and this lights up.')}</p>
      ) : (
        <>
          <section className="pz-kpis">
            {kpis.map((k) => (
              <div key={k.label} className="pz-kpi" style={{ '--t': k.tone } as CSSProperties}>
                <Icon name={k.icon} size={18} />
                <b>
                  {k.v}
                  {k.unit && <small>{k.unit}</small>}
                </b>
                <span>{k.label}</span>
              </div>
            ))}
          </section>

          <section className="pz-sec">
            <h2>
              <Icon name="trophy" size={16} /> {L('解锁的成就', 'Achievements unlocked')} <em>{r.achievements.length}</em>
            </h2>
            {r.achievements.length ? (
              <ul className="pz-badges">
                {r.achievements.slice(0, 12).map(({ a }) => (
                  <li key={a.id} className={`tier-${a.tier}`}>
                    <span className="pz-badge">
                      <Icon name={a.icon} size={20} />
                    </span>
                    <b>{lang === 'zh' ? a.zh[0] : a.en[0]}</b>
                    <small>{L(TIER_LABEL[a.tier][0], TIER_LABEL[a.tier][1])}</small>
                  </li>
                ))}
                {r.achievements.length > 12 && <li className="pz-more">+{r.achievements.length - 12}</li>}
              </ul>
            ) : (
              <p className="pz-note">{L('这段时间没有解锁新成就，继续加油。', 'No new achievements this time. Keep going.')}</p>
            )}
          </section>

          <div className="pz-grid">
            <section className="pz-sec">
              <h2>
                <Icon name="activity" size={16} /> {L('时间都去哪了', 'Where the time went')}
              </h2>
              {r.focusMs > 0 ? <TimeSplit r={r} cur={cur} /> : <p className="pz-note">{L('这段时间没有专注记录。', 'No focus sessions in this period.')}</p>}
            </section>
            <section className="pz-sec">
              <h2>
                <Icon name="list-checks" size={16} /> {L('习惯与任务', 'Habits & quests')}
              </h2>
              <div className="pz-habit">
                <RingStat value={dueRate} label={L('每日习惯完成率', 'Daily habits kept')} />
                <ul className="pz-facts">
                  <li>
                    <b>{nf(r.dailiesDone)}</b> {L(`/ ${nf(r.dailiesDue)} 次每日习惯`, `/ ${nf(r.dailiesDue)} daily check-ins`)}
                  </li>
                  <li>
                    <b>{nf(r.onceDone)}</b> {L('件一次性任务', 'one-off to-dos')}
                  </li>
                  <li>
                    <b>{nf(r.activeDays)}</b> {L(`/ ${r.days.length} 天有完成`, `/ ${r.days.length} active days`)}
                  </li>
                </ul>
              </div>
              {r.topHabits.length > 0 && (
                <ul className="pz-bars">
                  {r.topHabits.map((h) => (
                    <li key={h.title}>
                      <span>{h.title}</span>
                      <i>
                        <s style={{ width: `${(h.done / h.due) * 100}%` }} />
                      </i>
                      <b>{Math.round((h.done / h.due) * 100)}%</b>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          <section className="pz-sec">
            <h2>
              <Icon name="calendar" size={16} /> {r.kind === 'year' ? L('这一年的每一天', 'Every day of the year') : r.kind === 'quarter' ? L('这个季度的每一天', 'Every day of the quarter') : L('这个月的每一天', 'Every day of the month')}
              {r.bestDay && (
                <span className="pz-h-note">
                  {L('最闪亮的一天', 'Brightest day')}: <b>{dayLabel(r.bestDay.day)}</b> · +{nf(r.bestDay.xp)} XP
                </span>
              )}
            </h2>
            {r.kind === 'month' ? <MonthCal r={r} /> : <YearGrid r={r} />}
          </section>

          {r.months && r.months.length > 1 && (
            <section className="pz-sec">
              <h2>
                <Icon name="chart" size={16} /> {L('每个月', 'Month by month')}
              </h2>
              <MonthBars r={r} />
            </section>
          )}

          <section className="pz-sec">
            <h2>
              <Icon name="sparkles" size={16} /> {L('高光时刻', 'Highlights')}
            </h2>
            <div className="pz-hl">
              {r.plans.length > 0 && <Highlight icon="calendar" big={nf(r.plans.length)} label={L('个计划完成', r.plans.length > 1 ? 'plans completed' : 'plan completed')} items={r.plans} />}
              {r.milestones.length > 0 && <Highlight icon="flag" big={nf(r.milestones.length)} label={L('个目标达成', r.milestones.length > 1 ? 'goals reached' : 'goal reached')} items={r.milestones} />}
              {r.papers.length > 0 && <Highlight icon="graduation" big={nf(r.papers.length)} label={L('次论文推进', 'paper milestones')} items={r.papers} />}
              {r.longest && <Highlight icon="timer" big={`${h1(r.longest.activeMs)}h`} label={L('最长的一段专注', 'Longest focus session')} items={[`${r.longest.label} · ${dayLabel(dayKey(r.longest.start))}`]} />}
              {r.earned > 0 && <Highlight icon="coins" big={money(r.earned, cur, 0)} label={L('工作收入', 'Earned from paid work')} />}
              {r.citations != null && r.citations > 0 && <Highlight icon="quote" big={`+${nf(r.citations)}`} label={L('新增引用', 'new citations')} />}
              {r.netWorthDelta != null && <Highlight icon="landmark" big={`${r.netWorthDelta >= 0 ? '+' : '−'}${compact(Math.abs(r.netWorthDelta))}`} label={L(`净资产变化（${base}）`, `Net worth change (${base})`)} />}
              {r.moodAvg != null && (
                <div className="pz-card">
                  <MoodFace v={Math.round(r.moodAvg) as 1 | 2 | 3 | 4 | 5} size={34} />
                  <b>{r.moodAvg.toFixed(1)}</b>
                  <span>{L(`平均心情 · 记录 ${r.moodDays} 天`, `Average mood · ${r.moodDays} days logged`)}</span>
                </div>
              )}
              {r.reviews > 0 && <Highlight icon="notebook" big={nf(r.reviews)} label={L('天写了复盘', r.reviews > 1 ? 'days reviewed' : 'day reviewed')} />}
            </div>
          </section>

          <PosterH3 r={r} />

          {r.xpByAttr.length > 0 && (
            <section className="pz-sec">
              <h2>
                <Icon name="target" size={16} /> {L('属性成长', 'Growth by attribute')}
              </h2>
              <ul className="pz-attrs">
                {r.xpByAttr.map((x) => (
                  <li key={x.attr} style={{ '--t': `var(--c-${x.attr})` } as CSSProperties}>
                    <span>{attrs.label(x.attr)}</span>
                    <i>
                      <s style={{ width: `${(x.xp / r.xpByAttr[0].xp) * 100}%` }} />
                    </i>
                    <b>+{nf(x.xp)}</b>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
      <footer className="pz-foot">
        <span className="logo-mark" />
        <b>Record more. Focus more.</b>
        <span>LifeOS · {new Date().toLocaleDateString(lang === 'zh' ? 'zh-CN' : 'en-US')}</span>
      </footer>
    </div>
  );
}

function Highlight({ icon, big, label, items }: { icon: string; big: string; label: string; items?: string[] }) {
  return (
    <div className="pz-card">
      <Icon name={icon} size={20} />
      <b>{big}</b>
      <span>{label}</span>
      {items && items.length > 0 && (
        <ul>
          {items.slice(0, 3).map((x, i) => (
            <li key={i}>{x}</li>
          ))}
          {items.length > 3 && <li className="muted">+{items.length - 3}</li>}
        </ul>
      )}
    </div>
  );
}

function RingStat({ value, label }: { value: number; label: string }) {
  const R = 46;
  const C = 2 * Math.PI * R;
  return (
    <div className="pz-ring">
      <svg width={116} height={116} viewBox="0 0 116 116">
        <circle cx={58} cy={58} r={R} fill="none" stroke="rgba(255,255,255,.12)" strokeWidth={12} />
        <circle cx={58} cy={58} r={R} fill="none" stroke="url(#pz-ring-g)" strokeWidth={12} strokeLinecap="round" strokeDasharray={`${C * Math.min(1, value)} ${C}`} transform="rotate(-90 58 58)" />
        <defs>
          <linearGradient id="pz-ring-g" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#ffd166" />
            <stop offset="1" stopColor="#ff6b8a" />
          </linearGradient>
        </defs>
        <text x={58} y={64} textAnchor="middle" fill="#fff" fontSize={24} fontWeight={800}>
          {Math.round(value * 100)}%
        </text>
      </svg>
      <span>{label}</span>
    </div>
  );
}

function TimeSplit({ r, cur }: { r: PeriodReport; cur: string }) {
  const L = useL();
  const top = r.activities.slice(0, 6);
  const rest = r.activities.slice(6).reduce((a, x) => a + x.ms, 0);
  const parts = [...top.map((x) => ({ id: x.id, label: x.label, ms: x.ms, color: sliceColor(r.activities, x.id), paid: x.paid })), ...(rest ? [{ id: 'rest', label: L('其他', 'Other'), ms: rest, color: '#8a8fa3', paid: false }] : [])];
  const total = parts.reduce((a, x) => a + x.ms, 0) || 1;
  const R = 70;
  const C = 2 * Math.PI * R;
  let off = 0;
  return (
    <div className="pz-time">
      <svg width={180} height={180} viewBox="0 0 180 180">
        {parts.map((p) => {
          const len = (p.ms / total) * C;
          const el = <circle key={p.id} cx={90} cy={90} r={R} fill="none" stroke={p.color} strokeWidth={26} strokeDasharray={`${Math.max(0, len - 2)} ${C}`} strokeDashoffset={-off} transform="rotate(-90 90 90)" />;
          off += len;
          return el;
        })}
        <text x={90} y={88} textAnchor="middle" fill="#fff" fontSize={26} fontWeight={800}>
          {h1(r.focusMs)}h
        </text>
        <text x={90} y={110} textAnchor="middle" fill="rgba(255,255,255,.6)" fontSize={12}>
          {L('专注', 'focused')}
        </text>
      </svg>
      <ul className="pz-legend">
        {parts.map((p) => (
          <li key={p.id}>
            <i style={{ background: p.color }} />
            <span>{p.label}</span>
            <b>{h1(p.ms)}h</b>
            <small>{Math.round((p.ms / total) * 100)}%</small>
          </li>
        ))}
        <li className="pz-split">
          <span>
            {L('赚钱', 'Paid')} <b>{h1(r.paidMs)}h</b> · {L('项目', 'Projects')} <b>{h1(r.focusMs - r.paidMs)}h</b>
            {r.earned > 0 && <> · {money(r.earned, cur, 0)}</>}
          </span>
        </li>
      </ul>
    </div>
  );
}

/** Heat colour: violet-blue for a light day, through pink, to gold for the biggest days. */
const STOPS = [
  [81, 97, 214],
  [255, 107, 138],
  [255, 209, 102],
];
const heat = (v: number, max: number) => {
  if (v <= 0) return 'rgba(255,255,255,.07)';
  const t = Math.min(1, Math.sqrt(v / max)) * 2;
  const [a, b] = t < 1 ? [STOPS[0], STOPS[1]] : [STOPS[1], STOPS[2]];
  const f = t < 1 ? t : t - 1;
  const c = a.map((x, i) => Math.round(x + (b[i] - x) * f));
  return `rgb(${c.join(',')})`;
};

function MonthCal({ r }: { r: PeriodReport }) {
  const lang = useLang();
  const max = Math.max(1, ...Object.values(r.xpByDay));
  const first = r.first;
  const lead = dayOfWeek(parseDay(first));
  const cells: (string | null)[] = [...Array(lead).fill(null)];
  const end = addDays(periodBounds('month', r.key).end, -1);
  for (let d = first; d <= end; d = addDays(d, 1)) cells.push(d);
  return (
    <div className="pz-cal">
      {weekdayLetters(lang).map((w, i) => (
        <span key={`h${i}`} className="pz-cal-h">
          {w}
        </span>
      ))}
      {cells.map((d, i) =>
        d ? (
          <span key={d} className={`pz-cal-d ${d > r.last ? 'is-future' : ''}`} style={{ background: heat(r.xpByDay[d] ?? 0, max) }} title={`${d} · ${r.xpByDay[d] ?? 0} XP`}>
            {+d.slice(8)}
          </span>
        ) : (
          <span key={`e${i}`} />
        ),
      )}
    </div>
  );
}

function YearGrid({ r }: { r: PeriodReport }) {
  const max = Math.max(1, ...Object.values(r.xpByDay));
  const first = r.first;
  const lead = dayOfWeek(parseDay(first));
  const cols: (string | null)[][] = [];
  let col: (string | null)[] = Array(lead).fill(null);
  const stop = periodBounds(r.kind, r.key).end;
  for (let d = first; d < stop; d = addDays(d, 1)) {
    col.push(d);
    if (col.length === 7) (cols.push(col), (col = []));
  }
  if (col.length) cols.push(col);
  return (
    <div className="pz-year">
      {cols.map((c, i) => (
        <span key={i} className="pz-year-col">
          {c.map((d, j) => (d ? <i key={d} className={d > r.last ? 'is-future' : ''} style={{ background: heat(r.xpByDay[d] ?? 0, max) }} title={d} /> : <i key={`e${j}`} className="is-pad" />))}
        </span>
      ))}
    </div>
  );
}

function MonthBars({ r }: { r: PeriodReport }) {
  const lang = useLang();
  const L = useL();
  const ms = r.months!;
  const maxX = Math.max(1, ...ms.map((m) => m.xp));
  const maxF = Math.max(1, ...ms.map((m) => m.focusMs));
  return (
    <div className="pz-months">
      {ms.map((m) => (
        <div key={m.key} className="pz-month">
          <div className="pz-month-bars">
            <i className="xp" style={{ height: `${(m.xp / maxX) * 100}%` }} title={`${m.xp} XP`} />
            <i className="focus" style={{ height: `${(m.focusMs / maxF) * 100}%` }} title={`${h1(m.focusMs)}h`} />
          </div>
          <span>{parseDay(`${m.key}-01`).toLocaleDateString(lang === 'zh' ? 'zh-CN' : 'en-US', { month: 'short' })}</span>
        </div>
      ))}
      <p className="pz-month-key">
        <i className="xp" /> XP <i className="focus" /> {L('专注时长', 'Focus hours')}
      </p>
    </div>
  );
}

/** Human 3.0 on the poster: this period's assessment, the change since the one before, and what's next. */
function PosterH3({ r }: { r: PeriodReport }) {
  const L = useL();
  const lang = useLang();
  const s = useStore((x) => x);
  if (!s.h3?.assessments.length) return null;
  const a = assessmentFor(s, r.kind, r.key);
  const n = (t: [string, string]) => (lang === 'zh' ? t[0] : t[1]);
  if (!a)
    return (
      <section className="pz-sec pz-h3">
        <h2>
          <Icon name="target" size={16} /> Human 3.0
        </h2>
        <p className="pz-note">{L('这一期还没做 Human 3.0 评估：在「成就报告」→「Human 3.0」里做一次，这里就会显示你在地图上的位置和变化。', 'No Human 3.0 assessment for this period yet: do one under Reports → Human 3.0 and your position and progress show up here.')}</p>
      </section>
    );
  const prev = latestBefore(s, a.date, a.id);
  return (
    <section className="pz-sec pz-h3">
      <h2>
        <Icon name="target" size={16} /> {L('Human 3.0 · 你在地图上的位置', 'Human 3.0 · where you stand')}
        {isMetatype(a) && <em>3.0+ Metatype</em>}
        {prev && <span className="pz-h-note">{L(`对比 ${periodName(prev.kind, prev.key, 'zh')}`, `vs ${periodName(prev.kind, prev.key, 'en')}`)}</span>}
      </h2>
      <div className="pz-h3-grid">
        {QUADS.map((q) => {
          const p = a.quads[q];
          const b = prev?.quads[q];
          const d = b ? stepOf(p) - stepOf(b) : null;
          return (
            <div key={q} className="pz-h3-q" style={{ '--q': QUAD_META[q].color } as CSSProperties}>
              <span className="pz-h3-name">
                <Icon name={QUAD_META[q].icon} size={15} /> {n(QUAD_META[q].name).split(' ').pop()}
              </span>
              <b>
                {fmtPos(p)}
                {d != null && d !== 0 && <small className={d > 0 ? 'up' : 'down'}>{d > 0 ? ` ▲${d}` : ` ▼${-d}`}</small>}
              </b>
              <span className="pz-h3-lv">{n(LEVEL_NAME[p.level])}</span>
              <Ladder p={p} before={b} />
              {p.next && <p>→ {p.next}</p>}
            </div>
          );
        })}
      </div>
      {a.summary && <p className="pz-h3-sum">“{a.summary}”</p>}
    </section>
  );
}
