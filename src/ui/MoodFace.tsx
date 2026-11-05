import { useId } from 'react';

/** Five clay mood faces, 1 = rough day … 5 = great day. */
export const MOOD_COLORS = ['', '#7C8AA5', '#9E8BD8', '#E2B65A', '#3FBF8F', '#FF7A45'];
export const MOOD_LABELS: [string, string][] = [
  ['', ''],
  ['很糟', 'Rough'],
  ['低落', 'Low'],
  ['一般', 'Okay'],
  ['不错', 'Good'],
  ['超棒', 'Great'],
];

export function MoodFace({ v, size = 36 }: { v: number; size?: number }) {
  const id = useId().replace(/:/g, '');
  const c = MOOD_COLORS[v] ?? MOOD_COLORS[3];
  const ink = '#2B1F1A';
  const mouth = [
    '',
    'M13 27 q7 -6 14 0',
    'M14 26.5 q6 -2.5 12 0',
    'M14 25.5 h12',
    'M13 24 q7 6 14 0',
    'M12 23 q8 10 16 0 z',
  ][v];
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden className="mood-face">
      <defs>
        <radialGradient id={id} cx="35%" cy="28%" r="80%">
          <stop offset="0" stopColor="#fff" stopOpacity=".85" />
          <stop offset=".35" stopColor={c} stopOpacity=".75" />
          <stop offset="1" stopColor={c} />
        </radialGradient>
      </defs>
      <circle cx="20" cy="20" r="18" fill={`url(#${id})`} />
      <circle cx="20" cy="20" r="18" fill="none" stroke="#000" strokeOpacity=".08" />
      <ellipse cx="13.5" cy="11" rx="5" ry="2.6" fill="#fff" opacity=".55" transform="rotate(-25 13.5 11)" />
      {v === 5 ? (
        <g stroke={ink} strokeWidth="2.2" strokeLinecap="round" fill="none">
          <path d="M11.5 18 q2.5 -3.5 5 0" />
          <path d="M23.5 18 q2.5 -3.5 5 0" />
        </g>
      ) : (
        <g fill={ink}>
          <ellipse cx="14" cy="17.5" rx="2" ry={v <= 2 ? 2 : 2.5} />
          <ellipse cx="26" cy="17.5" rx="2" ry={v <= 2 ? 2 : 2.5} />
          <circle cx="14.7" cy="16.6" r=".7" fill="#fff" />
          <circle cx="26.7" cy="16.6" r=".7" fill="#fff" />
        </g>
      )}
      {v === 1 && <path d="M10 13 l5 1.6 M30 13 l-5 1.6" stroke={ink} strokeWidth="1.6" strokeLinecap="round" />}
      {v >= 4 && (
        <>
          <ellipse cx="10" cy="23" rx="3" ry="1.7" fill="#FF6F96" opacity=".45" />
          <ellipse cx="30" cy="23" rx="3" ry="1.7" fill="#FF6F96" opacity=".45" />
        </>
      )}
      <path d={mouth} stroke={ink} strokeWidth="2" fill={v === 5 ? ink : 'none'} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
