import { dayKey } from '../lib/date';
import { getState } from '../store/store';
import { notify } from './notify';
import { openRitual, todayOpen } from './Ritual';

const KEY = 'lifeos:ritual-offered'; // per device: "2026-11-28:morning,2026-11-28:evening"

/**
 * Offer the morning plan (first open between 5:00 and 12:00, if today isn't planned yet) and the
 * evening wrap-up (after 19:00, if not closed yet) — each at most once a day on this device.
 */
export function offerRitual(now = new Date()) {
  const s = getState();
  if (!s.onboarded || s.profile.rituals === false) return;
  const day = dayKey(now.getTime());
  const h = now.getHours();
  const plan = s.dayPlans?.[day];
  const kind = h >= 5 && h < 12 && !plan?.planned ? 'morning' : h >= 19 && !plan?.closed ? 'evening' : null;
  if (!kind) return;
  let seen = '';
  try {
    seen = localStorage.getItem(KEY) ?? '';
  } catch {
    /* blocked */
  }
  const tag = `${day}:${kind}`;
  if (seen.split(',').includes(tag)) return;
  try {
    localStorage.setItem(KEY, [...seen.split(',').filter((x) => x.startsWith(day)), tag].join(','));
  } catch {
    /* blocked */
  }
  const zh = s.profile.lang === 'zh';
  const left = todayOpen(s, day).todos.length;
  notify(
    kind === 'morning'
      ? { title: zh ? '早上好，花一分钟规划今天？' : 'Morning! A minute to plan today?', body: zh ? '挑出今天最重要的 3 件事。点这里开始。' : 'Pick the 3 things that matter most. Click to start.', icon: 'sunrise', tone: 'info', onOpen: () => openRitual('morning') }
      : { title: zh ? '今天辛苦了，收个尾？' : 'Long day — wrap it up?', body: left ? (zh ? `还有 ${left} 件没做完，可以一键挪到明天。` : `${left} still open — move them to tomorrow in one click.`) : zh ? '回看一下今天做成的事。' : 'Look back at what you got done.', icon: 'moon-star', tone: 'info', onOpen: () => openRitual('evening') },
    20_000,
  );
}
