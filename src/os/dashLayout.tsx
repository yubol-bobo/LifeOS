import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode, type RefObject } from 'react';
import { useL } from '../lib/i18n';
import { actions, useStore } from '../store/store';
import type { DashLayout } from '../store/types';
import { Button } from '../ui/kit';
import { Icon } from '../ui/Icon';
import { useLayout, type Layout } from './display';
import { open } from './router';

/**
 * Desktop layout editing: in edit mode, drag a tile to move it and drag its bottom-right corner to
 * resize it. The layout is saved per view (landscape dashboard / portrait), as an order plus
 * optional column/row spans; anything not customised keeps the built-in layout.
 */

/* ---------------- edit mode (UI-only state) ---------------- */

let editing = false;
const subs = new Set<() => void>();
const setEditing = (v: boolean) => {
  editing = v;
  subs.forEach((f) => f());
};
export const useDashEditing = () =>
  useSyncExternalStore(
    (f) => (subs.add(f), () => subs.delete(f)),
    () => editing,
  );
/** Close any app window and start editing the desktop layout. */
export function startDashEdit() {
  open('home');
  setEditing(true);
}
export const stopDashEdit = () => setEditing(false);

/** The tiles that can be laid out, with their names (ids match Settings → Desktop widgets). */
export const DASH_WIDGETS: { id: string; zh: string; en: string }[] = [
  { id: 'hero', zh: '星球与等级', en: 'Planet & level' },
  { id: 'quests', zh: '今日任务', en: "Today's quests" },
  { id: 'life', zh: '人生进度', en: 'Life progress' },
  { id: 'earn', zh: '今日收入', en: 'Earnings' },
  { id: 'assets', zh: '净资产', en: 'Net worth' },
  { id: 'effort', zh: '今日时间分配', en: 'Time split' },
  { id: 'projprog', zh: '项目进度', en: 'Project progress' },
  { id: 'research', zh: '学术', en: 'Research' },
  { id: 'plans', zh: '本周计划', en: 'This week' },
  { id: 'countdown', zh: '倒计时', en: 'Countdown' },
  { id: 'mood', zh: '心情打卡', en: 'Mood check-in' },
  { id: 'journal', zh: '每日复盘', en: 'Daily review' },
  { id: 'heat', zh: '经验热力图', en: 'XP heatmap' },
  { id: 'review', zh: '本周回顾', en: 'Weekly review' },
];

/* ---------------- per-tile props ---------------- */

type BoxProps = { 'data-w': string; 'data-cw'?: ''; 'data-ch'?: ''; style?: CSSProperties };
const DashCtx = createContext<(id: string) => BoxProps>((id) => ({ 'data-w': id }));
/** Props for a desktop tile: its id, order and any custom size. Spread onto the tile's <section>. */
export const useDashBox = (id: string) => useContext(DashCtx)(id);
/** The same, as a function, for a component that lays out several tiles. */
export const useDashBoxFn = () => useContext(DashCtx);

function boxFor(l: DashLayout | undefined, id: string): BoxProps {
  const p: BoxProps = { 'data-w': id };
  if (!l) return p;
  const style: Record<string, number> = {};
  if (l.order?.length) {
    const i = l.order.indexOf(id);
    style['--o'] = i >= 0 ? i : l.order.length + DASH_WIDGETS.findIndex((w) => w.id === id);
  }
  const sz = l.size?.[id];
  if (sz?.[0]) {
    style['--cw'] = sz[0];
    p['data-cw'] = '';
  }
  if (sz?.[1]) {
    style['--ch'] = sz[1];
    p['data-ch'] = '';
  }
  if (Object.keys(style).length) p.style = style as CSSProperties;
  return p;
}

/* ---------------- grid measuring ---------------- */

interface Grid {
  cols: number;
  colW: number;
  rowH: number | null; // null when rows size to content (portrait)
  gap: number;
}
function measure(el: HTMLElement): Grid {
  const cs = getComputedStyle(el);
  const cols = cs.gridTemplateColumns.split(' ').filter(Boolean);
  const rows = cs.gridTemplateRows.split(' ').filter(Boolean).map(parseFloat);
  const autoRows = cs.gridAutoRows;
  return {
    cols: cols.length,
    colW: parseFloat(cols[0]) || 1,
    rowH: autoRows.includes('min-content') || autoRows === 'auto' ? null : rows[0] || null,
    gap: parseFloat(cs.columnGap) || 0,
  };
}
const spanOf = (px: number, unit: number, gap: number) => Math.max(1, Math.round((px + gap) / (unit + gap)));

/** Editing is offered where the grid is wide enough: the landscape dashboard, or portrait on wide screens. */
const canEditAt = (mode: Layout) => (mode === 'landscape' ? window.innerWidth >= 1100 : window.innerWidth >= 1200);

/* ---------------- provider + editor ---------------- */

export function DashLayoutProvider({ desktop, children }: { desktop: RefObject<HTMLDivElement | null>; children: ReactNode }) {
  const mode = useLayout();
  const saved = useStore((s) => s.ui.dash?.[mode]);
  const isEditing = useDashEditing();
  const [draft, setDraft] = useState<DashLayout | undefined>(saved);
  useEffect(() => setDraft(saved), [saved]);
  const box = useCallback((id: string) => boxFor(draft, id), [draft]);

  // Esc leaves edit mode
  useEffect(() => {
    if (!isEditing) return;
    const k = (e: KeyboardEvent) => e.key === 'Escape' && stopDashEdit();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [isEditing]);

  return (
    <DashCtx.Provider value={box}>
      {children}
      {isEditing && <DashEditor desktop={desktop} mode={mode} draft={draft} setDraft={setDraft} />}
    </DashCtx.Provider>
  );
}

function tiles(root: HTMLElement) {
  return [...root.querySelectorAll<HTMLElement>(':scope > .widget[data-w]')];
}

/** The order as shown right now (CSS order, then DOM order). */
function currentOrder(root: HTMLElement) {
  return tiles(root)
    .map((el, i) => ({ id: el.dataset.w!, o: Number(getComputedStyle(el).order) || 0, i }))
    .sort((a, b) => a.o - b.o || a.i - b.i)
    .map((x) => x.id);
}

function DashEditor({ desktop, mode, draft, setDraft }: { desktop: RefObject<HTMLDivElement | null>; mode: Layout; draft: DashLayout | undefined; setDraft: (l: DashLayout | undefined) => void }) {
  const L = useL();
  const hidden = useStore((s) => s.ui.widgets);
  const [ghost, setGhost] = useState<{ x: number; y: number; label: string } | null>(null);
  const [wide, setWide] = useState(() => canEditAt(mode));
  const draftRef = useRef(draft);
  draftRef.current = draft;
  // keep the tiles clear of the floating edit bar, whatever its height
  const bar = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = bar.current;
    const root = desktop.current;
    if (!el || !root) return;
    const set = () => root.style.setProperty('--deb-h', `${el.offsetHeight}px`);
    set();
    const ro = new ResizeObserver(set);
    ro.observe(el);
    return () => {
      ro.disconnect();
      root.style.removeProperty('--deb-h');
    };
  }, [desktop]);

  // Edit chrome on the desktop itself, plus each tile's current size ("2 × 1") for the corner label.
  useLayoutEffect(() => {
    const root = desktop.current;
    if (!root) return;
    root.classList.add('is-editing');
    const label = () => {
      setWide(canEditAt(mode));
      const g = measure(root);
      for (const el of tiles(root)) {
        const r = el.getBoundingClientRect();
        const w = spanOf(r.width, g.colW, g.gap);
        const h = g.rowH ? spanOf(r.height, g.rowH, g.gap) : null;
        el.dataset.size = h ? `${w} × ${h}` : `${w} / ${g.cols}`;
      }
    };
    label();
    const ro = new ResizeObserver(label);
    ro.observe(root);
    tiles(root).forEach((el) => ro.observe(el));
    return () => {
      ro.disconnect();
      root.classList.remove('is-editing');
      tiles(root).forEach((el) => {
        delete el.dataset.size;
        el.classList.remove('is-drop-before', 'is-drop-after', 'is-dragging', 'is-resizing');
      });
    };
  }, [desktop, mode, draft, hidden]);

  const save = (next: DashLayout | undefined) => {
    setDraft(next);
    actions.setDash(mode, next);
  };

  // Pointer handling, delegated on the desktop: corner = resize, anywhere else = move.
  useEffect(() => {
    const root = desktop.current;
    if (!root) return;
    const down = (e: PointerEvent) => {
      if (e.button !== 0) return;
      const el = (e.target as HTMLElement).closest<HTMLElement>('.widget[data-w]');
      if (!el || el.parentElement !== root || !canEditAt(mode)) return;
      e.preventDefault();
      const id = el.dataset.w!;
      const r = el.getBoundingClientRect();
      const g = measure(root);
      const corner = e.clientX > r.right - 34 && e.clientY > r.bottom - 34;
      const name = (el.querySelector('.w-head h3, h1, h3')?.textContent || id).trim().slice(0, 40);

      if (corner) {
        el.classList.add('is-resizing');
        const w0 = spanOf(r.width, g.colW, g.gap);
        const h0 = g.rowH ? spanOf(r.height, g.rowH, g.gap) : null;
        let last = '';
        const move = (ev: PointerEvent) => {
          const w = Math.max(1, Math.min(g.cols, w0 + Math.round((ev.clientX - e.clientX) / (g.colW + g.gap))));
          const h = h0 && g.rowH ? Math.max(1, Math.min(4, h0 + Math.round((ev.clientY - e.clientY) / (g.rowH + g.gap)))) : undefined;
          const key = `${w}:${h}`;
          if (key === last) return;
          last = key;
          const cur = draftRef.current ?? {};
          setDraft({ ...cur, size: { ...cur.size, [id]: h ? [w, h] : [w] } });
        };
        const up = () => {
          window.removeEventListener('pointermove', move);
          window.removeEventListener('pointerup', up);
          el.classList.remove('is-resizing');
          if (last) save(draftRef.current);
        };
        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', up);
        return;
      }

      // move: a floating label follows the pointer; the tile under it shows where it will land
      let target: HTMLElement | null = null;
      let after = false;
      let started = false;
      const clear = () => tiles(root).forEach((t) => t.classList.remove('is-drop-before', 'is-drop-after'));
      const move = (ev: PointerEvent) => {
        if (!started && Math.hypot(ev.clientX - e.clientX, ev.clientY - e.clientY) < 6) return;
        if (!started) {
          started = true;
          el.classList.add('is-dragging');
        }
        setGhost({ x: ev.clientX, y: ev.clientY, label: name });
        const over = document
          .elementsFromPoint(ev.clientX, ev.clientY)
          .map((n) => (n as HTMLElement).closest?.<HTMLElement>('.widget[data-w]'))
          .find((n) => n && n !== el && n.parentElement === root);
        clear();
        target = over ?? null;
        if (target) {
          const tr = target.getBoundingClientRect();
          after = tr.width >= tr.height ? ev.clientX > tr.left + tr.width / 2 : ev.clientY > tr.top + tr.height / 2;
          target.classList.add(after ? 'is-drop-after' : 'is-drop-before');
        }
      };
      const up = () => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        el.classList.remove('is-dragging');
        clear();
        setGhost(null);
        if (!started || !target) return;
        const order = currentOrder(root).filter((x) => x !== id);
        const at = order.indexOf(target.dataset.w!) + (after ? 1 : 0);
        order.splice(at, 0, id);
        // keep hidden tiles' places too, so showing them again puts them back where they were
        const known = new Set(order);
        for (const w of DASH_WIDGETS) if (!known.has(w.id)) order.push(w.id);
        save({ ...(draftRef.current ?? {}), order });
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
    };
    root.addEventListener('pointerdown', down);
    return () => root.removeEventListener('pointerdown', down);
  }, [desktop, mode]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <div className="dash-editbar" ref={bar} role="toolbar" aria-label={L('编辑桌面布局', 'Edit desktop layout')}>
        <div className="deb-text">
          <b>
            <Icon name="layout-wide" size={15} /> {L('编辑桌面布局', 'Edit desktop layout')}
            <span className="muted"> · {mode === 'landscape' ? L('横版', 'landscape') : L('竖版', 'portrait')}</span>
          </b>
          <span className="muted small">
            {wide
              ? mode === 'landscape'
                ? L('拖动卡片换位置，拖右下角改宽度和高度。', 'Drag a tile to move it; drag its bottom-right corner to change its width and height.')
                : L('拖动卡片换位置，拖右下角改宽度（竖版的高度跟着内容走）。', 'Drag a tile to move it; drag its bottom-right corner to change its width (in portrait, height follows the content).')
              : L('窗口太窄了，放大窗口后才能拖动和调整大小。', 'The window is too narrow; widen it to move and resize tiles.')}
          </span>
        </div>
        <div className="deb-chips">
          {DASH_WIDGETS.map((w) => {
            const on = !hidden.includes(w.id);
            return (
              <button key={w.id} className={`chip chip-btn ${on ? 'is-active' : ''}`} onClick={() => actions.toggleWidget(w.id)} title={on ? L('点一下隐藏', 'Click to hide') : L('点一下显示', 'Click to show')}>
                <Icon name={on ? 'eye' : 'eye-off'} size={12} /> {L(w.zh, w.en)}
              </button>
            );
          })}
        </div>
        <div className="deb-actions">
          <Button size="sm" variant="ghost" icon="refresh" disabled={!draft} onClick={() => save(undefined)}>
            {L('恢复默认', 'Reset')}
          </Button>
          <Button size="sm" variant="primary" icon="check" onClick={stopDashEdit}>
            {L('完成', 'Done')}
          </Button>
        </div>
      </div>
      {ghost && (
        <div className="dash-ghost" style={{ left: ghost.x, top: ghost.y }}>
          <Icon name="grip" size={14} /> {ghost.label}
        </div>
      )}
    </>
  );
}

