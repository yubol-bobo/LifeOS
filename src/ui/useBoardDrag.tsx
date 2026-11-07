import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/**
 * Drag cards between the columns of a kanban board.
 * Columns carry `data-col="<key>"`; cards call `start(e, id, from)` on pointer down.
 * Mouse drags begin after a few pixels; touch drags after a short press, so the board can still scroll.
 */
export function useBoardDrag<K extends string>(onDrop: (id: string, from: K, to: K) => void) {
  const [drag, setDrag] = useState<{ id: string; from: K; over: K | null } | null>(null);
  const ghost = useRef<HTMLDivElement>(null);
  const board = useRef<HTMLDivElement>(null);
  const st = useRef<{ id: string; from: K; x: number; y: number; dx: number; dy: number; w: number; started: boolean; timer?: number; stop: () => void } | null>(null);
  const suppress = useRef(false);
  const drop = useRef(onDrop);
  drop.current = onDrop;

  useEffect(() => () => st.current?.stop(), []);

  // look through everything under the pointer, so a desktop pet or a toast sitting on a column doesn't block the drop
  const colAt = (x: number, y: number) => {
    for (const el of document.elementsFromPoint(x, y)) {
      const col = (el.closest('[data-col]') as HTMLElement | null)?.dataset.col;
      if (col) return col as K;
    }
    return undefined;
  };
  const place = (x: number, y: number) => {
    const g = ghost.current;
    const s = st.current;
    if (g && s) g.style.transform = `translate(${x - s.dx}px, ${y - s.dy}px) rotate(2deg)`;
  };

  const start = (e: ReactPointerEvent<HTMLElement>, id: string, from: K) => {
    if (e.button !== 0 || (e.target as HTMLElement).closest('[data-nodrag], a')) return;
    st.current?.stop();
    const r = e.currentTarget.getBoundingClientRect();
    const touch = e.pointerType !== 'mouse';
    const begin = () => {
      const s = st.current;
      if (!s || s.started) return;
      s.started = true;
      document.body.classList.add('is-dragging-card');
      setDrag({ id: s.id, from: s.from, over: null });
      requestAnimationFrame(() => place(s.x, s.y));
      navigator.vibrate?.(8);
    };
    const move = (ev: PointerEvent) => {
      const s = st.current;
      if (!s) return;
      const dist = Math.hypot(ev.clientX - s.x, ev.clientY - s.y);
      if (!s.started) {
        if (touch && dist > 8) return stop(); // a scroll, not a drag
        if (!touch && dist > 5) begin();
        if (!s.started) return;
      }
      s.x = ev.clientX;
      s.y = ev.clientY;
      place(ev.clientX, ev.clientY);
      const over = colAt(ev.clientX, ev.clientY) ?? null;
      setDrag((d) => (d && d.over !== over ? { ...d, over } : d));
      // nudge a horizontally scrolling board when dragging near its edges
      const b = board.current?.getBoundingClientRect();
      if (b && board.current) {
        if (ev.clientX < b.left + 40) board.current.scrollLeft -= 14;
        else if (ev.clientX > b.right - 40) board.current.scrollLeft += 14;
      }
    };
    const up = (ev: PointerEvent) => {
      const s = st.current;
      if (s?.started) {
        const to = colAt(ev.clientX, ev.clientY);
        suppress.current = true;
        setTimeout(() => (suppress.current = false), 0);
        if (to && to !== s.from) drop.current(s.id, s.from, to);
      }
      stop();
    };
    const noScroll = (ev: TouchEvent) => st.current?.started && ev.preventDefault();
    const stop = () => {
      window.clearTimeout(st.current?.timer);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', stop);
      window.removeEventListener('touchmove', noScroll);
      document.body.classList.remove('is-dragging-card');
      st.current = null;
      setDrag(null);
    };
    st.current = { id, from, x: e.clientX, y: e.clientY, dx: e.clientX - r.left, dy: e.clientY - r.top, w: r.width, started: false, stop };
    if (touch) st.current.timer = window.setTimeout(begin, 280);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', stop);
    window.addEventListener('touchmove', noScroll, { passive: false });
  };

  /** The floating card that follows the pointer (a render function, not a component, so it isn't remounted). */
  const ghostEl = (children: ReactNode) => {
    const s = st.current;
    return drag && s
      ? createPortal(
          <div className="paper-ghost" ref={ghost} style={{ width: s.w, transform: `translate(${s.x - s.dx}px, ${s.y - s.dy}px) rotate(2deg)` }}>
            {children}
          </div>,
          document.body,
        )
      : null;
  };

  /** True right after a drag ends, so the card's click handler can ignore that click. */
  const justDragged = () => suppress.current;

  return { drag, board, start, ghostEl, justDragged };
}
