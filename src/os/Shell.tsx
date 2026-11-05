import { useEffect, useState, type ReactNode } from 'react';
import { Desktop } from '../apps/Desktop';
import { Quests } from '../apps/Quests';
import { Roadmap } from '../apps/Roadmap';
import { Research } from '../apps/Research';
import { Earn } from '../apps/Earn';
import { Trackers } from '../apps/Trackers';
import { Shop } from '../apps/Shop';
import { Trophies } from '../apps/Trophies';
import { Settings } from '../apps/Settings';
import { Mood } from '../apps/Mood';
import { Assets, CheckinSheet } from '../apps/Assets';
import { attrCss, DEFAULT_ATTRS } from '../store/defaults';
import { PetLayer } from '../pet/PetLayer';
import { useLang } from '../lib/i18n';
import { money } from '../lib/format';
import { actions, useStore } from '../store/store';
import { loadFeed } from '../lib/scholarFeed';
import { initSync } from '../sync/engine';
import { Icon } from '../ui/Icon';
import { AppGlyph } from '../ui/kit';
import { appById, type AppId } from './apps';
import { Boot } from './Boot';
import { Dock } from './Dock';
import { useLiveSession } from './live';
import { MenuBar } from './MenuBar';
import { dismiss, useBursts, useNotices } from './notify';
import { Onboarding } from './Onboarding';
import { open, useRoute } from './router';
import { Spotlight } from './Spotlight';
import { useTheme } from './theme';

const APP_VIEWS: Record<Exclude<AppId, 'home'>, () => ReactNode> = {
  quests: () => <Quests />,
  roadmap: () => <Roadmap />,
  research: () => <Research />,
  earn: () => <Earn />,
  trackers: () => <Trackers />,
  mood: () => <Mood />,
  assets: () => <Assets />,
  shop: () => <Shop />,
  trophies: () => <Trophies />,
  settings: () => <Settings />,
};

export function Shell() {
  const dark = useTheme();
  const app = useRoute();
  const onboarded = useStore((s) => s.onboarded);
  const reduce = useStore((s) => s.profile.reduceMotion);
  const [booted, setBooted] = useState(() => sessionStorage.getItem('lifeos:booted') === '1');
  const [spot, setSpot] = useState(false);
  const [zoom, setZoom] = useState(false);
  const live = useLiveSession(1000);
  const currency = useStore((s) => s.profile.currency);
  const lang = useLang();
  const attributes = useStore((s) => s.attributes);
  const petOn = useStore((s) => s.pet.enabled);

  useEffect(() => {
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
    document.documentElement.dataset.motion = reduce ? 'reduce' : 'full';
  }, [lang, reduce]);

  useEffect(() => initSync(), []);

  // Pull the Google Scholar feed (if the deployment has one) once per page load.
  useEffect(() => {
    if (!onboarded) return;
    loadFeed().then((f) => f && actions.applyScholarFeed(f));
  }, [onboarded]);

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSpot((v) => !v);
      }
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, []);

  // Tab title doubles as a tiny earnings ticker while the wage timer runs.
  const def = appById(app);
  useEffect(() => {
    const name = lang === 'zh' ? def.zh : def.en;
    document.title = live ? `${live.paused ? '⏸' : '●'} ${money(live.earned, currency)} · LifeOS` : app === 'home' ? 'LifeOS' : `${name} · LifeOS`;
  }, [live?.earned, live?.paused, app, lang, currency]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!booted)
    return (
      <Boot
        fast={reduce}
        onDone={() => {
          sessionStorage.setItem('lifeos:booted', '1');
          setBooted(true);
        }}
      />
    );

  return (
    <div className="os">
      <style>{attrCss(DEFAULT_ATTRS) + attrCss(attributes)}</style>
      <Wallpaper />
      <MenuBar app={app} dark={dark} onSpotlight={() => setSpot(true)} />
      <main className="desk">
        <Desktop dark={dark} hidden={app !== 'home'} />
        {app !== 'home' && (
          <div className={`window ${zoom ? 'is-zoom' : ''}`} key={app} role="region" aria-label={lang === 'zh' ? def.zh : def.en}>
            <div className="win-bar" onDoubleClick={() => setZoom((z) => !z)}>
              <div className="lights">
                <button className="light l-close" aria-label="Close" onClick={() => open('home')}>
                  <Icon name="x" size={9} stroke={3.5} />
                </button>
                <button className="light l-min" aria-label="Minimize" onClick={() => open('home')}>
                  <Icon name="minus" size={9} stroke={3.5} />
                </button>
                <button className="light l-zoom" aria-label="Zoom" onClick={() => setZoom((z) => !z)}>
                  <Icon name="maximize" size={8} stroke={3.5} />
                </button>
              </div>
              <div className="win-title">
                <AppGlyph icon={def.icon} hue={def.hue} size={22} />
                <span>{lang === 'zh' ? def.zh : def.en}</span>
              </div>
              <div className="win-bar-end" />
            </div>
            <div className="win-body">{APP_VIEWS[app as Exclude<AppId, 'home'>]()}</div>
          </div>
        )}
      </main>
      <Dock app={app} />
      {petOn && onboarded && <PetLayer app={app} />}
      <CheckinSheet />
      <Notifications />
      <Bursts />
      {spot && <Spotlight dark={dark} onClose={() => setSpot(false)} />}
      {!onboarded && <Onboarding />}
    </div>
  );
}

function Wallpaper() {
  return (
    <div className="wallpaper" aria-hidden>
      <i className="blob b1" />
      <i className="blob b2" />
      <i className="blob b3" />
      <i className="grain" />
    </div>
  );
}

function Notifications() {
  const list = useNotices();
  return (
    <div className="notices" aria-live="polite">
      {list.map((n) => (
        <button key={n.id} className={`notice tone-${n.tone ?? 'info'}`} onClick={() => dismiss(n.id)}>
          <span className="notice-ic">
            <Icon name={n.icon ?? 'bell'} size={18} stroke={2.2} />
          </span>
          <span className="notice-text">
            <span className="notice-app">LifeOS</span>
            <strong>{n.title}</strong>
            {n.body && <span>{n.body}</span>}
          </span>
        </button>
      ))}
    </div>
  );
}

function Bursts() {
  const list = useBursts();
  return (
    <div className="bursts" aria-hidden>
      {list.map((b) => (
        <span key={b.id} className={`burst tone-${b.tone}`} style={{ left: b.x, top: b.y }}>
          {b.text}
        </span>
      ))}
    </div>
  );
}
