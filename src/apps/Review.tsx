import { useEffect, useMemo, useRef, useState } from 'react';
import { openSummary, useSummary } from '../ai/summary';
import { addDays, dayKey, lastNDays, parseDay } from '../lib/date';
import { hours, money } from '../lib/format';
import { useL, useLang } from '../lib/i18n';
import { ACHIEVEMENTS } from '../store/achievements';
import { dayDigest } from '../store/digest';
import { bestReviewStreak, deepQuestion, hasReview, reviewFilled, reviewStreak, reviewWords, type ReviewField } from '../store/review';
import { actions, getState, useStore } from '../store/store';
import type { Review as ReviewT } from '../store/types';
import { Heatmap } from '../ui/charts';
import { Icon } from '../ui/Icon';
import { MoodFace } from '../ui/MoodFace';
import { Button, Card, Chip, Stat } from '../ui/kit';

type Prompt = { k: Exclude<ReviewField, 'ai'>; icon: string; zh: string; en: string; phZh: string; phEn: string };

const PROMPTS: Prompt[] = [
  { k: 'win', icon: 'star', zh: '今天的高光', en: 'Today’s win', phZh: '做成了什么？哪怕很小。', phEn: 'What went well — however small?' },
  { k: 'lesson', icon: 'brain', zh: '学到 / 发现', en: 'Learned or noticed', phZh: '一个新知识、一个关于自己的发现…', phEn: 'Something new, or something about yourself…' },
  { k: 'friction', icon: 'mountain', zh: '卡住的地方', en: 'What got in the way', phZh: '什么拖慢了你？下次可以怎么做？', phEn: 'What slowed you down? What would you try next time?' },
  { k: 'grateful', icon: 'heart', zh: '感恩', en: 'Grateful for', phZh: '一个人、一件事、一个瞬间。', phEn: 'A person, a thing, a moment.' },
];

/** Debounced textarea bound to one review field. */
function ReviewField({ day, field, value, placeholder, rows = 2 }: { day: string; field: ReviewField; value: string; placeholder: string; rows?: number }) {
  const [draft, setDraft] = useState(value);
  const t = useRef<number>(0);
  const pending = useRef<{ day: string; v: string } | null>(null);
  useEffect(() => setDraft(value), [value, day]);
  const save = (v: string, d = day) => {
    window.clearTimeout(t.current);
    pending.current = null;
    if (v !== (getState().reviews[d]?.[field] ?? '')) actions.saveReview(d, { [field]: v } as Partial<ReviewT>);
  };
  // Typing then closing the window (or switching day) within the debounce must not lose the text.
  useEffect(
    () => () => {
      if (pending.current) save(pending.current.v, pending.current.day);
    },
    [day], // eslint-disable-line react-hooks/exhaustive-deps
  );
  return (
    <textarea
      className="input rv-input"
      rows={rows}
      value={draft}
      placeholder={placeholder}
      onChange={(e) => {
        const v = e.target.value;
        setDraft(v);
        window.clearTimeout(t.current);
        pending.current = { day, v };
        t.current = window.setTimeout(() => save(v), 700);
      }}
      onBlur={(e) => save(e.target.value)}
    />
  );
}

/** Small reusable review heatmap (also used by the desktop widget). */
export function ReviewHeatmap({ weeks = 26, selected, onPick }: { weeks?: number; selected?: string; onPick?: (d: string) => void }) {
  const L = useL();
  const reviews = useStore((s) => s.reviews);
  const days = useMemo(() => lastNDays(weeks * 7), [weeks]);
  return (
    <Heatmap
      className="heat-review"
      days={days}
      weeks={weeks}
      max={4}
      selected={selected}
      onPick={onPick}
      value={(d) => Math.min(4, reviewFilled(reviews[d]))}
      label={(d, v) => (
        <>
          <span className="tip-k">{d}</span>
          <span className="tip-v">{v ? L(`写了 ${v} 项`, `${v} prompts answered`) : L('没有复盘', 'No review')}</span>
        </>
      )}
    />
  );
}

export function Review() {
  const L = useL();
  const lang = useLang();
  const s = useStore((x) => x);
  const today = dayKey();
  const [day, setDay] = useState(() => sessionStorage.getItem('lifeos:review-day') ?? today);
  useEffect(() => {
    sessionStorage.removeItem('lifeos:review-day');
  }, []);
  const r = s.reviews[day];
  const digest = useMemo(() => dayDigest(s, day, lang), [s, day, lang]);
  const summary = useSummary();
  const yesterday = s.reviews[addDays(day, -1)];
  const reviewedDays = Object.keys(s.reviews).filter((d) => hasReview(s, d));
  const streak = reviewStreak(s, today);
  const words = reviewedDays.reduce((a, d) => a + reviewWords(s.reviews[d]), 0);
  const thisMonth = reviewedDays.filter((d) => d.startsWith(today.slice(0, 7))).length;
  const nextAch = ACHIEVEMENTS.filter((a) => a.cat === 'review' && !s.achievements[a.id] && (a.series === 'reviews' || a.series === 'reviewstreak'))[0];
  const dateLabel = parseDay(day).toLocaleDateString(lang === 'zh' ? 'zh-CN' : 'en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const lookback = (
    [
      [7, L('一周前的今天', 'A week ago')],
      [30, L('一个月前', 'A month ago')],
      [365, L('一年前的今天', 'A year ago')],
    ] as [number, string][]
  )
    .map(([n, label]) => ({ d: addDays(day, -n), label }))
    .filter((x) => hasReview(s, x.d));
  const recent = reviewedDays.filter((d) => d !== day).sort().reverse().slice(0, 6);
  const firstLine = (x?: ReviewT) => (x?.win || x?.lesson || x?.deep || x?.grateful || x?.friction || x?.ai || '').split('\n')[0];
  const tomorrowQuest = r?.tomorrowQuest ? s.quests.find((q) => q.id === r.tomorrowQuest) : undefined;
  const yQuest = yesterday?.tomorrowQuest ? s.quests.find((q) => q.id === yesterday.tomorrowQuest) : undefined;
  const generating = summary.open && summary.day === day && (summary.status === 'thinking' || summary.status === 'writing');

  const go = (n: number) => {
    const d = addDays(day, n);
    if (d <= today) setDay(d);
  };

  return (
    <div className="app review-app">
      <div className="app-head">
        <div>
          <h1>{L('每日复盘', 'Daily Review')}</h1>
          <p className="muted">{L('不强求，一句话也算数。今天写下的每一行，都会在某个未来的日子变得珍贵。', 'No pressure — one line counts. Every line you write today becomes precious on some future day.')}</p>
        </div>
      </div>

      <div className="stats-row">
        <Stat label={L('连续复盘', 'Review streak')} value={L(`${streak} 天`, `${streak} d`)} sub={L(`最长 ${bestReviewStreak(s)} 天`, `best ${bestReviewStreak(s)}`)} tone="violet" />
        <Stat label={L('累计复盘', 'Days reviewed')} value={reviewedDays.length} sub={L(`本月 ${thisMonth} 天`, `${thisMonth} this month`)} />
        <Stat label={L('写下的字', 'Words written')} value={words.toLocaleString()} />
        <Stat
          label={L('下一个徽章', 'Next badge')}
          value={nextAch ? (lang === 'zh' ? nextAch.zh[0] : nextAch.en[0]) : '—'}
          sub={nextAch ? (lang === 'zh' ? nextAch.zh[1] : nextAch.en[1]) : L('全部解锁', 'All unlocked')}
          tone="gold"
        />
      </div>

      <Card title={L('复盘热力图', 'Reflection map')} icon="calendar" action={<span className="muted small">{L('颜色越深，写得越多 · 点一格回到那天', 'Darker = more written · click a day to open it')}</span>}>
        <ReviewHeatmap weeks={26} selected={day} onPick={(d) => d <= today && setDay(d)} />
        <div className="heat-legend heat-review">
          <span>{L('没写', 'None')}</span>
          {[0, 1, 2, 3, 4].map((l) => (
            <i key={l} className={`heat-cell l${l}`} />
          ))}
          <span>{L('写满', 'Full')}</span>
        </div>
      </Card>

      <div className="rv-daybar">
        <button className="icon-btn" onClick={() => go(-1)} aria-label={L('前一天', 'Previous day')}>
          <Icon name="chevron-left" size={18} />
        </button>
        <div className="rv-date">
          <strong>{dateLabel}</strong>
          {day === today ? <Chip tone="accent">{L('今天', 'Today')}</Chip> : <button className="link-btn" onClick={() => setDay(today)}>{L('回到今天', 'Back to today')}</button>}
          {hasReview(s, day) && <Chip tone="good" icon="check">{L('已复盘', 'Reviewed')}</Chip>}
        </div>
        <button className="icon-btn" onClick={() => go(1)} disabled={day >= today} aria-label={L('后一天', 'Next day')}>
          <Icon name="chevron-right" size={18} />
        </button>
      </div>

      {yesterday?.tomorrow && (
        <div className={`rv-promise ${yQuest?.doneAt ? 'is-done' : ''}`}>
          <Icon name={yQuest?.doneAt ? 'circle-check' : 'target'} size={18} />
          <span>
            {L('昨天你说今天最重要的是：', 'Yesterday you said today’s one thing was: ')}
            <b>{yesterday.tomorrow}</b>
          </span>
          {yQuest && (yQuest.doneAt ? <Chip tone="good">{L('做到了 ✓', 'Done ✓')}</Chip> : <Chip>{L('还在任务里', 'Still in quests')}</Chip>)}
        </div>
      )}

      <div className="rv-grid">
        <div className="rv-main">
          <Card title={L('写下今天', 'Write it down')} icon="notebook" action={<span className="muted small">{L('自动保存', 'Saves automatically')}</span>}>
            <div className="rv-prompts">
              {PROMPTS.map((p) => (
                <label key={p.k} className="rv-prompt">
                  <span className="rv-label">
                    <Icon name={p.icon} size={15} /> {L(p.zh, p.en)}
                  </span>
                  <ReviewField day={day} field={p.k} value={r?.[p.k] ?? ''} placeholder={L(p.phZh, p.phEn)} />
                </label>
              ))}
              <label className="rv-prompt rv-deep">
                <span className="rv-label">
                  <Icon name="telescope" size={15} /> {L('今日一问', 'Question of the day')}
                </span>
                <span className="rv-question">{deepQuestion(day, lang)}</span>
                <ReviewField day={day} field="deep" value={r?.deep ?? ''} placeholder={L('想到什么写什么。', 'Whatever comes to mind.')} />
              </label>
              <div className="rv-prompt rv-tomorrow">
                <span className="rv-label">
                  <Icon name="target" size={15} /> {L('明天最重要的一件事', 'Tomorrow’s one thing')}
                </span>
                <ReviewField day={day} field="tomorrow" value={r?.tomorrow ?? ''} placeholder={L('只写一件。', 'Just one.')} rows={1} />
                {r?.tomorrow &&
                  (tomorrowQuest ? (
                    <Chip tone="good" icon="check">
                      {L('已加入任务', 'Added to quests')}
                    </Chip>
                  ) : (
                    <Button
                      size="sm"
                      variant="soft"
                      icon="plus"
                      onClick={() => {
                        const id = actions.addQuest({ title: r.tomorrow!.trim(), attr: 'spirit', difficulty: 'normal', kind: 'once' });
                        if (id) actions.saveReview(day, { tomorrowQuest: id });
                      }}
                    >
                      {L('加入任务清单', 'Add to quests')}
                    </Button>
                  ))}
              </div>
            </div>
          </Card>

          <Card
            title={L(`${s.pet.name} 的今日总结`, `${s.pet.name}’s summary`)}
            icon="sparkles"
            action={
              <Button size="sm" variant={r?.ai ? 'soft' : 'primary'} icon="sparkles" onClick={() => void openSummary(day)} disabled={generating}>
                {generating ? L('正在写…', 'Writing…') : r?.ai ? L('重新生成', 'Regenerate') : L('让宠物帮我写', 'Ask my pet')}
              </Button>
            }
          >
            {r?.ai ? (
              <ReviewField day={day} field="ai" value={r.ai} placeholder="" rows={7} />
            ) : (
              <p className="muted small">{L('宠物会读取这一天的任务、专注、入账、心情、计划和倒计时，写一段简短有趣的总结。可以在设置里接入 AI（OpenAI / Claude / DeepSeek / Kimi / GLM），没接入时也会写一份离线版。', 'Your pet reads the day’s quests, focus, earnings, mood, plans and countdowns, and writes a short, fun summary. Connect an AI in Settings (OpenAI / Claude / DeepSeek / Kimi / GLM) — without one it writes an offline version.')}</p>
            )}
          </Card>
        </div>

        <div className="rv-side">
          <Card title={L('这一天的数据', 'The day in numbers')} icon="chart">
            <ul className="rv-facts">
              <li>
                <Icon name="list-checks" size={15} />
                <span>{L('完成任务', 'Quests done')}</span>
                <b className="num">{digest.questsDone.length}</b>
              </li>
              <li>
                <Icon name="timer" size={15} />
                <span>{L('专注', 'Focus')}</span>
                <b className="num">{L(`${hours(digest.focusMin * 60_000)} 小时`, `${hours(digest.focusMin * 60_000)} h`)}</b>
              </li>
              {digest.focusBy.slice(0, 4).map((f) => (
                <li key={f.label} className="rv-sub">
                  <span>{f.label}</span>
                  <b className="num">
                    {L(`${hours(f.min * 60_000)} 小时`, `${hours(f.min * 60_000)} h`)}
                    {!f.paid && <small className="muted"> · {L('不计薪', 'unpaid')}</small>}
                  </b>
                </li>
              ))}
              <li>
                <Icon name="coins" size={15} />
                <span>{L('入账', 'Earned')}</span>
                <b className="num">{money(digest.earned, s.profile.currency)}</b>
              </li>
              <li>
                <Icon name="zap" size={15} />
                <span>XP</span>
                <b className="num">+{digest.xp}</b>
              </li>
              <li>
                <Icon name="smile" size={15} />
                <span>{L('心情', 'Mood')}</span>
                <b>{digest.mood ? <MoodFace v={digest.mood.v as 1 | 2 | 3 | 4 | 5} size={22} /> : '—'}</b>
              </li>
              <li>
                <Icon name="droplets" size={15} />
                <span>{L('喝水 / 起身', 'Water / breaks')}</span>
                <b className="num">
                  {digest.water}/{digest.waterGoal} · {digest.breaks}
                </b>
              </li>
              {digest.achievements.length > 0 && (
                <li>
                  <Icon name="trophy" size={15} />
                  <span>{L('解锁成就', 'Unlocked')}</span>
                  <b>{digest.achievements.slice(0, 2).join('、')}</b>
                </li>
              )}
              {digest.countdowns[0] && (
                <li>
                  <Icon name="hourglass" size={15} />
                  <span>{digest.countdowns[0].title}</span>
                  <b className="num">{L(`${digest.countdowns[0].days} 天`, `${digest.countdowns[0].days} d`)}</b>
                </li>
              )}
            </ul>
            {digest.questsDone.length > 0 && <p className="rv-done muted small">✓ {digest.questsDone.slice(0, 6).join(' · ')}</p>}
          </Card>

          {lookback.length > 0 && (
            <Card title={L('回看', 'Look back')} icon="hourglass">
              <ul className="rv-list">
                {lookback.map((x) => (
                  <li key={x.d}>
                    <button onClick={() => setDay(x.d)}>
                      <span className="rv-list-k">{x.label}</span>
                      <span className="rv-list-v">{firstLine(s.reviews[x.d])}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card title={L('最近的复盘', 'Recent reviews')} icon="book-open">
            {recent.length ? (
              <ul className="rv-list">
                {recent.map((d) => (
                  <li key={d}>
                    <button onClick={() => setDay(d)}>
                      <span className="rv-list-k num">{d.slice(5)}</span>
                      <span className="rv-list-v">{firstLine(s.reviews[d])}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted small">{L('写下第一篇，这里会慢慢变成你的时间胶囊。', 'Write your first one — this slowly becomes your time capsule.')}</p>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
