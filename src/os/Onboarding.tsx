import { useState } from 'react';
import { useL, useLang } from '../lib/i18n';
import { demoState } from '../store/demo';
import { actions, getState } from '../store/store';
import { defaultRates } from '../store/assets';
import { STARTER } from '../store/builtin';
import type { PayConfig } from '../store/types';
import { Button, Field, Modal, Segmented } from '../ui/kit';
import { SyncConnect } from '../apps/SyncSettings';

/** First-run setup assistant. */
export function Onboarding() {
  const L = useL();
  const lang = useLang();
  const [name, setName] = useState('');
  const [birth, setBirth] = useState('1998-01-01');
  const [rate, setRate] = useState(40);
  const [mode, setMode] = useState<PayConfig['mode']>('hour');
  const [syncOpen, setSyncOpen] = useState(false);
  const [currency, setCurrency] = useState('USD');

  const startFresh = () => {
    actions.onboard({ name: name.trim() || L('旅人', 'Traveler'), birthDate: birth, currency });
    actions.setPay({ mode, amount: rate });
    actions.setAssets({ base: currency, rates: defaultRates(currency) });
    const zh = lang === 'zh';
    const T = ([a, b]: [string, string]) => (zh ? a : b);
    // A gentle starter kit so the desktop isn't empty (built-in text follows the language switch).
    // A first goal, wired to the starter habits, so the daily → goal chain is visible from day one.
    actions.saveMilestone({
      title: T(STARTER.goal),
      note: T(STARTER.goalNote),
      attr: 'spirit',
      size: 'big',
      status: 'active',
      steps: [],
      krs: [
        { id: 'kr-starter-1', kind: 'quests', target: 60 },
        { id: 'kr-starter-2', kind: 'metric', metric: 'streak', target: 30 },
      ],
    });
    const goalId = getState().milestones[getState().milestones.length - 1]?.id;
    for (const [p, attr] of STARTER.quests) actions.addQuest({ title: T(p), attr, difficulty: 'normal', kind: 'daily', goalId });
    for (const [p, cost, icon] of STARTER.rewards) actions.saveReward({ title: T(p), cost, icon });
    actions.localize();
  };

  const loadDemo = () => actions.replace(demoState({ ...getState().profile, lang }));

  return (
    <div className="onboard-scrim">
      <div className="onboard">
        <div className="onboard-hero">
          <span className="logo-mark logo-lg" />
          <h1>
            {L('欢迎来到 ', 'Welcome to ')}
            <b>LifeOS</b>
          </h1>
          <p>{L('一个为你的人生运行的操作系统：任务、里程碑、学术、专注与收入，全部升级成一场游戏。数据只保存在本机浏览器里。', 'An operating system for your life — quests, milestones, research, focus and income, all turned into a game. Your data never leaves this browser.')}</p>
        </div>
        <div className="onboard-form">
          <Segmented
            size="sm"
            value={lang}
            onChange={(v) => actions.profile({ lang: v })}
            options={[
              { value: 'zh', label: '中文' },
              { value: 'en', label: 'English' },
            ]}
          />
          <Field label={L('怎么称呼你？', 'What should we call you?')}>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder={L('你的名字', 'Your name')} />
          </Field>
          <div className="row2">
            <Field label={L('出生日期', 'Birth date')} hint={L('用于计算人生进度', 'Used for life progress')}>
              <input className="input" type="date" value={birth} onChange={(e) => setBirth(e.target.value)} />
            </Field>
            <Field label={<span className="pay-mode-label"><select value={mode} onChange={(e) => setMode(e.target.value as PayConfig['mode'])} aria-label={L('收入方式', 'Pay type')}><option value="hour">{L('时薪', 'Hourly pay')}</option><option value="day">{L('日薪', 'Daily pay')}</option><option value="month">{L('月薪', 'Monthly pay')}</option><option value="year">{L('年薪', 'Yearly pay')}</option></select></span>}>
              <div className="input-group">
                <input className="input" type="number" min={0} value={rate} onChange={(e) => setRate(+e.target.value)} />
                <select className="input" value={currency} onChange={(e) => setCurrency(e.target.value)}>
                  {['USD', 'CNY', 'EUR', 'GBP', 'JPY', 'HKD', 'SGD', 'CAD'].map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </div>
            </Field>
          </div>
          <div className="onboard-actions">
            <Button variant="primary" size="lg" icon="power" onClick={startFresh}>
              {L('启动我的 LifeOS', 'Boot my LifeOS')}
            </Button>
            <div className="onboard-alt">
              <Button variant="ghost" icon="sparkles" onClick={loadDemo}>
                {L('先看看示例数据', 'Explore with demo data')}
              </Button>
              <Button variant="ghost" icon="cloud" onClick={() => setSyncOpen(true)}>
                {L('从其他设备同步', 'Sync from another device')}
              </Button>
            </div>
          </div>
        </div>
      </div>
      <Modal open={syncOpen} onClose={() => setSyncOpen(false)} title={L('从其他设备同步', 'Sync from another device')} width={560}>
        <SyncConnect onDone={() => setSyncOpen(false)} />
      </Modal>
    </div>
  );
}
