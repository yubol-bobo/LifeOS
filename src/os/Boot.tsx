import { useEffect, useState } from 'react';

/** Short boot sequence, shown once per browser session. Click or press any key to skip. */
export function Boot({ onDone, fast }: { onDone: () => void; fast: boolean }) {
  const [p, setP] = useState(0);
  const [leaving, setLeaving] = useState(false);
  useEffect(() => {
    const total = fast ? 300 : 1500;
    const t0 = performance.now();
    let raf = 0;
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / total);
      setP(1 - Math.pow(1 - k, 3));
      if (k < 1) raf = requestAnimationFrame(step);
      else finish();
    };
    raf = requestAnimationFrame(step);
    const skip = () => finish();
    window.addEventListener('keydown', skip);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', skip);
    };
    function finish() {
      setLeaving(true);
      window.setTimeout(onDone, fast ? 50 : 420);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className={`boot ${leaving ? 'is-leaving' : ''}`} onClick={() => (setLeaving(true), window.setTimeout(onDone, 300))}>
      <div className="boot-mark">
        <span className="logo-mark logo-xl" />
      </div>
      <div className="boot-name">
        Life<span>OS</span>
      </div>
      <div className="boot-bar">
        <i style={{ width: `${p * 100}%` }} />
      </div>
    </div>
  );
}
