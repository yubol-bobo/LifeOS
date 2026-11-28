import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { onSaveError } from '../store/persist';
import { Report } from '../apps/Report';
import { announceReports } from '../apps/reportNotice';
import { autoRefreshAmp } from '../apps/AmpSource';
import { initSnapshots } from './snapshot';
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
import { Review } from '../apps/Review';
import { Timeline } from '../apps/Timeline';
import { Plan } from '../apps/Plan';
import { Projects } from '../apps/Projects';
import { Assets, CheckinSheet } from '../apps/Assets';
import { attrCss, DEFAULT_ATTRS } from '../store/defaults';
import { PetLayer } from '../pet/PetLayer';
import { useLang } from '../lib/i18n';
import { money } from '../lib/format';
import { actions, getState, useStore } from '../store/store';
import { loadFeed } from '../lib/scholarFeed';
import { initSync } from '../sync/engine';
import { loadDictionary } from '../store/builtin';
import { Icon } from '../ui/Icon';
import { AppGlyph } from '../ui/kit';
import { appById, type AppId } from './apps';
import { Boot } from './Boot';
import { Dock } from './Dock';
import { useLiveSession } from './live';
import { MenuBar } from './MenuBar';
import { useFullscreen, useLayout, useWindowPrefs } from './display';
import { dismiss, notify, useBursts, useNotices } from './notify';
import { Onboarding } from './Onboarding';
import { LevelUp } from './LevelUp';
import { SummaryCard } from '../ai/SummaryCard';
import { closeSummary } from '../ai/summary';
import { FocusCelebrate } from './FocusCelebrate';
import { PlanNoteSheet } from '../apps/PlanNote';
import { DayHost } from '../apps/DayXp';
import { clock } from '../apps/Earn';
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
  review: () => <Review />,
  timeline: () => <Timeline />,
  report: () => <Report />,
  plan: () => <Plan />,
  projects: () => <Projects />,
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
  const equipWall = useStore((s) => (s.equip?.wall && s.equip.wall !== 'default' ? s.equip.wall : ''));

  useEffect(() => {
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
    document.documentElement.dataset.motion = reduce ? 'reduce' : 'full';
  }, [lang, reduce]);

  useEffect(() => initSync(), []);
  useEffect(() => initSnapshots(), []);
  // a failed save is never silent: warn once per problem (and again if it keeps failing later)
  useEffect(() => {
    let warned = 0;
    return onSaveError((msg) => {
      if (Date.now() - warned < 10 * 60_000) return;
      warned = Date.now();
      const zh = getState().profile.lang === 'zh';
      notify({ title: zh ? '保存失败：数据可能没存下来' : 'Save failed: your data may not be stored', body: (zh ? '请到 系统设置 → 通用 → 导出备份。' : 'Go to Settings → General → Export backup.') + ` (${msg})`, icon: 'info', tone: 'warn', onOpen: () => open('settings') }, 30_000);
    });
  }, []);
  // Asset Management Pro as the net-worth source: refresh quietly when it's a few hours old
  useEffect(() => autoRefreshAmp(getState()), []);
  // a new month (or year) began: say last one's report is ready
  useEffect(() => {
    const t = window.setTimeout(announceReports, 6000);
    return () => window.clearTimeout(t);
  }, []);
  useEffect(() => void loadDictionary().then(() => actions.localize()), []);

  // Pull the Google Scholar feed (if the deployment has one) once per page load.
  useEffect(() => {
    if (!onboarded) return;
    loadFeed().then((f) => f && actions.applyScholarFeed(f));
  }, [onboarded]);

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      // Esc closes the app window (unless a dialog, menu or input has focus)
      if (e.key === 'Escape' && document.querySelector('.sumcard') && !document.querySelector('.modal, .spotlight, .fc-card')) {
        closeSummary();
        return;
      }
      if (e.key === 'Escape' && !document.querySelector('.modal, .spotlight, .fc-card, .sumcard') && !(e.target as HTMLElement)?.closest?.('input, textarea, select')) {
        if (location.hash.replace(/^#\/?/, '')) open('home');
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSpot((v) => {
          if (!v) actions.bump('spotlight');
          return !v;
        });
      }
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, []);

  // Tab title doubles as a tiny earnings ticker while the wage timer runs.
  const def = appById(app);
  useEffect(() => {
    const name = lang === 'zh' ? def.zh : def.en;
    document.title = live ? `${live.paused ? '⏸' : '●'} ${live.left != null ? (live.left > 0 ? clock(live.left) : '🎉') : live.paid ? money(live.earned, currency) : clock(live.ms)} · LifeOS` : app === 'home' ? 'LifeOS' : `${name} · LifeOS`;
  }, [live ? Math.floor(live.ms / 1000) : -1, live?.paused, app, lang, currency]); // eslint-disable-line react-hooks/exhaustive-deps

  const layout = useLayout();
  const winPrefs = useWindowPrefs();
  const fullscreen = useFullscreen();
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
    <div className="os" data-wall={equipWall || undefined} data-layout={layout} data-fullscreen={fullscreen || undefined}>
      <style>{attrCss(DEFAULT_ATTRS) + attrCss(attributes)}</style>
      <Wallpaper />
      <MenuBar app={app} dark={dark} onSpotlight={() => (actions.bump('spotlight'), setSpot(true))} />
      <main className="desk">
        <Desktop dark={dark} hidden={app !== 'home'} />
        {app !== 'home' && winPrefs.clickOut && !zoom && (
          <div className="win-scrim" onClick={() => open('home')} title={lang === 'zh' ? '点击空白处返回桌面' : 'Click outside to go back to the desktop'} aria-hidden />
        )}
        {app !== 'home' && (
          <div
            className={`window ${zoom ? 'is-zoom' : ''} ${winPrefs.size === 'fit' ? 'is-fit' : ''}`}
            key={app}
            role="region"
            aria-label={lang === 'zh' ? def.zh : def.en}
            style={{ '--win-w': `${def.width ?? 1280}px` } as CSSProperties}
          >
            <div className="win-bar" onDoubleClick={() => setZoom((z) => !z)}>
              <div className="lights">
                <button className="light l-close" aria-label={lang === 'zh' ? '关闭' : 'Close'} onClick={() => open('home')}>
                  <Icon name="x" size={9} stroke={3.5} />
                </button>
                <button className="light l-min" aria-label={lang === 'zh' ? '最小化' : 'Minimize'} onClick={() => open('home')}>
                  <Icon name="minus" size={9} stroke={3.5} />
                </button>
                <button className="light l-zoom" aria-label={lang === 'zh' ? '缩放' : 'Zoom'} onClick={() => setZoom((z) => !z)}>
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
      <LevelUp />
      <SummaryCard />
      <FocusCelebrate />
      <PlanNoteSheet />
      <DayHost />
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
        <button key={n.id} className={`notice tone-${n.tone ?? 'info'}`} onClick={() => (n.onOpen?.(), dismiss(n.id))}>
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
