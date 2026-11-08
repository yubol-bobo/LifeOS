/**
 * Material for the summary's "✨ wander" line: a few recent news stories and "on this day" events,
 * fetched by the browser from Wikipedia's public feed. It works the same for every AI provider
 * (DeepSeek has no web search of its own) and costs nothing. Best effort: if Wikipedia can't be
 * reached (offline, blocked), the summary is written without it.
 */
export interface Inspiration {
  news: string[];
  onThisDay: { year: number; text: string }[];
}

const cache = new Map<string, Promise<Inspiration | null>>();

const plain = (html: string) => {
  try {
    return (new DOMParser().parseFromString(html, 'text/html').body.textContent ?? '').replace(/\s+/g, ' ').trim();
  } catch {
    return html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
  }
};

function pick<T>(xs: T[], n: number) {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, n);
}

async function load(day: string): Promise<Inspiration | null> {
  const [y, m, d] = day.split('-');
  const ctrl = new AbortController();
  const timer = window.setTimeout(() => ctrl.abort(), 6000);
  try {
    const res = await fetch(`https://en.wikipedia.org/api/rest_v1/feed/featured/${y}/${m}/${d}`, { signal: ctrl.signal });
    if (!res.ok) return null;
    const j = await res.json();
    const news = ((j.news ?? []) as { story?: string }[]).map((n) => plain(n.story ?? '')).filter(Boolean).slice(0, 4);
    const all = ((j.onthisday ?? []) as { year?: number; text?: string }[]).filter((e) => e.text && typeof e.year === 'number').map((e) => ({ year: e.year as number, text: e.text as string }));
    const onThisDay = pick(all, 6).sort((a, b) => a.year - b.year);
    return news.length || onThisDay.length ? { news, onThisDay } : null;
  } catch {
    return null;
  } finally {
    window.clearTimeout(timer);
  }
}

/** Fetch (once per day per page load) the inspiration material for a day. */
export function fetchInspiration(day: string): Promise<Inspiration | null> {
  let p = cache.get(day);
  if (!p) {
    p = load(day);
    cache.set(day, p);
    void p.then((r) => r || cache.delete(day)); // let a failed fetch be retried next time
  }
  return p;
}

/** The material as a block for the user message. */
export function inspirationForPrompt(ins: Inspiration, day: string, lang: 'zh' | 'en') {
  const zh = lang === 'zh';
  const [, m, d] = day.split('-').map(Number);
  const out: string[] = [];
  out.push(
    zh
      ? '灵感素材（浏览器刚从维基百科取到的英文原文，可选用，不必全用；用的话请用中文、用自己的话转述）：'
      : 'Inspiration material (just fetched from Wikipedia; optional, use at most one or two, in your own words):',
  );
  if (ins.news.length) {
    out.push(zh ? '【最近的新闻】' : '[Recent news]');
    ins.news.forEach((n) => out.push(`- ${n}`));
  }
  if (ins.onThisDay.length) {
    out.push(zh ? `【历史上的今天 · ${m} 月 ${d} 日】` : `[On this day · ${new Date(2000, m - 1, d).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}]`);
    ins.onThisDay.forEach((e) => out.push(`- ${e.year}: ${e.text}`));
  }
  return out.join('\n');
}
