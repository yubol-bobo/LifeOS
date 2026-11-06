import { useMemo, useState } from 'react';
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

/** One day's XP diary: a cute 3D block chart and the full log, with day-to-day navigation. */
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
          <b className="num">{list.length}</b>
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

      {list.length > 0 && (
        <ol className="dx-log">
          {list.map((e) => {
            const k = KINDS[e.kind] ?? { zh: e.kind, en: e.kind, icon: 'sparkles', color: 'slate' };
            const focus = hov && (by === 'kind' ? e.kind === hov : (e.attr ?? 'none') === hov);
            return (
              <li key={e.id} className={`${focus ? 'is-focus' : ''} ${hov && !focus ? 'is-dim' : ''}`}>
                <span className="dx-time num">{time(e.ts)}</span>
                <span className="dx-ic" style={{ color: `var(--p-${k.color})`, background: `color-mix(in oklab, var(--p-${k.color}) 14%, transparent)` }}>
                  <Icon name={k.icon} size={14} />
                </span>
                <span className="dx-label">{e.label}</span>
                {e.attr && attrs.list.some((a) => a.id === e.attr) && <span className="dx-attr muted small">{attrs.label(e.attr)}</span>}
                <span className={`dx-xp num ${e.xp > 0 ? '' : 'is-zero'}`}>{e.xp > 0 ? `+${e.xp} XP` : e.coins < 0 ? `${e.coins} 🪙` : '—'}</span>
              </li>
            );
          })}
        </ol>
      )}
    </Modal>
  );
}
