import { useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { LifeSettingsModal } from './LifeSettings';
import { openDay } from './DayXp';
import { addDays, dayKey, daysBetween, lastNDays, lifeProgress, parseDay } from '../lib/date';
import { compact, money, num } from '../lib/format';
import { useL, useLang } from '../lib/i18n';
import { open } from '../os/router';
import { useLiveSession } from '../os/live';
import Planet from '../scene/Planet';
import { useMetrics } from '../store/hooks';
import { useAttrs } from '../store/attrs';
import { attrLevel, QUEST_XP } from '../store/rules';
import { actions, useStore } from '../store/store';
import { Heatmap, Radar, Sparkline } from '../ui/charts';
import { Icon } from '../ui/Icon';
import { Bar, Button, CheckBubble, Chip, Ring } from '../ui/kit';
import { Odometer } from '../ui/Odometer';
import { goalProgress, isScheduled, weeklyReview } from '../store/links';
import { MILESTONE_XP } from '../store/rules';
import { GoalTag } from './goals';
import { useStatusLabel } from './Research';
import type { PaperStatus } from '../store/types';
import { QuickAdd } from './Quests';
import { MoodPicker } from './Mood';
import { MoodFace } from '../ui/MoodFace';
import { checkinDue, filledSeries } from '../store/assets';
import { titleName, unlockedAt } from '../store/progression';
import { periodOf } from '../lib/period';
import { planProgress } from '../store/plans';
import { upcoming } from '../store/countdowns';
import { ReviewHeatmap } from './Review';
import { clock } from './Earn';
import { cssVar, effortRows, sliceColor } from './effort';
import { Pie3D } from '../scene/Pie3D';
import { useTheme } from '../os/theme';
import { useLayout } from '../os/display';
import { hasReview, reviewStreak } from '../store/review';
import { openSummary } from '../ai/summary';

export function Desktop({ dark, hidden }: { dark: boolean; hidden: boolean }) {
  const L = useL();
  const lang = useLang();
  const s = useStore((x) => x);
  const m = useMetrics();
  const live = useLiveSession(200);
  const statusLabel = useStatusLabel();
  const attrs = useAttrs();
  const hide = new Set(s.ui.widgets);
  const [lifeOpen, setLifeOpen] = useState(false);
  const thisWeek = periodOf('week');
  const weekPlans = s.plans.filter((p) => p.scope === 'week' && p.period === thisWeek);
  const soon = upcoming(s);
  const assetSeries = useMemo(() => filledSeries(s), [s.snapshots, s.accounts, s.assets]); // eslint-disable-line react-hooks/exhaustive-deps
  const assetDelta = assetSeries.length > 1 ? assetSeries.at(-1)!.total - assetSeries.at(-2)!.total : null;
  const today = dayKey();
  const lp = lifeProgress(s.profile.birthDate, s.profile.lifeExpectancy);
  const hour = new Date().getHours();
  const hello =
    hour < 5 ? L('夜深了', 'Burning the midnight oil') : hour < 12 ? L('早上好', 'Good morning') : hour < 18 ? L('下午好', 'Good afternoon') : L('晚上好', 'Good evening');

  const doneToday = new Set(s.completions[today] ?? []);
  const quests = s.quests.filter((q) => !q.archived && (q.kind === 'daily' ? isScheduled(q, today) : !q.doneAt || q.doneAt > Date.now() - 86_400_000));
  const dailies = s.quests.filter((q) => isScheduled(q, today));
  const dailyDone = dailies.filter((q) => doneToday.has(q.id)).length;

  const todaysFocus = s.sessions.filter((x) => dayKey(x.start) === today);
  const todayEarned = todaysFocus.reduce((a, x) => a + x.earned, 0) + (live?.earned ?? 0);

  const goals = s.milestones
    .filter((x) => x.status !== 'done')
    .map((g) => ({ g, p: goalProgress(s, g, m) }))
    .sort((a, b) => Number(b.p.ready) - Number(a.p.ready) || Number(b.g.status === 'active') - Number(a.g.status === 'active') || (a.g.targetDate ?? '9').localeCompare(b.g.targetDate ?? '9'))
    .slice(0, 4);
  const review = useMemo(() => weeklyReview(s), [s]);

  const days = useMemo(() => lastNDays(140), [today]); // eslint-disable-line react-hooks/exhaustive-deps
  const xpByDay = useMemo(() => {
    const map: Record<string, number> = {};
    for (const e of s.events) if (e.xp > 0) map[dayKey(e.ts)] = (map[dayKey(e.ts)] ?? 0) + e.xp;
    return map;
  }, [s.events]);
  const maxDay = Math.max(60, ...Object.values(xpByDay));
  const citeSpark = s.citationLog.slice(-12).map((x) => x.total);
  const lastWeekCites = (() => {
    const cut = addDays(today, -30);
    const before = [...s.citationLog].reverse().find((x) => x.date <= cut);
    return before ? m.totalCitations - before.total : 0;
  })();

  return (
    <div className={`desktop ${hidden ? 'is-hidden' : ''}`} aria-hidden={hidden}>
      <LifeSettingsModal open={lifeOpen} onClose={() => setLifeOpen(false)} />
      {/* ---------- hero / planet ---------- */}
      {!hide.has('hero') && (
      <section className="widget w-hero">
        <div className="hero-text">
          <p className="eyebrow">{new Date().toLocaleDateString(lang === 'zh' ? 'zh-CN' : 'en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
          <h1>
            {hello}
            {s.profile.name ? (lang === 'zh' ? `，${s.profile.name}` : `, ${s.profile.name}`) : ''}
          </h1>
          <p className="hero-sub">
            {dailies.length === 0
              ? L('添加几个每日任务，开始养成你的星球。', 'Add a few daily quests to start growing your planet.')
              : dailyDone === dailies.length
                ? L('今日任务全部完成，星球在发光。', 'Every daily quest done — your planet is glowing.')
                : L(`今天还有 ${dailies.length - dailyDone} 个每日任务等你。`, `${dailies.length - dailyDone} daily quests left today.`)}
          </p>
        </div>
        <div className="hero-planet">
          <Planet
            trees={Math.min(90, 4 + m.level.level * 2 + Math.floor(m.questsDone / 15))}
            flags={m.milestonesDone}
            streak={m.streak.current}
            dark={dark}
            still={s.profile.reduceMotion || hidden}
            features={unlockedAt(m.level.level, 'planet').map((u) => u.id)}
          />
          <span className="planet-hint">{L('拖动旋转 · 树木随等级生长，旗帜是你的里程碑', 'Drag to spin · trees grow with level, flags are milestones')}</span>
        </div>
        {!hide.has('attrs') && (
          <button className="hero-attrs" onClick={() => open('trophies')} title={L('属性分布 · 点开看升级之路', 'Attributes · open the road')} aria-label={L('属性', 'Attributes')}>
            <Radar
              size={250}
              axes={attrs.list.map(({ id: a }) => ({
                key: a,
                label: attrs.label(a),
                value: m.attrXp[a] ?? 0,
                display: `Lv.${attrLevel(m.attrXp[a] ?? 0)}`,
              }))}
            />
          </button>
        )}
        <div className="hero-level">
          <Ring value={m.level.progress} size={78} stroke={8}>
            <span className="ring-num num">{m.level.level}</span>
            <span className="ring-cap">LV</span>
          </Ring>
          <div className="hero-level-text">
            <strong>{titleName(s.equip?.title, m.level.level, lang)}</strong>
            <span className="num">
              {num(m.level.into)} / {num(m.level.span)} XP
            </span>
            <div className="hero-pills">
              <Chip icon="flame" tone="accent">
                {L(`${m.streak.current} 天连胜`, `${m.streak.current}-day streak`)}
              </Chip>
              <Chip tone="gold">
                <span className="coin coin-sm" /> {m.coins.toLocaleString()}
              </Chip>
            </div>
          </div>
        </div>
      </section>
      )}

      {/* ---------- today's quests ---------- */}
      {!hide.has('quests') && (
      <section className="widget w-quests">
        <WidgetHead icon="list-checks" title={L('今日任务', "Today's quests")} onOpen={() => open('quests')}>
          <span className="num muted">
            {dailyDone}/{dailies.length}
          </span>
        </WidgetHead>
        <Bar value={dailies.length ? dailyDone / dailies.length : 0} height={8} label="daily progress" />
        <ul className="mini-quests">
          {quests.slice(0, 7).map((q) => {
            const done = q.kind === 'daily' ? doneToday.has(q.id) : !!q.doneAt;
            return (
              <li key={q.id} className={done ? 'is-done' : ''}>
                <CheckBubble checked={done} onChange={() => actions.toggleQuest(q.id)} tone={q.attr} label={q.title} />
                <span className="mq-title">{q.title}</span>
                <GoalTag goalId={q.goalId} />
                <span className="mq-xp num">+{QUEST_XP[q.difficulty]}</span>
              </li>
            );
          })}
          {quests.length === 0 && <li className="muted">{L('还没有任务', 'No quests yet')}</li>}
        </ul>
        {quests.length > 7 && (
          <button className="more-link" onClick={() => open('quests')}>
            {L(`还有 ${quests.length - 7} 个 →`, `${quests.length - 7} more →`)}
          </button>
        )}
        <QuickAdd compact />
      </section>
      )}

      {/* ---------- life progress ---------- */}
      {!hide.has('life') && (
      <section className="widget w-life">
        <WidgetHead icon="hourglass" title={L('人生进度', 'Life progress')} onOpen={() => open('roadmap')}>
          <button className="w-open" onClick={() => setLifeOpen(true)} aria-label={L('设置出生日期和预期寿命', 'Set birth date and life expectancy')} title={L('设置出生日期和预期寿命', 'Set birth date and life expectancy')}>
            <Icon name="pencil" size={14} />
          </button>
        </WidgetHead>
        <div className="life-rows">
          {[
            [L('今天', 'Today'), lp.day, 'accent'],
            [L('本周', 'This week'), lp.week, 'mind'],
            [L('本月', 'This month'), lp.month, 'wealth'],
            [new Date().getFullYear().toString(), lp.year, 'craft'],
            [L('人生', 'Life'), lp.life, 'spirit'],
          ].map(([label, v, tone]) => (
            <div className="life-row" key={label as string}>
              <span className="life-label">{label as string}</span>
              <Bar value={v as number} tone={tone as 'accent'} height={10} label={label as string} />
              <span className="life-pct num">{((v as number) * 100).toFixed(label === L('人生', 'Life') ? 1 : 0)}%</span>
            </div>
          ))}
        </div>
        <p className="life-foot">
          {L(`${lp.age.toFixed(1)} 岁 · 已度过 ${num(lp.weeksLived)} 周 · 今年还剩 ${lp.daysLeftYear} 天`, `Age ${lp.age.toFixed(1)} · ${num(lp.weeksLived)} weeks lived · ${lp.daysLeftYear} days left this year`)}
        </p>
      </section>
      )}

      {/* ---------- earn ---------- */}
      {!hide.has('earn') && (
      <section className={`widget w-earn ${live ? 'is-live' : ''}`}>
        <WidgetHead icon="coins" title={L('今日收入', 'Earnings')} onOpen={() => open('earn')}>
          {live?.paid && <span className="muted num">{live.left != null ? (live.left > 0 ? `⏳ ${clock(live.left)}` : '🎉') : clock(live.ms)}</span>}
        </WidgetHead>
        <div className="earn-row">
          <div className="earn-mini">
            <Odometer value={money(todayEarned, s.profile.currency)} className="odo-lg" />
            <span className="muted">{L('今天赚到的', 'earned today')}</span>
          </div>
          {live?.paid ? (
            <div className="row-gap">
              <Button variant="soft" icon={live.paused ? 'play' : 'pause'} title={live.paused ? L('继续', 'Resume') : L('暂停', 'Pause')} onClick={actions.pauseFocus}>
                <span className="btn-txt">{live.paused ? L('继续', 'Resume') : L('暂停', 'Pause')}</span>
              </Button>
              <Button variant="primary" icon="square" title={L('结算', 'Cash out')} onClick={() => actions.stopFocus()}>
                <span className="btn-txt">{L('结算', 'Cash out')}</span>
              </Button>
            </div>
          ) : (
            <div className="row-gap">
              <Button variant="primary" icon="play" disabled={!!live} title={L('开始工作', 'Start work')} onClick={() => actions.startFocus(s.profile.hourlyRate, 'craft')}>
                <span className="btn-txt">{L(`开始工作 · ${money(s.profile.hourlyRate, s.profile.currency, 0)}/h`, `Start work · ${money(s.profile.hourlyRate, s.profile.currency, 0)}/h`)}</span>
              </Button>
            </div>
          )}
        </div>
      </section>
      )}

      {!hide.has('assets') && (
      <section className="widget w-assets">
        <WidgetHead icon="landmark" title={L('净资产', 'Net worth')} onOpen={() => open('assets')} />
        {assetSeries.length ? (
          <>
            <div className="research-mini">
              <div>
                <div className="big-num num">{compact(assetSeries.at(-1)!.total)}</div>
                <div className="muted">
                  {s.assets.base}
                  {assetDelta != null && (
                    <span className={`num ${assetDelta >= 0 ? 'pos' : 'neg'}`}> {(assetDelta >= 0 ? '+' : '−') + compact(Math.abs(assetDelta))}</span>
                  )}
                </div>
              </div>
              <Sparkline values={assetSeries.slice(-14).map((x) => x.total)} tone="wealth" width={120} height={44} />
            </div>
            <Button size="sm" variant={checkinDue(s) ? 'primary' : 'soft'} icon="wallet" className={checkinDue(s) ? 'is-due' : 'not-due'} onClick={() => window.dispatchEvent(new Event('lifeos:asset-checkin'))} style={{ marginTop: 14 }}>
              {checkinDue(s) ? L('该盘点了 · 记录此刻', 'Check-in due · record now') : L('记录此刻', 'Record balances')}
            </Button>
          </>
        ) : (
          <>
            <p className="muted small">{L('添加账户，定期记录余额，看见资产的长期变化。', 'Add accounts and check in regularly to see your wealth over time.')}</p>
            <Button size="sm" icon="plus" onClick={() => open('assets')} style={{ marginTop: 12 }}>
              {L('添加账户', 'Add accounts')}
            </Button>
          </>
        )}
      </section>
      )}

      {/* ---------- where today's time went ---------- */}
      {!hide.has('effort') && <EffortWidget live={live} />}

      {/* ---------- research ---------- */}
      {!hide.has('research') && (
      <section className="widget w-research">
        <WidgetHead icon="graduation" title={L('学术', 'Research')} onOpen={() => open('research')} />
        <div className="research-mini">
          <div>
            <div className="big-num num">{num(m.totalCitations)}</div>
            <div className="muted">{L('总引用', 'citations')}</div>
          </div>
          <Sparkline values={citeSpark} tone="spirit" width={120} height={44} />
        </div>
        <div className="kv-row">
          <span>
            h-index <b className="num">{m.hIndex}</b>
          </span>
          <span>
            i10 <b className="num">{m.i10}</b>
          </span>
          <span>
            {L('近30天', '30d')} <b className="num">+{lastWeekCites}</b>
          </span>
        </div>
        <div className="pipeline-mini">
          {(['idea', 'drafting', 'submitted', 'review', 'accepted'] as PaperStatus[]).map((st) => {
            const n = s.papers.filter((p) => p.status === st).length;
            return (
              <span key={st} className={n ? '' : 'is-zero'}>
                <b className="num">{n}</b>
                {statusLabel(st)}
              </span>
            );
          })}
        </div>
      </section>
      )}

      {/* ---------- goals ---------- */}
      {!hide.has('goals') && (
      <section className="widget w-next">
        <WidgetHead icon="flag" title={L('目标进度', 'Goals')} onOpen={() => open('roadmap')} />
        {goals.length ? (
          <ul className="goal-mini">
            {goals.map(({ g, p }) => {
              const days = g.targetDate ? daysBetween(today, g.targetDate) : null;
              return (
                <li key={g.id} className={p.ready ? 'is-ready' : ''}>
                  <div className="gm-top">
                    <strong>{g.title}</strong>
                    {p.ready ? (
                      <Button size="sm" variant="gold" icon="gift" onClick={() => actions.setMilestoneStatus(g.id, 'done')}>
                        +{MILESTONE_XP[g.size]}
                      </Button>
                    ) : (
                      <span className="muted small num">{days != null ? (days >= 0 ? L(`${days} 天`, `${days}d`) : L('已逾期', 'late')) : ''}</span>
                    )}
                  </div>
                  {p.pct != null ? (
                    <div className="gm-bar">
                      <Bar value={p.pct} tone={g.attr} height={7} />
                      <span className="num small">{Math.round(p.pct * 100)}%</span>
                    </div>
                  ) : (
                    <span className="muted small">{L('还没有可衡量的关键结果', 'No measurable key results yet')}</span>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="muted">{L('设定一个目标，并给它加上关键结果——之后的每个任务、每次专注都会自动推动它。', 'Set a goal and give it key results — every quest and focus session will then move it automatically.')}</p>
        )}
      </section>
      )}

      {/* ---------- activity ---------- */}
      {!hide.has('plans') && (
      <section className="widget w-plans">
        <WidgetHead icon="calendar" title={L('本周计划', 'This week')} onOpen={() => open('plan')}>
          <span className="muted num small">
            {weekPlans.filter((p) => p.done).length}/{weekPlans.length}
          </span>
        </WidgetHead>
        {weekPlans.length === 0 ? (
          <p className="muted small">{L('还没有本周计划。从月计划拆几件事过来？', 'No plan for this week yet — break a few things down from the month?')}</p>
        ) : (
          <ul className="mini-plans">
            {weekPlans.slice(0, 5).map((p) => {
              const pr = planProgress(s, p, m);
              return (
                <li key={p.id} className={p.done ? 'is-done' : ''}>
                  <CheckBubble checked={!!p.done} onChange={() => actions.togglePlan(p.id)} tone="teal" label={p.title} />
                  <div>
                    <span className="mq-title">{p.title}</span>
                    {pr.parts > 0 && <Bar value={pr.pct} tone="teal" height={4} />}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
      )}

      {!hide.has('countdown') && (
      <section className="widget w-countdown">
        <WidgetHead icon="hourglass" title={L('倒计时', 'Countdown')} onOpen={() => (sessionStorage.setItem('lifeos:plan-tab', 'countdown'), open('plan'))} />
        {soon.length === 0 ? (
          <p className="muted small">{L('截稿、旅行、生日……加一个吧。', 'Deadlines, trips, birthdays — add one.')}</p>
        ) : (
          <ul className="cd-mini">
            {soon.slice(0, 4).map((c) => (
              <li key={c.id} style={{ '--tone': `var(--p-${c.color})` } as CSSProperties}>
                <span className="cd-days num">{c.daysLeft}</span>
                <span className="cd-unit">{L('天', 'd')}</span>
                <span className="mq-title">{c.title}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
      )}

      {!hide.has('mood') && (
      <section className="widget w-mood">
        <WidgetHead icon="smile" title={L('今天心情', 'Mood today')} onOpen={() => open('mood')} />
        <MoodPicker size={36} />
        <div className="mood-week">
          {lastNDays(7).map((d) => (
            <span key={d} title={d}>
              {s.moods[d] ? <MoodFace v={s.moods[d].v} size={20} /> : <i />}
              <small>{L('一二三四五六日'[(parseDay(d).getDay() + 6) % 7], 'MTWTFSS'[(parseDay(d).getDay() + 6) % 7])}</small>
            </span>
          ))}
        </div>
      </section>
      )}

      {!hide.has('journal') && (
      <section className="widget w-journal">
        <WidgetHead icon="notebook" title={L('每日复盘', 'Daily review')} onOpen={() => open('review')}>
          <span className="muted num">{L(`连续 ${reviewStreak(s)} 天`, `${reviewStreak(s)}-day streak`)}</span>
        </WidgetHead>
        <ReviewHeatmap
          weeks={12}
          onPick={(d) => {
            sessionStorage.setItem('lifeos:review-day', d);
            open('review');
          }}
        />
        <div className="journal-actions">
          <Button size="sm" variant={hasReview(s, today) ? 'soft' : 'primary'} icon={hasReview(s, today) ? 'check' : 'notebook'} onClick={() => open('review')}>
            {hasReview(s, today) ? L('已复盘 · 再看看', 'Reviewed · open') : L('写今天的复盘', 'Review today')}
          </Button>
          <Button size="sm" variant="soft" icon="sparkles" onClick={() => void openSummary(today)}>
            {L('宠物总结', 'Pet summary')}
          </Button>
        </div>
      </section>
      )}


      {!hide.has('heat') && (
      <section className="widget w-heat">
        <WidgetHead icon="calendar" title={L('经验热力图', 'XP activity')}>
          <span className="muted num">
            {L('最佳连胜', 'Best streak')} {m.streak.best}
          </span>
        </WidgetHead>
        <Heatmap
          days={days}
          weeks={20}
          max={maxDay}
          value={(d) => xpByDay[d] ?? 0}
          onPick={openDay}
          label={(d, v) => (
            <>
              <span className="tip-k">{d}</span>
              <span className="tip-v num">
                {v} XP · {L('点开看记录', 'click for details')}
              </span>
            </>
          )}
        />
        <div className="heat-legend">
          <span>{L('少', 'Less')}</span>
          {[0, 1, 2, 3, 4].map((l) => (
            <i key={l} className={`heat-cell l${l}`} />
          ))}
          <span>{L('多', 'More')}</span>
        </div>
      </section>
      )}

      {/* ---------- weekly review ---------- */}
      {!hide.has('review') && (
      <section className="widget w-log">
        <WidgetHead icon="sparkles" title={L('本周回顾', 'This week')} />
        <div className="review-stats">
          <div>
            <span className="muted small">XP</span>
            <strong className="num">{num(review.xpThis)}</strong>
            <Delta now={review.xpThis} prev={review.xpLast} />
          </div>
          <div>
            <span className="muted small">{L('专注', 'Focus')}</span>
            <strong className="num">{review.focusThis.toFixed(1)}h</strong>
            <Delta now={review.focusThis} prev={review.focusLast} />
          </div>
          <div>
            <span className="muted small">{L('主属性', 'Top stat')}</span>
            <strong>{review.topAttr ? attrs.label(review.topAttr) : '—'}</strong>
          </div>
        </div>
        <ul className="insights">
          {review.insights.slice(0, 3).map((x, i) => (
            <li key={i}>
              <span className="ins-ic" style={{ color: x.tone === 'accent' ? 'var(--accent)' : x.tone === 'gold' ? 'var(--gold)' : `var(--c-${x.tone})` }}>
                <Icon name={x.icon} size={14} />
              </span>
              <span>{lang === 'zh' ? x.zh : x.en}</span>
            </li>
          ))}
          {review.insights.length === 0 && <li className="muted">{L('多记录几天，这里会自动生成洞察。', 'Log a few more days and insights will appear here.')}</li>}
        </ul>
      </section>
      )}
    </div>
  );
}

function Delta({ now, prev }: { now: number; prev: number }) {
  const L = useL();
  if (!prev) return <span className="delta muted">{L('与上周同期', 'vs last week')} —</span>;
  const d = (now - prev) / prev;
  return (
    <span className={`delta ${d >= 0 ? 'up' : 'down'}`}>
      <Icon name={d >= 0 ? 'trending-up' : 'trending-down'} size={11} /> {d >= 0 ? '+' : ''}
      {Math.round(d * 100)}%
    </span>
  );
}

/** Today's focus as a small interactive 3D donut: paid work and project time, slice by activity. */
function EffortWidget({ live }: { live: ReturnType<typeof useLiveSession> }) {
  const L = useL();
  const dark = useTheme();
  const sessions = useStore((s) => s.sessions);
  const projects = useStore((s) => s.projects);
  const goalMin = useStore((s) => s.profile.focusGoalMin);
  const reduce = useStore((s) => s.profile.reduceMotion);
  const [sel, setSel] = useState<string | null>(null);
  const compact = useLayout() === 'landscape';
  const from = new Date(new Date().setHours(0, 0, 0, 0)).getTime();
  const all = effortRows(sessions, projects, live, from, L('专注', 'Focus'));
  const total = all.reduce((a, r) => a + r.ms, 0);
  const byId = new Map(all.map((r) => [r.id, r]));
  const h = (ms: number) => (ms / 3_600_000).toFixed(1);
  const paidRim = cssVar('--c-wealth', '#1ba677');
  const freeRim = cssVar('--p-violet', '#7a5ae6');
  const focus = sel ? byId.get(sel) : undefined;
  const toFocus = () => open('projects');
  return (
    <section className={`widget w-effort ${live ? 'is-live' : ''}`}>
      <WidgetHead icon="activity" title={L('今日时间分配', 'Time split')} onOpen={() => toFocus()}>
        {live && !live.paid && <span className="muted num">{live.left != null ? (live.left > 0 ? `⏳ ${clock(live.left)}` : '🎉') : clock(live.ms)}</span>}
      </WidgetHead>
      {total > 0 ? (
        <div className="effort-mini">
          <Pie3D
            slices={all.map((r) => ({ id: r.id, value: Math.max(1, Math.round(r.ms / 60_000)), color: sliceColor(all, r.id), rim: r.paid ? paidRim : freeRim }))}
            dark={dark}
            height={compact ? 118 : 160}
            still={reduce}
            selected={sel}
            onSelect={setSel}
            tooltip={(id) => {
              const r = byId.get(id);
              return r ? (
                <>
                  <span className="tip-k">{r.label}</span>
                  <span className="tip-v num">
                    {h(r.ms)}h · {Math.round((r.ms / total) * 100)}%
                  </span>
                </>
              ) : null;
            }}
            center={
              <span className="effort-center">
                <b className="num">{focus ? h(focus.ms) : h(total)}h</b>
                <small className="muted">{focus ? focus.label : L('今天', 'today')}</small>
              </span>
            }
          />
          <ul className="effort-legend">
            {all.slice(0, 4).map((r) => (
              <li key={r.id} className={sel === r.id ? 'is-on' : ''} onClick={() => setSel(sel === r.id ? null : r.id)}>
                <i style={{ background: sliceColor(all, r.id) }} />
                <span className="el-name">{r.label}</span>
                <span className="num muted">{h(r.ms)}h</span>
              </li>
            ))}
            {all.length > 4 && <li className="muted small">{L(`还有 ${all.length - 4} 项`, `+${all.length - 4} more`)}</li>}
          </ul>
        </div>
      ) : (
        <p className="muted small effort-empty">{L('今天还没有专注记录。开始一段计时，这里会出现一个 3D 环形图。', 'No focus yet today. Start a session and a 3D donut appears here.')}</p>
      )}
      <div className="goal">
        <div className="goal-top">
          <span className="muted small">{L('今日专注目标', "Today's focus goal")}</span>
          <span className="num small">
            {h(total)} / {(goalMin / 60).toFixed(1)}h
          </span>
        </div>
        <Bar value={total / (goalMin * 60_000)} tone="violet" height={7} label="focus goal" />
      </div>
      {live && !live.paid ? (
        <div className="row-gap">
          <Button variant="soft" icon={live.paused ? 'play' : 'pause'} onClick={actions.pauseFocus}>
            {live.paused ? L('继续', 'Resume') : L('暂停', 'Pause')}
          </Button>
          <Button variant="primary" icon="square" onClick={() => actions.stopFocus()}>
            {L('结束', 'Stop')}
          </Button>
        </div>
      ) : (
        <div className="row-gap">
          <Button variant="soft" icon="briefcase" disabled={!!live} onClick={() => toFocus()}>
            {L('开始项目专注', 'Focus on a project')}
          </Button>
        </div>
      )}
    </section>
  );
}

function WidgetHead({ icon, title, onOpen, children }: { icon: string; title: string; onOpen?: () => void; children?: ReactNode }) {
  return (
    <header className="w-head">
      <span className="w-ic">
        <Icon name={icon} size={14} stroke={2.4} />
      </span>
      <h3>{title}</h3>
      <div className="w-head-end">
        {children}
        {onOpen && (
          <button className="w-open" onClick={onOpen} aria-label={`Open ${title}`}>
            <Icon name="chevron-right" size={16} />
          </button>
        )}
      </div>
    </header>
  );
}
