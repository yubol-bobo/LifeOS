import confetti from 'canvas-confetti';

const COLORS = ['#FF6A3D', '#F2B33D', '#3F7BE0', '#1BA677', '#E2689A', '#7A5AE6'];

export function celebrate() {
  const base = { spread: 70, startVelocity: 42, ticks: 220, gravity: 0.9, scalar: 1.05, colors: COLORS, zIndex: 9999 };
  confetti({ ...base, particleCount: 70, origin: { x: 0.3, y: 0.7 }, angle: 60 });
  confetti({ ...base, particleCount: 70, origin: { x: 0.7, y: 0.7 }, angle: 120 });
}
