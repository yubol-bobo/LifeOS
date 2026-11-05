import type { Paper, ScholarConfig } from '../store/types';

/**
 * Citation sync from open scholarly APIs (both allow browser CORS, no key needed).
 *  - OpenAlex:          author id like "A5023888391", or "orcid:0000-0002-1825-0097"
 *  - Semantic Scholar:  numeric author id from the profile URL
 * Google Scholar has no public API, so it can't be synced from the browser.
 */
export interface SyncResult {
  name: string;
  papers: Omit<Paper, 'id' | 'updatedAt'>[];
  byYear?: ScholarConfig['byYear'];
}

export async function syncScholar(provider: ScholarConfig['provider'], rawId: string): Promise<SyncResult> {
  const id = rawId.trim();
  if (!id) throw new Error('empty id');
  return provider === 'openalex' ? openAlex(id) : semanticScholar(id);
}

async function getJson(url: string) {
  const r = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

async function openAlex(id: string): Promise<SyncResult> {
  const clean = id.replace(/^https?:\/\/(openalex\.org|orcid\.org)\//, (_, host) => (host === 'orcid.org' ? 'orcid:' : ''));
  const author = await getJson(`https://api.openalex.org/authors/${encodeURIComponent(clean)}`);
  const aid = String(author.id).split('/').pop();
  const works: unknown[] = [];
  let cursor = '*';
  for (let page = 0; page < 5 && cursor; page++) {
    const res = await getJson(`https://api.openalex.org/works?filter=author.id:${aid}&per-page=200&cursor=${encodeURIComponent(cursor)}&select=display_name,publication_year,cited_by_count,primary_location,doi,authorships`);
    works.push(...res.results);
    cursor = res.meta?.next_cursor;
  }
  type W = { display_name: string; publication_year?: number; cited_by_count: number; doi?: string; primary_location?: { source?: { display_name?: string } }; authorships?: { author: { id: string }; author_position?: string }[] };
  return {
    name: author.display_name,
    byYear: (author.counts_by_year ?? []).map((y: { year: number; cited_by_count: number }) => ({ year: y.year, citations: y.cited_by_count })).sort((a: { year: number }, b: { year: number }) => a.year - b.year),
    papers: (works as W[])
      .filter((w) => w.display_name)
      .map((w) => ({
        title: w.display_name,
        year: w.publication_year,
        venue: w.primary_location?.source?.display_name ?? '',
        citations: w.cited_by_count ?? 0,
        status: 'published' as const,
        firstAuthor: !!w.authorships?.find((a) => a.author_position === 'first' && String(a.author.id).endsWith(aid!)),
        url: w.doi ?? undefined,
        source: 'openalex' as const,
      })),
  };
}

async function semanticScholar(id: string): Promise<SyncResult> {
  const clean = id.replace(/^https?:\/\/www\.semanticscholar\.org\/author\/[^/]+\//, '').replace(/\D/g, '');
  const res = await getJson(`https://api.semanticscholar.org/graph/v1/author/${clean}?fields=name,papers.title,papers.year,papers.venue,papers.citationCount,papers.url,papers.authors`);
  type P = { title: string; year?: number; venue?: string; citationCount?: number; url?: string; authors?: { authorId: string }[] };
  return {
    name: res.name,
    papers: (res.papers as P[]).map((p) => ({
      title: p.title,
      year: p.year ?? undefined,
      venue: p.venue ?? '',
      citations: p.citationCount ?? 0,
      status: 'published' as const,
      firstAuthor: p.authors?.[0]?.authorId === clean,
      url: p.url,
      source: 's2' as const,
    })),
  };
}
