import { useMemo, useState, type CSSProperties } from 'react';
import { useL } from '../lib/i18n';
import { useStore } from '../store/store';
import { GROUPS, SOURCES, xpSources, type SourceGroup } from '../store/xpSources';
import { Icon } from '../ui/Icon';
import { Card, Segmented } from '../ui/kit';

type Range = '7' | '30' | '90' | 'all';
const GROUP_TONE: Record<SourceGroup, string> = { time: 'var(--p-teal)', done: 'var(--p-orange, #f2683c)', care: 'var(--p-violet, #8b5cf6)', passive: 'var(--p-amber, #e09b12)' };
const pct = (x: number) => `${Math.round(x * 100)}%`;

/** Growth → XP sources: what your XP is actually made of. */
export function XpSources() {
  const L = useL();
  const s = useStore((x) => x);
  const [range, setRange] = useState<Range>('30');
  const r = useMemo(() => xpSources(s, range === 'all' ? 'all' : Number(range)), [s, range]);
  const max = r.sources[0]?.xp ?? 1;
  const time = r.groups.find((g) => g.id === 'time')!;

  return (
    <div className="xps">
      <Card
        className="xps-card"
        title={L('经验值从哪里来', 'Where your XP comes from')}
        icon="chart"
        action={
          <Segmented
            size="sm"
            value={range}
            onChange={setRange}
            options={[
              { value: '7', label: L('7 天', '7d') },
              { value: '30', label: L('30 天', '30d') },
              { value: '90', label: L('90 天', '90d') },
              { value: 'all', label: L('全部', 'All') },
            ]}
          />
        }
      >
        {r.total === 0 ? (
          <p className="muted">{L('这段时间还没有经验值记录。', 'No XP in this period yet.')}</p>
        ) : (
          <>
            <p className="xps-sum">
              <b className="num">{r.total.toLocaleString()}</b> XP · {L(`有记录的日子平均 ${r.perDay} / 天`, `${r.perDay} per active day`)} · <span className="muted">{L(`${r.activeDays} 天有记录（${r.from} 起）`, `${r.activeDays} active days (from ${r.from})`)}</span>
            </p>
            <div className="xps-stack" role="img" aria-label={r.groups.map((g) => `${L(GROUPS[g.id].zh, GROUPS[g.id].en)} ${pct(g.share)}`).join(', ')}>
              {r.groups.filter((g) => g.xp > 0).map((g) => (
                <i key={g.id} style={{ width: pct(g.share), background: GROUP_TONE[g.id] }} />
              ))}
            </div>
            <ul className="xps-legend">
              {r.groups.map((g) => (
                <li key={g.id}>
                  <i style={{ background: GROUP_TONE[g.id] }} />
                  {L(GROUPS[g.id].zh, GROUPS[g.id].en)} <b className="num">{pct(g.share)}</b>
                </li>
              ))}
            </ul>

            <ul className="xps-list">
              {r.sources.map((x) => {
                const m = SOURCES[x.id];
                return (
                  <li key={x.id} style={{ '--tone': GROUP_TONE[m.group] } as CSSProperties}>
                    <span className="xps-name">
                      <Icon name={m.icon} size={14} /> {L(m.zh, m.en)}
                    </span>
                    <span className="xps-bar">
                      <i style={{ width: `${Math.max(1.5, (x.xp / max) * 100)}%` }} />
                    </span>
                    <span className="xps-num num">{x.xp.toLocaleString()}</span>
                    <span className="xps-pct num muted">{pct(x.share)}</span>
                    <span className="xps-n num muted">{L(`${x.n} 笔`, `${x.n}×`)}</span>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </Card>

      {r.total > 0 && (
        <Card title={L('值得注意的地方', 'Worth a look')} icon="info">
          <ul className="xps-facts">
            <li>
              <b>{L(`花的时间占 ${pct(time.share)}`, `Time spent is ${pct(time.share)}`)}</b>
              <span>
                {L(
                  `有计时的 ${r.time.activeDays} 天里，超过 4 小时的 ${r.time.daysOver4h} 天，超过 8 小时的 ${r.time.daysOver8h} 天；最长一天 ${r.time.maxHours.toFixed(1)} 小时。专注和赚钱现在都是每分钟 1 XP，不封顶。`,
                  `Of ${r.time.activeDays} days with timed work, ${r.time.daysOver4h} went over 4 hours and ${r.time.daysOver8h} over 8; the longest was ${r.time.maxHours.toFixed(1)} h. Focus and paid work both give 1 XP a minute, uncapped.`,
                )}
              </span>
            </li>
            <li>
              <b>{L(`番茄钟和计时重叠 ${r.pomoOverlap.n} 次`, `${r.pomoOverlap.n} pomodoros overlapped a timer`)}</b>
              <span>{L(`这些番茄钟跑的时候，专注或赚钱计时也在跑，同一段时间多拿了 ${r.pomoOverlap.xp} XP。`, `They ran while a focus or work timer was also running: ${r.pomoOverlap.xp} XP for the same time, twice.`)}</span>
            </li>
            <li>
              <b>{L(`引用：日均 ${r.citePerDay} XP`, `Citations: ${r.citePerDay} XP a day`)}</b>
              <span>{L('新增引用每次 +2 XP（每次抓取最多 +200），不用做什么就会来。', 'Each new citation gives 2 XP (up to 200 per fetch) — it arrives without any action.')}</span>
            </li>
            <li>
              <b>{L('最大的几笔', 'The biggest single grants')}</b>
              <span className="xps-top">
                {r.top.map((t, i) => (
                  <span key={i}>
                    <span className="num">+{t.xp}</span> {t.label} <span className="muted num">{t.day.slice(5)}</span>
                  </span>
                ))}
              </span>
            </li>
          </ul>
          <p className="muted small">{L('这里只是统计，经验值规则还没有改。看完告诉我哪些需要调整。', 'This only shows the numbers — no XP rules have changed.')}</p>
        </Card>
      )}
    </div>
  );
}
