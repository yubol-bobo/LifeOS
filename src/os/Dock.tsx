import { useRef, useState, type CSSProperties } from 'react';
import { useLang } from '../lib/i18n';
import { dayKey } from '../lib/date';
import { isScheduled, onToday } from '../store/links';
import { useStore } from '../store/store';
import { AppGlyph } from '../ui/kit';
import { APPS, type AppId } from './apps';
import { open } from './router';

/** macOS-style magnifying dock with clay app icons. */
export function Dock({ app }: { app: AppId }) {
  const lang = useLang();
  const ref = useRef<HTMLDivElement>(null);
  const [mx, setMx] = useState<number | null>(null);
  const pending = useStore((s) => {
    const done = new Set(s.completions[dayKey()] ?? []);
    return s.quests.filter((q) => (q.kind === 'daily' ? isScheduled(q, dayKey()) && !done.has(q.id) : onToday(q) && !q.doneAt)).length;
  });
  // which timer app has a session running: 'earn' (paid) or 'projects' (project time)
  const runningApp = useStore((s) => (s.active ? (s.active.rate > 0 ? 'earn' : 'projects') : null));
  const reduce = useStore((s) => s.profile.reduceMotion);
  const ui = useStore((s) => s.ui);
  const apps = ui.dock.filter((id) => !ui.hidden.includes(id) || id === app).map((id) => APPS.find((a) => a.id === id)!).filter(Boolean);

  return (
    <nav
      className="dock-wrap"
      aria-label="Dock"
      onPointerMove={(e) => e.pointerType === 'mouse' && !reduce && setMx(e.clientX)}
      onPointerLeave={() => setMx(null)}
    >
      <div className="dock" ref={ref}>
        {apps.map((a, i) => {
          const scale = magnify(ref.current?.children[i] as HTMLElement | undefined, mx);
          const badge = a.id === 'quests' && pending > 0 ? pending : undefined;
          return (
            <div key={a.id} className="dock-slot" style={{ '--s': scale } as CSSProperties}>
              {a.id === 'settings' && i > 0 && <span className="dock-sep" />}
              <button
                className={`dock-item ${app === a.id ? 'is-open' : ''}`}
                onClick={() => open(a.id)}
                aria-label={lang === 'zh' ? a.zh : a.en}
                aria-current={app === a.id ? 'page' : undefined}
              >
                <span className="dock-tip">{lang === 'zh' ? a.zh : a.en}</span>
                <AppGlyph icon={a.icon} hue={a.hue} size={50} badge={badge} />
                {(app === a.id || a.id === runningApp) && <i className={`dock-dot ${a.id === runningApp ? 'is-live' : ''}`} />}
              </button>
            </div>
          );
        })}
      </div>
    </nav>
  );
}

function magnify(el: HTMLElement | undefined, mx: number | null) {
  if (!el || mx == null) return 1;
  const r = el.getBoundingClientRect();
  const d = Math.abs(mx - (r.left + r.width / 2));
  const reach = 150;
  return 1 + Math.max(0, 1 - d / reach) ** 2 * 0.42;
}
