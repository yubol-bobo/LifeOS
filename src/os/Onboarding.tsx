import { useState } from 'react';
import { useL, useLang } from '../lib/i18n';
import { demoState } from '../store/demo';
import { actions, getState } from '../store/store';
import { defaultRates } from '../store/assets';
import type { PayConfig } from '../store/types';
import { Button, Field, Segmented } from '../ui/kit';

/** First-run setup assistant. */
export function Onboarding() {
  const L = useL();
  const lang = useLang();
  const [name, setName] = useState('');
  const [birth, setBirth] = useState('1998-01-01');
  const [rate, setRate] = useState(40);
  const [mode, setMode] = useState<PayConfig['mode']>('hour');
  const [currency, setCurrency] = useState('USD');

  const startFresh = () => {
    actions.onboard({ name: name.trim() || L('旅人', 'Traveler'), birthDate: birth, currency });
    actions.setPay({ mode, amount: rate });
    actions.setAssets({ base: currency, rates: defaultRates(currency) });
    const zh = lang === 'zh';
    // A gentle starter kit so the desktop isn't empty.
    const starter: [string, string, 'mind' | 'body' | 'spirit' | 'craft'][] = [
      ['专注工作 2 小时', 'Two hours of deep work', 'craft'],
      ['阅读 30 分钟', 'Read for 30 minutes', 'mind'],
      ['运动一下', 'Move your body', 'body'],
      ['写三行日记', 'Write three lines of journal', 'spirit'],
    ];
    // A first goal, wired to the starter habits, so the daily → goal chain is visible from day one.
    actions.saveMilestone({
      title: zh ? '坚持 30 天' : 'My first 30 days',
      note: zh ? '每完成一个下面的习惯，这个目标都会自动前进。' : 'Every habit below moves this goal forward automatically.',
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
    for (const [a, b, attr] of starter) actions.addQuest({ title: zh ? a : b, attr, difficulty: 'normal', kind: 'daily', goalId });
    actions.saveReward({ title: zh ? '一杯好咖啡' : 'A really good coffee', cost: 60, icon: 'coffee' });
    actions.saveReward({ title: zh ? '看一部电影' : 'Movie night', cost: 250, icon: 'film' });
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
            <Button variant="ghost" icon="sparkles" onClick={loadDemo}>
              {L('先看看示例数据', 'Explore with demo data')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
