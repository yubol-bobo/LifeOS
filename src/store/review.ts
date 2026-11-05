import { addDays, dayKey } from '../lib/date';
import type { Review, State } from './types';

/** The prompts a user writes into (the AI summary counts too, so saving it alone still marks the day). */
export const REVIEW_FIELDS = ['win', 'lesson', 'friction', 'grateful', 'deep', 'tomorrow', 'ai'] as const;
export type ReviewField = (typeof REVIEW_FIELDS)[number];

/** How many prompts have words in them. */
export const reviewFilled = (r?: Review) => (r ? REVIEW_FIELDS.filter((k) => (r[k] ?? '').trim()).length : 0);

export const reviewWords = (r?: Review) =>
  r ? REVIEW_FIELDS.reduce((a, k) => a + countWords(r[k] ?? ''), 0) : 0;

/** CJK characters count one each; other text counts by words. */
export function countWords(t: string) {
  const cjk = (t.match(/[㐀-鿿豈-﫿]/g) ?? []).length;
  const latin = t.replace(/[㐀-鿿豈-﫿]/g, ' ').split(/\s+/).filter(Boolean).length;
  return cjk + latin;
}

export const hasReview = (s: Pick<State, 'reviews'>, day: string) => reviewFilled(s.reviews?.[day]) > 0;

/** Consecutive reviewed days ending today (or yesterday, so the streak survives until tonight). */
export function reviewStreak(s: Pick<State, 'reviews'>, today = dayKey()) {
  let d = hasReview(s, today) ? today : addDays(today, -1);
  let n = 0;
  while (hasReview(s, d)) {
    n++;
    d = addDays(d, -1);
  }
  return n;
}

export function bestReviewStreak(s: Pick<State, 'reviews'>) {
  const days = Object.keys(s.reviews ?? {}).filter((d) => hasReview(s, d)).sort();
  let best = 0;
  let run = 0;
  let prev = '';
  for (const d of days) {
    run = prev && addDays(prev, 1) === d ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }
  return best;
}

/**
 * One reflective question a day, rotating by date — so the review never feels like the same form.
 * Kept short and concrete; each one is answerable in a sentence.
 */
export const DEEP_QUESTIONS: [string, string][] = [
  ['今天哪一刻你最像你自己？', 'When today did you feel most like yourself?'],
  ['如果今天重来一次，你会改变哪一件事？', 'If you could replay today, what one thing would you change?'],
  ['今天谁让你的日子变好了一点？', 'Who made your day a little better?'],
  ['今天有什么事情，比你预想的更容易？', 'What turned out easier than you expected?'],
  ['今天你在逃避什么？', 'What were you avoiding today?'],
  ['今天的你，会给一年后的你留一句什么话？', 'What would today-you tell you-a-year-from-now?'],
  ['今天花时间最多的事，值得吗？', 'Was the thing you spent the most time on worth it?'],
  ['今天有没有一个小小的勇敢时刻？', 'Was there a small moment of courage today?'],
  ['今天你学到的最反直觉的一件事是什么？', 'What was the most counter-intuitive thing you learned?'],
  ['今天的精力在什么时候最高，什么时候最低？', 'When was your energy highest today, and lowest?'],
  ['有什么事是你可以停止做的？', 'What is something you could stop doing?'],
  ['今天你对谁说了谢谢，或者应该说？', 'Who did you thank today — or should have?'],
  ['今天离你最重要的目标近了多少？', 'How much closer did today bring you to your biggest goal?'],
  ['今天有什么让你笑出来的瞬间？', 'What made you laugh today?'],
  ['你今天做的哪件事，十年后还会有意义？', 'What did you do today that will still matter in ten years?'],
  ['今天有什么事你做得比上次更好？', 'What did you do better than last time?'],
  ['今天你对自己足够温柔吗？', 'Were you kind enough to yourself today?'],
  ['今天的一个小发现是什么？', 'What was a small discovery today?'],
  ['如果明天只能做一件事，你会选什么？为什么？', 'If you could only do one thing tomorrow, what — and why?'],
  ['今天有什么担心，后来发现是多余的？', 'Which worry today turned out to be unnecessary?'],
  ['今天你最想记住的一句话或一个画面？', 'A sentence or an image from today you want to keep?'],
];

export function deepQuestion(day: string, lang: 'zh' | 'en') {
  const n = [...day].reduce((a, c) => a * 31 + c.charCodeAt(0), 7);
  const q = DEEP_QUESTIONS[Math.abs(n) % DEEP_QUESTIONS.length];
  return lang === 'zh' ? q[0] : q[1];
}
