import { openDay } from './DayXp';
import { dayKey } from '../lib/date';
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { num } from '../lib/format';
import { useL, useLang } from '../lib/i18n';
import { PetAvatar } from '../pet/sprites';
import { ACHIEVEMENTS, CATS, SERIES, TIER_LABEL, TOTAL_POINTS, achContext, type AchCat, type Achievement } from '../store/achievements';
import { useAttrs } from '../store/attrs';
import { useMetrics } from '../store/hooks';
import { ACCESSORIES, ERAS, UNLOCKS, WALLPAPERS, availableTitles, eraOf, nextUnlock, titleName } from '../store/progression';
import { attrLevel, xpForLevel } from '../store/rules';
import { actions, useStore } from '../store/store';
import { Icon } from '../ui/Icon';
import { Bar, Card, Ring, Segmented } from '../ui/kit';

type Tab = 'road' | 'hall' | 'style';

const HINTS: Record<string, [string, string]> = {
  'sec-night': ['和深夜有关', 'Something about late nights'],
  'sec-early': ['和清晨有关', 'Something about early mornings'],
  'sec-weekend': ['和周末有关', 'Something about weekends'],
  'sec-undo': ['人总会改变主意', 'Everyone changes their mind'],
  'sec-past': ['过去的事也能补上', 'The past can be caught up on'],
  'sec-marathon': ['真的非常非常专注', 'Really, really focused'],
  'sec-allin': ['完美的一天，各方面都是', 'A perfect day, in every way'],
};

export function Trophies() {
  const L = useL();
  const [tab, setTab] = useState<Tab>(() => (sessionStorage.getItem('lifeos:trophy-tab') as Tab) || 'road');
  const go = (t: Tab) => {
    setTab(t);
    try {
      sessionStorage.setItem('lifeos:trophy-tab', t);
    } catch {
      /* ignore */
    }
  };
  const unlocked = useStore((s) => s.achievements);
  const count = ACHIEVEMENTS.filter((a) => unlocked[a.id]).length;
  return (
    <div className="app">
      <div className="app-head">
        <div>
          <h1>{L('成长', 'Growth')}</h1>
          <p className="muted">{L(`升级之路上的每一步都会解锁新东西。成就馆已收集 ${count} / ${ACHIEVEMENTS.length}。`, `Every step on the road unlocks something. ${count} of ${ACHIEVEMENTS.length} achievements collected.`)}</p>
        </div>
      </div>
      <nav className="settings-tabs" role="tablist">
        {(
          [
            ['road', 'route', L('升级之路', 'The Road')],
            ['hall', 'trophy', L('成就馆', 'Trophy Hall')],
            ['style', 'sparkles', L('装扮', 'Style')],
          ] as [Tab, string, string][]
        ).map(([id, icon, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? 'is-on' : ''} onClick={() => go(id)}>
            <Icon name={icon} size={15} />
            {label}
          </button>
        ))}
      </nav>
      {tab === 'road' && <Road />}
      {tab === 'hall' && <Hall />}
      {tab === 'style' && <Style />}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* The road                                                           */
/* ------------------------------------------------------------------ */

function Road() {
  const L = useL();
  const lang = useLang();
  const m = useMetrics();
  const attrs = useAttrs();
  const pet = useStore((s) => s.pet);
  const equip = useStore((s) => s.equip);
  const lvl = m.level.level;
  const era = eraOf(lvl);
  const nu = nextUnlock(lvl);
  const track = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = track.current?.querySelector('.rd-node.is-here') as HTMLElement | null;
    if (el && track.current) track.current.scrollLeft = el.offsetLeft - track.current.clientWidth / 2;
  }, []);
  const MAX = 60;
  return (
    <>
      <div className="grid-1-2">
        <Card className="level-card">
          <Ring value={m.level.progress} size={150} stroke={14}>
            <span className="ring-num num xl">{lvl}</span>
            <span className="ring-cap">{L('等级', 'LEVEL')}</span>
          </Ring>
          <div className="level-text">
            <h2>
              <Icon name={era.icon} size={20} /> {lang === 'zh' ? era.zh : era.en}
            </h2>
            <p className="muted small">{lang === 'zh' ? era.blurbZh : era.blurbEn}</p>
            <p className="num">
              {num(m.xp)} XP · {L('距下一级', 'Next level in')} {num(m.level.span - m.level.into)}
            </p>
            {nu && (
              <p className="next-unlock">
                <Icon name={nu.icon} size={14} />
                {L(`Lv.${nu.level} 解锁「${nu.zh}」· 还差 ${num(xpForLevel(nu.level) - m.xp)} XP`, `Lv.${nu.level} unlocks “${nu.en}” · ${num(xpForLevel(nu.level) - m.xp)} XP to go`)}
              </p>
            )}
          </div>
        </Card>
        <Card title={L('属性', 'Attributes')} icon="sparkles">
          <div className="attr-grid">
            {attrs.list.map(({ id: a }) => {
              const xp = m.attrXp[a] ?? 0;
              const lv = attrLevel(xp);
              const lo = 40 * (lv - 1) ** 2;
              const hi = 40 * lv ** 2;
              return (
                <div className="attr-card" key={a} style={{ '--tone': `var(--c-${a})` } as CSSProperties}>
                  <span className="attr-ic">
                    <Icon name={attrs.icon(a)} size={18} />
                  </span>
                  <div className="attr-body">
                    <div className="attr-top">
                      <strong>{attrs.label(a)}</strong>
                      <span className="num">Lv.{lv}</span>
                    </div>
                    <Bar value={(xp - lo) / (hi - lo)} tone={a} height={7} />
                    <span className="muted small num">{num(xp)} XP</span>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      <Card title={L('升级之路', 'The road')} icon="route" action={<span className="muted small">{L('左右滑动', 'Scroll sideways')}</span>}>
        <div className="road" ref={track}>
          <div className="rd-track">
            {Array.from({ length: MAX }, (_, i) => i + 1).map((n) => {
              const ups = UNLOCKS.filter((u) => u.level === n);
              const er = ERAS.find((e) => e.level === n);
              return (
                <div key={n} className={`rd-node ${n <= lvl ? 'is-past' : ''} ${n === lvl ? 'is-here' : ''} ${er ? 'is-era' : ''}`}>
                  {er && (
                    <span className="rd-era">
                      <Icon name={er.icon} size={13} /> {lang === 'zh' ? er.zh : er.en}
                    </span>
                  )}
                  {ups.length > 0 && (
                    <span className="rd-unlocks">
                      {ups.map((u) => (
                        <span key={u.kind + u.id} className={`rd-u k-${u.kind} ${n <= lvl ? 'is-on' : ''}`} title={lang === 'zh' ? u.zh : u.en}>
                          <Icon name={u.icon} size={13} />
                        </span>
                      ))}
                    </span>
                  )}
                  {n === lvl && (
                    <span className="rd-pet">
                      <PetAvatar kind={pet.kind} size={52} mood="happy" acc={equip.acc} />
                    </span>
                  )}
                  <span className="rd-dot" />
                  <span className="rd-n num">{n}</span>
                </div>
              );
            })}
          </div>
        </div>
      </Card>

      <div className="era-grid">
        {ERAS.map((e, i) => {
          const end = ERAS[i + 1]?.level ?? 61;
          const ups = UNLOCKS.filter((u) => u.level >= e.level && u.level < end);
          const reached = lvl >= e.level;
          return (
            <article key={e.id} className={`era-card ${reached ? 'is-on' : ''} ${era.id === e.id ? 'is-now' : ''}`}>
              <div className="era-top">
                <span className="era-ic">
                  <Icon name={reached ? e.icon : 'lock'} size={18} />
                </span>
                <div>
                  <strong>{lang === 'zh' ? e.zh : e.en}</strong>
                  <span className="muted small num">Lv.{e.level}</span>
                </div>
              </div>
              <p className="muted small">{lang === 'zh' ? e.blurbZh : e.blurbEn}</p>
              {ups.length > 0 && (
                <ul>
                  {ups.map((u) => (
                    <li key={u.kind + u.id} className={lvl >= u.level ? 'is-on' : ''}>
                      <Icon name={lvl >= u.level ? u.icon : 'lock'} size={12} /> <span className="num">Lv.{u.level}</span> {lang === 'zh' ? u.zh : u.en}
                    </li>
                  ))}
                </ul>
              )}
            </article>
          );
        })}
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* The hall                                                           */
/* ------------------------------------------------------------------ */

function Hall() {
  const L = useL();
  const lang = useLang();
  const s = useStore((x) => x);
  const m = useMetrics();
  const ctx = useMemo(() => achContext(s, m), [s, m]);
  const [cat, setCat] = useState<AchCat | 'all'>('all');
  const [filter, setFilter] = useState<'all' | 'done' | 'todo'>('all');
  const has = (a: Achievement) => !!s.achievements[a.id];
  const points = ACHIEVEMENTS.filter(has).reduce((x, a) => x + a.points, 0);
  const total = ACHIEVEMENTS.length;
  const got = ACHIEVEMENTS.filter(has).length;
  const tiers = (['bronze', 'silver', 'gold', 'mythic'] as const).map((t) => [t, ACHIEVEMENTS.filter((a) => a.tier === t && has(a)).length, ACHIEVEMENTS.filter((a) => a.tier === t).length] as const);
  const near = ACHIEVEMENTS.filter((a) => !has(a) && !a.hidden && (a.stage === 0 || has(ACHIEVEMENTS.find((x) => x.series === a.series && x.stage === a.stage - 1)!)))
    .map((a) => ({ a, f: Math.min(0.99, a.value(ctx) / a.target) }))
    .filter((x) => x.f > 0)
    .sort((x, y) => y.f - x.f)
    .slice(0, 3);
  const T = (a: Achievement) => (lang === 'zh' ? a.zh : a.en);

  const series = SERIES.filter((x) => cat === 'all' || x.cat === cat)
    .map((sr) => {
      const stages = ACHIEVEMENTS.filter((a) => a.series === sr.key);
      const done = stages.filter(has);
      return { sr, stages, done, next: stages.find((a) => !has(a)), top: done[done.length - 1] };
    })
    .filter((x) => (filter === 'done' ? x.done.length > 0 : filter === 'todo' ? !!x.next : true));

  return (
    <>
      <div className="hall-head">
        <Card className="hall-score">
          <Ring value={got / total} size={110} stroke={11} tone="gold">
            <span className="ring-num num">{got}</span>
            <span className="ring-cap">/ {total}</span>
          </Ring>
          <div>
            <p className="muted small">{L('成就点', 'Achievement points')}</p>
            <strong className="num big-num">{num(points)}</strong>
            <span className="muted small num"> / {num(TOTAL_POINTS)}</span>
            <div className="tier-row">
              {tiers.map(([t, a, b]) => (
                <span key={t} className={`tier-chip tier-${t}`}>
                  <i />
                  {TIER_LABEL[t][lang === 'zh' ? 0 : 1]} <b className="num">{a}</b>/{b}
                </span>
              ))}
            </div>
          </div>
        </Card>
        <Card title={L('快要达成', 'Almost there')} icon="target">
          {near.length === 0 ? (
            <p className="muted small">{L('多用几天，这里会出现下一步最近的成就。', 'Use LifeOS for a few days and your nearest achievements show up here.')}</p>
          ) : (
            <ul className="near-list">
              {near.map(({ a, f }) => (
                <li key={a.id}>
                  <span className={`mini-medal tier-${a.tier}`}>
                    <Icon name={a.icon} size={14} />
                  </span>
                  <div>
                    <strong>{T(a)[0]}</strong>
                    <span className="muted small">{T(a)[1]}</span>
                    <Bar value={f} tone="gold" height={5} />
                  </div>
                  <span className="num small">{Math.round(f * 100)}%</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="proj-filters">
        <button className={`chip chip-btn ${cat === 'all' ? 'is-active' : ''}`} onClick={() => setCat('all')}>
          {L('全部', 'All')}
        </button>
        {CATS.map((c) => {
          const all = ACHIEVEMENTS.filter((a) => a.cat === c.id);
          return (
            <button key={c.id} className={`chip chip-btn ${cat === c.id ? 'is-active' : ''}`} onClick={() => setCat(c.id)}>
              <Icon name={c.icon} size={13} /> {lang === 'zh' ? c.zh : c.en}{' '}
              <span className="num muted">
                {all.filter(has).length}/{all.length}
              </span>
            </button>
          );
        })}
        <span className="spacer" />
        <Segmented
          size="sm"
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: L('全部', 'All') },
            { value: 'done', label: L('已获得', 'Earned') },
            { value: 'todo', label: L('未完成', 'To do') },
          ]}
        />
      </div>

      <div className="medal-grid">
        {series.map(({ sr, stages, done, next, top }) => {
          const secret = sr.hidden && done.length === 0;
          const show = top ?? stages[0];
          const v = next ? Math.min(next.target, next.value(ctx)) : show.target;
          const tierCls = top ? `tier-${top.tier} is-on` : '';
          return (
            <article key={sr.key} className={`medal-card ${tierCls} ${secret ? 'is-secret' : ''}`}>
              <div className="medal">
                <span className="medal-face">
                  <Icon name={secret ? 'lock' : top ? sr.icon : sr.icon} size={26} stroke={2.2} />
                </span>
              </div>
              <strong>{secret ? '???' : top ? T(top)[0] : T(stages[0])[0]}</strong>
              <span className="muted small">{secret ? (lang === 'zh' ? HINTS[sr.key]?.[0] : HINTS[sr.key]?.[1]) ?? L('隐藏成就', 'Secret') : next ? T(next)[1] : T(show)[1]}</span>
              {stages.length > 1 && !secret && (
                <span className="pips">
                  {stages.map((a) => (
                    <i key={a.id} className={`tier-${a.tier} ${has(a) ? 'on' : ''}`} title={`${T(a)[0]} · ${T(a)[1]}`} />
                  ))}
                </span>
              )}
              {next && !secret ? (
                <div className="medal-progress">
                  <Bar value={v / next.target} tone="gold" height={6} />
                  <span className="muted small num">
                    {num(v, v % 1 ? 1 : 0)} / {num(next.target)}
                    {next.title && ` · ${L('奖励称号', 'grants a title')}`}
                  </span>
                </div>
              ) : !secret && top ? (
                <button className="medal-date small link-btn" onClick={() => openDay(dayKey(s.achievements[top.id]))} title={L('看那一天', 'Open that day')}>
                  {TIER_LABEL[top.tier][lang === 'zh' ? 0 : 1]} · {new Date(s.achievements[top.id]).toLocaleDateString()}
                </button>
              ) : null}
            </article>
          );
        })}
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Style: titles, wallpapers, pet accessories, planet                 */
/* ------------------------------------------------------------------ */

function Style() {
  const L = useL();
  const lang = useLang();
  const m = useMetrics();
  const s = useStore((x) => x);
  const lvl = m.level.level;
  const titles = availableTitles(lvl, s.achievements, lang);
  const current = titleName(s.equip.title, lvl, lang);
  const lockedTitles = ACHIEVEMENTS.filter((a) => a.title && !s.achievements[a.id]);
  return (
    <div className="grid-1-1">
      <Card title={L('称号', 'Title')} icon="crown" action={<span className="muted small">{L(`当前：${current}`, `Wearing: ${current}`)}</span>}>
        <p className="muted small">{L('称号会显示在桌面上你的等级旁边。每个时代一个，部分成就系列的最高阶也会奖励称号。', 'Shown next to your level on the desktop. One per era, plus the top stage of some achievement series.')}</p>
        <div className="title-grid">
          {titles.map((t) => (
            <button key={t.id} className={`title-chip ${(s.equip.title ?? `era:${eraOf(lvl).id}`) === t.id ? 'is-on' : ''} src-${t.source}`} onClick={() => actions.equip({ title: t.id })}>
              <Icon name={t.source === 'era' ? 'route' : 'trophy'} size={13} /> {t.name}
            </button>
          ))}
          {lockedTitles.slice(0, 8).map((a) => (
            <span key={a.id} className="title-chip is-locked" title={(lang === 'zh' ? a.zh : a.en)[1]}>
              <Icon name="lock" size={12} /> {(lang === 'zh' ? a.zh : a.en)[0]}
            </span>
          ))}
        </div>
      </Card>

      <Card title={L('宠物配饰', 'Pet accessories')} icon="paw">
        <div className="acc-grid">
          {ACCESSORIES.map((a) => {
            const ok = lvl >= a.level;
            const on = (s.equip.acc ?? 'none') === a.id;
            return (
              <button key={a.id} className={`acc-card ${on ? 'is-on' : ''} ${ok ? '' : 'is-locked'}`} disabled={!ok} onClick={() => actions.equip({ acc: a.id })}>
                <PetAvatar kind={s.pet.kind} size={64} mood={on ? 'happy' : 'idle'} acc={ok ? a.id : 'none'} />
                <span>{lang === 'zh' ? a.zh : a.en}</span>
                {!ok && <span className="muted small num">Lv.{a.level}</span>}
              </button>
            );
          })}
        </div>
      </Card>

      <Card title={L('桌面壁纸', 'Wallpapers')} icon="palette">
        <div className="wall-grid">
          {WALLPAPERS.map((w) => {
            const ok = lvl >= w.level;
            const on = (s.equip.wall ?? 'default') === w.id;
            return (
              <button key={w.id} className={`wall-card ${on ? 'is-on' : ''} ${ok ? '' : 'is-locked'}`} disabled={!ok} onClick={() => actions.equip({ wall: w.id })}>
                <span className={`wall-prev os`} data-wall={w.id === 'default' ? undefined : w.id}>
                  <i className="w1" />
                  <i className="w2" />
                  <i className="w3" />
                  {!ok && <Icon name="lock" size={16} />}
                </span>
                <span>{lang === 'zh' ? w.zh : w.en}</span>
                {!ok && <span className="muted small num">Lv.{w.level}</span>}
              </button>
            );
          })}
        </div>
      </Card>

      <Card title={L('星球进化', 'Planet evolution')} icon="orbit">
        <p className="muted small">{L('升级时自动出现在桌面的人生星球上。', 'Appears on your Life Planet automatically as you level up.')}</p>
        <ul className="planet-unlocks">
          {UNLOCKS.filter((u) => u.kind === 'planet').map((u) => (
            <li key={u.id} className={lvl >= u.level ? 'is-on' : ''}>
              <span className="lu-ic k-planet">
                <Icon name={lvl >= u.level ? u.icon : 'lock'} size={16} />
              </span>
              <span>{lang === 'zh' ? u.zh.split(' · ')[1] : u.en.split(' · ')[1]}</span>
              <span className="muted small num">Lv.{u.level}</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
