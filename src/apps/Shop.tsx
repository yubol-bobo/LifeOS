import { useState } from 'react';
import { useL } from '../lib/i18n';
import { notify } from '../os/notify';
import { useMetrics } from '../store/hooks';
import { actions, useStore } from '../store/store';
import type { Reward } from '../store/types';
import { Icon, REWARD_ICONS } from '../ui/Icon';
import { Bar, Button, Card, Empty, Field, Modal, Stat } from '../ui/kit';

export function Shop() {
  const L = useL();
  const rewards = useStore((s) => s.rewards);
  const events = useStore((s) => s.events);
  const m = useMetrics();
  const [edit, setEdit] = useState<Partial<Reward> | null>(null);
  const spent = -events.filter((e) => e.kind === 'reward').reduce((a, e) => a + e.coins, 0);
  const earned = events.reduce((a, e) => a + Math.max(0, e.coins), 0);
  const history = events.filter((e) => e.kind === 'reward').sort((a, b) => b.ts - a.ts).slice(0, 8);

  return (
    <div className="app">
      <div className="app-head">
        <div>
          <h1>{L('奖励商店', 'Reward Shop')}</h1>
          <p className="muted">{L('认真生活赚来的金币，就该花在让你开心的事上。每 5 XP = 1 金币。', 'Coins earned by living well deserve to be spent on joy. Every 5 XP = 1 coin.')}</p>
        </div>
        <Button variant="primary" icon="plus" onClick={() => setEdit({ title: '', cost: 100, icon: 'gift' })}>
          {L('上架奖励', 'Add reward')}
        </Button>
      </div>

      <div className="stats-row">
        <Stat label={L('余额', 'Balance')} value={<><span className="coin" /> {m.coins.toLocaleString()}</>} tone="gold" />
        <Stat label={L('累计赚取', 'Earned')} value={earned.toLocaleString()} />
        <Stat label={L('累计花费', 'Spent')} value={spent.toLocaleString()} />
        <Stat label={L('兑换次数', 'Redeemed')} value={m.rewardsRedeemed} />
      </div>

      {rewards.length === 0 ? (
        <Card>
          <Empty icon="store" title={L('货架是空的', 'The shelves are empty')} body={L('一杯咖啡、一集剧、一次旅行。给自己定价。', 'A coffee, an episode, a trip. Put a price on it.')} />
        </Card>
      ) : (
        <div className="shop-grid">
          {rewards.map((r) => {
            const can = m.coins >= r.cost;
            return (
              <article key={r.id} className={`shop-item ${can ? '' : 'is-locked'}`}>
                <button className="shop-edit" onClick={() => setEdit(r)} aria-label={L('编辑', 'Edit')}>
                  <Icon name="pencil" size={14} />
                </button>
                <div className="shop-art">
                  <Icon name={r.icon} size={30} stroke={2} />
                </div>
                <strong>{r.title}</strong>
                <span className="shop-price num">
                  <span className="coin coin-sm" /> {r.cost.toLocaleString()}
                </span>
                {!can && (
                  <div className="shop-progress">
                    <Bar value={m.coins / r.cost} tone="gold" height={6} />
                    <span className="muted small num">{L(`还差 ${r.cost - m.coins}`, `${r.cost - m.coins} to go`)}</span>
                  </div>
                )}
                <Button
                  variant={can ? 'gold' : 'soft'}
                  disabled={!can}
                  icon={can ? 'gift' : 'lock'}
                  onClick={() => {
                    if (actions.redeem(r.id)) notify({ title: L('兑换成功', 'Redeemed'), body: L(`享受「${r.title}」吧，这是你应得的。`, `Enjoy “${r.title}” — you earned it.`), icon: 'gift', tone: 'gold' });
                  }}
                >
                  {can ? L('兑换', 'Redeem') : L('金币不足', 'Not yet')}
                </Button>
                {r.redeemed > 0 && <span className="shop-count muted small">{L(`已兑换 ${r.redeemed} 次`, `Redeemed ${r.redeemed}×`)}</span>}
              </article>
            );
          })}
        </div>
      )}

      {history.length > 0 && (
        <Card title={L('兑换记录', 'Redemption history')} icon="clock">
          <ul className="xp-log">
            {history.map((e) => (
              <li key={e.id}>
                <span className="xp-dot" style={{ background: 'var(--gold)' }} />
                <span className="xp-label">{e.label}</span>
                <span className="muted small">{new Date(e.ts).toLocaleDateString()}</span>
                <span className="xp-amt num">{e.coins}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <RewardEditor value={edit} onClose={() => setEdit(null)} />
    </div>
  );
}

function RewardEditor({ value, onClose }: { value: Partial<Reward> | null; onClose: () => void }) {
  const L = useL();
  const [d, setD] = useState<Partial<Reward>>({});
  const [key, setKey] = useState<string | undefined>('__');
  const k = value ? (value.id ?? 'new') : undefined;
  if (k !== key) {
    setKey(k);
    if (value) setD(value);
  }
  const r = { title: '', cost: 100, icon: 'gift', ...d } as Reward;
  const save = () => {
    if (!r.title.trim()) return;
    actions.saveReward({ id: r.id, title: r.title.trim(), cost: Math.max(1, Math.round(r.cost)), icon: r.icon });
    onClose();
  };
  return (
    <Modal
      open={!!value}
      onClose={onClose}
      title={r.id ? L('编辑奖励', 'Edit reward') : L('上架奖励', 'New reward')}
      footer={
        <>
          {r.id && (
            <Button variant="danger" icon="trash" onClick={() => (actions.removeReward(r.id), onClose())}>
              {L('下架', 'Remove')}
            </Button>
          )}
          <span className="spacer" />
          <Button variant="ghost" onClick={onClose}>
            {L('取消', 'Cancel')}
          </Button>
          <Button variant="primary" icon="check" onClick={save} disabled={!r.title.trim()}>
            {L('保存', 'Save')}
          </Button>
        </>
      }
    >
      <div className="form">
        <Field label={L('奖励', 'Reward')}>
          <input className="input" value={r.title} onChange={(e) => setD({ ...r, title: e.target.value })} placeholder={L('例如：周末睡个懒觉', 'e.g. Sleep in on Saturday')} />
        </Field>
        <Field label={L('价格（金币）', 'Price (coins)')}>
          <input className="input" type="number" min={1} value={r.cost} onChange={(e) => setD({ ...r, cost: +e.target.value })} />
        </Field>
        <Field label={L('图标', 'Icon')}>
          <div className="icon-pick">
            {REWARD_ICONS.map((ic) => (
              <button type="button" key={ic} className={r.icon === ic ? 'is-on' : ''} onClick={() => setD({ ...r, icon: ic })} aria-label={ic}>
                <Icon name={ic} size={18} />
              </button>
            ))}
          </div>
        </Field>
      </div>
    </Modal>
  );
}
