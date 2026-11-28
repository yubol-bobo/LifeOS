import { getLayout, toggleFullscreen, toggleLayout } from './display';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { dayKey } from '../lib/date';
import { useL, useLang } from '../lib/i18n';
import { actions, getState, useStore } from '../store/store';
import { Icon } from '../ui/Icon';
import { AppGlyph } from '../ui/kit';
import { addDays } from '../lib/date';
import { parseCapture } from '../lib/capture';
import { notify } from './notify';
import { APP_GROUPS, APPS } from './apps';
import { open } from './router';

interface Item {
  id: string;
  group: string;
  title: string;
  sub?: string;
  icon: string;
  hue?: string;
  run: () => void;
}

export function Spotlight({ onClose, dark }: { onClose: () => void; dark: boolean }) {
  const L = useL();
  const lang = useLang();
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const quests = useStore((s) => s.quests);
  const papers = useStore((s) => s.papers);
  const milestones = useStore((s) => s.milestones);
  const active = useStore((s) => s.active);
  const done = useStore((s) => s.completions[dayKey()]);

  useEffect(() => input.current?.focus(), []);

  const items = useMemo<Item[]>(() => {
    const needleEmpty = !q.trim();
    const G = { apps: L('应用', 'Apps'), cmd: L('指令', 'Commands'), quest: L('今日任务', 'Quests'), paper: L('论文', 'Papers'), ms: L('目标', 'Goals') };
    const groupOf = (id: string) => APP_GROUPS.find((g) => g.apps.includes(id as never));
    const appsSorted = APP_GROUPS.flatMap((g) => g.apps.map((id) => APPS.find((a) => a.id === id)!)).concat(APPS.filter((a) => !groupOf(a.id)));
    const all: Item[] = [
      ...appsSorted.map((a) => ({ id: `app:${a.id}`, group: needleEmpty ? (lang === 'zh' ? groupOf(a.id)?.zh : groupOf(a.id)?.en) ?? G.apps : G.apps, title: lang === 'zh' ? a.zh : a.en, sub: lang === 'zh' ? a.blurbZh : a.blurbEn, icon: a.icon, hue: a.hue, run: () => open(a.id) })),
      active
        ? { id: 'cmd:stop', group: G.cmd, title: L('结束专注并结算', 'Stop focus & cash out'), icon: 'square', run: () => actions.stopFocus() }
        : { id: 'cmd:focus', group: G.cmd, title: L('开始赚钱计时', 'Start the paid-work timer'), icon: 'play', run: () => (actions.startFocus(getState().profile.hourlyRate, 'craft'), open('earn')) },
      { id: 'cmd:theme', group: G.cmd, title: dark ? L('切换到明亮模式', 'Switch to light mode') : L('切换到暗夜模式', 'Switch to dark mode'), icon: dark ? 'sun' : 'moon', run: () => actions.profile({ theme: dark ? 'light' : 'dark' }) },
      { id: 'cmd:layout', group: G.cmd, title: getLayout() === 'landscape' ? L('切换到竖版布局', 'Switch to portrait layout') : L('切换到横版仪表盘', 'Switch to landscape dashboard'), icon: getLayout() === 'landscape' ? 'layout-tall' : 'layout-wide', run: toggleLayout },
      { id: 'cmd:fullscreen', group: G.cmd, title: L('全屏 / 退出全屏', 'Toggle full screen'), icon: 'fullscreen', run: () => void toggleFullscreen() },
      { id: 'cmd:pet', group: G.cmd, title: L('找到我的宠物', 'Find my pet'), icon: 'paw', run: () => window.dispatchEvent(new Event('lifeos:pet-locate')) },
      { id: 'cmd:pomo', group: G.cmd, title: L('开始番茄钟', 'Start a pomodoro'), icon: 'timer', run: () => actions.setPomo({ phase: 'work', startedAt: Date.now(), endsAt: Date.now() + getState().pet.pomoWork * 60_000 }) },
      { id: 'cmd:checkin', group: G.cmd, title: L('记录资产', 'Record balances'), icon: 'wallet', run: () => window.dispatchEvent(new Event('lifeos:asset-checkin')) },
      { id: 'cmd:lang', group: G.cmd, title: lang === 'zh' ? 'Switch to English' : '切换到中文', icon: 'refresh', run: () => actions.profile({ lang: lang === 'zh' ? 'en' : 'zh' }) },
      ...quests
        .filter((x) => !x.archived)
        .map((x) => {
          const isDone = x.kind === 'daily' ? (done ?? []).includes(x.id) : !!x.doneAt;
          return { id: `q:${x.id}`, group: G.quest, title: x.title, sub: isDone ? L('已完成 · 回车撤销', 'Done · Enter to undo') : L('回车完成', 'Enter to complete'), icon: isDone ? 'circle-check' : 'target', run: () => actions.toggleQuest(x.id) };
        }),
      ...papers.map((p) => ({ id: `p:${p.id}`, group: G.paper, title: p.title, sub: [p.venue, p.year].filter(Boolean).join(' · '), icon: 'book-open', run: () => open('research') })),
      ...milestones.map((m) => ({ id: `m:${m.id}`, group: G.ms, title: m.title, sub: m.targetDate, icon: 'flag', run: () => open('roadmap') })),
    ];
    const needle = q.trim().toLowerCase();
    if (!needle) return all.filter((x) => x.id.startsWith('app:') || x.group === G.cmd);
    const hits = all.filter((x) => (x.title + ' ' + (x.sub ?? '')).toLowerCase().includes(needle)).slice(0, 10);
    // whatever you type can become a to-do: "约导师 明天 #论文"
    const s = getState();
    const c = parseCapture(q, s.projects);
    if (c.title) {
      const proj = c.projectId ? s.projects.find((p) => p.id === c.projectId) : undefined;
      const when = c.day ? (c.day === addDays(dayKey(), 1) ? L('明天', 'tomorrow') : c.day) : L('今天', 'today');
      // first when nothing matches; after the matches otherwise, so Enter on an existing to-do still ticks it
      hits.push({
        id: 'cmd:capture',
        group: L('快速记录', 'Quick capture'),
        title: L(`新建待办：${c.title}`, `New to-do: ${c.title}`),
        sub: [when, proj && `#${proj.name}`, c.difficulty === 'hard' && L('困难', 'hard'), c.difficulty === 'easy' && L('简单', 'easy')].filter(Boolean).join(' · '),
        icon: 'plus',
        run: () => {
          actions.addQuest({ title: c.title, kind: 'once', attr: proj ? (s.quests.find((x) => x.projectId === proj.id)?.attr ?? s.attributes[0]?.id ?? 'craft') : (s.attributes[0]?.id ?? 'craft'), difficulty: c.difficulty ?? 'normal', ...(c.day ? { day: c.day } : {}), ...(proj ? { projectId: proj.id, step: false } : {}) });
          notify({ title: c.day ? L(`已记下，${when}出现在今日任务里`, `Saved — it shows on Today ${when}`) : L('已加到今日任务', 'Added to today'), body: c.title, icon: 'list-checks', tone: 'good' });
        },
      });
    }
    return hits;
  }, [q, quests, papers, milestones, active, done, dark, lang]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => setSel(0), [q]);

  const run = (it: Item) => {
    it.run();
    onClose();
  };

  let lastGroup = '';
  return createPortal(
    <div className="spot-scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="spot" role="dialog" aria-label={L('聚焦搜索', 'Spotlight')}>
        <div className="spot-input">
          <Icon name="search" size={20} />
          <input
            ref={input}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={L('搜索，或直接记一件事（例：约导师 明天 #论文）…', 'Search, or jot something down (e.g. call mom tomorrow #family)…')}
            onKeyDown={(e) => {
              if (e.key === 'Escape') onClose();
              if (e.key === 'ArrowDown') (e.preventDefault(), setSel((s) => Math.min(items.length - 1, s + 1)));
              if (e.key === 'ArrowUp') (e.preventDefault(), setSel((s) => Math.max(0, s - 1)));
              if (e.key === 'Enter' && items[sel]) run(items[sel]);
            }}
          />
          <kbd>esc</kbd>
        </div>
        <div className="spot-list">
          {items.length === 0 && <div className="spot-empty">{L('没有结果', 'No results')}</div>}
          {items.map((it, i) => {
            const head = it.group !== lastGroup ? (lastGroup = it.group) : null;
            return (
              <div key={it.id}>
                {head && <div className="spot-group">{head}</div>}
                <button className={`spot-item ${i === sel ? 'is-sel' : ''}`} onMouseEnter={() => setSel(i)} onClick={() => run(it)}>
                  {it.hue ? (
                    <AppGlyph icon={it.icon} hue={it.hue} size={30} />
                  ) : (
                    <span className="spot-ic">
                      <Icon name={it.icon} size={16} />
                    </span>
                  )}
                  <span className="spot-t">{it.title}</span>
                  {it.sub && <span className="spot-s">{it.sub}</span>}
                  {i === sel && <Icon name="chevron-right" size={16} className="spot-go" />}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>,
    document.body,
  );
}
