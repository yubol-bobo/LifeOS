/**
 * The road: levels → eras, and the things you unlock along the way.
 * Unlocks are cosmetic but tangible — the Life Planet evolves, your pet gets accessories,
 * new wallpapers appear, and some achievements grant a title you can wear.
 */
import { ACHIEVEMENTS } from './achievements';

export interface Era {
  level: number;
  id: string;
  zh: string;
  en: string;
  icon: string;
  blurbZh: string;
  blurbEn: string;
}

export const ERAS: Era[] = [
  { level: 1, id: 'stardust', zh: '星尘', en: 'Stardust', icon: 'sparkles', blurbZh: '一切从一粒星尘开始', blurbEn: 'Everything starts as stardust' },
  { level: 5, id: 'sprout', zh: '萌芽', en: 'Sprout', icon: 'sprout', blurbZh: '习惯开始扎根', blurbEn: 'Habits take root' },
  { level: 10, id: 'wanderer', zh: '旅人', en: 'Wanderer', icon: 'footprints', blurbZh: '你已经上路了', blurbEn: "You're on your way" },
  { level: 15, id: 'pathfinder', zh: '探路者', en: 'Pathfinder', icon: 'map', blurbZh: '找到了自己的方向', blurbEn: 'You found your direction' },
  { level: 20, id: 'artisan', zh: '匠人', en: 'Artisan', icon: 'hammer', blurbZh: '把事情做到漂亮', blurbEn: 'Doing things beautifully' },
  { level: 25, id: 'scholar', zh: '学者', en: 'Scholar', icon: 'book-open', blurbZh: '知识在积累', blurbEn: 'Knowledge compounds' },
  { level: 30, id: 'sage', zh: '贤者', en: 'Sage', icon: 'leaf', blurbZh: '从容而清醒', blurbEn: 'Calm and clear' },
  { level: 40, id: 'master', zh: '大师', en: 'Master', icon: 'crown', blurbZh: '技艺纯熟', blurbEn: 'Mastery' },
  { level: 50, id: 'legend', zh: '传奇', en: 'Legend', icon: 'star', blurbZh: '别人会讲你的故事', blurbEn: 'People tell your story' },
  { level: 60, id: 'eternal', zh: '永恒', en: 'Eternal', icon: 'orbit', blurbZh: '成为一颗恒星', blurbEn: 'Become a star' },
];

export const eraOf = (level: number) => [...ERAS].reverse().find((e) => level >= e.level) ?? ERAS[0];
export const nextEra = (level: number) => ERAS.find((e) => e.level > level);

export type UnlockKind = 'acc' | 'wall' | 'planet';

export interface Unlock {
  level: number;
  kind: UnlockKind;
  id: string;
  zh: string;
  en: string;
  icon: string;
}

export const UNLOCKS: Unlock[] = [
  { level: 3, kind: 'acc', id: 'sprout', zh: '宠物配饰 · 小嫩芽', en: 'Pet accessory · Sprout', icon: 'sprout' },
  { level: 5, kind: 'wall', id: 'sunrise', zh: '壁纸 · 日出', en: 'Wallpaper · Sunrise', icon: 'sun' },
  { level: 8, kind: 'acc', id: 'party', zh: '宠物配饰 · 派对帽', en: 'Pet accessory · Party hat', icon: 'cake' },
  { level: 10, kind: 'planet', id: 'moon2', zh: '星球 · 第二颗卫星', en: 'Planet · A second moon', icon: 'moon' },
  { level: 12, kind: 'wall', id: 'ocean', zh: '壁纸 · 海洋', en: 'Wallpaper · Ocean', icon: 'droplets' },
  { level: 15, kind: 'acc', id: 'scarf', zh: '宠物配饰 · 围巾', en: 'Pet accessory · Scarf', icon: 'heart' },
  { level: 18, kind: 'planet', id: 'houses', zh: '星球 · 小屋', en: 'Planet · Little houses', icon: 'house' },
  { level: 20, kind: 'wall', id: 'sakura', zh: '壁纸 · 樱花', en: 'Wallpaper · Sakura', icon: 'leaf' },
  { level: 25, kind: 'planet', id: 'ring', zh: '星球 · 星环', en: 'Planet · Rings', icon: 'orbit' },
  { level: 28, kind: 'acc', id: 'glasses', zh: '宠物配饰 · 学者眼镜', en: 'Pet accessory · Scholar glasses', icon: 'eye' },
  { level: 30, kind: 'wall', id: 'aurora', zh: '壁纸 · 极光', en: 'Wallpaper · Aurora', icon: 'sparkles' },
  { level: 35, kind: 'planet', id: 'satellite', zh: '星球 · 人造卫星', en: 'Planet · Satellite', icon: 'rocket' },
  { level: 40, kind: 'acc', id: 'crown', zh: '宠物配饰 · 皇冠', en: 'Pet accessory · Crown', icon: 'crown' },
  { level: 45, kind: 'wall', id: 'galaxy', zh: '壁纸 · 星河', en: 'Wallpaper · Galaxy', icon: 'star' },
  { level: 50, kind: 'planet', id: 'aurora', zh: '星球 · 极光', en: 'Planet · Aurora', icon: 'sparkles' },
  { level: 60, kind: 'acc', id: 'halo', zh: '宠物配饰 · 光环', en: 'Pet accessory · Halo', icon: 'sun' },
  { level: 60, kind: 'planet', id: 'gold', zh: '星球 · 金色恒星', en: 'Planet · Golden star', icon: 'star' },
];

export const unlockedAt = (level: number, kind?: UnlockKind) => UNLOCKS.filter((u) => u.level <= level && (!kind || u.kind === kind));
export const nextUnlock = (level: number) => UNLOCKS.find((u) => u.level > level);
export const unlocksBetween = (from: number, to: number) => UNLOCKS.filter((u) => u.level > from && u.level <= to);

export const WALLPAPERS: { id: string; zh: string; en: string; level: number }[] = [
  { id: 'default', zh: '默认 · 暖阳', en: 'Default · Warm', level: 1 },
  ...UNLOCKS.filter((u) => u.kind === 'wall').map((u) => ({ id: u.id, zh: u.zh.split(' · ')[1], en: u.en.split(' · ')[1], level: u.level })),
];

export const ACCESSORIES: { id: string; zh: string; en: string; level: number }[] = [
  { id: 'none', zh: '不戴', en: 'None', level: 1 },
  ...UNLOCKS.filter((u) => u.kind === 'acc').map((u) => ({ id: u.id, zh: u.zh.split(' · ')[1], en: u.en.split(' · ')[1], level: u.level })),
];

/** Titles: one per era reached, plus the final stage of title-bearing achievement series. */
export function availableTitles(level: number, unlocked: Record<string, number>, lang: 'zh' | 'en') {
  const eras = ERAS.filter((e) => e.level <= level).map((e) => ({ id: `era:${e.id}`, name: lang === 'zh' ? e.zh : e.en, source: 'era' as const }));
  const ach = ACHIEVEMENTS.filter((a) => a.title && unlocked[a.id]).map((a) => ({ id: `ach:${a.id}`, name: (lang === 'zh' ? a.zh : a.en)[0], source: 'ach' as const }));
  return [...eras, ...ach];
}

export function titleName(id: string | undefined, level: number, lang: 'zh' | 'en') {
  if (id?.startsWith('ach:')) {
    const a = ACHIEVEMENTS.find((x) => x.id === id.slice(4));
    if (a) return (lang === 'zh' ? a.zh : a.en)[0];
  }
  if (id?.startsWith('era:')) {
    const e = ERAS.find((x) => x.id === id.slice(4));
    if (e && e.level <= level) return lang === 'zh' ? e.zh : e.en;
  }
  const e = eraOf(level);
  return lang === 'zh' ? e.zh : e.en;
}
