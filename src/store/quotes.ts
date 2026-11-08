/**
 * A small, hand-checked set of lines for the offline day summary's "✨" line (no AI key needed).
 * Every quote here is well known and attributed to its real source.
 */
export const QUOTES: { zh: string[]; en: string[] } = {
  zh: [
    '「千里之行，始于足下。」——《道德经》',
    '「不积跬步，无以至千里。」——《荀子·劝学》',
    '「路漫漫其修远兮，吾将上下而求索。」——屈原《离骚》',
    '「长风破浪会有时，直挂云帆济沧海。」——李白《行路难》',
    '「莫听穿林打叶声，何妨吟啸且徐行。」——苏轼《定风波》',
    '「人生如逆旅，我亦是行人。」——苏轼《临江仙·送钱穆父》',
    '「山重水复疑无路，柳暗花明又一村。」——陆游《游山西村》',
    '「纸上得来终觉浅，绝知此事要躬行。」——陆游《冬夜读书示子聿》',
    '「采菊东篱下，悠然见南山。」——陶渊明《饮酒》',
    '「行到水穷处，坐看云起时。」——王维《终南别业》',
  ],
  en: [
    '“How we spend our days is, of course, how we spend our lives.” — Annie Dillard, The Writing Life',
    '“The journey of a thousand miles begins with a single step.” — Laozi, Tao Te Ching',
    '“Hope is the thing with feathers.” — Emily Dickinson',
    '“Not all those who wander are lost.” — J.R.R. Tolkien',
    '“The best way out is always through.” — Robert Frost',
    '“Tell me, what is it you plan to do / with your one wild and precious life?” — Mary Oliver, The Summer Day',
    '“What’s past is prologue.” — Shakespeare, The Tempest',
    '“A thing of beauty is a joy for ever.” — John Keats, Endymion',
    '“After all, tomorrow is another day.” — Margaret Mitchell, Gone with the Wind',
    '“Waste no more time arguing what a good man should be. Be one.” — Marcus Aurelius, Meditations',
  ],
};

/** The same line all day, a different one tomorrow. */
export function quoteFor(day: string, lang: 'zh' | 'en') {
  const list = QUOTES[lang];
  let h = 0;
  for (const ch of day) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return list[h % list.length];
}
