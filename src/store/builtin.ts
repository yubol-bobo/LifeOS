/**
 * Built-in text (demo data, the starter kit, ledger labels) follows the language switch.
 *
 * Built-in strings are registered as zh/en pairs. When state is localized, any text field whose
 * value is one of the two variants is rewritten to the current language and the pair is remembered
 * on the object (`i18n`), so it keeps switching even after a reload or a sync. Anything the user
 * typed or edited matches neither variant and is never touched.
 */
import type { Lang } from './types';

type Pair = [zh: string, en: string];
type Obj = Record<string, unknown> & { i18n?: Record<string, Pair> };

const PAIRS = new Map<string, Pair>();

/** Register a pair (both spellings map to it). */
export function bi(zh: string, en: string): Pair {
  const p: Pair = [zh, en];
  if (zh !== en) {
    if (!PAIRS.has(zh)) PAIRS.set(zh, p);
    if (!PAIRS.has(en)) PAIRS.set(en, p);
  }
  return p;
}

export const pairOf = (text: string) => PAIRS.get(text);

/** Text fields that can hold built-in wording. */
const FIELDS = ['title', 'name', 'note', 'label', 'unit', 'venue'];

function localizeObj(o: Obj, lang: Lang, fields = FIELDS): boolean {
  let changed = false;
  // Older achievement entries were written as "🏆 中文 / English" — split them into a pair.
  if (typeof o.label === 'string' && !o.i18n?.label) {
    const m = /^🏆 (.+?) \/ (.+)$/.exec(o.label);
    if (m) {
      o.i18n = { ...o.i18n, label: [`🏆 ${m[1]}`, `🏆 ${m[2]}`] };
      o.label = `🏆 ${m[2]}`; // any variant; the loop below picks the right one
      changed = true;
    }
  }
  for (const f of fields) {
    const v = o[f];
    if (typeof v !== 'string' || !v) continue;
    const pair = o.i18n?.[f] ?? PAIRS.get(v);
    if (!pair || (v !== pair[0] && v !== pair[1])) continue; // user-edited → leave it alone
    const next = lang === 'zh' ? pair[0] : pair[1];
    if (!o.i18n?.[f]) o.i18n = { ...o.i18n, [f]: pair };
    if (v !== next) {
      o[f] = next;
      changed = true;
    }
  }
  // nested lists such as goal steps and key results
  for (const v of Object.values(o)) if (Array.isArray(v)) for (const x of v) if (x && typeof x === 'object' && !Array.isArray(x)) changed = localizeObj(x as Obj, lang) || changed;
  return changed;
}

const COLLECTIONS = ['quests', 'milestones', 'papers', 'trackers', 'rewards', 'projects', 'plans', 'countdowns', 'accounts', 'sessions', 'events'];

/** Rewrite built-in text in `s` to `lang`. Returns whether anything changed. */
export function localizeState(s: Record<string, unknown>, lang: Lang) {
  let changed = false;
  for (const c of COLLECTIONS) {
    const list = s[c];
    if (Array.isArray(list)) for (const x of list) if (x && typeof x === 'object') changed = localizeObj(x as Obj, lang) || changed;
  }
  // demo reviews
  const reviews = s.reviews as Record<string, Obj> | undefined;
  for (const r of Object.values(reviews ?? {})) changed = localizeObj(r, lang, ['win', 'lesson', 'friction', 'grateful', 'deep', 'tomorrow', 'ai']) || changed;
  // The pet's default name follows the language too (a custom name stays).
  const pet = s.pet as { name?: string; kind?: string } | undefined;
  const names: Record<string, Pair> = { mochi: ['团子', 'Mochi'], bolt: ['小电', 'Bolt'], nova: ['星灵', 'Nova'] };
  const pn = pet && names[pet.kind ?? ''];
  if (pet && pn && (pet.name === pn[0] || pet.name === pn[1])) {
    const next = lang === 'zh' ? pn[0] : pn[1];
    if (pet.name !== next) {
      pet.name = next;
      changed = true;
    }
  }
  return changed;
}

/* ---- starter kit (used by onboarding; registered here so old saves can be recognized) ---- */
export const STARTER = {
  goal: bi('坚持 30 天', 'My first 30 days'),
  goalNote: bi('每完成一个下面的习惯，这个目标都会自动前进。', 'Every habit below moves this goal forward automatically.'),
  quests: [
    [bi('专注工作 2 小时', 'Two hours of deep work'), 'craft'],
    [bi('阅读 30 分钟', 'Read for 30 minutes'), 'mind'],
    [bi('运动一下', 'Move your body'), 'body'],
    [bi('写三行日记', 'Write three lines of journal'), 'spirit'],
  ] as [Pair, string][],
  rewards: [
    [bi('一杯好咖啡', 'A really good coffee'), 60, 'coffee'],
    [bi('看一部电影', 'Movie night'), 250, 'film'],
  ] as [Pair, number, string][],
};

let dictionary: Promise<void> | null = null;
/** Build the full dictionary once: generating the demo registers every demo pair as a side effect. */
export function loadDictionary() {
  return (dictionary ??= import('./demo').then((m) => void m.demoState({ lang: 'en' })));
}
