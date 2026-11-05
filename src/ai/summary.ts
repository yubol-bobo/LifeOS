import { useSyncExternalStore } from 'react';
import { dayDigest, digestForPrompt, localSummary } from '../store/digest';
import { actions, getState } from '../store/store';
import { notify } from '../os/notify';
import { activeProvider } from './config';
import { AiError, generate } from './generate';

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

export function systemPrompt(lang: 'zh' | 'en', petName: string, web: boolean) {
  if (lang === 'zh')
    return `你是「${petName}」，住在用户的 LifeOS 桌面上的一只可爱、温暖、有点俏皮的小宠物。现在请根据用户今天的数据，替 TA 写一份「今日总结」。

要求：
- 用中文，总长度不超过 220 个汉字。
- 第一行：一个简短有趣的标题，带一个 emoji。
- 接着 3–4 行，每行以「• 」开头：① 今天做成了什么（用具体数字：任务、专注时长、入账、XP）；② 身体和心情；③ 计划 / 目标 / 倒计时的进展；④ 一个有趣的小彩蛋——「历史上的今天」里你确定为真的一件事、一个特别的日子，${web ? '或者用网络搜索找一条最近的新闻，和 TA 今天做的事情巧妙地联系起来' : '或者一句和 TA 今天做的事情有关的有趣思考'}。
- 最后一行：一句给明天的、具体而温暖的鼓励。
- 只能使用提供的事实，绝不编造数字或事件；没有的数据就跳过。不确定的历史事实不要写。
- 不要 Markdown 标题、不要加粗、不要客套开场白。直接输出总结正文。${web ? '\n- 如果要搜索，请先搜索，再一次性写出总结。' : ''}`;
  return `You are "${petName}", a cute, warm, slightly playful pet living on the user's LifeOS desktop. Write today's summary for them from the facts below.

Rules:
- English, at most 130 words.
- Line 1: a short, fun title with one emoji.
- Then 3–4 lines, each starting with "• ": (1) what got done, with concrete numbers (quests, focus time, money earned, XP); (2) body and mood; (3) progress on plans / goals / countdowns; (4) one fun extra — an "on this day in history" fact you are sure is true, a special day, ${web ? 'or one recent news item (use web search) cleverly tied to what they did today' : 'or a playful thought connected to what they did'}.
- Last line: one specific, warm nudge for tomorrow.
- Use only the facts given; never invent numbers or events; skip anything missing. Leave out history facts you're unsure of.
- No markdown headings, no bold, no preamble. Output the summary text only.${web ? '\n- If you search, search first, then write the summary in one go.' : ''}`;
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
      const user = (lang === 'zh' ? '这是今天的数据：\n' : "Here is today's data:\n") + digestForPrompt(digest, lang);
      const text = await generate({
        provider: prov,
        system: systemPrompt(lang, s.pet.name, prov.web),
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
