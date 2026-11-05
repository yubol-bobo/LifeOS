import { useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import { parseDay } from '../lib/date';
import { useL, useLang } from '../lib/i18n';
import { open } from '../os/router';
import { PetAvatar } from '../pet/sprites';
import { useStore } from '../store/store';
import { Icon } from '../ui/Icon';
import { Button } from '../ui/kit';
import { providerById, useAi } from './config';
import { closeSummary, editSummary, openSummary, saveSummary, useSummary } from './summary';

/** The pet's day summary: streams in with a typewriter caret, then becomes an editable note. */
export function SummaryCard() {
  const L = useL();
  const lang = useLang();
  const st = useSummary();
  const pet = useStore((s) => s.pet);
  const acc = useStore((s) => s.equip?.acc);
  const ai = useAi();
  const area = useRef<HTMLTextAreaElement>(null);
  const card = useRef<HTMLDivElement>(null);
  const busy = st.status === 'thinking' || st.status === 'writing';

  // grow the editor with its content
  useEffect(() => {
    const t = area.current;
    if (t) {
      t.style.height = 'auto';
      t.style.height = `${t.scrollHeight + 2}px`;
    }
  }, [st.text, st.status]);

  // a sparkle burst when the card appears
  useEffect(() => {
    if (!st.open || !card.current) return;
    const r = card.current.getBoundingClientRect();
    void confetti({
      particleCount: 26,
      spread: 70,
      startVelocity: 22,
      scalar: 0.7,
      ticks: 120,
      shapes: ['star'],
      colors: ['#FFD166', '#FF8A5B', '#B69CFF', '#7DD3FC'],
      origin: { x: (r.left + 40) / innerWidth, y: (r.top + 30) / innerHeight },
      disableForReducedMotion: true,
    });
  }, [st.open, st.day]);

  if (!st.open) return null;
  const date = parseDay(st.day).toLocaleDateString(lang === 'zh' ? 'zh-CN' : 'en-US', { month: 'long', day: 'numeric', weekday: 'short' });
  const prov = providerById(ai.provider);
  const errText =
    st.error?.kind === 'auth'
      ? L('API Key 无效或没有权限。', 'The API key was rejected.')
      : st.error?.kind === 'network'
        ? L('连不上 AI 服务（网络问题，或该服务不允许浏览器直连 —— 见设置 → AI 的说明）。', 'Couldn’t reach the AI service (network, or it blocks browser calls — see Settings → AI).')
        : st.error?.kind === 'rate'
          ? L('请求太频繁或额度用完了。', 'Rate-limited or out of credit.')
          : st.error?.kind === 'refusal'
            ? L('模型拒绝了这次请求。', 'The model declined this one.')
            : L('AI 出错了：', 'AI error: ') + (st.error?.message ?? '');

  const save = () => {
    saveSummary();
    const r = card.current?.getBoundingClientRect();
    void confetti({ particleCount: 60, spread: 80, startVelocity: 28, scalar: 0.8, origin: r ? { x: (r.left + r.width / 2) / innerWidth, y: (r.bottom - 20) / innerHeight } : undefined, disableForReducedMotion: true });
  };

  return (
    <div className={`sumcard ${busy ? 'is-busy' : ''} is-${st.status}`} ref={card} role="dialog" aria-label={L('今日总结', 'Day summary')}>
      <div className="sumcard-glow" aria-hidden />
      <header className="sumcard-head">
        <span className={`sumcard-pet ${busy ? 'is-thinking' : ''}`}>
          <PetAvatar kind={pet.kind} size={52} mood={busy ? 'idle' : 'happy'} acc={acc} />
          <i className="orbit o1" />
          <i className="orbit o2" />
          <i className="orbit o3" />
        </span>
        <div className="sumcard-title">
          <strong>{st.auto ? L(`叮～ ${pet.name} 写好了今天的总结`, `Ding — ${pet.name} wrote up your day`) : L(`${pet.name} 的今日总结`, `${pet.name}’s day summary`)}</strong>
          <span className="muted small">
            {date} ·{' '}
            {st.source === 'ai' ? (
              <>
                <Icon name="sparkles" size={11} /> {prov.name} · {st.model}
              </>
            ) : (
              L('离线版', 'offline')
            )}
          </span>
        </div>
        <button className="icon-btn" onClick={closeSummary} aria-label={L('关闭', 'Close')}>
          <Icon name="x" size={16} />
        </button>
      </header>

      {st.status === 'thinking' && (
        <div className="sumcard-thinking">
          <span className="dots">
            <i />
            <i />
            <i />
          </span>
          {L('正在翻看你今天的记录…', 'Reading through your day…')}
          <div className="skel" />
          <div className="skel short" />
          <div className="skel" />
        </div>
      )}

      {st.status === 'writing' && (
        <div className="sumcard-text">
          {st.text}
          <span className="caret" />
        </div>
      )}

      {(st.status === 'done' || st.status === 'error') && (
        <>
          {st.status === 'error' && (
            <p className="sumcard-err">
              <Icon name="info" size={14} /> {errText} {L('先给你一份离线版：', 'Here’s an offline version instead:')}
            </p>
          )}
          <textarea ref={area} className="sumcard-edit" value={st.text} onChange={(e) => editSummary(e.target.value)} aria-label={L('编辑总结', 'Edit summary')} />
          <p className="muted small sumcard-hint">{L('可以直接修改，再存进当天的复盘。', 'Edit freely, then keep it in that day’s review.')}</p>
        </>
      )}

      <footer className="sumcard-foot">
        {st.source === 'local' && !busy && (
          <Button size="sm" variant="ghost" icon="settings" onClick={() => (sessionStorage.setItem('lifeos:settings-tab', 'ai'), open('settings'), window.dispatchEvent(new Event('lifeos:settings-tab')))}>
            {L('接入 AI', 'Connect AI')}
          </Button>
        )}
        <span className="spacer" />
        <Button size="sm" variant="soft" icon="refresh" disabled={busy} onClick={() => void openSummary(st.day, { auto: st.auto })}>
          {L('重新生成', 'Regenerate')}
        </Button>
        {st.saved ? (
          <Button size="sm" variant="soft" icon="notebook" onClick={() => (sessionStorage.setItem('lifeos:review-day', st.day), closeSummary(), open('review'))}>
            {L('已保存 · 打开复盘', 'Saved · open review')}
          </Button>
        ) : (
          <Button size="sm" variant="primary" icon="check" disabled={busy || !st.text.trim()} onClick={save}>
            {L('存到每日复盘', 'Save to review')}
          </Button>
        )}
      </footer>
    </div>
  );
}
