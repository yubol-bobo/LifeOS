import type { ActiveProvider } from './config';

export interface GenerateOpts {
  provider: ActiveProvider;
  system: string;
  user: string;
  signal?: AbortSignal;
  /** Called with the full text so far, as it streams in. */
  onText: (text: string) => void;
}

export class AiError extends Error {
  constructor(
    message: string,
    public kind: 'auth' | 'network' | 'rate' | 'refusal' | 'other' = 'other',
  ) {
    super(message);
  }
}

const isAbort = (e: unknown) => (e as Error)?.name === 'AbortError';
/** Errors that a retry without web search would not fix. */
const fatal = (e: unknown) => isAbort(e) || (e instanceof AiError && (e.kind === 'auth' || e.kind === 'rate' || e.kind === 'refusal'));

/**
 * Stream a completion from the configured provider. Resolves with the final text.
 * With web search on, each provider uses its own search tool; if that fails (the model or the
 * endpoint doesn't support it), the summary is written again without search rather than failing.
 */
export async function generate(o: GenerateOpts): Promise<string> {
  const p = o.provider;
  if (!p.search) return p.def.kind === 'anthropic' ? viaClaude(o, false) : viaOpenAICompatible(o);
  try {
    if (p.search === 'claude') return await viaClaude(o, true);
    if (p.search === 'openai') return await viaOpenAIResponses(o);
    if (p.search === 'kimi') return await viaKimiSearch(o);
    return await viaOpenAICompatible(o, { tools: [{ type: 'web_search', web_search: { enable: true, search_engine: 'search_std', search_result: false } }] });
  } catch (e) {
    if (fatal(e)) throw e;
    o.onText('');
    return p.def.kind === 'anthropic' ? viaClaude(o, false) : viaOpenAICompatible(o);
  }
}

/* ---------------- Claude: official SDK, loaded on demand ---------------- */

async function viaClaude({ provider, system, user, signal, onText }: GenerateOpts, search: boolean) {
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const client = new Anthropic({
    apiKey: provider.key,
    baseURL: provider.baseUrl || undefined,
    // The key belongs to the person using this page and goes straight to Anthropic.
    dangerouslyAllowBrowser: true,
    maxRetries: 1,
  });
  let text = '';
  try {
    const stream = client.beta.messages.stream(
      {
        model: provider.model,
        max_tokens: 8000,
        system,
        messages: [{ role: 'user', content: user }],
        // A short, friendly summary doesn't need deep thinking.
        output_config: { effort: 'low' },
        // If a safety classifier declines, retry on Anthropic's recommended fallback model.
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        ...(search ? { tools: [{ type: 'web_search_20260209' as const, name: 'web_search' as const, max_uses: 2 }] } : {}),
      },
      { signal },
    );
    for await (const ev of stream) {
      // Only keep the text written after the last search, so no "let me look that up" preamble leaks in.
      if (ev.type === 'content_block_start' && ev.content_block.type === 'web_search_tool_result') text = '';
      if (ev.type === 'content_block_delta' && ev.delta.type === 'text_delta') {
        text += ev.delta.text;
        onText(text);
      }
    }
    const final = await stream.finalMessage();
    if (final.stop_reason === 'refusal') throw new AiError('The model declined to write this summary.', 'refusal');
    return text.trim();
  } catch (e) {
    if (e instanceof AiError) throw e;
    if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError) throw new AiError(e.message, 'auth');
    if (e instanceof Anthropic.RateLimitError) throw new AiError(e.message, 'rate');
    if (e instanceof Anthropic.APIConnectionError) throw new AiError(e.message, 'network');
    if (e instanceof Anthropic.APIError) throw new AiError(`${e.status ?? ''} ${e.message}`.trim(), 'other');
    throw e;
  }
}

/* ---------------- Shared HTTP helpers for the OpenAI-style APIs ---------------- */

async function post(provider: ActiveProvider, path: string, body: unknown, signal?: AbortSignal) {
  let res: Response;
  try {
    res = await fetch(`${provider.baseUrl}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${provider.key}` },
      body: JSON.stringify(body),
      signal,
    });
  } catch (e) {
    if (isAbort(e)) throw e;
    // Typically CORS (the provider doesn't accept browser calls) or no network.
    throw new AiError((e as Error).message, 'network');
  }
  if (!res.ok) {
    let msg = `${res.status} ${res.statusText}`;
    try {
      const j = await res.json();
      msg = j?.error?.message ?? j?.message ?? msg;
    } catch {
      /* not JSON */
    }
    throw new AiError(msg, res.status === 401 || res.status === 403 ? 'auth' : res.status === 429 ? 'rate' : 'other');
  }
  return res;
}

/** Read a server-sent-events body, calling `onData` with each parsed `data:` JSON payload. */
async function readSSE(res: Response, onData: (j: Record<string, any>) => void) {
  if (!res.body) throw new AiError('Empty response', 'other');
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let nl: number;
    while ((nl = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line.startsWith('data:')) continue;
      const data = line.slice(5).trim();
      if (!data || data === '[DONE]') continue;
      let j: Record<string, any>;
      try {
        j = JSON.parse(data);
      } catch {
        continue; // keep-alive or partial line
      }
      onData(j);
    }
  }
}

/** Reveal text that arrived all at once, so every provider feels like it's typing. */
async function reveal(text: string, onText: (t: string) => void, signal?: AbortSignal) {
  const chars = [...text];
  for (let i = 0; i < chars.length; i += 4) {
    if (signal?.aborted) return;
    onText(chars.slice(0, i).join(''));
    await new Promise((r) => setTimeout(r, 12));
  }
  onText(text);
}

/* ---------------- OpenAI, DeepSeek, Kimi, GLM: OpenAI-compatible chat completions ---------------- */

async function viaOpenAICompatible({ provider, system, user, signal, onText }: GenerateOpts, extra: Record<string, unknown> = {}) {
  const body: Record<string, unknown> = {
    model: provider.model,
    stream: true,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    ...extra,
  };
  if (provider.def.completionTokens) body.max_completion_tokens = 4000;
  else {
    body.max_tokens = 1200;
    body.temperature = 0.85;
  }
  const res = await post(provider, '/chat/completions', body, signal);
  let text = '';
  await readSSE(res, (j) => {
    if (j.error) throw new AiError(j.error.message ?? 'error', 'other');
    const delta = j.choices?.[0]?.delta?.content;
    if (typeof delta === 'string' && delta) {
      text += delta;
      onText(text);
    }
  });
  if (!text.trim()) throw new AiError('Empty response', 'other');
  return text.trim();
}

/* ---------------- OpenAI with web search: the Responses API ---------------- */

async function viaOpenAIResponses({ provider, system, user, signal, onText }: GenerateOpts) {
  const res = await post(
    provider,
    '/responses',
    { model: provider.model, instructions: system, input: user, stream: true, max_output_tokens: 4000, tools: [{ type: 'web_search' }] },
    signal,
  );
  let text = '';
  await readSSE(res, (j) => {
    // Drop anything written before a search, same as with Claude.
    if (j.type === 'response.output_item.added' && j.item?.type === 'web_search_call') text = '';
    else if (j.type === 'response.output_text.delta' && typeof j.delta === 'string') {
      text += j.delta;
      onText(text);
    } else if (j.type === 'response.failed' || j.type === 'error') throw new AiError(j.response?.error?.message ?? j.message ?? 'error', 'other');
  });
  if (!text.trim()) throw new AiError('Empty response', 'other');
  return text.trim();
}

/* ---------------- Kimi with web search: its built-in $web_search tool ---------------- */

async function viaKimiSearch({ provider, system, user, signal, onText }: GenerateOpts) {
  const tools = [{ type: 'builtin_function', function: { name: '$web_search' } }];
  const messages: Record<string, unknown>[] = [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ];
  // Kimi runs the search itself; we hand the tool call's arguments straight back, then it writes.
  for (let round = 0; round < 4; round++) {
    const res = await post(provider, '/chat/completions', { model: provider.model, messages, tools, max_tokens: 1200, temperature: 0.6 }, signal);
    const j = await res.json();
    const choice = j.choices?.[0];
    const calls = choice?.message?.tool_calls as { id: string; function: { name: string; arguments: string } }[] | undefined;
    if (choice?.finish_reason === 'tool_calls' && calls?.length) {
      messages.push(choice.message);
      for (const c of calls) messages.push({ role: 'tool', tool_call_id: c.id, name: c.function.name, content: c.function.arguments });
      continue;
    }
    const text = String(choice?.message?.content ?? '').trim();
    if (!text) throw new AiError('Empty response', 'other');
    await reveal(text, onText, signal);
    return text;
  }
  throw new AiError('Too many search rounds', 'other');
}
