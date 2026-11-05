import { useEffect, useState } from 'react';
import { useL, useLang } from '../lib/i18n';
import { PetAvatar } from '../pet/sprites';
import { eraOf, unlocksBetween, type Unlock } from '../store/progression';
import { actions, useStore } from '../store/store';
import { Icon } from '../ui/Icon';
import { Button, Modal } from '../ui/kit';
import { open } from './router';

/** Celebration sheet when a level-up crosses an unlock or a new era. */
export function LevelUp() {
  const L = useL();
  const lang = useLang();
  const pet = useStore((s) => s.pet);
  const equip = useStore((s) => s.equip);
  const [ev, setEv] = useState<{ from: number; to: number; unlocks: Unlock[]; era?: string } | null>(null);
  useEffect(() => {
    const f = (e: Event) => {
      const { from, to } = (e as CustomEvent<{ from: number; to: number }>).detail;
      const unlocks = unlocksBetween(from, to);
      const newEra = eraOf(to).level > from ? eraOf(to) : null;
      if (unlocks.length || newEra) setEv({ from, to, unlocks, era: newEra ? (lang === 'zh' ? newEra.zh : newEra.en) : undefined });
    };
    window.addEventListener('lifeos:levelup', f);
    return () => window.removeEventListener('lifeos:levelup', f);
  }, [lang]);
  if (!ev) return null;
  return (
    <Modal
      open
      onClose={() => setEv(null)}
      title={L(`升到 Lv.${ev.to}！`, `Level ${ev.to}!`)}
      width={520}
      footer={
        <>
          <span className="spacer" />
          <Button onClick={() => setEv(null)}>{L('好耶', 'Nice')}</Button>
          <Button
            variant="primary"
            icon="sparkles"
            onClick={() => {
              sessionStorage.setItem('lifeos:trophy-tab', 'style');
              setEv(null);
              open('trophies');
            }}
          >
            {L('去装扮', 'Customize')}
          </Button>
        </>
      }
    >
      <div className="lu">
        {ev.era && (
          <p className="lu-era">
            {L('进入新时代：', 'A new era: ')}
            <b>{ev.era}</b>
          </p>
        )}
        {ev.unlocks.length > 0 && <p className="muted small">{L('解锁了：', 'You unlocked:')}</p>}
        <ul className="lu-list">
          {ev.unlocks.map((u) => (
            <li key={u.kind + u.id}>
              {u.kind === 'acc' ? (
                <span className="lu-pet">
                  <PetAvatar kind={pet.kind} size={56} mood="happy" acc={u.id} />
                </span>
              ) : (
                <span className={`lu-ic k-${u.kind}`}>
                  <Icon name={u.icon} size={20} />
                </span>
              )}
              <span className="lu-name">{lang === 'zh' ? u.zh : u.en}</span>
              {u.kind === 'acc' && equip.acc !== u.id && (
                <Button size="sm" variant="soft" onClick={() => actions.equip({ acc: u.id })}>
                  {L('戴上', 'Wear')}
                </Button>
              )}
              {u.kind === 'wall' && equip.wall !== u.id && (
                <Button size="sm" variant="soft" onClick={() => actions.equip({ wall: u.id })}>
                  {L('换上', 'Use')}
                </Button>
              )}
              {u.kind === 'planet' && <span className="muted small">{L('已出现在你的星球上', 'Now on your planet')}</span>}
            </li>
          ))}
        </ul>
      </div>
    </Modal>
  );
}
