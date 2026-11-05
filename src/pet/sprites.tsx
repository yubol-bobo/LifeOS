import { useId, type CSSProperties } from 'react';
import type { PetKind } from '../store/types';

/**
 * Original clay-style desktop pets. Pure SVG + CSS so they stay crisp at any size and
 * theme. Expressions: idle (with blinks), happy, sleep, surprised, worried.
 * Pupils follow the cursor through the --lx / --ly custom properties on the svg root.
 */
export type PetMood = 'idle' | 'happy' | 'sleep' | 'surprised' | 'worried';

export const PET_KINDS: { id: PetKind; zh: string; en: string; blurbZh: string; blurbEn: string }[] = [
  { id: 'mochi', zh: '团子', en: 'Mochi', blurbZh: '软糯的橘子团子猫，蹦蹦跳跳', blurbEn: 'A squishy tangerine mochi-cat that hops' },
  { id: 'bolt', zh: '小电', en: 'Bolt', blurbZh: '喷气飞行的薄荷小机器人', blurbEn: 'A jet-powered mint mini robot' },
  { id: 'nova', zh: '星灵', en: 'Nova', blurbZh: '带着星环的紫色小星球', blurbEn: 'A tiny ringed star spirit' },
];

export function PetAvatar({ kind, size = 80, mood = 'idle', style, acc }: { kind: PetKind; size?: number; mood?: PetMood; style?: CSSProperties; acc?: string }) {
  const uid = useId().replace(/:/g, '');
  const Body = kind === 'bolt' ? Bolt : kind === 'nova' ? Nova : Mochi;
  return (
    <svg className={`pet-svg pet-${kind} mood-${mood}`} width={size} height={size} viewBox="0 0 100 100" style={style} aria-hidden>
      {acc === 'halo' && <Accessory kind={kind} acc="halo" id={uid} back />}
      <Body id={uid} mood={mood} />
      {acc && acc !== 'none' && <Accessory kind={kind} acc={acc} id={uid} />}
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Accessories (unlocked on the level road)                            */
/* ------------------------------------------------------------------ */

const ANCHOR: Record<PetKind, { top: number; hatX: number; eyes: [number, number, number]; neck: number; w: number }> = {
  mochi: { top: 24, hatX: 50, eyes: [37, 63, 59], neck: 79, w: 38 },
  bolt: { top: 21, hatX: 66, eyes: [37, 63, 54], neck: 84, w: 36 },
  nova: { top: 29, hatX: 50, eyes: [39, 61, 58], neck: 80, w: 30 },
};

function Accessory({ kind, acc, id, back = false }: { kind: PetKind; acc: string; id: string; back?: boolean }) {
  const a = ANCHOR[kind];
  if (acc === 'halo')
    return back ? (
      <g className="acc-halo">
        <ellipse cx="50" cy={a.top - 10} rx="20" ry="5.5" fill="none" stroke="#FFE08A" strokeWidth="3.5" opacity=".9" />
        <ellipse cx="50" cy={a.top - 10} rx="20" ry="5.5" fill="none" stroke="#FFF7D6" strokeWidth="1.2" />
      </g>
    ) : null;
  if (acc === 'sprout')
    return (
      <g className="acc-sprout" transform={`translate(${kind === 'bolt' ? 64 : 50} ${a.top + 1})`}>
        <path d="M0 0 C0 -6 0 -8 0 -10" stroke="#3E9B5F" strokeWidth="2.4" strokeLinecap="round" fill="none" />
        <path d="M0 -9 C-9 -14 -12 -6 -6 -4 C-3 -3 -1 -6 0 -9 Z" fill="#6CC27A" />
        <path d="M0 -10 C8 -17 13 -8 7 -5 C4 -4 1 -7 0 -10 Z" fill="#8BD88E" />
      </g>
    );
  if (acc === 'party')
    return (
      <g className="acc-party" transform={`translate(${a.hatX} ${a.top + 2}) rotate(12)`}>
        <defs>
          <linearGradient id={`${id}ph`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#7A5AE6" />
            <stop offset="1" stopColor="#B69CFF" />
          </linearGradient>
        </defs>
        <path d="M-9 0 L0 -24 L9 0 Z" fill={`url(#${id}ph)`} />
        <path d="M-6 -8 L6 -8 M-3.5 -15 L3.5 -15" stroke="#FFD25E" strokeWidth="2.2" strokeLinecap="round" />
        <circle cx="0" cy="-25" r="3.6" fill="#FF6F96" />
        <ellipse cx="0" cy="0" rx="10" ry="2.6" fill="#5B3FC9" />
      </g>
    );
  if (acc === 'scarf')
    return (
      <g className="acc-scarf">
        <path d={`M${50 - a.w} ${a.neck - 4} Q50 ${a.neck + 6} ${50 + a.w} ${a.neck - 4} L${50 + a.w - 2} ${a.neck + 3} Q50 ${a.neck + 13} ${50 - a.w + 2} ${a.neck + 3} Z`} fill="#E0473C" />
        <path d={`M${50 - a.w + 4} ${a.neck} Q50 ${a.neck + 9} ${50 + a.w - 4} ${a.neck}`} stroke="#fff" strokeOpacity=".35" strokeWidth="1.5" fill="none" />
        <path d={`M${50 + a.w - 12} ${a.neck + 4} l4 14 l7 -2 l-3 -13 z`} fill="#C9372D" />
      </g>
    );
  if (acc === 'glasses') {
    const [lx, rx, y] = a.eyes;
    return (
      <g className="acc-glasses" stroke="#2B1B12" strokeWidth="2" fill="rgba(255,255,255,.18)">
        <circle cx={lx} cy={y} r="8.5" />
        <circle cx={rx} cy={y} r="8.5" />
        <path d={`M${lx + 8.5} ${y - 1} Q50 ${y - 5} ${rx - 8.5} ${y - 1}`} fill="none" />
      </g>
    );
  }
  if (acc === 'crown')
    return (
      <g className="acc-crown" transform={`translate(${a.hatX} ${a.top + 3})`}>
        <path d="M-12 0 L-12 -11 L-6 -5 L0 -15 L6 -5 L12 -11 L12 0 Z" fill="#F5B83D" stroke="#C98A12" strokeWidth="1.2" strokeLinejoin="round" />
        <circle cx="0" cy="-15" r="2.2" fill="#FF6F96" />
        <circle cx="-12" cy="-11" r="1.8" fill="#4FB6F2" />
        <circle cx="12" cy="-11" r="1.8" fill="#4FB6F2" />
        <rect x="-12" y="-3" width="24" height="3" fill="#FFE08A" />
      </g>
    );
  return null;
}

/* ------------------------------------------------------------------ */
/* Shared face                                                         */
/* ------------------------------------------------------------------ */

function Eyes({ mood, lx, rx, y, ink, glow }: { mood: PetMood; lx: number; rx: number; y: number; ink: string; glow?: string }) {
  if (mood === 'happy')
    return (
      <g className="pet-eyes" stroke={ink} strokeWidth="3.2" strokeLinecap="round" fill="none">
        <path d={`M${lx - 5} ${y + 1} q5 -7 10 0`} />
        <path d={`M${rx - 5} ${y + 1} q5 -7 10 0`} />
      </g>
    );
  if (mood === 'sleep')
    return (
      <g className="pet-eyes" stroke={ink} strokeWidth="3" strokeLinecap="round" fill="none">
        <path d={`M${lx - 5} ${y} q5 4 10 0`} />
        <path d={`M${rx - 5} ${y} q5 4 10 0`} />
      </g>
    );
  const r = mood === 'surprised' ? 6.4 : 5.2;
  const ry = mood === 'surprised' ? 6.4 : 6.6;
  return (
    <g className="pet-eyes blinking">
      <g className="pet-pupils">
        <ellipse cx={lx} cy={y} rx={r} ry={ry} fill={ink} />
        <ellipse cx={rx} cy={y} rx={r} ry={ry} fill={ink} />
        {glow && (
          <>
            <ellipse cx={lx} cy={y} rx={r + 2.5} ry={ry + 2.5} fill={glow} opacity=".25" />
            <ellipse cx={rx} cy={y} rx={r + 2.5} ry={ry + 2.5} fill={glow} opacity=".25" />
          </>
        )}
        <circle cx={lx + 1.8} cy={y - 2.4} r="1.9" fill="#fff" />
        <circle cx={rx + 1.8} cy={y - 2.4} r="1.9" fill="#fff" />
        <circle cx={lx - 1.6} cy={y + 2.2} r=".9" fill="#fff" opacity=".8" />
        <circle cx={rx - 1.6} cy={y + 2.2} r=".9" fill="#fff" opacity=".8" />
      </g>
      {mood === 'worried' && (
        <g stroke={ink} strokeWidth="2" strokeLinecap="round">
          <path d={`M${lx - 6} ${y - 8.5} l8 -3`} />
          <path d={`M${rx + 6} ${y - 8.5} l-8 -3`} />
        </g>
      )}
    </g>
  );
}

function Mouth({ mood, x, y, ink }: { mood: PetMood; x: number; y: number; ink: string }) {
  if (mood === 'surprised') return <ellipse cx={x} cy={y + 1.5} rx="3" ry="3.6" fill={ink} />;
  if (mood === 'happy')
    return (
      <g>
        <path d={`M${x - 6} ${y - 1} q6 9 12 0 z`} fill={ink} />
        <path d={`M${x - 3} ${y + 2.6} q3 2 6 0`} fill="#FF8FA6" />
      </g>
    );
  if (mood === 'sleep') return <ellipse cx={x} cy={y + 1} rx="2.2" ry="1.6" fill={ink} opacity=".7" />;
  if (mood === 'worried') return <path d={`M${x - 4} ${y + 2} q4 -4 8 0`} stroke={ink} strokeWidth="2" fill="none" strokeLinecap="round" />;
  return <path d={`M${x - 5} ${y} q2.5 3 5 0 q2.5 3 5 0`} stroke={ink} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />;
}

/* ------------------------------------------------------------------ */
/* Mochi — tangerine mochi-cat                                         */
/* ------------------------------------------------------------------ */

function Mochi({ id, mood }: { id: string; mood: PetMood }) {
  const ink = '#2B1B12';
  return (
    <g>
      <defs>
        <radialGradient id={`${id}b`} cx="34%" cy="28%" r="80%">
          <stop offset="0" stopColor="#FFE6D6" />
          <stop offset=".42" stopColor="#FFAF86" />
          <stop offset=".82" stopColor="#FF7A45" />
          <stop offset="1" stopColor="#E3561F" />
        </radialGradient>
        <linearGradient id={`${id}e`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFB993" />
          <stop offset="1" stopColor="#F06A35" />
        </linearGradient>
        <radialGradient id={`${id}s`} cx="50%" cy="100%" r="70%">
          <stop offset=".55" stopColor="#B53A0F" stopOpacity="0" />
          <stop offset="1" stopColor="#B53A0F" stopOpacity=".35" />
        </radialGradient>
      </defs>
      <path className="pet-tail" d="M80 78 q17 -3 13 -21 q-2 -8 -9 -5" stroke="#F0743F" strokeWidth="8" fill="none" strokeLinecap="round" />
      <g className="pet-ear pet-ear-l">
        <path d="M23 42 L20 14 Q22 9 28 12 L45 30 Z" fill={`url(#${id}e)`} />
        <path d="M26 35 L25 20 L37 30 Z" fill="#FFC4CC" />
      </g>
      <g className="pet-ear pet-ear-r">
        <path d="M77 42 L80 14 Q78 9 72 12 L55 30 Z" fill={`url(#${id}e)`} />
        <path d="M74 35 L75 20 L63 30 Z" fill="#FFC4CC" />
      </g>
      <g className="pet-core">
        <path d="M50 22 C77 22 91 42 91 64 C91 85 75 96 50 96 C25 96 9 85 9 64 C9 42 23 22 50 22 Z" fill={`url(#${id}b)`} />
        <path d="M50 22 C77 22 91 42 91 64 C91 85 75 96 50 96 C25 96 9 85 9 64 C9 42 23 22 50 22 Z" fill={`url(#${id}s)`} />
        <ellipse cx="33" cy="37" rx="14" ry="7" fill="#fff" opacity=".6" transform="rotate(-22 33 37)" />
        <ellipse cx="50" cy="80" rx="21" ry="12" fill="#FFF3EA" opacity=".55" />
        <Eyes mood={mood} lx={37} rx={63} y={59} ink={ink} />
        <ellipse cx="27" cy="70" rx="6.5" ry="3.6" fill="#FF6F96" opacity=".42" />
        <ellipse cx="73" cy="70" rx="6.5" ry="3.6" fill="#FF6F96" opacity=".42" />
        <Mouth mood={mood} x={50} y={68} ink={ink} />
        <ellipse cx="36" cy="94" rx="8.5" ry="4.5" fill="#E15A26" />
        <ellipse cx="64" cy="94" rx="8.5" ry="4.5" fill="#E15A26" />
        <ellipse cx="34" cy="92.6" rx="3.5" ry="1.4" fill="#fff" opacity=".35" />
        <ellipse cx="62" cy="92.6" rx="3.5" ry="1.4" fill="#fff" opacity=".35" />
      </g>
    </g>
  );
}

/* ------------------------------------------------------------------ */
/* Bolt — jet-powered mint mini robot                                  */
/* ------------------------------------------------------------------ */

function Bolt({ id, mood }: { id: string; mood: PetMood }) {
  const eye = '#7DFBE0';
  return (
    <g>
      <defs>
        <linearGradient id={`${id}b`} x1="0" y1="0" x2=".3" y2="1">
          <stop offset="0" stopColor="#CFFAEE" />
          <stop offset=".4" stopColor="#5ADBB0" />
          <stop offset="1" stopColor="#13865F" />
        </linearGradient>
        <linearGradient id={`${id}s`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#163F38" />
          <stop offset="1" stopColor="#0A211D" />
        </linearGradient>
        <linearGradient id={`${id}j`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFF3B0" />
          <stop offset=".45" stopColor="#FFB547" />
          <stop offset="1" stopColor="#FF6A3D" stopOpacity="0" />
        </linearGradient>
        <radialGradient id={`${id}g`}>
          <stop offset="0" stopColor="#FFF6C8" />
          <stop offset=".5" stopColor="#FFD25E" />
          <stop offset="1" stopColor="#FFB020" stopOpacity="0" />
        </radialGradient>
      </defs>
      <g className="pet-jet">
        <path d="M38 84 Q41 104 44 84 Z" fill={`url(#${id}j)`} />
        <path d="M56 84 Q59 104 62 84 Z" fill={`url(#${id}j)`} />
      </g>
      <g className="pet-core">
        <line x1="50" y1="9" x2="50" y2="22" stroke="#4F6B66" strokeWidth="3" strokeLinecap="round" />
        <circle className="pet-antenna" cx="50" cy="8" r="9" fill={`url(#${id}g)`} />
        <circle cx="50" cy="8" r="4.2" fill="#FFD25E" />
        <circle cx="48.6" cy="6.6" r="1.4" fill="#fff" />
        <rect x="4" y="44" width="10" height="20" rx="5" fill="#2A9C77" />
        <rect x="86" y="44" width="10" height="20" rx="5" fill="#2A9C77" />
        <rect x="11" y="20" width="78" height="68" rx="27" fill={`url(#${id}b)`} />
        <rect x="11" y="20" width="78" height="68" rx="27" fill="none" stroke="#0E6A4B" strokeOpacity=".25" strokeWidth="1.5" />
        <rect x="21" y="25" width="40" height="9" rx="4.5" fill="#fff" opacity=".5" />
        <rect x="21" y="37" width="58" height="37" rx="15" fill={`url(#${id}s)`} />
        <rect x="21" y="37" width="58" height="37" rx="15" fill="none" stroke={eye} strokeOpacity=".22" strokeWidth="1.5" />
        <g className="pet-screen">
          {mood === 'happy' ? (
            <g stroke={eye} strokeWidth="3.4" strokeLinecap="round" fill="none" className="pet-eyes">
              <path d="M32 56 q5 -7 10 0" />
              <path d="M58 56 q5 -7 10 0" />
            </g>
          ) : mood === 'sleep' ? (
            <g stroke={eye} strokeWidth="3" strokeLinecap="round" opacity=".7" className="pet-eyes">
              <path d="M32 55 h10" />
              <path d="M58 55 h10" />
            </g>
          ) : (
            <g className="pet-eyes blinking">
              <g className="pet-pupils">
                <rect x={mood === 'surprised' ? 31 : 33} y={mood === 'surprised' ? 47 : 48} width={mood === 'surprised' ? 12 : 8} height={mood === 'surprised' ? 12 : 13} rx="4" fill={eye} />
                <rect x={mood === 'surprised' ? 57 : 59} y={mood === 'surprised' ? 47 : 48} width={mood === 'surprised' ? 12 : 8} height={mood === 'surprised' ? 12 : 13} rx="4" fill={eye} />
                <rect x="33" y="47" width="22" height="16" rx="6" fill={eye} opacity=".08" />
              </g>
            </g>
          )}
          {mood === 'surprised' ? (
            <circle cx="50" cy="66" r="2.6" fill={eye} />
          ) : mood === 'worried' ? (
            <path d="M45 67 q5 -4 10 0" stroke={eye} strokeWidth="2.4" fill="none" strokeLinecap="round" />
          ) : (
            <path d="M45 64 q5 4.5 10 0" stroke={eye} strokeWidth="2.4" fill="none" strokeLinecap="round" />
          )}
          <circle cx="27" cy="66" r="2.6" fill="#FF7FA8" opacity=".75" />
          <circle cx="73" cy="66" r="2.6" fill="#FF7FA8" opacity=".75" />
        </g>
        <circle cx="30" cy="81" r="2" fill="#0E6A4B" opacity=".35" />
        <circle cx="70" cy="81" r="2" fill="#0E6A4B" opacity=".35" />
      </g>
    </g>
  );
}

/* ------------------------------------------------------------------ */
/* Nova — ringed star spirit                                           */
/* ------------------------------------------------------------------ */

function Nova({ id, mood }: { id: string; mood: PetMood }) {
  const ink = '#2A1656';
  return (
    <g>
      <defs>
        <radialGradient id={`${id}b`} cx="36%" cy="30%" r="78%">
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset=".22" stopColor="#E7DCFF" />
          <stop offset=".6" stopColor="#A98BFF" />
          <stop offset="1" stopColor="#5E3FD0" />
        </radialGradient>
        <linearGradient id={`${id}r`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#FFE9A8" />
          <stop offset=".5" stopColor="#F5B83D" />
          <stop offset="1" stopColor="#FFE9A8" />
        </linearGradient>
        <radialGradient id={`${id}a`}>
          <stop offset=".45" stopColor="#B69CFF" stopOpacity=".55" />
          <stop offset="1" stopColor="#B69CFF" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle className="pet-aura" cx="50" cy="58" r="46" fill={`url(#${id}a)`} />
      <g className="pet-core">
        <path d="M7 62 A43 12 0 0 1 93 62" stroke={`url(#${id}r)`} strokeWidth="4.5" fill="none" opacity=".9" />
        <g className="pet-crest">
          <path d="M50 12 L53.2 20.4 L62 21 L55.2 26.6 L57.6 35 L50 30.2 L42.4 35 L44.8 26.6 L38 21 L46.8 20.4 Z" fill="#FFD66B" stroke="#F2A93B" strokeWidth="1.2" strokeLinejoin="round" />
          <circle cx="48" cy="21" r="1.6" fill="#fff" />
        </g>
        <circle cx="50" cy="58" r="31" fill={`url(#${id}b)`} />
        <circle cx="50" cy="58" r="31" fill="none" stroke="#fff" strokeOpacity=".35" strokeWidth="1.2" />
        <ellipse cx="38" cy="43" rx="10" ry="5.5" fill="#fff" opacity=".7" transform="rotate(-28 38 43)" />
        <circle cx="70" cy="48" r="1.5" fill="#fff" opacity=".8" />
        <circle cx="66" cy="76" r="1.1" fill="#fff" opacity=".7" />
        <circle cx="31" cy="72" r="1.3" fill="#fff" opacity=".7" />
        <Eyes mood={mood} lx={39} rx={61} y={58} ink={ink} glow="#fff" />
        <ellipse cx="30" cy="67" rx="5.5" ry="3" fill="#FF7FB8" opacity=".45" />
        <ellipse cx="70" cy="67" rx="5.5" ry="3" fill="#FF7FB8" opacity=".45" />
        <Mouth mood={mood} x={50} y={66} ink={ink} />
        <path d="M7 62 A43 12 0 0 0 93 62" stroke={`url(#${id}r)`} strokeWidth="4.5" fill="none" />
        <circle className="pet-moon" r="3.6" fill="#FFF4D6" stroke="#F2B33D" strokeWidth="1" />
      </g>
    </g>
  );
}
