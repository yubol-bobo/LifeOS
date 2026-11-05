/** Minimal GitHub Gist client for the sync file (secret gist, conditional GETs to spare rate limits). */
const API = 'https://api.github.com';
export const FILE = 'lifeos-sync.json';

export class GistError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

const headers = (token: string, extra: Record<string, string> = {}) => ({
  Authorization: `Bearer ${token}`,
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
  ...extra,
});

async function call(token: string, path: string, init: RequestInit = {}, extra: Record<string, string> = {}) {
  const r = await fetch(`${API}${path}`, { ...init, headers: { ...headers(token, extra), ...(init.body ? { 'Content-Type': 'application/json' } : {}) } });
  if (r.status === 304) return { status: 304 as const, etag: r.headers.get('ETag') ?? '', json: null };
  if (!r.ok) {
    const msg = await r.text().catch(() => '');
    throw new GistError(r.status === 401 ? 'Token invalid or expired' : r.status === 404 ? 'Gist not found (or token lacks the gist scope)' : `GitHub ${r.status}: ${msg.slice(0, 120)}`, r.status);
  }
  return { status: r.status, etag: r.headers.get('ETag') ?? '', json: await r.json() };
}

type GistFile = { content?: string; truncated?: boolean; raw_url?: string };
type Gist = { id: string; files: Record<string, GistFile>; updated_at: string };

/** Find the user's existing LifeOS sync gist. */
export async function findGist(token: string): Promise<string | null> {
  for (let page = 1; page <= 5; page++) {
    const { json } = await call(token, `/gists?per_page=100&page=${page}`);
    const list = json as Gist[];
    const hit = list.find((g) => g.files && g.files[FILE]);
    if (hit) return hit.id;
    if (list.length < 100) break;
  }
  return null;
}

export async function createGist(token: string, content: string) {
  const { json } = await call(token, '/gists', { method: 'POST', body: JSON.stringify({ description: 'LifeOS sync (end-to-end encrypted)', public: false, files: { [FILE]: { content } } }) });
  return (json as Gist).id;
}

/** Read the sync file; returns null content on 304 (unchanged since `etag`). */
export async function readGist(token: string, id: string, etag?: string): Promise<{ changed: boolean; etag: string; content: string | null }> {
  const res = await call(token, `/gists/${id}`, {}, etag ? { 'If-None-Match': etag } : {});
  if (res.status === 304) return { changed: false, etag: etag!, content: null };
  const f = (res.json as Gist).files[FILE];
  if (!f) return { changed: true, etag: res.etag, content: null };
  let content = f.content ?? '';
  if (f.truncated && f.raw_url) content = await (await fetch(f.raw_url)).text();
  return { changed: true, etag: res.etag, content };
}

export async function writeGist(token: string, id: string, content: string) {
  const res = await call(token, `/gists/${id}`, { method: 'PATCH', body: JSON.stringify({ files: { [FILE]: { content } } }) });
  return res.etag;
}
