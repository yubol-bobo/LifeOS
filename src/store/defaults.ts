import type { AttrDef, PaletteKey, PayConfig } from './types';

/** Identity colors — each hand-tuned per theme (see styles/tokens.css --p-*). */
export const PALETTE: PaletteKey[] = ['blue', 'orange', 'jade', 'amber', 'pink', 'violet', 'teal', 'red', 'lime', 'indigo', 'slate', 'brown'];
/** Colour names for screen readers, in both languages. */
export const PALETTE_NAMES: Record<PaletteKey, [string, string]> = {
  blue: ['蓝', 'Blue'], orange: ['橙', 'Orange'], jade: ['翠绿', 'Jade'], amber: ['琥珀', 'Amber'], pink: ['粉', 'Pink'], violet: ['紫', 'Violet'],
  teal: ['青', 'Teal'], red: ['红', 'Red'], lime: ['黄绿', 'Lime'], indigo: ['靛蓝', 'Indigo'], slate: ['石板灰', 'Slate'], brown: ['棕', 'Brown'],
};

export const ATTR_ICONS = [
  'brain', 'dumbbell', 'coins', 'hammer', 'heart', 'leaf', 'book-open', 'code', 'palette', 'music', 'camera', 'globe',
  'languages', 'briefcase', 'users', 'sprout', 'rocket', 'star', 'mountain', 'utensils', 'paw', 'smile',
];

export const DEFAULT_ATTRS: AttrDef[] = [
  { id: 'mind', zh: '智识', en: 'Mind', icon: 'brain', color: 'blue' },
  { id: 'body', zh: '体魄', en: 'Body', icon: 'dumbbell', color: 'orange' },
  { id: 'wealth', zh: '财富', en: 'Wealth', icon: 'coins', color: 'jade' },
  { id: 'craft', zh: '创造', en: 'Craft', icon: 'hammer', color: 'amber' },
  { id: 'bond', zh: '羁绊', en: 'Bond', icon: 'heart', color: 'pink' },
  { id: 'spirit', zh: '心境', en: 'Spirit', icon: 'leaf', color: 'violet' },
];

export const attrName = (a: AttrDef | undefined, lang: 'zh' | 'en') => (a ? (lang === 'zh' ? a.zh || a.en : a.en || a.zh) : '—');

/** CSS that maps every attribute id to its palette color: --c-<id>. */
export const attrCss = (list: AttrDef[]) => `:root{${list.map((a) => `--c-${a.id}:var(--p-${a.color});`).join('')}}`;

/** Hourly rate derived from whatever the person thinks in: hourly, daily, monthly or yearly pay. */
export function hourlyFrom(p: PayConfig) {
  const h = Math.max(0.5, p.hoursPerDay);
  const d = Math.max(0.5, p.daysPerWeek);
  switch (p.mode) {
    case 'day':
      return p.amount / h;
    case 'month':
      return p.amount / (h * d * (52 / 12));
    case 'year':
      return p.amount / (h * d * 52);
    default:
      return p.amount;
  }
}

import type { Category } from './types';

export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'research', zh: '学术', en: 'Research', icon: 'graduation', color: 'violet' },
  { id: 'work', zh: '工作', en: 'Work', icon: 'briefcase', color: 'blue' },
  { id: 'life', zh: '生活', en: 'Life', icon: 'leaf', color: 'jade' },
  { id: 'other', zh: '其他', en: 'Other', icon: 'sparkles', color: 'slate' },
];
