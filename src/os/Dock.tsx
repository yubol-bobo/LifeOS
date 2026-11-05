import { useRef, useState, type CSSProperties } from 'react';
import { useLang } from '../lib/i18n';
import { dayKey } from '../lib/date';
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
    return s.quests.filter((q) => !q.archived && (q.kind === 'daily' ? !done.has(q.id) : !q.doneAt)).length;
  });
  const running = useStore((s) => !!s.active);
  const reduce = useStore((s) => s.profile.reduceMotion);

  return (
    <nav
      className="dock-wrap"
      aria-label="Dock"
      onPointerMove={(e) => e.pointerType === 'mouse' && !reduce && setMx(e.clientX)}
      onPointerLeave={() => setMx(null)}
    >
      <div className="dock" ref={ref}>
        {APPS.map((a, i) => {
          const scale = magnify(ref.current?.children[i] as HTMLElement | undefined, mx);
          const badge = a.id === 'quests' && pending > 0 ? pending : undefined;
          return (
            <div key={a.id} className="dock-slot" style={{ '--s': scale } as CSSProperties}>
              {i === APPS.length - 1 && <span className="dock-sep" />}
              <button
                className={`dock-item ${app === a.id ? 'is-open' : ''}`}
                onClick={() => open(a.id)}
                aria-label={lang === 'zh' ? a.zh : a.en}
                aria-current={app === a.id ? 'page' : undefined}
              >
                <span className="dock-tip">{lang === 'zh' ? a.zh : a.en}</span>
                <AppGlyph icon={a.icon} hue={a.hue} size={50} badge={badge} />
                {(app === a.id || (a.id === 'earn' && running)) && <i className={`dock-dot ${a.id === 'earn' && running ? 'is-live' : ''}`} />}
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
