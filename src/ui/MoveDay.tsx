import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { addDays, dayKey, parseDay, startOfWeek } from '../lib/date';
import { useL, useLang } from '../lib/i18n';
import { notify } from '../os/notify';
import { actions } from '../store/store';
import type { Quest } from '../store/types';
import { Icon } from './Icon';

/** "12月3日 周四" / "Thu, Dec 3" */
export function dayLabel(day: string, lang: 'zh' | 'en') {
  const today = dayKey();
  if (day === today) return lang === 'zh' ? '今天' : 'today';
  if (day === addDays(today, 1)) return lang === 'zh' ? '明天' : 'tomorrow';
  return parseDay(day).toLocaleDateString(lang === 'zh' ? 'zh-CN' : 'en-US', { month: 'short', day: 'numeric', weekday: 'short' });
}

/**
 * A small "move to another day" button for a one-off to-do: tomorrow, the day after, next week, or
 * any date. The to-do leaves Today and comes back on that day.
 */
export function MoveDay({ q, compact = false }: { q: Quest; compact?: boolean }) {
  const L = useL();
  const lang = useLang();
  const btn = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const today = dayKey();
  const nextWeek = addDays(dayKey(startOfWeek()), 7);

  useEffect(() => {
    if (!pos) return;
    const close = (e: Event) => {
      if (menu.current?.contains(e.target as Node) || btn.current?.contains(e.target as Node)) return;
      setPos(null);
    };
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setPos(null);
    window.addEventListener('pointerdown', close, true);
    window.addEventListener('keydown', esc);
    window.addEventListener('resize', () => setPos(null), { once: true });
    return () => {
      window.removeEventListener('pointerdown', close, true);
      window.removeEventListener('keydown', esc);
    };
  }, [pos]);

  const move = (day: string) => {
    setPos(null);
    actions.moveQuest(q.id, day);
    notify({
      title: L(`已移到${dayLabel(day, 'zh')}`, `Moved to ${dayLabel(day, 'en')}`),
      body: day > today ? L('到那天会出现在今日任务里；在「任务」→「以后」里能看到和改回来。', 'It comes back on Today that day; see or change it under Quests → Later.') : q.title,
      icon: 'calendar',
      tone: 'info',
    });
  };
  const toggle = () => {
    if (pos) return setPos(null);
    const r = btn.current!.getBoundingClientRect();
    const w = 220;
    setPos({ x: Math.max(8, Math.min(window.innerWidth - w - 8, r.right - w)), y: r.bottom + 6 > window.innerHeight - 220 ? r.top - 6 - 200 : r.bottom + 6 });
  };
  const opts: [string, string][] = [
    [addDays(today, 1), L('明天', 'Tomorrow')],
    [addDays(today, 2), L('后天', 'In 2 days')],
    [nextWeek, L('下周', 'Next week')],
  ];

  return (
    <>
      <button
        ref={btn}
        type="button"
        className={`move-day ${compact ? 'is-compact' : ''} ${pos ? 'is-open' : ''}`}
        title={L('移到以后某一天', 'Move to a later day')}
        aria-label={L('移到以后某一天', 'Move to a later day')}
        aria-expanded={!!pos}
        onClick={toggle}
      >
        <Icon name="calendar" size={compact ? 13 : 14} />
        {!compact && <Icon name="chevron-right" size={11} />}
      </button>
      {pos &&
        createPortal(
          <div className="move-menu" ref={menu} role="menu" style={{ left: pos.x, top: pos.y }}>
            <p className="muted small">{L('移到哪天做？', 'Move to which day?')}</p>
            {opts.map(([d, label]) => (
              <button key={label} role="menuitem" onClick={() => move(d)}>
                <span>{label}</span>
                <small className="muted num">{dayLabel(d, lang)}</small>
              </button>
            ))}
            <label className="move-pick">
              <span>{L('选日期', 'Pick a date')}</span>
              <input className="input input-sm" type="date" min={addDays(today, 1)} defaultValue={q.day && q.day > today ? q.day : ''} onChange={(e) => e.target.value && e.target.value > today && move(e.target.value)} />
            </label>
            {q.day && q.day > today && (
              <button role="menuitem" onClick={() => move(today)}>
                <span>{L('移回今天', 'Back to today')}</span>
              </button>
            )}
          </div>,
          document.body,
        )}
    </>
  );
}
