import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { addDays, dayKey } from '../lib/date';
import { openSummary } from '../ai/summary';
import { hasReview } from '../store/review';
import { useL } from '../lib/i18n';
import type { AppId } from '../os/apps';
import { onAppEvent } from '../os/notify';
import { open } from '../os/router';
import { checkinDue } from '../store/assets';
import { upcoming } from '../store/countdowns';
import { periodOf } from '../lib/period';
import { scheduledDailies } from '../store/links';
import { actions, getState, useStore } from '../store/store';
import type { MoodEntry, PetKind } from '../store/types';
import { Icon } from '../ui/Icon';
import { MoodFace } from '../ui/MoodFace';
import { chime, sysNotify } from './sound';
import { BREAK_IDLE_MIN, MIN_SIT_STRETCH_FOR_AUTO_BREAK, nightKey, pastBedtime, waterPlan } from './health';
import { PetAvatar, type PetMood } from './sprites';

/* =====================================================================
   Desktop pet engine
   One rAF loop writes transforms straight to the DOM; React only renders
   when the pet's mood, bubble or menu changes.
   ===================================================================== */

const S = 78; // sprite size (px)

type Mode = 'idle' | 'walk' | 'perch' | 'peek' | 'sleep' | 'play' | 'react' | 'remind' | 'drag' | 'fall';
type After = 'idle' | 'perch' | 'peekTop' | 'peekSide' | 'sleep';

interface Anchor {
  el: Element;
  kind: 'perch' | 'peekTop' | 'peekSide';
  fx: number; // 0..1 along the edge
  side: -1 | 1; // for side peeks: -1 = left edge, 1 = right edge
  fy: number; // for side peeks: 0..1 down the edge
}

interface Engine {
  x: number;
  y: number;
  tx: number;
  ty: number;
  mode: Mode;
  after: After;
  anchor: Anchor | null;
  pending: Anchor | null;
  until: number;
  facing: 1 | -1;
  hopT: number;
  hop: number;
  squash: number;
  tilt: number;
  vx: number;
  vy: number;
  duck: number; // 0..1 how far a peeking pet has ducked behind its panel
  ball: { x: number; y: number; vx: number; vy: number } | null;
  lastTrail: number;
  dragOff: { x: number; y: number };
  down: { x: number; y: number; t: number } | null;
  dragging: boolean;
}

interface Bubble {
  id: string;
  text: string;
  sticky?: boolean;
  moods?: boolean;
  actions?: { label: string; icon?: string; primary?: boolean; run: () => void }[];
}

const ls = {
  get: (k: string, d = 0) => {
    try {
      return Number(localStorage.getItem(`lifeos:pet:${k}`)) || d;
    } catch {
      return d;
    }
  },
  set: (k: string, v: number) => {
    try {
      localStorage.setItem(`lifeos:pet:${k}`, String(v));
    } catch {
      /* ignore */
    }
  },
};

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)];

export function PetLayer({ app }: { app: AppId }) {
  const L = useL();
  const pet = useStore((s) => s.pet);
  const pomo = useStore((s) => s.pomo);
  const reduce = useStore((s) => s.profile.reduceMotion);
  const acc = useStore((s) => s.equip?.acc);
  const [mood, setMood] = useState<PetMood>('idle');
  const [bubble, setBubble] = useState<Bubble | null>(null);
  const [menu, setMenu] = useState(false);
  const [tag, setTag] = useState(false);
  const [spot, setSpot] = useState<{ x: number; y: number } | null>(null);
  const [thinking, setThinking] = useState(false);
  const [, force] = useState(0);

  const layer = useRef<HTMLDivElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const flip = useRef<HTMLDivElement>(null);
  const shadow = useRef<HTMLDivElement>(null);
  const ballEl = useRef<HTMLDivElement>(null);
  const appRef = useRef(app);
  appRef.current = app;
  const cfg = useRef(pet);
  cfg.current = pet;
  const bubbleRef = useRef(bubble);
  bubbleRef.current = bubble;
  const moodRef = useRef(mood);
  moodRef.current = mood;
  const pointer = useRef({ x: -999, y: -999, t: Date.now() });
  const Lr = useRef(L);
  Lr.current = L;

  const e = useRef<Engine>({
    x: window.innerWidth - 140,
    y: window.innerHeight - 110,
    tx: 0,
    ty: 0,
    mode: 'idle',
    after: 'idle',
    anchor: null,
    pending: null,
    until: performance.now() + 2000,
    facing: -1,
    hopT: 0,
    hop: 0,
    squash: 0,
    tilt: 0,
    vx: 0,
    vy: 0,
    duck: 0,
    ball: null,
    lastTrail: 0,
    dragOff: { x: 0, y: 0 },
    down: null,
    dragging: false,
  });

  const kind: PetKind = pet.kind;
  const flies = kind !== 'mochi';

  /* ---------------- particles (direct DOM, self-removing) ---------------- */
  const spawn = (type: 'heart' | 'star' | 'drop' | 'zzz' | 'dust' | 'coin' | 'note' | 'puff' | 'spark', x: number, y: number, n = 1, spread = 30) => {
    const host = layer.current;
    if (!host || (reduce && type !== 'zzz')) return;
    for (let i = 0; i < n; i++) {
      const p = document.createElement('span');
      p.className = `pp pp-${type}`;
      p.innerHTML = PARTICLE[type];
      p.style.left = `${x + rand(-spread / 2, spread / 2)}px`;
      p.style.top = `${y + rand(-spread / 4, spread / 4)}px`;
      p.style.setProperty('--dx', `${rand(-40, 40)}px`);
      p.style.setProperty('--dy', `${rand(-90, -40)}px`);
      p.style.setProperty('--rot', `${rand(-60, 60)}deg`);
      p.style.animationDelay = `${i * 60}ms`;
      p.addEventListener('animationend', () => p.remove());
      host.appendChild(p);
    }
  };

  /* ---------------- bubble helpers ---------------- */
  const say = (b: Bubble, ms = 5200) => {
    // Never let small talk replace a reminder that is waiting for an answer.
    // The ref is updated right away so two ticks in a row (throttled tabs) see it.
    if (bubbleRef.current?.sticky && !b.sticky) return;
    bubbleRef.current = b;
    setBubble(b);
    if (!b.sticky) window.setTimeout(() => setBubble((cur) => (cur?.id === b.id ? null : cur)), ms);
  };
  const remind = (b: Bubble, notifyTitle: string, face: PetMood = 'worried') => {
    const g = e.current;
    g.mode = 'remind';
    g.anchor = null;
    setMood(face);
    setMenu(false);
    say({ ...b, sticky: true });
    if (cfg.current.sound) chime('remind');
    if (cfg.current.sysNotify) sysNotify(`${cfg.current.name} · LifeOS`, notifyTitle);
    spawn('spark', g.x, g.y - S, 6, 50);
  };
  const release = () => {
    setBubble(null);
    setMood('happy');
    const g = e.current;
    g.mode = 'react';
    g.until = performance.now() + 900;
    g.hopT = 0;
    window.setTimeout(() => setMood('idle'), 1200);
  };

  /* ---------------- panels the pet can interact with ---------------- */
  const panels = () => {
    const sel = appRef.current === 'home' ? '.desktop .widget' : '.window';
    const els = [...document.querySelectorAll(sel), document.querySelector('.dock')].filter(Boolean) as Element[];
    return els.filter((el) => {
      const r = el.getBoundingClientRect();
      return r.width > 140 && r.right > 40 && r.left < innerWidth - 40 && r.bottom > 60 && r.top < innerHeight - 40;
    });
  };
  const anchorPoint = (a: Anchor) => {
    const r = a.el.getBoundingClientRect();
    if (a.kind === 'peekSide') {
      const x = a.side < 0 ? r.left + S * 0.08 : r.right - S * 0.08;
      return { x, y: Math.max(r.top + S + 10, Math.min(r.bottom - 10, r.top + 30 + a.fy * (r.height - 40))), r };
    }
    const x = r.left + 36 + a.fx * Math.max(0, r.width - 72);
    return { x, y: a.kind === 'perch' ? r.top + 3 : r.top + S * 0.52, r };
  };
  const validAnchor = (a: Anchor) => {
    const { x, y, r } = anchorPoint(a);
    if (r.width === 0 || !document.contains(a.el) || a.el.closest('.is-hidden')) return false;
    if (appRef.current !== 'home' && a.el.classList.contains('widget')) return false;
    if (a.kind === 'perch' && r.top < 34 + S) return false;
    if (a.kind === 'peekTop' && r.top < 34 + S * 0.55) return false;
    return x > 20 && x < innerWidth - 20 && y < innerHeight - 4;
  };

  /* ---------------- choosing what to do next ---------------- */
  const bounds = () => ({ x0: 50, x1: innerWidth - 50, y0: 34 + S + 16, y1: innerHeight - 96 });

  const goTo = (x: number, y: number, after: After, anchor: Anchor | null = null) => {
    const g = e.current;
    g.mode = 'walk';
    g.tx = x;
    g.ty = y;
    g.after = after;
    g.pending = anchor;
    g.anchor = null;
    g.hopT = 0;
    g.until = performance.now() + 14000;
  };

  const next = () => {
    const g = e.current;
    const now = performance.now();
    const lively = cfg.current.roam === 'lively';
    if (moodRef.current !== 'idle' && g.mode !== 'remind') setMood('idle');
    if (reduce || innerWidth < 760) {
      // Reduced motion, or a phone with no room to roam: live on the dock.
      const dock = document.querySelector('.dock');
      if (dock) {
        const a: Anchor = { el: dock, kind: 'perch', fx: reduce ? 0.96 : Math.random(), side: 1, fy: 0 };
        if (reduce || g.mode === 'fall' || !g.anchor) {
          g.anchor = a;
          g.mode = 'perch';
          g.until = now + (reduce ? 60_000 : rand(8000, 15000));
        } else {
          const pt = anchorPoint(a);
          goTo(pt.x, pt.y, 'perch', a); // stroll along the dock
        }
      }
      return;
    }
    // An app window just opened over the pet? Get out of the way first.
    const win = appRef.current !== 'home' ? document.querySelector('.window')?.getBoundingClientRect() : null;
    const inWindow = !!win && g.x > win.left + 30 && g.x < win.right - 30 && g.y > win.top + 30 && g.y < win.bottom + 10;
    const idleFor = Date.now() - pointer.current.t;
    const hour = new Date().getHours();
    const sleepy = idleFor > 180_000 || hour >= 23 || hour < 6;
    const ps = panels();
    const options: [string, number][] = [
      ['wander', lively ? 30 : 18],
      ['perch', ps.length ? 22 : 0],
      ['peek', ps.length ? 20 : 0],
      ['idle', lively ? 10 : 26],
      ['play', lively ? 9 : 2],
      ['sleep', sleepy ? 40 : 5],
    ];
    let r = Math.random() * options.reduce((a, o) => a + o[1], 0);
    let choice = options.find((o) => (r -= o[1]) <= 0)?.[0] ?? 'idle';
    if (inWindow && choice !== 'perch' && choice !== 'peek') choice = 'wander';
    const b = bounds();

    if (choice === 'perch' || choice === 'peek') {
      for (let tries = 0; tries < 6; tries++) {
        const el = pick(ps);
        const isDock = el.classList.contains('dock');
        const isWin = el.classList.contains('window');
        const kindA: Anchor['kind'] = choice === 'perch' ? (isWin ? 'peekSide' : 'perch') : isDock || isWin || Math.random() < 0.35 ? (isDock ? 'peekTop' : 'peekSide') : 'peekTop';
        const a: Anchor = { el, kind: kindA, fx: Math.random(), side: Math.random() < 0.5 ? -1 : 1, fy: Math.random() };
        if (!validAnchor(a)) continue;
        const pt = anchorPoint(a);
        goTo(pt.x, pt.y, kindA === 'perch' ? 'perch' : kindA, a);
        return;
      }
      choice = 'wander'; // nowhere suitable to sit — go for a walk instead
    }
    if (choice === 'play') {
      g.mode = 'play';
      g.until = now + rand(6000, 9000);
      g.ball = { x: Math.min(b.x1, Math.max(b.x0, g.x + rand(-200, 200))), y: Math.min(b.y1, Math.max(b.y0, g.y - rand(40, 160))), vx: rand(-260, 260), vy: rand(-200, 200) };
      setMood('happy');
      return;
    }
    if (choice === 'sleep') {
      g.mode = 'sleep';
      g.until = now + rand(14000, 30000);
      setMood('sleep');
      return;
    }
    if (choice === 'wander') {
      if (appRef.current !== 'home') {
        // An app window is open: stay in the gutters or ride on the dock instead of wandering over content.
        const win = document.querySelector('.window')?.getBoundingClientRect();
        const left = win ? win.left : 0;
        const right = win ? innerWidth - win.right : 0;
        if (Math.max(left, right) >= 90) {
          const x = left >= right ? rand(40, left - 40) : rand(innerWidth - right + 40, innerWidth - 40);
          goTo(x, rand(b.y0 + 60, b.y1), 'idle');
          return;
        }
        const dock = document.querySelector('.dock');
        if (dock) {
          const a: Anchor = { el: dock, kind: 'perch', fx: Math.random(), side: 1, fy: 0 };
          const pt = anchorPoint(a);
          goTo(pt.x, pt.y, 'perch', a);
          return;
        }
      }
      goTo(rand(b.x0, b.x1), rand(b.y0, b.y1), 'idle');
      return;
    }
    g.mode = 'idle';
    g.until = now + rand(2500, 6000);
  };

  /* ---------------- main loop ---------------- */
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let lastZ = 0;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const g = e.current;
      const b = bounds();
      let clip = '';
      let wantHop = 0;

      switch (g.mode) {
        case 'walk': {
          const dx = g.tx - g.x;
          const dy = g.ty - g.y;
          const dist = Math.hypot(dx, dy);
          const speed = (cfg.current.roam === 'lively' ? 170 : 105) * (flies ? 1.1 : 1);
          if (dist < 4 || now > g.until) {
            g.x = g.tx;
            g.y = g.ty;
            g.vx = 0;
            arrive();
          } else {
            const step = Math.min(dist, speed * dt);
            g.vx = (dx / dist) * speed;
            g.vy = (dy / dist) * speed;
            g.x += (dx / dist) * step;
            g.y += (dy / dist) * step;
            if (Math.abs(dx) > 2) g.facing = dx > 0 ? 1 : -1;
            if (!flies) {
              const prev = Math.sin(g.hopT);
              g.hopT += dt * 11;
              wantHop = Math.abs(Math.sin(g.hopT)) * 15;
              if (prev > 0 !== Math.sin(g.hopT) > 0) {
                g.squash = 1;
                spawn('dust', g.x, g.y - 4, 2, 18);
              }
            } else if (now - g.lastTrail > 90) {
              g.lastTrail = now;
              spawn(kind === 'nova' ? 'spark' : 'puff', g.x - g.facing * 18, g.y - (kind === 'nova' ? 30 : 10), 1, 8);
            }
          }
          break;
        }
        case 'perch':
        case 'peek': {
          const a = g.anchor;
          if (!a || !validAnchor(a)) {
            g.anchor = null;
            g.mode = 'fall';
            g.vy = 0;
            break;
          }
          const pt = anchorPoint(a);
          g.x = pt.x;
          g.y = pt.y;
          if (g.mode === 'peek') {
            // Occasionally duck fully behind the panel, then pop back up.
            const phase = (now / 1000) % 7;
            const target = phase > 5.2 && phase < 6.1 ? 1 : 0;
            g.duck += (target - g.duck) * Math.min(1, dt * 6);
            if (a.kind === 'peekTop') {
              const extra = g.duck * S * 0.5;
              g.y = pt.y + extra;
              clip = `inset(0 -40px ${Math.max(0, g.y - pt.r.top)}px -40px)`;
            } else {
              const shift = g.duck * S * 0.45 * -a.side;
              g.x = pt.x - shift;
              const hidden = a.side < 0 ? g.x + S / 2 - pt.r.left : pt.r.right - (g.x - S / 2);
              clip = a.side < 0 ? `inset(-40px ${Math.max(0, hidden)}px -40px -40px)` : `inset(-40px -40px -40px ${Math.max(0, hidden)}px)`;
              g.facing = a.side < 0 ? -1 : 1;
            }
            // Look toward the pointer while hiding.
          }
          if (now > g.until) leaveAnchor();
          break;
        }
        case 'sleep':
          if (now - lastZ > 1500) {
            lastZ = now;
            spawn('zzz', g.x + g.facing * 18, g.y - S + 8, 1, 6);
          }
          if (now > g.until) next();
          break;
        case 'play': {
          const ball = g.ball!;
          ball.x += ball.vx * dt;
          ball.y += ball.vy * dt;
          if (ball.x < b.x0 || ball.x > b.x1) ball.vx *= -1;
          if (ball.y < b.y0 - 40 || ball.y > b.y1) ball.vy *= -1;
          ball.x = Math.min(b.x1, Math.max(b.x0, ball.x));
          ball.y = Math.min(b.y1, Math.max(b.y0 - 40, ball.y));
          const dx = ball.x - g.x;
          const dy = ball.y + 20 - g.y;
          const d = Math.hypot(dx, dy);
          const sp = 230;
          if (d > 30) {
            g.x += (dx / d) * sp * dt;
            g.y += (dy / d) * sp * dt;
            g.facing = dx > 0 ? 1 : -1;
          } else {
            // caught it — bat it away
            ball.vx = rand(-300, 300);
            ball.vy = rand(-260, 120);
            spawn('star', ball.x, ball.y, 3, 20);
            g.squash = 1;
          }
          if (!flies) {
            g.hopT += dt * 12;
            wantHop = Math.abs(Math.sin(g.hopT)) * 18;
          }
          if (ballEl.current) ballEl.current.style.transform = `translate3d(${ball.x - 11}px, ${ball.y - 11}px, 0)`;
          if (now > g.until) {
            g.ball = null;
            spawn('star', g.x, g.y - S, 6, 60);
            g.mode = 'react';
            g.until = now + 900;
            g.hopT = 0;
            force((n) => n + 1);
          }
          break;
        }
        case 'react':
          g.hopT += dt * 9;
          wantHop = Math.max(0, Math.sin(g.hopT)) * 34;
          if (now > g.until) {
            g.hopT = 0;
            next();
          }
          break;
        case 'drag': {
          const tx = pointer.current.x + g.dragOff.x;
          const ty = pointer.current.y + g.dragOff.y;
          const vx = (tx - g.x) / Math.max(dt, 0.001);
          g.x += (tx - g.x) * Math.min(1, dt * 18);
          g.y += (ty - g.y) * Math.min(1, dt * 18);
          g.tilt += (Math.max(-30, Math.min(30, vx / 40)) - g.tilt) * Math.min(1, dt * 8);
          break;
        }
        case 'fall': {
          g.vy += 2200 * dt;
          g.y += g.vy * dt;
          const floor = Math.min(b.y1 + 40, innerHeight - 90);
          if (g.y >= floor) {
            g.y = floor;
            g.vy = 0;
            g.squash = 1.4;
            spawn('dust', g.x, g.y - 4, 5, 40);
            g.mode = 'idle';
            g.until = now + 1600;
          }
          break;
        }
        case 'remind': {
          // Stay visible: drift to a comfortable spot above the dock.
          const tx = Math.min(b.x1, Math.max(b.x0, g.x));
          const ty = Math.min(b.y1, Math.max(b.y0 + 60, g.y));
          g.x += (tx - g.x) * Math.min(1, dt * 4);
          g.y += (ty - g.y) * Math.min(1, dt * 4);
          g.hopT += dt * 4;
          wantHop = Math.max(0, Math.sin(g.hopT)) * 6;
          break;
        }
        default:
          if (now > g.until) next();
      }

      if (g.mode !== 'drag') g.tilt += ((flies && g.mode === 'walk' ? g.facing * 8 : 0) - g.tilt) * Math.min(1, dt * 6);
      if (flies && g.mode !== 'drag' && g.mode !== 'peek') wantHop += 6 + Math.sin(now / 420) * 4;
      g.hop = wantHop;
      g.squash = Math.max(0, g.squash - dt * 5);
      const sq = g.squash * 0.16;

      // eyes follow the pointer
      const px = pointer.current.x - g.x;
      const py = pointer.current.y - (g.y - S * 0.6);
      const pd = Math.hypot(px, py) || 1;
      const look = Math.min(1, pd / 160) * 2.4;
      const svg = flip.current?.firstElementChild as SVGElement | null;
      if (svg) {
        svg.style.setProperty('--lx', `${((px / pd) * look * g.facing).toFixed(2)}px`);
        svg.style.setProperty('--ly', `${((py / pd) * look).toFixed(2)}px`);
      }

      if (root.current) root.current.style.transform = `translate3d(${(g.x - S / 2).toFixed(1)}px, ${(g.y - S).toFixed(1)}px, 0)`;
      if (wrap.current) {
        wrap.current.style.transform = `translateY(${(-g.hop).toFixed(1)}px) rotate(${g.tilt.toFixed(1)}deg) scale(${1 + sq}, ${1 - sq})`;
        wrap.current.style.clipPath = clip;
      }
      if (flip.current) flip.current.style.transform = `scaleX(${g.facing})`;
      if (shadow.current) {
        const k = Math.max(0.35, 1 - g.hop / 60);
        shadow.current.style.transform = `scale(${k})`;
        shadow.current.style.opacity = clip || g.mode === 'perch' || g.mode === 'drag' ? '0' : String(0.9 * k);
      }
    };

    const arrive = () => {
      const g = e.current;
      const now = performance.now();
      if (g.pending && (g.after === 'perch' || g.after === 'peekTop' || g.after === 'peekSide') && validAnchor(g.pending)) {
        g.anchor = g.pending;
        g.pending = null;
        g.mode = g.after === 'perch' ? 'perch' : 'peek';
        g.duck = g.mode === 'peek' ? 1 : 0;
        g.until = now + rand(7000, 15000);
        g.squash = 1;
        if (g.mode === 'perch') spawn('dust', g.x, g.y - 2, 3, 30);
        return;
      }
      g.pending = null;
      g.mode = 'idle';
      g.until = now + rand(1500, 4000);
    };

    const leaveAnchor = () => {
      const g = e.current;
      if (g.anchor?.kind !== 'perch' && g.anchor) {
        // pop out from behind the panel
        g.y = Math.min(g.y, g.anchor.el.getBoundingClientRect().top - 2);
        spawn('star', g.x, g.y - S / 2, 3, 30);
      }
      g.anchor = null;
      g.mode = 'idle';
      g.until = 0;
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [kind, reduce]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const g = e.current;
    if (g.mode === 'remind' || g.mode === 'drag') return;
    g.anchor = null;
    g.pending = null;
    g.ball = null;
    g.mode = 'idle';
    g.until = performance.now() + 350; // let the window animate in, then re-plan
  }, [app]);

  /* ---------------- pointer: look, drag, click ---------------- */
  useEffect(() => {
    const move = (ev: PointerEvent) => {
      pointer.current = { x: ev.clientX, y: ev.clientY, t: Date.now() };
      const g = e.current;
      if (g.down && !g.dragging && Math.hypot(ev.clientX - g.down.x, ev.clientY - g.down.y) > 6) {
        g.dragging = true;
        g.mode = 'drag';
        g.anchor = null;
        g.ball = null;
        setMenu(false);
        setMood('surprised');
      }
      if (moodRef.current === 'sleep' && Math.hypot(ev.clientX - g.x, ev.clientY - (g.y - S / 2)) < 60) {
        g.mode = 'react';
        g.until = performance.now() + 700;
        setMood('surprised');
        window.setTimeout(() => setMood('idle'), 900);
      }
    };
    const up = () => {
      const g = e.current;
      if (!g.down) return;
      const wasDrag = g.dragging;
      g.down = null;
      g.dragging = false;
      if (!wasDrag) return;
      setMood('idle');
      // Dropped onto a panel's top edge? Sit there.
      for (const el of panels()) {
        const r = el.getBoundingClientRect();
        if (g.x > r.left + 20 && g.x < r.right - 20 && Math.abs(g.y - r.top) < 46) {
          g.anchor = { el, kind: 'perch', fx: Math.max(0, Math.min(1, (g.x - r.left - 36) / Math.max(1, r.width - 72))), side: 1, fy: 0 };
          g.mode = 'perch';
          g.until = performance.now() + rand(9000, 16000);
          g.squash = 1.2;
          spawn('dust', g.x, r.top, 4, 36);
          actions.bump('petPerch');
          return;
        }
      }
      g.mode = 'fall';
      g.vy = -200;
    };
    const keys = () => (pointer.current.t = Date.now());
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('keydown', keys);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('keydown', keys);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const onDown = (ev: React.PointerEvent) => {
    ev.preventDefault();
    const g = e.current;
    g.down = { x: ev.clientX, y: ev.clientY, t: Date.now() };
    g.dragOff = { x: g.x - ev.clientX, y: g.y - ev.clientY };
  };
  const onClick = () => {
    const g = e.current;
    if (g.dragging) return;
    if (g.mode === 'sleep') {
      setMood('surprised');
      g.mode = 'react';
      g.until = performance.now() + 800;
      window.setTimeout(() => setMood('idle'), 900);
      return;
    }
    spawn('heart', g.x, g.y - S, 3, 40);
    g.squash = 1;
    setMenu((m) => !m);
    actions.bump('petPats');
  };

  /* ---------------- reactions to what happens in LifeOS ---------------- */
  useEffect(
    () =>
      onAppEvent((ev) => {
        const g = e.current;
        if (g.mode === 'drag' || g.mode === 'remind') return;
        if (ev.type === 'xp') {
          spawn('star', g.x, g.y - S, 3, 40);
          if (g.mode !== 'perch' && g.mode !== 'peek') {
            g.mode = 'react';
            g.until = performance.now() + 700;
            g.hopT = 0;
          }
          setMood('happy');
          window.setTimeout(() => setMood((m) => (m === 'happy' ? 'idle' : m)), 1400);
        } else if (ev.tone === 'gold' || ev.tone === 'accent') {
          g.anchor = null;
          g.mode = 'react';
          g.until = performance.now() + 1600;
          g.hopT = 0;
          setMood('happy');
          spawn(ev.tone === 'gold' ? 'coin' : 'star', g.x, g.y - S, 8, 70);
          spawn('note', g.x, g.y - S, 2, 40);
          window.setTimeout(() => setMood('idle'), 2000);
        }
      }),
    [], // eslint-disable-line react-hooks/exhaustive-deps
  );

  /* ---------------- thinking (writing the day summary) ---------------- */
  useEffect(() => {
    let iv = 0;
    const f = (ev: Event) => {
      const on = (ev as CustomEvent<{ on: boolean }>).detail.on;
      setThinking(on);
      window.clearInterval(iv);
      if (on) {
        const g = e.current;
        g.mode = 'idle';
        g.until = performance.now() + 60_000; // stay put while thinking
        setMood('happy');
        spawn('spark', g.x, g.y - S, 10, 60);
        iv = window.setInterval(() => spawn('star', e.current.x, e.current.y - S, 2, 40), 700);
      } else {
        e.current.until = 0;
        setMood('idle');
      }
    };
    window.addEventListener('lifeos:pet-think', f);
    return () => (window.removeEventListener('lifeos:pet-think', f), window.clearInterval(iv));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---------------- locate ---------------- */
  useEffect(() => {
    const locate = () => {
      actions.bump('petLocate');
      const g = e.current;
      spawn('puff', g.x, g.y - S / 2, 8, 50);
      g.anchor = null;
      g.ball = null;
      g.x = innerWidth / 2;
      g.y = innerHeight / 2 + S / 2;
      g.mode = 'react';
      g.until = performance.now() + 1400;
      g.hopT = 0;
      setMood('happy');
      setTag(true);
      setSpot({ x: g.x, y: g.y - S / 2 });
      spawn('star', g.x, g.y - S, 10, 90);
      spawn('heart', g.x, g.y - S, 3, 40);
      window.setTimeout(() => setSpot(null), 1700);
      window.setTimeout(() => {
        setTag(false);
        setMood('idle');
      }, 3200);
    };
    window.addEventListener('lifeos:pet-locate', locate);
    return () => window.removeEventListener('lifeos:pet-locate', locate);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---------------- reminders, pomodoro, check-ins ---------------- */
  useEffect(() => {
    // "Sitting" = you're at the computer (input in the last 5 min) or a focus timer is running.
    let sitStart = Date.now();
    let lastActive = Date.now();
    let eyeAt = Date.now();
    let lastDrank = -1;
    let chatterAt = Date.now() + 90_000;
    if (!ls.get('waterAt')) ls.set('waterAt', Date.now() - (cfg.current.waterMin - 2) * 60_000); // first check ~2 min after opening
    const tick = () => {
      const now = Date.now();
      const s = getState();
      const c = cfg.current;
      const L = Lr.current;
      // Midnight: the pet writes up the day that just ended (works without AI too).
      const midnight = new Date(now).setHours(0, 0, 0, 0);
      if (c.nightSummary !== false && now - midnight < 15 * 60_000 && ls.get('nightSum') < midnight) {
        ls.set('nightSum', now);
        void openSummary(addDays(dayKey(now), -1), { auto: true });
      }
      const timerOn = !!s.active && !s.active.pausedAt;
      const inputRecent = now - pointer.current.t < BREAK_IDLE_MIN * 60_000;
      const active = inputRecent || timerOn;
      // Back after stepping away ≥ 5 min? That was a real break — log it automatically.
      if (active && now - lastActive > BREAK_IDLE_MIN * 60_000) {
        const sat = (lastActive - sitStart) / 60_000;
        sitStart = now;
        eyeAt = now;
        if (sat >= MIN_SIT_STRETCH_FOR_AUTO_BREAK) {
          actions.logWellness('breaks');
          if (!bubbleRef.current) say({ id: `back-${now}`, text: L('欢迎回来～刚才的离开已经自动记作一次起身活动', 'Welcome back — that time away counted as a stand-up break') }, 5000);
        }
      }
      if (active) lastActive = now;
      // Any drink logged anywhere (pet, Mood app, reminder) resets the water clock.
      const drank = s.wellness[dayKey()]?.water ?? 0;
      if (lastDrank >= 0 && drank > lastDrank) ls.set('waterAt', now);
      lastDrank = drank;

      // Pomodoro phase changes
      const p = s.pomo;
      if (p && !p.pausedLeft && now >= p.endsAt) {
        if (p.phase === 'work') {
          actions.logWellness('pomos', 1, c.pomoWork);
          actions.setPomo(null);
          if (c.sound) chime('done');
          remind(
            {
              id: 'pomo-done',
              text: Lr.current(`番茄完成！休息 ${c.pomoBreak} 分钟吧`, `Pomodoro done! Take ${c.pomoBreak} minutes`),
              actions: [
                { label: Lr.current('开始休息', 'Start break'), primary: true, icon: 'leaf', run: () => (actions.setPomo({ phase: 'break', startedAt: Date.now(), endsAt: Date.now() + c.pomoBreak * 60_000 }), release()) },
                { label: Lr.current('再来一个', 'Another one'), icon: 'timer', run: () => (actions.setPomo({ phase: 'work', startedAt: Date.now(), endsAt: Date.now() + c.pomoWork * 60_000 }), release()) },
              ],
            },
            Lr.current('番茄钟完成', 'Pomodoro complete'),
          );
        } else {
          actions.setPomo(null);
          if (c.sound) chime('remind');
          remind(
            {
              id: 'pomo-break',
              text: Lr.current('休息结束，继续下一个番茄？', 'Break’s over — another pomodoro?'),
              actions: [
                { label: Lr.current('开始专注', 'Focus'), primary: true, icon: 'timer', run: () => (actions.setPomo({ phase: 'work', startedAt: Date.now(), endsAt: Date.now() + c.pomoWork * 60_000 }), release()) },
                { label: Lr.current('先不了', 'Not now'), run: release },
              ],
            },
            Lr.current('休息结束', 'Break over'),
          );
        }
        return;
      }
      if (bubbleRef.current?.sticky || e.current.mode === 'drag') return;
      const inBreak = s.pomo?.phase === 'break';

      // Water — keep pace with the daily goal across waking hours
      const plan = waterPlan(new Date(now), drank, c.waterGoal, c.cupMl, c.wakeHour, c.sleepHour);
      if (c.waterMin && active && plan.inWindow && plan.behind > 0 && now - ls.get('waterAt') >= c.waterMin * 60_000) {
        ls.set('waterAt', now);
        remind(
          {
            id: 'water',
            text: L(
              `该喝水啦！今天 ${plan.drank}/${plan.goal} 杯（${plan.ml.drank}/${plan.ml.goal} ml），按节奏现在应该到 ${plan.expected} 杯了。`,
              `Water time! ${plan.drank}/${plan.goal} cups today (${plan.ml.drank}/${plan.ml.goal} ml) — by now you'd be at ${plan.expected}.`,
            ),
            actions: [
              { label: L('喝了一杯', 'Had a cup'), primary: true, icon: 'droplets', run: () => (actions.logWellness('water'), spawn('drop', e.current.x, e.current.y - S, 6, 40), release()) },
              { label: L('15 分钟后', 'In 15 min'), run: () => (ls.set('waterAt', now - (c.waterMin - 15) * 60_000), setBubble(null), setMood('idle'), next()) },
            ],
          },
          L(`该喝水了 · ${plan.drank}/${plan.goal} 杯`, `Time to drink water · ${plan.drank}/${plan.goal} cups`),
        );
        return;
      }
      // Sitting too long
      if (c.sitMin && active && !inBreak && now - sitStart >= c.sitMin * 60_000 && now > ls.get('sitSnooze')) {
        const sat = Math.round((now - sitStart) / 60_000);
        remind(
          {
            id: 'sit',
            text: L(`已经连续坐了 ${sat} 分钟。起来走动 2–3 分钟吧：伸展、倒杯水、看看窗外。`, `You've been sitting for ${sat} minutes. Get up and move for 2–3 minutes — stretch, refill water, look outside.`),
            actions: [
              { label: L('我起来了', "I'm up"), primary: true, icon: 'footprints', run: () => ((sitStart = Date.now()), (eyeAt = Date.now()), actions.logWellness('breaks'), release()) },
              { label: L('10 分钟后', 'In 10 min'), run: () => (ls.set('sitSnooze', Date.now() + 10 * 60_000), setBubble(null), setMood('idle'), next()) },
            ],
          },
          L(`久坐 ${sat} 分钟了，起来活动一下`, `Sitting for ${sat} min — time to move`),
        );
        return;
      }
      // Bedtime
      const night = nightKey(new Date(now));
      if (c.bedtime && inputRecent && pastBedtime(new Date(now), c.bedtime) && localStorage.getItem('lifeos:pet:bedNight') !== night && now > ls.get('bedSnooze')) {
        remind(
          {
            id: 'bed',
            text: L('到睡觉时间啦。成年人每晚需要 7–9 小时睡眠，明天的你会感谢现在的你。', "It's bedtime. Adults need 7–9 hours of sleep — tomorrow-you will be grateful."),
            actions: [
              {
                label: L('好，晚安', 'Okay, good night'),
                primary: true,
                icon: 'moon',
                run: () => {
                  try {
                    localStorage.setItem('lifeos:pet:bedNight', night);
                  } catch {
                    /* ignore */
                  }
                  actions.bump('bedtimeOk');
                  setBubble(null);
                  setMood('sleep');
                  e.current.mode = 'sleep';
                  e.current.until = performance.now() + 60_000;
                },
              },
              { label: L('再 15 分钟', '15 more min'), run: () => (ls.set('bedSnooze', Date.now() + 15 * 60_000), setBubble(null), setMood('idle'), next()) },
            ],
          },
          L('该睡觉了', 'Time for bed'),
          'sleep',
        );
        return;
      }
      // Planning nudges: a new week / month with nothing planned yet
      const hr = new Date(now).getHours();
      const dnow = new Date(now);
      if (inputRecent && hr >= 8 && hr < 21) {
        const wk = periodOf('week');
        const mo = periodOf('month');
        const needMonth = dnow.getDate() <= 3 && !s.plans.some((p) => p.scope === 'month' && p.period === mo) && localStorage.getItem('lifeos:pet:askedPlan') !== mo;
        const needWeek = (dnow.getDay() + 6) % 7 <= 1 && !s.plans.some((p) => p.scope === 'week' && p.period === wk) && localStorage.getItem('lifeos:pet:askedPlan') !== wk;
        if (needMonth || needWeek) {
          try {
            localStorage.setItem('lifeos:pet:askedPlan', needMonth ? mo : wk);
          } catch {
            /* ignore */
          }
          remind(
            {
              id: 'plan',
              text: needMonth ? L('新的一个月开始啦！花两分钟写下这个月最重要的几件事？', 'A new month! Two minutes to write down what matters most this month?') : L('新的一周～要不要先把本周计划定下来？我会帮你盯进度。', 'New week! Set this week’s plan? I’ll keep an eye on progress.'),
              actions: [
                {
                  label: L('去写计划', 'Plan it'),
                  primary: true,
                  icon: 'calendar',
                  run: () => {
                    try {
                      sessionStorage.setItem('lifeos:plan-tab', needMonth ? 'month' : 'week');
                    } catch {
                      /* ignore */
                    }
                    release();
                    open('plan');
                  },
                },
                { label: L('稍后', 'Later'), run: () => (setBubble(null), setMood('idle'), next()) },
              ],
            },
            needMonth ? L('写下本月计划', 'Plan your month') : L('写下本周计划', 'Plan your week'),
            'happy',
          );
          return;
        }
      }
      // Countdown heads-up (7 / 3 / 1 / 0 days), once per day per item
      if (inputRecent && !bubbleRef.current) {
        const soonItem = upcoming(s).find((c) => [0, 1, 3, 7].includes(c.daysLeft) && localStorage.getItem(`lifeos:pet:cd:${c.id}`) !== dayKey());
        if (soonItem) {
          try {
            localStorage.setItem(`lifeos:pet:cd:${soonItem.id}`, dayKey());
          } catch {
            /* ignore */
          }
          say(
            {
              id: `cd-${now}`,
              text: soonItem.daysLeft === 0 ? L(`就是今天：「${soonItem.title}」！`, `It’s today: “${soonItem.title}”!`) : L(`距离「${soonItem.title}」还有 ${soonItem.daysLeft} 天`, `${soonItem.daysLeft} day${soonItem.daysLeft > 1 ? 's' : ''} until “${soonItem.title}”`),
            },
            9000,
          );
        }
      }
      // Eyes: 20-20-20 (gentle, no buttons)
      if (c.eye20 && inputRecent && now - eyeAt >= 20 * 60_000 && !bubbleRef.current) {
        eyeAt = now;
        say({ id: `eye-${now}`, text: L('护眼时间：看向 6 米外的地方 20 秒～', 'Eye break: look at something ~6 m away for 20 seconds') }, 20_000);
        if (c.sysNotify) sysNotify(`${c.name} · LifeOS`, L('护眼时间：看向远处 20 秒', 'Eye break: look far away for 20 s'));
      }
      // Asset check-in due (at most once per day)
      if (active && checkinDue(s) && ls.get('assetsAsked') < new Date().setHours(0, 0, 0, 0)) {
        ls.set('assetsAsked', now);
        remind(
          {
            id: 'assets',
            text: Lr.current('到了盘点资产的时候啦，花一分钟记一下各账户现在的余额？', 'Asset check-in time — one minute to note your balances?'),
            actions: [
              { label: Lr.current('现在记录', 'Record now'), primary: true, icon: 'wallet', run: () => (release(), window.dispatchEvent(new Event('lifeos:asset-checkin'))) },
              { label: Lr.current('明天吧', 'Tomorrow'), run: () => (setBubble(null), setMood('idle'), next()) },
            ],
          },
          Lr.current('资产盘点', 'Asset check-in'),
        );
        return;
      }
      // Evening mood check-in
      const hour = new Date().getHours();
      if (active && hour >= 19 && !s.moods[dayKey()] && ls.get('moodAsked') < new Date().setHours(0, 0, 0, 0)) {
        ls.set('moodAsked', now);
        remind({ id: 'mood', text: Lr.current('今天过得怎么样？点一下就好', 'How was today? Just tap one'), moods: true }, Lr.current('心情打卡', 'Mood check-in'), 'happy');
        return;
      }
      // Missed midnight (app was closed)? Offer yesterday's summary once, in the morning.
      const yday = addDays(dayKey(now), -1);
      if (active && c.nightSummary !== false && hour >= 6 && hour < 13 && ls.get('nightSum') < midnight && !s.reviews?.[yday]?.ai && s.events.some((x) => dayKey(x.ts) === yday)) {
        ls.set('nightSum', now);
        remind(
          {
            id: 'yday-summary',
            text: L(`早呀！昨天还没总结，要我帮你写一份吗？`, `Morning! Want me to write up yesterday for you?`),
            actions: [
              { label: L('好呀', 'Yes please'), primary: true, icon: 'sparkles', run: () => (void openSummary(yday, { auto: true }), release()) },
              { label: L('不用了', 'No thanks'), run: () => (setBubble(null), setMood('idle'), next()) },
            ],
          },
          L('昨天的总结', "Yesterday's summary"),
          'happy',
        );
        return;
      }
      // Evening: a gentle, skippable nudge to review the day
      if (active && c.reviewNudge !== false && (hour > 21 || (hour === 21 && new Date(now).getMinutes() >= 30)) && !hasReview(s, dayKey(now)) && ls.get('reviewAsked') < midnight) {
        ls.set('reviewAsked', now);
        remind(
          {
            id: 'review',
            text: L('今天要不要花两分钟复盘一下？一句话也算～', 'Two minutes to look back on today? Even one line counts.'),
            actions: [
              { label: L('写两句', 'Write a line'), primary: true, icon: 'notebook', run: () => (open('review'), release()) },
              { label: L('你帮我总结', 'You summarize'), icon: 'sparkles', run: () => (void openSummary(dayKey()), release()) },
              { label: L('今天不了', 'Not today'), run: () => (setBubble(null), setMood('idle'), next()) },
            ],
          },
          L('每日复盘', 'Daily review'),
          'happy',
        );
        return;
      }
      // Light chatter
      if (active && now > chatterAt && !bubbleRef.current && e.current.mode !== 'sleep') {
        chatterAt = now + rand(4, 8) * 60_000;
        const due = scheduledDailies(s).filter((q) => !(s.completions[dayKey()] ?? []).includes(q.id)).length;
        const lines: [string, string][] = [
          due ? [`今天还有 ${due} 个任务，我陪你～`, `${due} quests left today — I’ve got your back`] : ['今天的任务都完成啦，好厉害！', 'All quests done today. Amazing!'],
          ['可以把我拖到面板上，我会坐在上面', 'Drag me onto a panel and I’ll sit on it'],
          ['点我可以开番茄钟哦', 'Click me to start a pomodoro'],
          [`今天喝了 ${s.wellness[dayKey()]?.water ?? 0} 杯水`, `${s.wellness[dayKey()]?.water ?? 0} cups of water today`],
        ];
        const [zh, en] = pick(lines);
        say({ id: `chat-${now}`, text: Lr.current(zh, en) }, 4500);
      }
    };
    const t = window.setInterval(tick, 5000);
    window.setTimeout(tick, 2500);
    return () => window.clearInterval(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---------------- render ---------------- */
  const w = useStore((s) => s.wellness[dayKey()]);
  const [, setClock] = useState(0);
  useEffect(() => {
    if (!pomo) return;
    const t = window.setInterval(() => setClock((n) => n + 1), 1000);
    return () => window.clearInterval(t);
  }, [pomo]);
  const pomoLeft = pomo ? Math.max(0, pomo.pausedLeft ?? pomo.endsAt - Date.now()) : 0;
  const mmss = `${String(Math.floor(pomoLeft / 60000)).padStart(2, '0')}:${String(Math.floor((pomoLeft % 60000) / 1000)).padStart(2, '0')}`;
  const g = e.current;
  const nearTop = g.y - S < 200;

  const menuItems: { icon: string; label: string; run: () => void; on?: boolean }[] = [
    { icon: 'hand', label: L('摸摸', 'Pet'), run: () => (spawn('heart', g.x, g.y - S, 6, 50), setMood('happy'), actions.bump('petPats'), window.setTimeout(() => setMood('idle'), 1500)) },
    { icon: 'droplets', label: L('喝水 +1', 'Water +1'), run: () => (actions.logWellness('water'), spawn('drop', g.x, g.y - S, 5, 40), ls.set('water', Date.now())) },
    { icon: 'footprints', label: L('起身了', 'Stood up'), run: () => actions.logWellness('breaks') },
    {
      icon: 'timer',
      label: pomo ? L('停止番茄', 'Stop pomodoro') : L(`番茄 ${pet.pomoWork}′`, `Pomodoro ${pet.pomoWork}′`),
      on: !!pomo,
      run: () => actions.setPomo(pomo ? null : { phase: 'work', startedAt: Date.now(), endsAt: Date.now() + pet.pomoWork * 60_000 }),
    },
    { icon: 'sparkles', label: L('今日总结', 'Day summary'), run: () => void openSummary(dayKey()) },
    { icon: 'gamepad', label: L('一起玩', 'Play'), run: () => (actions.bump('petPlay'), (g.mode = 'idle'), (g.until = 0), setMood('happy'), (g.ball = null), window.setTimeout(() => ((g.mode = 'play'), (g.until = performance.now() + 8000), (g.ball = { x: g.x + 120, y: g.y - 120, vx: 200, vy: -150 }), force((n) => n + 1)), 50)) },
    { icon: 'moon', label: L('去睡觉', 'Nap'), run: () => ((g.mode = 'sleep'), (g.until = performance.now() + 30000), setMood('sleep')) },
    { icon: 'settings', label: L('设置', 'Settings'), run: () => (sessionStorage.setItem('lifeos:settings-tab', 'pet'), open('settings'), window.dispatchEvent(new Event('lifeos:settings-tab'))) },
  ];

  return (
    <div className="pet-layer" ref={layer} aria-hidden={false}>
      {spot && <div className="pet-spotlight" style={{ '--sx': `${spot.x}px`, '--sy': `${spot.y}px` } as CSSProperties} />}
      {g.mode === 'play' && g.ball && <div className="pet-ball" ref={ballEl} />}
      <div className={`pet pet-k-${kind} ${tag ? 'is-located' : ''} ${thinking ? 'is-thinking' : ''}`} ref={root}>
        <div className="pet-shadow" ref={shadow} />
        {spot && <div className="pet-ripple" />}
        <div className="pet-wrap" ref={wrap}>
          <div className="pet-flip" ref={flip}>
            <PetAvatar kind={kind} size={S} mood={mood} acc={acc} />
          </div>
          <button className="pet-hit" onPointerDown={onDown} onClick={onClick} aria-label={pet.name} title={pet.name} />
        </div>
        {pomo && (
          <div className={`pet-badge ${pomo.phase}`}>
            <span className="tomato" />
            <span className="num">{mmss}</span>
          </div>
        )}
        {(tag || menu) && <div className="pet-tag">{pet.name}</div>}
        {bubble && (
          <div className={`pet-bubble ${nearTop ? 'below' : ''} ${bubble.sticky ? 'is-sticky' : ''}`}>
            <p>{bubble.text}</p>
            {bubble.moods && (
              <div className="pb-moods">
                {([1, 2, 3, 4, 5] as MoodEntry['v'][]).map((v) => (
                  <button key={v} onClick={() => (actions.setMood(v), release())} aria-label={`mood ${v}`}>
                    <MoodFace v={v} size={30} />
                  </button>
                ))}
              </div>
            )}
            {bubble.actions && (
              <div className="pb-actions">
                {bubble.actions.map((a) => (
                  <button key={a.label} className={a.primary ? 'is-primary' : ''} onClick={a.run}>
                    {a.icon && <Icon name={a.icon} size={13} />}
                    {a.label}
                  </button>
                ))}
              </div>
            )}
            {bubble.moods && (
              <button className="pb-close" onClick={() => (setBubble(null), setMood('idle'), next())} aria-label="close">
                <Icon name="x" size={12} />
              </button>
            )}
          </div>
        )}
        {menu && !bubble && (
          <div className={`pet-menu ${nearTop ? 'below' : ''}`}>
            <div className="pm-head">
              <strong>{pet.name}</strong>
              <span className="pm-stats num">
                <Icon name="droplets" size={12} /> {w?.water ?? 0}
                <Icon name="footprints" size={12} /> {w?.breaks ?? 0}
                <span className="tomato sm" /> {w?.pomos ?? 0}
              </span>
            </div>
            <div className="pm-grid">
              {menuItems.map((m) => (
                <button
                  key={m.icon}
                  className={m.on ? 'is-on' : ''}
                  onClick={() => {
                    m.run();
                    setMenu(false);
                  }}
                >
                  <Icon name={m.icon} size={16} />
                  <span>{m.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

const PARTICLE: Record<string, string> = {
  heart: '<svg viewBox="0 0 24 24" width="18" height="18"><path d="M12 21s-7.5-4.6-9.6-9.2C.9 8.4 3 4.5 6.6 4.5c2.1 0 3.6 1.2 5.4 3.2 1.8-2 3.3-3.2 5.4-3.2 3.6 0 5.7 3.9 4.2 7.3C19.5 16.4 12 21 12 21z" fill="#FF6F96"/><ellipse cx="7.5" cy="8.5" rx="2" ry="1.2" fill="#fff" opacity=".6" transform="rotate(-30 7.5 8.5)"/></svg>',
  star: '<svg viewBox="0 0 24 24" width="16" height="16"><path d="M12 1.5 14.2 9.8 22.5 12 14.2 14.2 12 22.5 9.8 14.2 1.5 12 9.8 9.8Z" fill="#FFD25E"/></svg>',
  spark: '<svg viewBox="0 0 24 24" width="12" height="12"><path d="M12 2 13.6 10.4 22 12 13.6 13.6 12 22 10.4 13.6 2 12 10.4 10.4Z" fill="#C9B6FF"/></svg>',
  drop: '<svg viewBox="0 0 24 24" width="15" height="15"><path d="M12 2s7 7.6 7 12.2A7 7 0 0 1 5 14.2C5 9.6 12 2 12 2z" fill="#4FB6F2"/><ellipse cx="9.5" cy="13" rx="1.6" ry="2.6" fill="#fff" opacity=".6"/></svg>',
  zzz: '<span>z</span>',
  dust: '<i></i>',
  puff: '<i></i>',
  coin: '<i></i>',
  note: '<span>♪</span>',
};
