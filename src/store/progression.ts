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
  { level: 20, id: 'apprentice', zh: '学徒', en: 'Apprentice', icon: 'book-marked', blurbZh: '每天都比昨天多会一点', blurbEn: 'A little better every day' },
  { level: 25, id: 'artisan', zh: '匠人', en: 'Artisan', icon: 'hammer', blurbZh: '把事情做到漂亮', blurbEn: 'Doing things beautifully' },
  { level: 30, id: 'scholar', zh: '学者', en: 'Scholar', icon: 'book-open', blurbZh: '知识在积累', blurbEn: 'Knowledge compounds' },
  { level: 35, id: 'voyager', zh: '远行者', en: 'Voyager', icon: 'plane', blurbZh: '走得比想象中更远', blurbEn: 'Further than you imagined' },
  { level: 40, id: 'guardian', zh: '守望者', en: 'Guardian', icon: 'target', blurbZh: '守住节奏，也守住自己', blurbEn: 'Keeping the rhythm, keeping yourself' },
  { level: 45, id: 'sage', zh: '贤者', en: 'Sage', icon: 'leaf', blurbZh: '从容而清醒', blurbEn: 'Calm and clear' },
  { level: 50, id: 'pioneer', zh: '开拓者', en: 'Pioneer', icon: 'mountain', blurbZh: '走出别人没走过的路', blurbEn: 'Paths no one walked before' },
  { level: 55, id: 'dreamer', zh: '筑梦者', en: 'Dreamweaver', icon: 'palette', blurbZh: '把想象变成现实', blurbEn: 'Turning dreams into things' },
  { level: 60, id: 'master', zh: '大师', en: 'Master', icon: 'crown', blurbZh: '技艺纯熟', blurbEn: 'Mastery' },
  { level: 65, id: 'luminary', zh: '引路人', en: 'Luminary', icon: 'sun', blurbZh: '你的光照亮了别人', blurbEn: 'Your light guides others' },
  { level: 70, id: 'oracle', zh: '智者', en: 'Oracle', icon: 'eye', blurbZh: '看得更深，也看得更远', blurbEn: 'Seeing deeper and further' },
  { level: 75, id: 'legend', zh: '传奇', en: 'Legend', icon: 'star', blurbZh: '别人会讲你的故事', blurbEn: 'People tell your story' },
  { level: 80, id: 'starlight', zh: '星辉', en: 'Starlight', icon: 'telescope', blurbZh: '远方的人也能看见你', blurbEn: 'Seen from far away' },
  { level: 85, id: 'myth', zh: '神话', en: 'Myth', icon: 'gem', blurbZh: '故事变成了传说', blurbEn: 'Stories become legend' },
  { level: 90, id: 'cosmos', zh: '星海', en: 'Cosmos', icon: 'globe', blurbZh: '心里装得下整片星海', blurbEn: 'A whole sky inside you' },
  { level: 100, id: 'eternal', zh: '永恒', en: 'Eternal', icon: 'orbit', blurbZh: '成为一颗恒星', blurbEn: 'Become a star' },
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
  { level: 23, kind: 'acc', id: 'flower', zh: '宠物配饰 · 小花', en: 'Pet accessory · Flower', icon: 'sprout' },
  { level: 26, kind: 'wall', id: 'mint', zh: '壁纸 · 薄荷', en: 'Wallpaper · Mint', icon: 'leaf' },
  { level: 30, kind: 'planet', id: 'ring', zh: '星球 · 星环', en: 'Planet · Rings', icon: 'orbit' },
  { level: 33, kind: 'acc', id: 'glasses', zh: '宠物配饰 · 学者眼镜', en: 'Pet accessory · Scholar glasses', icon: 'eye' },
  { level: 36, kind: 'wall', id: 'lavender', zh: '壁纸 · 薰衣草', en: 'Wallpaper · Lavender', icon: 'sparkles' },
  { level: 40, kind: 'acc', id: 'bow', zh: '宠物配饰 · 蝴蝶结', en: 'Pet accessory · Bow', icon: 'gift' },
  { level: 43, kind: 'wall', id: 'aurora', zh: '壁纸 · 极光', en: 'Wallpaper · Aurora', icon: 'sparkles' },
  { level: 46, kind: 'planet', id: 'satellite', zh: '星球 · 人造卫星', en: 'Planet · Satellite', icon: 'rocket' },
  { level: 50, kind: 'acc', id: 'crown', zh: '宠物配饰 · 皇冠', en: 'Pet accessory · Crown', icon: 'crown' },
  { level: 53, kind: 'wall', id: 'sunset', zh: '壁纸 · 晚霞', en: 'Wallpaper · Sunset', icon: 'sun' },
  { level: 57, kind: 'acc', id: 'headphones', zh: '宠物配饰 · 耳机', en: 'Pet accessory · Headphones', icon: 'headphones' },
  { level: 60, kind: 'wall', id: 'galaxy', zh: '壁纸 · 星河', en: 'Wallpaper · Galaxy', icon: 'star' },
  { level: 65, kind: 'planet', id: 'aurora', zh: '星球 · 极光', en: 'Planet · Aurora', icon: 'sparkles' },
  { level: 70, kind: 'acc', id: 'wizard', zh: '宠物配饰 · 魔法帽', en: 'Pet accessory · Wizard hat', icon: 'star' },
  { level: 75, kind: 'wall', id: 'forest', zh: '壁纸 · 森林', en: 'Wallpaper · Forest', icon: 'leaf' },
  { level: 80, kind: 'acc', id: 'star', zh: '宠物配饰 · 星星发夹', en: 'Pet accessory · Star clip', icon: 'star' },
  { level: 85, kind: 'wall', id: 'nebula', zh: '壁纸 · 星云', en: 'Wallpaper · Nebula', icon: 'telescope' },
  { level: 90, kind: 'planet', id: 'gold', zh: '星球 · 金色恒星', en: 'Planet · Golden star', icon: 'star' },
  { level: 95, kind: 'acc', id: 'halo', zh: '宠物配饰 · 光环', en: 'Pet accessory · Halo', icon: 'sun' },
  { level: 100, kind: 'wall', id: 'eternal', zh: '壁纸 · 永恒金辉', en: 'Wallpaper · Eternal gold', icon: 'orbit' },
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
