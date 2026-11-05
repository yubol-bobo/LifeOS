/** Tiny synthesized chimes — no audio files to ship. */
let ctx: AudioContext | null = null;

export function chime(kind: 'remind' | 'done' | 'pop' = 'remind') {
  try {
    ctx ??= new AudioContext();
    const notes = kind === 'done' ? [659.25, 783.99, 1046.5] : kind === 'pop' ? [880] : [783.99, 1046.5];
    const t0 = ctx.currentTime + 0.01;
    notes.forEach((f, i) => {
      const o = ctx!.createOscillator();
      const g = ctx!.createGain();
      o.type = 'sine';
      o.frequency.value = f;
      const t = t0 + i * 0.12;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.16, t + 0.015);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
      o.connect(g).connect(ctx!.destination);
      o.start(t);
      o.stop(t + 0.55);
    });
  } catch {
    /* audio unavailable */
  }
}

export function sysNotify(title: string, body: string) {
  try {
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted' && document.hidden) new Notification(title, { body, icon: './favicon.svg', silent: true });
  } catch {
    /* ignore */
  }
}
