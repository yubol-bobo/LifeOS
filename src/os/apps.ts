export type AppId = 'home' | 'quests' | 'plan' | 'projects' | 'roadmap' | 'research' | 'earn' | 'trackers' | 'mood' | 'review' | 'timeline' | 'assets' | 'shop' | 'trophies' | 'settings';

export interface AppDef {
  id: AppId;
  icon: string;
  hue: string;
  zh: string;
  en: string;
  blurbZh: string;
  blurbEn: string;
  key: string; // keyboard shortcut digit
  width?: number; // natural content width of its window (px)
}

export const APPS: AppDef[] = [
  { id: 'home', icon: 'house', hue: '#FF6A3D', zh: '桌面', en: 'Desktop', blurbZh: '今日总览与小组件', blurbEn: 'Today at a glance', key: '1' },
  { id: 'quests', icon: 'list-checks', hue: '#F2683C', zh: '任务', en: 'Quests', blurbZh: '每日清单与一次性任务', blurbEn: 'Daily habits & to-dos', key: '2', width: 940 },
  { id: 'plan', icon: 'calendar', hue: '#1497A8', zh: '计划', en: 'Plans', blurbZh: '年 / 月 / 周计划与倒计时', blurbEn: 'Year, month, week plans & countdowns', key: '3', width: 1180 },
  { id: 'projects', icon: 'briefcase', hue: '#5161D6', zh: '项目', en: 'Projects', blurbZh: '学术、工作、生活，一切项目；在这里直接开始专注', blurbEn: 'Every project — and start focusing on one right here', key: '3', width: 1180 },
  { id: 'roadmap', icon: 'route', hue: '#3F7BE0', zh: '人生地图', en: 'Roadmap', blurbZh: '里程碑与人生周格', blurbEn: 'Milestones & life in weeks', key: '3', width: 1200 },
  { id: 'research', icon: 'graduation', hue: '#7A5AE6', zh: '学术', en: 'Research', blurbZh: '论文管线与引用追踪', blurbEn: 'Papers & citations', key: '4', width: 1160 },
  { id: 'earn', icon: 'coins', hue: '#1BA677', zh: '赚钱', en: 'Earn', blurbZh: '时薪计时：赚钱的工作，实时看见收入', blurbEn: 'Paid work, with live earnings', key: '5', width: 1180 },
  { id: 'trackers', icon: 'activity', hue: '#E2689A', zh: '追踪', en: 'Trackers', blurbZh: '任何你想量化的指标', blurbEn: 'Quantify anything', key: '6', width: 1020 },
  { id: 'assets', icon: 'landmark', hue: '#2E9E6E', zh: '资产', en: 'Assets', blurbZh: '账户余额与净资产曲线', blurbEn: 'Balances & net worth', key: '6', width: 1120 },
  { id: 'mood', icon: 'smile', hue: '#14A3B8', zh: '心情', en: 'Mood', blurbZh: '每日心情与身心关联', blurbEn: 'Mood & what moves it', key: '7', width: 1000 },
  { id: 'review', icon: 'notebook', hue: '#8B5CF6', zh: '复盘', en: 'Review', blurbZh: '每日复盘、回看与宠物总结', blurbEn: 'Daily review, look-backs & pet summaries', key: '7', width: 1160 },
  { id: 'timeline', icon: 'clock', hue: '#D9822B', zh: '足迹', en: 'Timeline', blurbZh: '记下的一切，按时间排好，每天都能点开', blurbEn: 'Everything recorded, in order — open any day', key: '7', width: 1000 },
  { id: 'shop', icon: 'store', hue: '#E09B12', zh: '奖励商店', en: 'Reward Shop', blurbZh: '用金币兑换犒劳', blurbEn: 'Spend coins on treats', key: '7', width: 980 },
  { id: 'trophies', icon: 'trophy', hue: '#C9A227', zh: '成长', en: 'Growth', blurbZh: '升级之路、成就馆与装扮', blurbEn: 'Level road, trophy hall & style', key: '8', width: 1180 },
  { id: 'settings', icon: 'settings', hue: '#7C8594', zh: '系统设置', en: 'Settings', blurbZh: '个人资料、外观与数据', blurbEn: 'Profile, look & data', key: '9', width: 1080 },
];

export const appById = (id: AppId) => APPS.find((a) => a.id === id) ?? APPS[0];

export const DEFAULT_DOCK: AppId[] = APPS.map((a) => a.id);
/** Apps that can't be hidden — otherwise you could lock yourself out of customizing. */
export const PINNED: AppId[] = ['home', 'settings'];
