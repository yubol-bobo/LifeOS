import { useState } from 'react';
import { useL, useLang } from '../lib/i18n';
import { money } from '../lib/format';
import { useMetrics } from '../store/hooks';
import { actions, useStore } from '../store/store';
import { Icon } from '../ui/Icon';
import { appById, type AppId } from './apps';
import { useClock, useLiveSession } from './live';
import { open } from './router';

export function MenuBar({ app, onSpotlight, dark }: { app: AppId; onSpotlight: () => void; dark: boolean }) {
  const L = useL();
  const lang = useLang();
  const now = useClock(1000);
  const m = useMetrics();
  const currency = useStore((s) => s.profile.currency);
  const live = useLiveSession(250);
  const def = appById(app);
  const [menu, setMenu] = useState(false);

  const time = now.toLocaleTimeString(lang === 'zh' ? 'zh-CN' : 'en-US', { hour: '2-digit', minute: '2-digit' });
  const date = now.toLocaleDateString(lang === 'zh' ? 'zh-CN' : 'en-US', { weekday: 'short', month: 'short', day: 'numeric' });

  return (
    <header className="menubar">
      <div className="mb-left">
        <button className="mb-logo" onClick={() => setMenu((v) => !v)} aria-label="LifeOS menu" aria-expanded={menu}>
          <span className="logo-mark" />
        </button>
        <strong className="mb-app">{lang === 'zh' ? def.zh : def.en}</strong>
        <nav className="mb-menus">
          <button onClick={onSpotlight}>{L('前往', 'Go')}</button>
          <button onClick={() => actions.profile({ theme: dark ? 'light' : 'dark' })}>{L('外观', 'View')}</button>
          <button onClick={() => open('settings')}>{L('系统', 'System')}</button>
        </nav>
        {menu && (
          <div className="mb-dropdown" onMouseLeave={() => setMenu(false)}>
            <button onClick={() => (setMenu(false), open('settings'))}>
              <Icon name="info" size={15} /> {L('关于 LifeOS', 'About LifeOS')}
            </button>
            <button onClick={() => (setMenu(false), onSpotlight())}>
              <Icon name="search" size={15} /> {L('聚焦搜索', 'Spotlight')} <kbd>⌘K</kbd>
            </button>
            <hr />
            <button onClick={() => (setMenu(false), actions.profile({ theme: dark ? 'light' : 'dark' }))}>
              <Icon name={dark ? 'sun' : 'moon'} size={15} /> {dark ? L('切换到明亮', 'Light mode') : L('切换到暗夜', 'Dark mode')}
            </button>
            <button onClick={() => (setMenu(false), actions.profile({ lang: lang === 'zh' ? 'en' : 'zh' }))}>
              <Icon name="refresh" size={15} /> {lang === 'zh' ? 'English' : '中文'}
            </button>
            <hr />
            <button onClick={() => (setMenu(false), sessionStorage.removeItem('lifeos:booted'), location.reload())}>
              <Icon name="power" size={15} /> {L('重新启动…', 'Restart…')}
            </button>
          </div>
        )}
      </div>

      <div className="mb-right">
        {live && (
          <button className={`mb-live ${live.paused ? 'is-paused' : ''}`} onClick={() => open('earn')} title={L('正在计时', 'Focus running')}>
            <i className="pulse" />
            <span className="num">{money(live.earned, currency)}</span>
          </button>
        )}
        <span className="mb-item" title={L('连续天数', 'Streak')}>
          <Icon name="flame" size={15} className="ic-flame" />
          <span className="num">{m.streak.current}</span>
        </span>
        <span className="mb-item" title={L('金币', 'Coins')}>
          <span className="coin" />
          <span className="num">{m.coins.toLocaleString()}</span>
        </span>
        <button className="mb-item mb-level" onClick={() => open('trophies')} title={L('等级', 'Level')}>
          <span>Lv.{m.level.level}</span>
          <span className="mb-xp">
            <i style={{ width: `${m.level.progress * 100}%` }} />
          </span>
        </button>
        <button className="mb-icon" onClick={() => actions.profile({ theme: dark ? 'light' : 'dark' })} aria-label={L('切换主题', 'Toggle theme')}>
          <Icon name={dark ? 'sun' : 'moon'} size={15} />
        </button>
        <button className="mb-icon" onClick={onSpotlight} aria-label={L('搜索', 'Search')}>
          <Icon name="search" size={15} />
        </button>
        <span className="mb-clock">
          <span className="mb-date">{date}</span>
          <span className="num">{time}</span>
        </span>
      </div>
    </header>
  );
}
