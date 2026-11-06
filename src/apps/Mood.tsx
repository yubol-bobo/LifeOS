import { openDay } from './DayXp';
import { useMemo, useState, type CSSProperties } from 'react';
import { addDays, dayKey, lastNDays, parseDay } from '../lib/date';
import { useL, useLang } from '../lib/i18n';
import { moodFactors } from '../store/insights';
import { actions, useStore } from '../store/store';
import type { MoodEntry } from '../store/types';
import { AreaChart } from '../ui/charts';
import { Icon } from '../ui/Icon';
import { Button, Card, Empty, Stat } from '../ui/kit';
import { MOOD_COLORS, MOOD_LABELS, MoodFace } from '../ui/MoodFace';

export function MoodPicker({ day = dayKey(), size = 44 }: { day?: string; size?: number }) {
  const L = useL();
  const cur = useStore((s) => s.moods[day]);
  return (
    <div className="mood-pick" role="radiogroup" aria-label={L('心情', 'Mood')}>
      {([1, 2, 3, 4, 5] as MoodEntry['v'][]).map((v) => (
        <button key={v} role="radio" aria-checked={cur?.v === v} className={cur?.v === v ? 'is-on' : cur ? 'is-dim' : ''} onClick={() => actions.setMood(v, undefined, day)} title={L(...MOOD_LABELS[v])}>
          <MoodFace v={v} size={size} />
          <span>{L(...MOOD_LABELS[v])}</span>
        </button>
      ))}
    </div>
  );
}

export function Mood() {
  const L = useL();
  const lang = useLang();
  const s = useStore((x) => x);
  const today = dayKey();
  const [month, setMonth] = useState(() => today.slice(0, 7));
  const [noteDraft, setNoteDraft] = useState<string | null>(null);
  const factors = useMemo(() => moodFactors(s), [s]);

  const avg = (n: number) => {
    const vs = lastNDays(n)
      .map((d) => s.moods[d]?.v)
      .filter(Boolean) as number[];
    return vs.length ? vs.reduce((a, b) => a + b, 0) / vs.length : null;
  };
  let streak = 0;
  for (let d = s.moods[today] ? today : addDays(today, -1); s.moods[d]; d = addDays(d, -1)) streak++;
  const trend = lastNDays(45)
    .filter((d) => s.moods[d])
    .map((d) => ({ x: parseDay(d).toLocaleDateString(lang === 'zh' ? 'zh-CN' : 'en-US', { month: 'numeric', day: 'numeric' }), y: s.moods[d].v }));

  // calendar
  const first = parseDay(`${month}-01`);
  const lead = (first.getDay() + 6) % 7;
  const daysIn = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const cells = [...Array(lead).fill(null), ...Array.from({ length: daysIn }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`)];
  const shift = (n: number) => {
    const d = new Date(first.getFullYear(), first.getMonth() + n, 1);
    setMonth(dayKey(d).slice(0, 7));
  };
  const w = s.wellness[today] ?? { water: 0, breaks: 0, pomos: 0, pomoMin: 0 };
  const note = noteDraft ?? s.moods[today]?.note ?? '';

  return (
    <div className="app">
      <div className="app-head">
        <div>
          <h1>{L('心情', 'Mood')}</h1>
          <p className="muted">{L('每天点一下。积累几周后，LifeOS 会告诉你什么在真正影响你的状态。', 'One tap a day. After a few weeks, LifeOS shows you what actually moves how you feel.')}</p>
        </div>
      </div>

      <section className="mood-hero">
        <div>
          <p className="eyebrow">{parseDay(today).toLocaleDateString(lang === 'zh' ? 'zh-CN' : 'en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
          <h2>{L('今天感觉怎么样？', 'How are you feeling today?')}</h2>
        </div>
        <MoodPicker size={58} />
        <textarea
          className="input"
          rows={2}
          placeholder={s.moods[today] ? L('一句话记下今天（可选）', 'One line about today (optional)') : L('先选一个心情，再写一句', 'Pick a mood first, then add a line')}
          disabled={!s.moods[today]}
          value={note}
          onChange={(e) => setNoteDraft(e.target.value)}
          onBlur={() => {
            if (noteDraft != null) actions.setMoodNote(noteDraft);
            setNoteDraft(null);
          }}
        />
      </section>

      <div className="stats-row">
        <Stat label={L('近 7 天平均', '7-day average')} value={avg(7)?.toFixed(1) ?? '—'} tone="accent" />
        <Stat label={L('近 30 天平均', '30-day average')} value={avg(30)?.toFixed(1) ?? '—'} />
        <Stat label={L('连续记录', 'Logging streak')} value={<>{streak}<small>{L('天', 'd')}</small></>} />
        <Stat label={L('已记录', 'Days logged')} value={Object.keys(s.moods).length} />
      </div>

      <div className="grid-2-1">
        <Card title={L('什么在影响你的心情', 'What moves your mood')} icon="sparkles">
          {factors.length === 0 ? (
            <Empty icon="sparkles" title={L('还需要多一点数据', 'Need a bit more data')} body={L('至少记录 6 天心情，并且每个因素「有」和「没有」的日子各 3 天以上，才会出现关联。', 'Log at least 6 days, with 3+ days on each side of a factor, and correlations will appear here.')} />
          ) : (
            <ul className="factors">
              {factors.slice(0, 8).map((f) => (
                <li key={f.key} className={f.diff > 0 ? 'up' : 'down'}>
                  <span className="f-ic">
                    <Icon name={f.icon} size={14} />
                  </span>
                  <div className="f-main">
                    <strong>{L(f.zh, f.en)}</strong>
                    <span className="muted small">
                      {f.diff > 0
                        ? L(`这些日子心情平均高 ${f.diff.toFixed(1)} 分`, `Mood ${f.diff.toFixed(1)} higher on these days`)
                        : L(`这些日子心情平均低 ${(-f.diff).toFixed(1)} 分`, `Mood ${(-f.diff).toFixed(1)} lower on these days`)}
                      {` · ${f.withAvg.toFixed(1)} vs ${f.withoutAvg.toFixed(1)} · n=${f.nWith}/${f.nWithout}`}
                    </span>
                  </div>
                  <span className="f-bars" aria-hidden>
                    <i style={{ '--v': f.withAvg / 5 } as CSSProperties} className="with" />
                    <i style={{ '--v': f.withoutAvg / 5 } as CSSProperties} className="without" />
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="muted small footnote">{L('相关不等于因果——这是一面镜子，不是实验结论。', 'Correlation, not causation — a mirror, not a study.')}</p>
        </Card>

        <Card title={L('今天的身体', 'Body today')} icon="droplets">
          <p className="muted small">{L('桌面宠物会提醒你喝水和起身；这里也能手动记录。', 'Your desktop pet reminds you; you can also log here.')}</p>
          <ul className="well-list">
            {(
              [
                ['water', 'droplets', L('喝水（杯）', 'Water (cups)')],
                ['breaks', 'footprints', L('起身活动', 'Stand-up breaks')],
                ['pomos', 'timer', L('番茄钟', 'Pomodoros')],
              ] as const
            ).map(([k, icon, label]) => (
              <li key={k}>
                <Icon name={icon} size={16} />
                <span>{label}</span>
                <Button size="sm" variant="ghost" icon="minus" title={L('减少', 'Less')} disabled={!w[k]} onClick={() => actions.logWellness(k, -1)} />
                <strong className="num">{w[k]}</strong>
                <Button size="sm" variant="soft" icon="plus" title={L('增加', 'More')} onClick={() => actions.logWellness(k, 1, k === 'pomos' ? s.pet.pomoWork : 0)} />
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="grid-1-1">
        <Card
          title={L('心情日历', 'Mood calendar')}
          icon="calendar"
          action={
            <div className="day-nav">
              <Button size="sm" variant="ghost" icon="chevron-left" title={L('上个月', 'Previous month')} onClick={() => shift(-1)} />
              <span className="num">{first.toLocaleDateString(lang === 'zh' ? 'zh-CN' : 'en-US', { year: 'numeric', month: 'long' })}</span>
              <Button size="sm" variant="ghost" icon="chevron-right" title={L('下个月', 'Next month')} disabled={month >= today.slice(0, 7)} onClick={() => shift(1)} />
            </div>
          }
        >
          <div className="cal">
            {(lang === 'zh' ? ['一', '二', '三', '四', '五', '六', '日'] : ['M', 'T', 'W', 'T', 'F', 'S', 'S']).map((d, i) => (
              <span key={i} className="cal-h">
                {d}
              </span>
            ))}
            {cells.map((d, i) =>
              d ? (
                <span key={d} className={`cal-d ${d === today ? 'is-today' : ''} ${d > today ? 'is-future' : ''}`} title={s.moods[d]?.note || d} onClick={d <= today ? () => openDay(d) : undefined} role={d <= today ? 'button' : undefined} style={s.moods[d] ? ({ '--m': MOOD_COLORS[s.moods[d].v] } as CSSProperties) : undefined}>
                  {s.moods[d] ? <MoodFace v={s.moods[d].v} size={26} /> : <span className="num">{+d.slice(8)}</span>}
                </span>
              ) : (
                <span key={`x${i}`} />
              ),
            )}
          </div>
        </Card>
        <Card title={L('心情趋势', 'Mood trend')} icon="chart">
          {trend.length > 1 ? <AreaChart data={trend} tone="accent" height={230} baseline="auto" format={(v) => `${v} · ${L(...MOOD_LABELS[Math.round(v)])}`} /> : <Empty icon="chart" title={L('记录两天以上显示趋势', 'Log two days to see a trend')} />}
          {Object.entries(s.moods)
            .filter(([, m]) => m.note)
            .sort((a, b) => b[0].localeCompare(a[0]))
            .slice(0, 3)
            .map(([d, m]) => (
              <p key={d} className="mood-note">
                <MoodFace v={m.v} size={20} /> <span className="num muted small">{d}</span> {m.note}
              </p>
            ))}
        </Card>
      </div>
    </div>
  );
}
