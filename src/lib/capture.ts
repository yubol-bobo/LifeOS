/**
 * Quick capture: turn one typed line into a to-do.
 *
 *   "约导师开会 明天 #毕业论文 !"   → "约导师开会", tomorrow, project 毕业论文, hard
 *   "call mom fri"                  → "call mom", next Friday
 *
 * Understood anywhere in the line (as separate words):
 *   - a day: 今天 / 明天 / 后天 / 大后天 / 周一…周日 (星期一…, 下周一…), today / tomorrow / tmr / mon…sun (next mon…)
 *     or a date: 12-03 / 12/3 / 2026-12-03
 *   - #project: the first project whose name starts with (or contains) what follows #
 *   - ! = hard, !! = hard too; ~ = easy
 * Anything else is the title.
 */
import { addDays, dayKey, parseDay } from './date';

export interface Capture {
  title: string;
  day?: string; // only when later than today
  projectId?: string;
  difficulty?: 'easy' | 'normal' | 'hard';
}

const ZH_WD = ['一', '二', '三', '四', '五', '六', '日', '天'];
const EN_WD = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];


/** The next date (after today) that falls on weekday w (0 = Mon); "next week" adds a week past this week's. */
function nextWeekday(today: string, w: number, nextWeek: boolean) {
  const cur = (parseDay(today).getDay() + 6) % 7;
  let ahead = (w - cur + 7) % 7 || 7;
  if (nextWeek) ahead = 7 - cur + w; // that weekday in the following Mon–Sun week
  return addDays(today, ahead);
}

function dayWord(word: string, today: string, prev?: string): { day: string; usedPrev?: boolean } | null {
  const w = word.toLowerCase();
  const rel: Record<string, number> = { 今天: 0, 今日: 0, today: 0, 明天: 1, 明日: 1, tomorrow: 1, tmr: 1, tmrw: 1, 后天: 2, 大后天: 3 };
  if (w in rel) return { day: addDays(today, rel[w]) };
  const zh = /^(下)?(?:周|星期|礼拜)([一二三四五六日天])$/.exec(word);
  if (zh) return { day: nextWeekday(today, Math.min(6, ZH_WD.indexOf(zh[2])), !!zh[1]) };
  // full names, or 3-letter forms — except "sat" / "sun", which are ordinary words ("sun-dried tomatoes")
  const FULL = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  const en = FULL.indexOf(w) >= 0 ? FULL.indexOf(w) : w !== 'sat' && w !== 'sun' ? EN_WD.indexOf(w) : -1;
  if (en >= 0) return { day: nextWeekday(today, en, prev?.toLowerCase() === 'next'), usedPrev: prev?.toLowerCase() === 'next' };
  const full = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(word);
  if (full) return { day: dayKey(new Date(+full[1], +full[2] - 1, +full[3])) };
  const md = /^(\d{1,2})[-/.](\d{1,2})$/.exec(word);
  if (md) {
    const y = parseDay(today).getFullYear();
    let d = dayKey(new Date(y, +md[1] - 1, +md[2]));
    if (d < today) d = dayKey(new Date(y + 1, +md[1] - 1, +md[2])); // "1/5" in December means next January
    return { day: d };
  }
  return null;
}

export function parseCapture(text: string, projects: { id: string; name: string; status?: string }[], today = dayKey()): Capture {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const keep: string[] = [];
  const out: Capture = { title: '' };
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    if (w === '!' || w === '!!' || w === '！' || w === '！！') {
      out.difficulty = 'hard';
      continue;
    }
    if (w === '~' || w === '～') {
      out.difficulty = 'easy';
      continue;
    }
    if (/^[#＃].+/.test(w)) {
      const needle = w.slice(1).toLowerCase();
      const live = projects.filter((p) => p.status !== 'done');
      const hit = live.find((p) => p.name.toLowerCase().startsWith(needle)) ?? live.find((p) => p.name.toLowerCase().includes(needle)) ?? projects.find((p) => p.name.toLowerCase().includes(needle));
      if (hit) {
        out.projectId = hit.id;
        continue;
      }
    }
    if (!out.day) {
      const d = dayWord(w, today, keep.at(-1));
      if (d) {
        if (d.usedPrev) keep.pop();
        if (d.day > today) out.day = d.day;
        else if (d.day === today) out.day = undefined;
        else {
          keep.push(w); // a past date isn't a plan; keep it as text
          continue;
        }
        continue;
      }
    }
    keep.push(w);
  }
  out.title = keep.join(' ');
  return out;
}
