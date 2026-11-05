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

/** Stream a completion from the configured provider. Resolves with the final text. */
export function generate(o: GenerateOpts): Promise<string> {
  return o.provider.def.kind === 'anthropic' ? viaClaude(o) : viaOpenAICompatible(o);
}

/* ---------------- Claude: official SDK, loaded on demand ---------------- */

async function viaClaude({ provider, system, user, signal, onText }: GenerateOpts) {
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
        ...(provider.web ? { tools: [{ type: 'web_search_20260209' as const, name: 'web_search' as const, max_uses: 2 }] } : {}),
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

/* ---------------- OpenAI, DeepSeek, Kimi, GLM: OpenAI-compatible chat completions ---------------- */

async function viaOpenAICompatible({ provider, system, user, signal, onText }: GenerateOpts) {
  const body: Record<string, unknown> = {
    model: provider.model,
    stream: true,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
  };
  if (provider.def.completionTokens) body.max_completion_tokens = 4000;
  else {
    body.max_tokens = 1200;
    body.temperature = 0.8;
  }
  let res: Response;
  try {
    res = await fetch(`${provider.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${provider.key}` },
      body: JSON.stringify(body),
      signal,
    });
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e;
    // Typically CORS (the provider doesn't accept browser calls) or no network.
    throw new AiError((e as Error).message, 'network');
  }
  if (!res.ok || !res.body) {
    let msg = `${res.status} ${res.statusText}`;
    try {
      const j = await res.json();
      msg = j?.error?.message ?? j?.message ?? msg;
    } catch {
      /* not JSON */
    }
    throw new AiError(msg, res.status === 401 || res.status === 403 ? 'auth' : res.status === 429 ? 'rate' : 'other');
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  let text = '';
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
      if (data === '[DONE]') continue;
      try {
        const j = JSON.parse(data);
        const delta = j.choices?.[0]?.delta?.content;
        if (typeof delta === 'string' && delta) {
          text += delta;
          onText(text);
        }
      } catch {
        /* keep-alive or partial line */
      }
    }
  }
  return text.trim();
}
