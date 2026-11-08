import { useSyncExternalStore } from 'react';
import { dayDigest, digestForPrompt, localSummary } from '../store/digest';
import { actions, getState } from '../store/store';
import { notify } from '../os/notify';
import { activeProvider } from './config';
import { AiError, generate } from './generate';
import { fetchInspiration, inspirationForPrompt } from './inspiration';

/**
 * The pet's "today summary": one at a time, shown in a floating card (see SummaryCard).
 * With an AI provider configured it streams from the LLM; otherwise it writes an offline summary.
 */
export type SummaryStatus = 'thinking' | 'writing' | 'done' | 'error';

export interface SummaryState {
  open: boolean;
  day: string;
  status: SummaryStatus;
  text: string;
  source: 'ai' | 'local';
  model?: string;
  error?: { kind: AiError['kind']; message: string };
  auto?: boolean; // opened by the midnight trigger
  saved?: boolean;
}

let st: SummaryState = { open: false, day: '', status: 'done', text: '', source: 'local' };
const subs = new Set<() => void>();
let ctrl: AbortController | null = null;
const set = (p: Partial<SummaryState>) => {
  st = { ...st, ...p };
  subs.forEach((f) => f());
};

export const useSummary = () =>
  useSyncExternalStore(
    (f) => (subs.add(f), () => subs.delete(f)),
    () => st,
  );

/** The kinds of "✨ wander" association the pet can make. News needs web access. */
export const WANDER_KINDS: { id: string; zh: string; en: string; news?: boolean }[] = [
  { id: 'news', zh: '一条最近的新闻', en: 'a recent news story', news: true },
  { id: 'history', zh: '历史上的今天', en: 'something that happened on this day in history' },
  { id: 'quote', zh: '一句金句', en: 'a memorable quote' },
  { id: 'poem', zh: '一句诗词（古诗词、现代诗、外国诗都行）', en: 'a line of poetry (any era, any language, translated if needed)' },
  { id: 'romance', zh: '一个浪漫或有趣的联想', en: 'a romantic or playful association' },
  { id: 'cheer', zh: '一句加油打气', en: 'a bit of cheering on' },
  { id: 'wisdom', zh: '一点人生哲理', en: 'a small piece of life wisdom' },
];

/** Two kinds to lean towards this time, so each summary (and each "Regenerate") feels different. */
export function pickAngles(news: boolean, rnd: () => number = Math.random) {
  const pool = WANDER_KINDS.filter((k) => news || !k.news);
  const a = pool.splice(Math.floor(rnd() * pool.length), 1)[0];
  const b = pool[Math.floor(rnd() * pool.length)];
  return [a.id, b.id];
}

export interface PromptOpts {
  /** News is available: the provider can search, or the browser fetched some. */
  news: boolean;
  /** The provider will search the web itself. */
  search: boolean;
  /** Wikipedia material is included in the user message. */
  material: boolean;
  angles: string[];
}

export function systemPrompt(lang: 'zh' | 'en', petName: string, o: PromptOpts) {
  const kinds = WANDER_KINDS.filter((k) => o.news || !k.news);
  const name = (id: string) => WANDER_KINDS.find((k) => k.id === id)?.[lang] ?? id;
  if (lang === 'zh')
    return `你是「${petName}」，住在用户的 LifeOS 桌面上的一只可爱、温暖、有点俏皮的小宠物。现在请根据用户今天的数据，替 TA 写一份「今日总结」。

要求：
- 用中文，总长度不超过 300 个汉字。
- 第一行：一个简短有趣的标题，带一个 emoji。
- 接着 2–3 行，每行以「• 」开头：① 今天做成了什么（用具体数字：任务、专注时长、入账、XP）；② 身体和心情；③ 计划 / 目标 / 倒计时的进展。没有数据的就跳过。
- 然后一行以「✨ 」开头的「发散联想」，1–2 句：从 TA 今天做的某件具体的事出发，自由地联想开去。可以是：${kinds.map((k) => k.zh).join('、')}。这次优先试试「${name(o.angles[0])}」或「${name(o.angles[1])}」，不合适就换别的。要巧妙、有画面感，别生硬说教。
- 最后一行：一句给明天的、具体而温暖的鼓励。
- 关于 TA 的今天，只能用提供的事实，绝不编造数字或事件。
- 联想里的新闻和历史，只能来自${o.material ? '提供的灵感素材、' : ''}${o.search ? '你的搜索结果、' : ''}或你确定为真的知识；诗词和金句必须原文准确、出处真实，没有把握就不要标作者，或者干脆用你自己的话。
- 不要 Markdown 标题、不要加粗、不要客套开场白。直接输出总结正文。${o.search ? '\n- 如果要搜索（比如找一条最近的新闻），请先搜索，再一次性写出总结。' : ''}`;
  return `You are "${petName}", a cute, warm, slightly playful pet living on the user's LifeOS desktop. Write today's summary for them from the facts below.

Rules:
- English, at most 170 words.
- Line 1: a short, fun title with one emoji.
- Then 2–3 lines, each starting with "• ": (1) what got done, with concrete numbers (quests, focus time, money earned, XP); (2) body and mood; (3) progress on plans / goals / countdowns. Skip anything with no data.
- Then one line starting with "✨ ": a free association in 1–2 sentences, starting from something specific they did today and wandering off from it. It can be ${kinds.map((k) => k.en).join('; ')}. This time, lean towards ${name(o.angles[0])} or ${name(o.angles[1])}, or pick another if those don't fit. Make it clever and vivid, never preachy.
- Last line: one specific, warm nudge for tomorrow.
- About their day, use only the facts given; never invent numbers or events.
- News and history in the association must come from ${o.material ? 'the inspiration material, ' : ''}${o.search ? 'your search results, ' : ''}or things you are sure are true. Quote poems and sayings exactly and attribute them correctly; if unsure, leave out the attribution or use your own words.
- No markdown headings, no bold, no preamble. Output the summary text only.${o.search ? '\n- If you search (for a recent news story, say), search first, then write the summary in one go.' : ''}`;
}

/** Typewriter effect for the offline summary so both paths feel the same. */
async function typeOut(text: string, signal: AbortSignal) {
  const chars = [...text];
  for (let i = 0; i <= chars.length; i += 3) {
    if (signal.aborted) return;
    set({ text: chars.slice(0, i).join(''), status: 'writing' });
    await new Promise((r) => setTimeout(r, 14));
  }
  set({ text });
}

export async function openSummary(day: string, opts: { auto?: boolean } = {}) {
  ctrl?.abort();
  const c = (ctrl = new AbortController());
  const s = getState();
  const lang = s.profile.lang;
  const prov = activeProvider();
  set({ open: true, day, status: 'thinking', text: '', source: prov ? 'ai' : 'local', model: prov?.model, error: undefined, auto: opts.auto, saved: false });
  window.dispatchEvent(new CustomEvent('lifeos:pet-think', { detail: { on: true } }));
  const digest = dayDigest(s, day, lang);
  try {
    if (prov) {
      const ins = prov.web ? await fetchInspiration(day) : null;
      if (c.signal.aborted) return;
      const search = !!prov.search;
      const user =
        (lang === 'zh' ? '这是今天的数据：\n' : "Here is today's data:\n") + digestForPrompt(digest, lang) + (ins ? '\n\n' + inspirationForPrompt(ins, day, lang) : '');
      const news = search || !!ins?.news.length;
      const text = await generate({
        provider: prov,
        system: systemPrompt(lang, s.pet.name, { news, search, material: !!ins, angles: pickAngles(news) }),
        user,
        signal: c.signal,
        onText: (t) => set({ text: t, status: 'writing' }),
      });
      if (c.signal.aborted) return;
      set({ text, status: 'done' });
    } else {
      await new Promise((r) => setTimeout(r, 900)); // a beat of "thinking"
      await typeOut(localSummary(digest, lang), c.signal);
      if (!c.signal.aborted) set({ status: 'done' });
    }
    actions.bump(prov ? 'aiSummaries' : 'localSummaries');
  } catch (e) {
    if ((e as Error).name === 'AbortError' || c.signal.aborted) return;
    const err = e instanceof AiError ? { kind: e.kind, message: e.message } : { kind: 'other' as const, message: String((e as Error).message ?? e) };
    // Fall back to the offline summary so there is always something to keep.
    set({ status: 'error', error: err, text: localSummary(digest, lang), source: 'local' });
  } finally {
    if (ctrl === c) window.dispatchEvent(new CustomEvent('lifeos:pet-think', { detail: { on: false } }));
  }
}

export const editSummary = (text: string) => set({ text, saved: false });

export function saveSummary() {
  if (!st.text.trim()) return;
  actions.saveReview(st.day, { ai: st.text.trim() });
  set({ saved: true });
  const zh = getState().profile.lang === 'zh';
  notify({ title: zh ? '已存入每日复盘' : 'Saved to your daily review', body: st.day, tone: 'accent' });
}

export function closeSummary() {
  ctrl?.abort();
  set({ open: false });
  window.dispatchEvent(new CustomEvent('lifeos:pet-think', { detail: { on: false } }));
}
