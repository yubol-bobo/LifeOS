/**
 * End-to-end encryption for the sync file: gzip → AES-GCM-256 with a key derived from the
 * user's sync password (PBKDF2-SHA256). GitHub only ever stores ciphertext.
 */
const ITER = 210_000;
const enc = new TextEncoder();
const dec = new TextDecoder();

const b64 = (u: Uint8Array) => {
  let s = '';
  for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000));
  return btoa(s);
};
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

const keyCache = new Map<string, Promise<CryptoKey>>();
function deriveKey(pass: string, salt: Uint8Array, iter: number) {
  const id = `${iter}:${b64(salt)}:${pass}`;
  if (!keyCache.has(id))
    keyCache.set(
      id,
      crypto.subtle
        .importKey('raw', enc.encode(pass), 'PBKDF2', false, ['deriveKey'])
        .then((base) => crypto.subtle.deriveKey({ name: 'PBKDF2', salt: salt as BufferSource, iterations: iter, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])),
    );
  return keyCache.get(id)!;
}

async function pipe(data: Uint8Array, stream: CompressionStream | DecompressionStream) {
  const out = new Response(new Blob([data as BlobPart]).stream().pipeThrough(stream));
  return new Uint8Array(await out.arrayBuffer());
}

export interface Envelope {
  format: 'lifeos-sync';
  v: 1;
  iter: number;
  gzip: boolean;
  salt: string;
  iv: string;
  data: string;
}

export async function seal(plain: string, pass: string, salt?: Uint8Array): Promise<Envelope> {
  const s = salt ?? crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const gzip = typeof CompressionStream !== 'undefined';
  const body = gzip ? await pipe(enc.encode(plain), new CompressionStream('gzip')) : enc.encode(plain);
  const key = await deriveKey(pass, s, ITER);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, body as BufferSource));
  return { format: 'lifeos-sync', v: 1, iter: ITER, gzip, salt: b64(s), iv: b64(iv), data: b64(ct) };
}

export class WrongPassword extends Error {}

export async function open(env: Envelope, pass: string): Promise<string> {
  if (env.format !== 'lifeos-sync') throw new Error('Not a LifeOS sync file');
  const key = await deriveKey(pass, unb64(env.salt), env.iter);
  let body: Uint8Array;
  try {
    body = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(env.iv) as BufferSource }, key, unb64(env.data) as BufferSource));
  } catch {
    throw new WrongPassword('wrong password');
  }
  return dec.decode(env.gzip ? await pipe(body, new DecompressionStream('gzip')) : body);
}

export const saltOf = (env: Envelope) => unb64(env.salt);
