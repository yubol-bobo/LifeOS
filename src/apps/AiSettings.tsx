import { useState } from 'react';
import { activeProvider, PROVIDERS, providerById, setAi, useAi } from '../ai/config';
import { AiError, generate } from '../ai/generate';
import { openSummary } from '../ai/summary';
import { dayKey } from '../lib/date';
import { useL, useLang } from '../lib/i18n';
import { actions, useStore } from '../store/store';
import { Icon } from '../ui/Icon';
import { Button, Card, Field } from '../ui/kit';

/** Settings → AI: pick a provider, paste a key (kept in this browser only), test it. */
export function AiSettings() {
  const L = useL();
  const lang = useLang();
  const ai = useAi();
  const pet = useStore((s) => s.pet);
  const p = providerById(ai.provider);
  const [show, setShow] = useState(false);
  const [test, setTest] = useState<{ state: 'idle' | 'running' | 'ok' | 'err'; text?: string }>({ state: 'idle' });
  const key = ai.keys[p.id] ?? '';

  const runTest = async () => {
    const prov = activeProvider();
    if (!prov) return;
    setTest({ state: 'running', text: '' });
    try {
      const text = await generate({
        provider: { ...prov, search: undefined }, // a quick hello doesn't need web search
        system: lang === 'zh' ? '你是一只可爱的桌面宠物。' : 'You are a cute desktop pet.',
        user: lang === 'zh' ? '用不超过 15 个字跟主人打个招呼。' : 'Say hi to your human in under 12 words.',
        onText: (t) => setTest({ state: 'running', text: t }),
      });
      setTest({ state: 'ok', text });
    } catch (e) {
      const kind = e instanceof AiError ? e.kind : 'other';
      const why =
        kind === 'auth'
          ? L('Key 无效或没有权限', 'Key rejected')
          : kind === 'network'
            ? L('连接失败：网络问题，或者这个服务不允许浏览器直接调用（CORS）。可以在「接口地址」里换成你自己的代理。', 'Connection failed: network, or the service blocks direct browser calls (CORS). You can point “Base URL” at your own proxy.')
            : kind === 'rate'
              ? L('请求过于频繁或额度不足', 'Rate-limited or out of credit')
              : '';
      setTest({ state: 'err', text: [why, (e as Error).message].filter(Boolean).join(' — ') });
    }
  };

  return (
    <div className="ai-settings">
      <Card title={L('AI 宠物', 'AI pet')} icon="sparkles">
        <p className="muted small">
          {L(
            '接入一个大模型后，宠物可以读取你一天的任务、专注、入账、心情、计划和倒计时，写一份简短有趣的「今日总结」，还能顺便讲个历史上的今天。总结可以编辑，并一键存进当天的每日复盘。不接入也能用：宠物会写一份离线版。',
            'With a model connected, your pet reads the day’s quests, focus, earnings, mood, plans and countdowns and writes a short, fun day summary — with an “on this day” tidbit. Edit it and save it to that day’s review. Works without AI too: the pet writes an offline version.',
          )}
        </p>
        <div className="ai-providers" role="radiogroup" aria-label={L('服务商', 'Provider')}>
          {PROVIDERS.map((x) => (
            <button key={x.id} role="radio" aria-checked={ai.provider === x.id} className={`ai-prov ${ai.provider === x.id ? 'is-on' : ''}`} onClick={() => (setAi({ provider: x.id }), setTest({ state: 'idle' }))}>
              <strong>{lang === 'zh' ? x.zh : x.name}</strong>
              <span className="muted small">{ai.keys[x.id] ? L('已填 Key', 'Key set') : L('未设置', 'Not set')}</span>
            </button>
          ))}
        </div>

        <div className="form">
          <Field
            label="API Key"
            hint={
              <>
                {L('只保存在这台设备的浏览器里，不会同步、不会导出、不会上传到 GitHub。请求从浏览器直接发给服务商。建议在服务商后台给这个 Key 设置额度上限。', 'Kept only in this browser — never synced, exported or committed. Requests go straight from your browser to the provider. Consider a spending limit on this key.')}{' '}
                <a href={p.keyUrl} target="_blank" rel="noreferrer">
                  {L('去获取 Key ↗', 'Get a key ↗')}
                </a>
              </>
            }
          >
            <div className="row-gap">
              <input
                className="input"
                type={show ? 'text' : 'password'}
                autoComplete="off"
                spellCheck={false}
                placeholder={p.keyHint}
                value={key}
                onChange={(e) => setAi({ keys: { ...ai.keys, [p.id]: e.target.value.trim() } })}
              />
              <Button size="sm" variant="ghost" icon={show ? 'eye-off' : 'eye'} onClick={() => setShow((v) => !v)} aria-label={show ? L('隐藏', 'Hide') : L('显示', 'Show')} />
            </div>
          </Field>
          <div className="row2">
            <Field label={L('模型', 'Model')} hint={L('可以选，也可以直接输入任何该服务商支持的模型名。', 'Pick one or type any model this provider offers.')}>
              <>
                <input className="input" list={`models-${p.id}`} value={ai.models[p.id] ?? p.model} onChange={(e) => setAi({ models: { ...ai.models, [p.id]: e.target.value } })} />
                <datalist id={`models-${p.id}`}>
                  {p.models.map((m) => (
                    <option key={m} value={m} />
                  ))}
                </datalist>
              </>
            </Field>
            <Field label={L('接口地址（可选）', 'Base URL (optional)')} hint={p.id === 'kimi' ? L('海外账号可用 https://api.moonshot.ai/v1', 'International accounts: https://api.moonshot.ai/v1') : L('留空使用官方地址；也可以填你自己的代理。', 'Leave empty for the official endpoint, or use your own proxy.')}>
              <input className="input" placeholder={p.baseUrl || 'https://api.anthropic.com'} value={ai.baseUrls[p.id] ?? ''} onChange={(e) => setAi({ baseUrls: { ...ai.baseUrls, [p.id]: e.target.value } })} />
            </Field>
          </div>
          <div className="toggle-list">
            <button className={`toggle-row ${ai.web ? 'is-on' : ''}`} role="switch" aria-checked={ai.web} onClick={() => setAi({ web: !ai.web })}>
              <span>
                {L('联网找灵感：最近的新闻、历史上的今天', 'Go online for inspiration: recent news, on this day')}
                <small className="muted">
                  {' '}
                  {p.search
                    ? L(`（${p.zh.replace(/（.*/, '')} 自带联网搜索，加上维基百科的新闻；会多一点费用）`, `(${p.name.replace(/ \(.*/, '')}'s own web search, plus Wikipedia's news feed; costs a little more)`)
                    : L('（DeepSeek 没有自带搜索，由浏览器从维基百科取新闻和历史上的今天，免费）', "(DeepSeek has no web search of its own; the browser fetches news and on-this-day from Wikipedia, free)")}
                </small>
              </span>
              <i className="switch" />
            </button>
          </div>
          <p className="muted small">
            {L(
              '每份总结都有一段「✨ 发散联想」：从你今天做的事出发，联想到一条新闻、历史上的今天、一句金句或诗词、一个浪漫或有趣的画面、一句打气或一点人生哲理，每次换个花样。',
              'Every summary ends with a “✨” line that wanders off from something you did today: a news story, this day in history, a quote or a line of poetry, a romantic or playful thought, some cheering on or a bit of life wisdom, different each time.',
            )}
          </p>
          <div className="row-gap wrap">
            <Button icon="zap" disabled={!key || test.state === 'running'} onClick={() => void runTest()}>
              {test.state === 'running' ? L('测试中…', 'Testing…') : L('测试连接', 'Test connection')}
            </Button>
            <Button variant="soft" icon="sparkles" onClick={() => void openSummary(dayKey())}>
              {L('现在就写今日总结', 'Write today’s summary now')}
            </Button>
            {key && (
              <Button variant="ghost" icon="trash" onClick={() => (setAi({ keys: { ...ai.keys, [p.id]: '' } }), setTest({ state: 'idle' }))}>
                {L('删除这个 Key', 'Remove key')}
              </Button>
            )}
          </div>
          {test.state !== 'idle' && (
            <p className={`ai-test is-${test.state}`}>
              <Icon name={test.state === 'ok' ? 'circle-check' : test.state === 'err' ? 'info' : 'sparkles'} size={15} /> {test.text || '…'}
            </p>
          )}
        </div>
      </Card>

      <Card title={L('什么时候写', 'When it writes')} icon="moon">
        <div className="toggle-list">
          <button className={`toggle-row ${pet.nightSummary !== false ? 'is-on' : ''}`} role="switch" aria-checked={pet.nightSummary !== false} onClick={() => actions.setPet({ nightSummary: pet.nightSummary === false })}>
            <span>
              {L('午夜 12 点自动弹出当天的总结', 'Pop the day summary at midnight')}
              <small className="muted"> {L('（错过了，第二天早上会问你要不要补一份）', '(missed it? it offers one the next morning)')}</small>
            </span>
            <i className="switch" />
          </button>
          <button className={`toggle-row ${pet.reviewNudge !== false ? 'is-on' : ''}`} role="switch" aria-checked={pet.reviewNudge !== false} onClick={() => actions.setPet({ reviewNudge: pet.reviewNudge === false })}>
            <span>
              {L('晚上 9:30 轻轻提醒一次复盘', 'A gentle review nudge at 9:30 pm')}
              <small className="muted"> {L('（每天最多一次，可以直接跳过）', '(once a day at most, easy to skip)')}</small>
            </span>
            <i className="switch" />
          </button>
        </div>
        <p className="muted small">{L('随时也可以点宠物 → 「今日总结」，或者在每日复盘里让它写。', 'Any time: click your pet → “Day summary”, or ask from the Daily Review.')}</p>
      </Card>
    </div>
  );
}
