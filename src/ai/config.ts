import { useSyncExternalStore } from 'react';

/**
 * AI provider settings. Stored only in this browser (localStorage) — never synced, never exported,
 * never committed. The key is sent straight from the browser to the provider you pick.
 */
export type ProviderId = 'claude' | 'openai' | 'deepseek' | 'kimi' | 'glm';

export interface ProviderDef {
  id: ProviderId;
  name: string;
  zh: string;
  kind: 'anthropic' | 'openai';
  baseUrl: string;
  model: string;
  models: string[];
  keyUrl: string;
  keyHint: string;
  /** OpenAI's newer models want `max_completion_tokens` and no custom temperature. */
  completionTokens?: boolean;
  web?: boolean; // server-side web search supported here
}

export const PROVIDERS: ProviderDef[] = [
  {
    id: 'claude',
    name: 'Claude (Anthropic)',
    zh: 'Claude（Anthropic）',
    kind: 'anthropic',
    baseUrl: '',
    model: 'claude-opus-5-5',
    models: ['claude-opus-5-5', 'claude-sonnet-5-5', 'claude-haiku-5-5'],
    keyUrl: 'https://console.anthropic.com/settings/keys',
    keyHint: 'sk-ant-…',
    web: true,
  },
  {
    id: 'openai',
    name: 'OpenAI',
    zh: 'OpenAI',
    kind: 'openai',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-5-mini',
    models: ['gpt-5-mini', 'gpt-5', 'gpt-4.1-mini'],
    keyUrl: 'https://platform.openai.com/api-keys',
    keyHint: 'sk-…',
    completionTokens: true,
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    zh: 'DeepSeek（深度求索）',
    kind: 'openai',
    baseUrl: 'https://api.deepseek.com',
    model: 'deepseek-chat',
    models: ['deepseek-chat', 'deepseek-reasoner'],
    keyUrl: 'https://platform.deepseek.com/api_keys',
    keyHint: 'sk-…',
  },
  {
    id: 'kimi',
    name: 'Kimi (Moonshot)',
    zh: 'Kimi（月之暗面）',
    kind: 'openai',
    baseUrl: 'https://api.moonshot.cn/v1',
    model: 'moonshot-v1-8k',
    models: ['moonshot-v1-8k', 'kimi-k2-turbo-preview', 'kimi-latest'],
    keyUrl: 'https://platform.moonshot.cn/console/api-keys',
    keyHint: 'sk-…',
  },
  {
    id: 'glm',
    name: 'GLM (Zhipu)',
    zh: 'GLM（智谱）',
    kind: 'openai',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    model: 'glm-4-flash',
    models: ['glm-4-flash', 'glm-4.5', 'glm-4-plus'],
    keyUrl: 'https://open.bigmodel.cn/usercenter/apikeys',
    keyHint: '…',
  },
];

export const providerById = (id: ProviderId) => PROVIDERS.find((p) => p.id === id) ?? PROVIDERS[0];

export interface AiConfig {
  provider: ProviderId;
  keys: Partial<Record<ProviderId, string>>;
  models: Partial<Record<ProviderId, string>>;
  baseUrls: Partial<Record<ProviderId, string>>;
  web: boolean; // let the model search the web for a news tie-in (where supported)
}

const KEY = 'lifeos:ai';
const DEFAULT: AiConfig = { provider: 'claude', keys: {}, models: {}, baseUrls: {}, web: false };
const subs = new Set<() => void>();

function read(): AiConfig {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...DEFAULT, ...JSON.parse(raw) } : DEFAULT;
  } catch {
    return DEFAULT;
  }
}

let cfg = read();

export const getAi = () => cfg;

export function setAi(patch: Partial<AiConfig>) {
  cfg = { ...cfg, ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(cfg));
  } catch {
    /* storage unavailable: keep for this session */
  }
  subs.forEach((f) => f());
}

export function useAi(): AiConfig {
  return useSyncExternalStore(
    (f) => (subs.add(f), () => subs.delete(f)),
    () => cfg,
  );
}

/** The resolved settings for the active provider (null when no key is set). */
export function activeProvider(c: AiConfig = cfg) {
  const p = providerById(c.provider);
  const key = c.keys[p.id]?.trim();
  if (!key) return null;
  return { def: p, key, model: c.models[p.id]?.trim() || p.model, baseUrl: (c.baseUrls[p.id]?.trim() || p.baseUrl).replace(/\/+$/, ''), web: !!(c.web && p.web) };
}
export type ActiveProvider = NonNullable<ReturnType<typeof activeProvider>>;
