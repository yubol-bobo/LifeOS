import { setLayout, useLayout } from '../os/display';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { money, num } from '../lib/format';
import { useL, useLang } from '../lib/i18n';
import { APPS, PINNED, type AppId } from '../os/apps';
import { notify } from '../os/notify';
import { open } from '../os/router';
import { PET_KINDS, PetAvatar } from '../pet/sprites';
import { ATTR_ICONS, PALETTE, attrName, hourlyFrom, useAttrs } from '../store/attrs';
import { demoState } from '../store/demo';
import { actions, getState, migrate, useStore } from '../store/store';
import type { PaletteKey, PayConfig, PetKind, State } from '../store/types';
import { Icon } from '../ui/Icon';
import { SyncSettings } from './SyncSettings';
import { AppGlyph, Button, Card, Field, Modal, Segmented } from '../ui/kit';

type Tab = 'general' | 'sync' | 'dock' | 'attrs' | 'work' | 'pet';

export function Settings() {
  const L = useL();
  const [tab, setTab] = useState<Tab>(() => (sessionStorage.getItem('lifeos:settings-tab') as Tab) || 'general');
  const go = (t: Tab) => {
    setTab(t);
    try {
      sessionStorage.setItem('lifeos:settings-tab', t);
    } catch {
      /* ignore */
    }
  };
  useEffect(() => {
    const f = () => setTab((sessionStorage.getItem('lifeos:settings-tab') as Tab) || 'general');
    window.addEventListener('lifeos:settings-tab', f);
    return () => window.removeEventListener('lifeos:settings-tab', f);
  }, []);
  const tabs: { id: Tab; icon: string; zh: string; en: string }[] = [
    { id: 'general', icon: 'settings', zh: '通用', en: 'General' },
    { id: 'sync', icon: 'cloud', zh: '同步', en: 'Sync' },
    { id: 'dock', icon: 'grid', zh: '程序坞与桌面', en: 'Dock & Desktop' },
    { id: 'attrs', icon: 'sparkles', zh: '属性', en: 'Attributes' },
    { id: 'work', icon: 'wallet', zh: '工作与收入', en: 'Work & Pay' },
    { id: 'pet', icon: 'paw', zh: '桌面宠物', en: 'Desktop Pet' },
  ];
  return (
    <div className="app settings">
      <div className="app-head">
        <div>
          <h1>{L('系统设置', 'Settings')}</h1>
          <p className="muted">{L('几乎所有东西都可以改：程序坞、属性、收入方式、宠物……改动立即生效。', 'Nearly everything is editable — dock, attributes, pay, pet. Changes apply instantly.')}</p>
        </div>
      </div>
      <nav className="settings-tabs" role="tablist">
        {tabs.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} className={tab === t.id ? 'is-on' : ''} onClick={() => go(t.id)}>
            <Icon name={t.icon} size={15} />
            {L(t.zh, t.en)}
          </button>
        ))}
      </nav>
      {tab === 'general' && <General />}
      {tab === 'sync' && <SyncSettings />}
      {tab === 'dock' && <DockSettings />}
      {tab === 'attrs' && <AttrSettings />}
      {tab === 'work' && <WorkSettings />}
      {tab === 'pet' && <PetSettings />}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function General() {
  const L = useL();
  const p = useStore((s) => s.profile);
  const layout = useLayout();
  const demo = useStore((s) => s.demo);
  const file = useRef<HTMLInputElement>(null);
  const [confirm, setConfirm] = useState<null | 'reset' | 'demo'>(null);

  const exportData = () => {
    const blob = new Blob([JSON.stringify(getState(), null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `lifeos-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const importData = async (f: File) => {
    try {
      const parsed = JSON.parse(await f.text()) as Partial<State>;
      if (parsed.version !== 1 || !parsed.profile) throw new Error('bad file');
      actions.replace(migrate(parsed));
      notify({ title: L('数据已恢复', 'Data restored'), icon: 'upload', tone: 'good' });
    } catch {
      notify({ title: L('无法读取这个文件', "Couldn't read that file"), body: L('请选择 LifeOS 导出的 JSON 备份。', 'Pick a JSON backup exported from LifeOS.'), icon: 'info', tone: 'warn' });
    }
  };

  return (
    <>
      {demo && (
        <div className="banner">
          <span>{L('你正在浏览示例数据。准备好了就清空，开始记录真实的人生。', "You're exploring demo data. Clear it whenever you're ready to log your real life.")}</span>
          <Button variant="primary" size="sm" icon="power" onClick={() => setConfirm('reset')}>
            {L('清空并开始', 'Clear & start')}
          </Button>
        </div>
      )}
      <div className="grid-1-1">
        <Card title={L('个人资料', 'Profile')} icon="users">
          <div className="form">
            <Field label={L('名字', 'Name')}>
              <input className="input" value={p.name} onChange={(e) => actions.profile({ name: e.target.value })} />
            </Field>
            <div className="row2">
              <Field label={L('出生日期', 'Birth date')}>
                <input className="input" type="date" value={p.birthDate} onChange={(e) => e.target.value && actions.profile({ birthDate: e.target.value })} />
              </Field>
              <Field label={L('预期寿命（年）', 'Life expectancy (years)')}>
                <input className="input" type="number" min={30} max={120} value={p.lifeExpectancy} onChange={(e) => actions.profile({ lifeExpectancy: Math.max(30, Math.min(120, +e.target.value || 85)) })} />
              </Field>
            </div>
          </div>
        </Card>
        <Card title={L('外观', 'Appearance')} icon="sun">
          <div className="form">
            <Field label={L('主题', 'Theme')}>
              <Segmented
                value={p.theme}
                onChange={(v) => actions.profile({ theme: v })}
                options={[
                  { value: 'light', label: L('明亮', 'Light'), icon: 'sun' },
                  { value: 'dark', label: L('暗夜', 'Dark'), icon: 'moon' },
                  { value: 'system', label: L('跟随系统', 'System'), icon: 'monitor' },
                ]}
              />
            </Field>
            <Field label={L('桌面布局（仅本设备）', 'Desktop layout (this device)')}>
              <Segmented
                value={layout}
                onChange={(v) => setLayout(v)}
                options={[
                  { value: 'portrait', label: L('竖版', 'Portrait'), icon: 'layout-tall' },
                  { value: 'landscape', label: L('横版仪表盘', 'Landscape'), icon: 'layout-wide' },
                ]}
              />
            </Field>
            <Field label={L('语言', 'Language')}>
              <Segmented
                value={p.lang}
                onChange={(v) => actions.profile({ lang: v })}
                options={[
                  { value: 'zh', label: '中文' },
                  { value: 'en', label: 'English' },
                ]}
              />
            </Field>
            <Field label={L('动效', 'Motion')}>
              <Segmented
                value={p.reduceMotion ? 'reduce' : 'full'}
                onChange={(v) => actions.profile({ reduceMotion: v === 'reduce' })}
                options={[
                  { value: 'full', label: L('完整', 'Full') },
                  { value: 'reduce', label: L('减弱', 'Reduced') },
                ]}
              />
            </Field>
          </div>
        </Card>
        <Card title={L('数据', 'Data')} icon="download">
          <p className="muted small">{L('数据保存在本机浏览器（localStorage）。换设备或清理浏览器前，请先导出备份。', 'Data lives in this browser (localStorage). Export a backup before switching devices or clearing your browser.')}</p>
          <div className="row-gap wrap" style={{ marginTop: 12 }}>
            <Button icon="download" onClick={exportData}>
              {L('导出备份', 'Export backup')}
            </Button>
            <Button icon="upload" onClick={() => file.current?.click()}>
              {L('导入备份', 'Import backup')}
            </Button>
            <Button icon="sparkles" onClick={() => setConfirm('demo')}>
              {L('载入示例数据', 'Load demo data')}
            </Button>
            <Button variant="danger" icon="trash" onClick={() => setConfirm('reset')}>
              {L('清空全部', 'Erase everything')}
            </Button>
          </div>
          <input ref={file} type="file" accept="application/json,.json" hidden onChange={(e) => e.target.files?.[0] && importData(e.target.files[0])} />
        </Card>
        <Card className="about">
          <span className="logo-mark logo-lg" />
          <div>
            <h3>
              LifeOS <span className="muted">1.1</span>
            </h3>
            <p className="muted small">{L('开源、本地优先的人生操作系统。⌘K / Ctrl+K 打开聚焦搜索。', 'An open-source, local-first OS for your life. ⌘K / Ctrl+K opens Spotlight.')}</p>
          </div>
        </Card>
      </div>
      <Modal
        open={!!confirm}
        onClose={() => setConfirm(null)}
        title={confirm === 'demo' ? L('载入示例数据？', 'Load demo data?') : L('清空全部数据？', 'Erase everything?')}
        footer={
          <>
            <span className="spacer" />
            <Button variant="ghost" onClick={() => setConfirm(null)}>
              {L('取消', 'Cancel')}
            </Button>
            <Button
              variant={confirm === 'demo' ? 'primary' : 'danger'}
              onClick={() => {
                if (confirm === 'demo') actions.replace(demoState({ ...getState().profile }));
                else actions.reset();
                setConfirm(null);
              }}
            >
              {L('确认', 'Confirm')}
            </Button>
          </>
        }
      >
        <p>{confirm === 'demo' ? L('当前数据会被示例数据替换。建议先导出备份。', 'Your current data will be replaced. Consider exporting a backup first.') : L('任务、目标、论文、收入记录和成就都会被删除，个人资料和自定义设置保留。此操作无法撤销。', 'Quests, goals, papers, sessions and trophies will be deleted; your profile and customizations stay. This cannot be undone.')}</p>
      </Modal>
    </>
  );
}

/* ------------------------------------------------------------------ */

const WIDGETS: { id: string; zh: string; en: string }[] = [
  { id: 'hero', zh: '星球与等级', en: 'Planet & level' },
  { id: 'quests', zh: '今日任务', en: "Today's quests" },
  { id: 'plans', zh: '本周计划', en: 'This week' },
  { id: 'countdown', zh: '倒计时', en: 'Countdown' },
  { id: 'mood', zh: '心情打卡', en: 'Mood check-in' },
  { id: 'life', zh: '人生进度', en: 'Life progress' },
  { id: 'earn', zh: '时薪计', en: 'Wage timer' },
  { id: 'attrs', zh: '属性雷达', en: 'Attribute radar' },
  { id: 'research', zh: '学术', en: 'Research' },
  { id: 'goals', zh: '目标进度', en: 'Goals' },
  { id: 'assets', zh: '净资产', en: 'Net worth' },
  { id: 'heat', zh: '经验热力图', en: 'XP heatmap' },
  { id: 'review', zh: '本周回顾', en: 'Weekly review' },
];

function DockSettings() {
  const L = useL();
  const lang = useLang();
  const ui = useStore((s) => s.ui);
  const [drag, setDrag] = useState<AppId | null>(null);
  const order = ui.dock;
  const move = (from: number, to: number) => {
    if (to < 0 || to >= order.length || from === to) return;
    const next = [...order];
    const [x] = next.splice(from, 1);
    next.splice(to, 0, x);
    actions.setDock(next, ui.hidden);
  };
  const toggle = (id: AppId) => actions.setDock(order, ui.hidden.includes(id) ? ui.hidden.filter((h) => h !== id) : [...ui.hidden, id]);

  return (
    <div className="grid-1-1">
      <Card title={L('程序坞', 'Dock')} icon="grid" action={<span className="muted small">{L('拖动排序', 'Drag to reorder')}</span>}>
        <p className="muted small">{L('隐藏的应用仍然可以通过 ⌘K 聚焦搜索打开。桌面和设置固定显示。', 'Hidden apps stay reachable from ⌘K Spotlight. Desktop and Settings are always shown.')}</p>
        <ul className="dock-edit">
          {order.map((id, i) => {
            const a = APPS.find((x) => x.id === id)!;
            const hidden = ui.hidden.includes(id);
            const pinned = PINNED.includes(id);
            return (
              <li
                key={id}
                draggable
                onDragStart={(e) => {
                  setDrag(id);
                  e.dataTransfer.effectAllowed = 'move';
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  if (drag && drag !== id) move(order.indexOf(drag), i);
                }}
                onDragEnd={() => setDrag(null)}
                className={`${hidden ? 'is-hidden' : ''} ${drag === id ? 'is-drag' : ''}`}
              >
                <span className="grip" aria-hidden>
                  <Icon name="grip" size={16} />
                </span>
                <AppGlyph icon={a.icon} hue={a.hue} size={30} />
                <span className="de-name">{lang === 'zh' ? a.zh : a.en}</span>
                <Button size="sm" variant="ghost" icon="arrow-up" title={L('上移', 'Move up')} disabled={i === 0} onClick={() => move(i, i - 1)} />
                <Button size="sm" variant="ghost" icon="arrow-down" title={L('下移', 'Move down')} disabled={i === order.length - 1} onClick={() => move(i, i + 1)} />
                {pinned ? (
                  <span className="de-pin" title={L('固定显示', 'Always shown')}>
                    <Icon name="lock" size={14} />
                  </span>
                ) : (
                  <Button size="sm" variant="ghost" icon={hidden ? 'eye-off' : 'eye'} title={hidden ? L('显示', 'Show') : L('隐藏', 'Hide')} onClick={() => toggle(id)} />
                )}
              </li>
            );
          })}
        </ul>
      </Card>
      <Card title={L('桌面小组件', 'Desktop widgets')} icon="house">
        <p className="muted small">{L('关掉用不上的，桌面会自动重新排布。', 'Turn off what you don’t use — the desktop reflows itself.')}</p>
        <div className="toggle-list">
          {WIDGETS.map((w) => {
            const on = !ui.widgets.includes(w.id);
            return (
              <button key={w.id} className={`toggle-row ${on ? 'is-on' : ''}`} role="switch" aria-checked={on} onClick={() => actions.toggleWidget(w.id)}>
                <span>{L(w.zh, w.en)}</span>
                <i className="switch" />
              </button>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Swatches({ value, onChange }: { value: PaletteKey; onChange: (c: PaletteKey) => void }) {
  return (
    <div className="swatches">
      {PALETTE.map((c) => (
        <button key={c} type="button" aria-label={c} className={value === c ? 'is-on' : ''} style={{ '--sw': `var(--p-${c})` } as CSSProperties} onClick={() => onChange(c)} />
      ))}
    </div>
  );
}

function AttrSettings() {
  const L = useL();
  const lang = useLang();
  const attrs = useAttrs();
  const m = useStore((s) => s.events);
  const [iconFor, setIconFor] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [into, setInto] = useState('');
  const xpOf = (id: string) => m.filter((e) => e.attr === id).reduce((a, e) => a + e.xp, 0);

  return (
    <>
      <Card title={L('属性', 'Attributes')} icon="sparkles" action={<span className="muted small">{L(`${attrs.list.length} / 10`, `${attrs.list.length} / 10`)}</span>}>
        <p className="muted small">{L('属性就是你人生的「维度」。改名字、图标、颜色，或者新增一个（比如「语言」「育儿」「音乐」）。至少保留 3 个。', 'Attributes are the dimensions of your life. Rename them, re-icon, recolor, or add new ones (Languages, Parenting, Music…). Keep at least 3.')}</p>
        <ul className="attr-edit">
          {attrs.list.map((a, i) => (
            <li key={a.id} style={{ '--tone': `var(--c-${a.id})` } as CSSProperties}>
              <button className="ae-icon" onClick={() => setIconFor(iconFor === a.id ? null : a.id)} aria-label={L('更换图标', 'Change icon')}>
                <Icon name={a.icon} size={18} />
              </button>
              <input
                className="input"
                value={lang === 'zh' ? a.zh : a.en}
                onChange={(e) => actions.saveAttr({ ...a, [lang]: e.target.value })}
                aria-label={L('名称', 'Name')}
                placeholder={attrName(a, lang === 'zh' ? 'en' : 'zh')}
              />
              <span className="ae-xp num muted small">{num(xpOf(a.id))} XP</span>
              <Swatches value={a.color} onChange={(c) => actions.saveAttr({ ...a, color: c })} />
              <span className="ae-actions">
                <Button size="sm" variant="ghost" icon="arrow-up" title={L('上移', 'Move up')} disabled={i === 0} onClick={() => actions.moveAttr(a.id, -1)} />
                <Button size="sm" variant="ghost" icon="arrow-down" title={L('下移', 'Move down')} disabled={i === attrs.list.length - 1} onClick={() => actions.moveAttr(a.id, 1)} />
                <Button
                  size="sm"
                  variant="ghost"
                  icon="trash"
                  title={L('删除', 'Delete')}
                  disabled={attrs.list.length <= 3}
                  onClick={() => {
                    setRemoving(a.id);
                    setInto(attrs.list.find((x) => x.id !== a.id)!.id);
                  }}
                />
              </span>
              {iconFor === a.id && (
                <div className="icon-pick ae-icons">
                  {ATTR_ICONS.map((ic) => (
                    <button
                      type="button"
                      key={ic}
                      className={a.icon === ic ? 'is-on' : ''}
                      onClick={() => {
                        actions.saveAttr({ ...a, icon: ic });
                        setIconFor(null);
                      }}
                      aria-label={ic}
                    >
                      <Icon name={ic} size={18} />
                    </button>
                  ))}
                </div>
              )}
            </li>
          ))}
        </ul>
        <Button
          icon="plus"
          disabled={attrs.list.length >= 10}
          onClick={() => {
            const used = new Set(attrs.list.map((a) => a.color));
            actions.saveAttr({ zh: '新属性', en: 'New attribute', icon: 'star', color: PALETTE.find((c) => !used.has(c)) ?? 'teal' });
          }}
        >
          {L('添加属性', 'Add attribute')}
        </Button>
      </Card>
      <Modal
        open={!!removing}
        onClose={() => setRemoving(null)}
        title={L('删除这个属性？', 'Delete this attribute?')}
        footer={
          <>
            <span className="spacer" />
            <Button variant="ghost" onClick={() => setRemoving(null)}>
              {L('取消', 'Cancel')}
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                actions.removeAttr(removing!, into);
                setRemoving(null);
              }}
            >
              {L('删除并合并', 'Delete & merge')}
            </Button>
          </>
        }
      >
        <div className="form">
          <p>{L(`「${attrs.label(removing ?? '')}」下的任务、目标、追踪和已获得的 ${num(xpOf(removing ?? ''))} XP 会合并到：`, `Quests, goals, trackers and the ${num(xpOf(removing ?? ''))} XP earned in “${attrs.label(removing ?? '')}” will move to:`)}</p>
          <select className="input" value={into} onChange={(e) => setInto(e.target.value)}>
            {attrs.list
              .filter((a) => a.id !== removing)
              .map((a) => (
                <option key={a.id} value={a.id}>
                  {attrs.label(a.id)}
                </option>
              ))}
          </select>
        </div>
      </Modal>
    </>
  );
}

/* ------------------------------------------------------------------ */

function WorkSettings() {
  const L = useL();
  const pay = useStore((s) => s.pay);
  const p = useStore((s) => s.profile);
  return (
    <div className="grid-1-1">
      <PayCard pay={pay} currency={p.currency} />
      <Card title={L('为谁工作（项目）', 'Working for (projects)')} icon="briefcase" action={<Button size="sm" variant="ghost" icon="chevron-right" onClick={() => open('projects')}>{L('完整项目管理', 'Full project view')}</Button>}>
        <p className="muted small">{L('老板、客户、项目、副业……每一项都可以有自己的时薪，不填就用默认时薪。时薪计会按项目统计收入。', 'Employers, clients, projects, side gigs — each can have its own rate (blank = default). The wage timer breaks income down by these.')}</p>
        <ProjectsEditor />
      </Card>
      <Card title={L('专注目标', 'Focus goal')} icon="target">
        <Field label={L('每日专注目标（分钟）', 'Daily focus goal (minutes)')}>
          <input className="input" type="number" min={15} step={15} value={p.focusGoalMin} onChange={(e) => actions.profile({ focusGoalMin: Math.max(15, +e.target.value || 240) })} />
        </Field>
      </Card>
    </div>
  );
}

export function PayCard({ pay, currency, compact = false }: { pay: PayConfig; currency: string; compact?: boolean }) {
  const L = useL();
  const hourly = hourlyFrom(pay);
  const unit = { hour: L('时薪', 'Hourly'), day: L('日薪', 'Daily'), month: L('月薪', 'Monthly'), year: L('年薪', 'Yearly') }[pay.mode];
  const body = (
    <div className="form">
      <Segmented
        value={pay.mode}
        onChange={(v) => actions.setPay({ mode: v })}
        options={[
          { value: 'hour', label: L('时薪', 'Hourly') },
          { value: 'day', label: L('日薪', 'Daily') },
          { value: 'month', label: L('月薪', 'Monthly') },
          { value: 'year', label: L('年薪', 'Yearly') },
        ]}
      />
      <div className="row2">
        <Field label={unit}>
          <div className="input-group">
            <input className="input" type="number" min={0} value={pay.amount} onChange={(e) => actions.setPay({ amount: Math.max(0, +e.target.value) })} />
            <select className="input" value={currency} onChange={(e) => actions.profile({ currency: e.target.value })} aria-label={L('货币', 'Currency')}>
              {['USD', 'CNY', 'EUR', 'GBP', 'JPY', 'HKD', 'SGD', 'CAD', 'AUD', 'KRW', 'TWD'].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>
        </Field>
        {pay.mode !== 'hour' && (
          <div className="row2">
            <Field label={L('每天工作（小时）', 'Hours / day')}>
              <input className="input" type="number" min={1} max={24} step={0.5} value={pay.hoursPerDay} onChange={(e) => actions.setPay({ hoursPerDay: +e.target.value || 8 })} />
            </Field>
            {pay.mode !== 'day' && (
              <Field label={L('每周工作（天）', 'Days / week')}>
                <input className="input" type="number" min={1} max={7} step={0.5} value={pay.daysPerWeek} onChange={(e) => actions.setPay({ daysPerWeek: +e.target.value || 5 })} />
              </Field>
            )}
          </div>
        )}
      </div>
      <div className="pay-out">
        <div>
          <span className="muted small">{L('折合时薪', 'Hourly')}</span>
          <strong className="num">{money(hourly, currency)}</strong>
        </div>
        <div>
          <span className="muted small">{L('每分钟', 'Per minute')}</span>
          <strong className="num">{money(hourly / 60, currency, 3)}</strong>
        </div>
        <div>
          <span className="muted small">{L('每秒跳动', 'Per second')}</span>
          <strong className="num">{money(hourly / 3600, currency, 4)}</strong>
        </div>
      </div>
    </div>
  );
  if (compact) return body;
  return (
    <Card title={L('收入方式', 'How you’re paid')} icon="wallet">
      <p className="muted small" style={{ marginBottom: 12 }}>
        {L('按你习惯的方式填写——时薪、日薪、月薪或年薪，系统会换算出每秒的跳钱速度。', 'Enter pay the way you think about it — hourly, daily, monthly or yearly. LifeOS converts it to a per-second tick.')}
      </p>
      {body}
    </Card>
  );
}

/* ------------------------------------------------------------------ */

function PetSettings() {
  const L = useL();
  const pet = useStore((s) => s.pet);
  const [perm, setPerm] = useState(typeof Notification !== 'undefined' ? Notification.permission : 'denied');
  const minutes = (v: number) => (v ? L(`${v} 分钟`, `${v} min`) : L('关闭', 'Off'));
  return (
    <div className="grid-1-1">
      <Card
        title={L('桌面宠物', 'Desktop pet')}
        icon="paw"
        action={
          <button className={`toggle-row bare ${pet.enabled ? 'is-on' : ''}`} role="switch" aria-checked={pet.enabled} onClick={() => actions.setPet({ enabled: !pet.enabled })}>
            <span>{pet.enabled ? L('已开启', 'On') : L('已关闭', 'Off')}</span>
            <i className="switch" />
          </button>
        }
      >
        <div className="pet-pick">
          {PET_KINDS.map((k) => (
            <button key={k.id} className={pet.kind === k.id ? 'is-on' : ''} onClick={() => actions.setPet({ kind: k.id as PetKind, name: pet.name === L(PET_KINDS.find((x) => x.id === pet.kind)!.zh, PET_KINDS.find((x) => x.id === pet.kind)!.en) ? L(k.zh, k.en) : pet.name })}>
              <span className="pet-stage">
                <PetAvatar kind={k.id as PetKind} size={86} mood={pet.kind === k.id ? 'happy' : 'idle'} />
              </span>
              <strong>{L(k.zh, k.en)}</strong>
              <span className="muted small">{L(k.blurbZh, k.blurbEn)}</span>
            </button>
          ))}
        </div>
        <div className="form" style={{ marginTop: 16 }}>
          <div className="row2">
            <Field label={L('名字', 'Name')}>
              <input className="input" value={pet.name} onChange={(e) => actions.setPet({ name: e.target.value })} />
            </Field>
            <Field label={L('活跃程度', 'Energy')}>
              <Segmented
                value={pet.roam}
                onChange={(v) => actions.setPet({ roam: v })}
                options={[
                  { value: 'calm', label: L('安静', 'Calm') },
                  { value: 'lively', label: L('活泼', 'Lively') },
                ]}
              />
            </Field>
          </div>
        </div>
      </Card>
      <Card title={L('健康提醒与番茄钟', 'Health reminders & pomodoro')} icon="bell-ring">
        <div className="form">
          <div className="health-note">
            <Icon name="shield" size={15} />
            <span>
              {L(
                '宠物会按健康建议主动提醒你：成人每天约 2 L 饮水（约 8 杯），分散在清醒时间里；每坐 30–60 分钟起身活动 2–3 分钟（WHO 建议减少久坐）；20-20-20 护眼；成年人每晚 7–9 小时睡眠。离开电脑 5 分钟以上会自动记作一次起身。',
                'Your pet reminds you based on common health guidance: ~2 L of water a day (≈ 8 cups) spread across waking hours; get up and move 2–3 min every 30–60 min of sitting (WHO advises limiting sedentary time); the 20-20-20 eye rule; 7–9 h of sleep for adults. Stepping away ≥ 5 min is logged as a break automatically.',
              )}
            </span>
          </div>
          <div className="toggle-list">
            <button className={`toggle-row ${pet.waterMin ? 'is-on' : ''}`} role="switch" aria-checked={!!pet.waterMin} onClick={() => actions.setPet({ waterMin: pet.waterMin ? 0 : 45 })}>
              <span>{L('喝水提醒', 'Water reminders')}</span>
              <i className="switch" />
            </button>
          </div>
          {pet.waterMin > 0 && (
            <div className="row2">
              <Field label={L('每日目标（杯）', 'Daily goal (cups)')} hint={L(`共 ${((pet.waterGoal * pet.cupMl) / 1000).toFixed(1)} L`, `${((pet.waterGoal * pet.cupMl) / 1000).toFixed(1)} L total`)}>
                <div className="input-group">
                  <input className="input" type="number" min={1} max={20} value={pet.waterGoal} onChange={(e) => actions.setPet({ waterGoal: Math.max(1, Math.min(20, +e.target.value || 8)) })} />
                  <span className="input-addon">×</span>
                  <input className="input" type="number" min={100} max={1000} step={50} value={pet.cupMl} onChange={(e) => actions.setPet({ cupMl: Math.max(100, +e.target.value || 250) })} aria-label={L('每杯毫升', 'ml per cup')} />
                  <span className="input-addon">ml</span>
                </div>
              </Field>
              <Field label={L('清醒时间', 'Waking hours')} hint={L('目标会平均分配在这段时间里', 'The goal is spread across these hours')}>
                <div className="input-group">
                  <select className="input" value={pet.wakeHour} onChange={(e) => actions.setPet({ wakeHour: +e.target.value })} aria-label={L('起床', 'Wake')}>
                    {Array.from({ length: 13 }, (_, h) => h + 4).map((h) => (
                      <option key={h} value={h}>{`${h}:00`}</option>
                    ))}
                  </select>
                  <span className="input-addon">→</span>
                  <select className="input" value={pet.sleepHour} onChange={(e) => actions.setPet({ sleepHour: +e.target.value })} aria-label={L('睡觉', 'Sleep')}>
                    {Array.from({ length: 9 }, (_, h) => h + 18).map((h) => (
                      <option key={h} value={h}>{`${h % 24}:00`}</option>
                    ))}
                  </select>
                </div>
              </Field>
            </div>
          )}
          <Field label={L('久坐提醒', 'Sitting reminder')} hint={L('建议 30–60 分钟；连续操作电脑或计时器运行时累计。', 'Recommended 30–60 min; counts while you use the computer or a timer runs.')}>
            <Segmented value={String(pet.sitMin)} onChange={(v) => actions.setPet({ sitMin: +v })} options={[0, 30, 45, 60, 90].map((v) => ({ value: String(v), label: minutes(v) }))} />
          </Field>
          <div className="toggle-list">
            <button className={`toggle-row ${pet.eye20 ? 'is-on' : ''}`} role="switch" aria-checked={pet.eye20} onClick={() => actions.setPet({ eye20: !pet.eye20 })}>
              <span>
                {L('护眼 20-20-20', 'Eye breaks (20-20-20)')}
                <small className="muted"> {L('（每 20 分钟看远处 20 秒）', '(every 20 min, look far for 20 s)')}</small>
              </span>
              <i className="switch" />
            </button>
            <button className={`toggle-row ${pet.bedtime ? 'is-on' : ''}`} role="switch" aria-checked={!!pet.bedtime} onClick={() => actions.setPet({ bedtime: pet.bedtime ? 0 : 23 * 60 + 30 })}>
              <span>{L('睡前提醒', 'Bedtime reminder')}</span>
              <i className="switch" />
            </button>
          </div>
          {pet.bedtime > 0 && (
            <Field label={L('几点提醒睡觉', 'Remind me at')}>
              <input
                className="input"
                type="time"
                value={`${String(Math.floor(pet.bedtime / 60) % 24).padStart(2, '0')}:${String(pet.bedtime % 60).padStart(2, '0')}`}
                onChange={(e) => {
                  const [h, m] = e.target.value.split(':').map(Number);
                  if (Number.isFinite(h)) actions.setPet({ bedtime: h * 60 + (m || 0) || 1 });
                }}
              />
            </Field>
          )}
          <div className="row2">
            <Field label={L('番茄钟专注（分钟）', 'Pomodoro focus (min)')}>
              <input className="input" type="number" min={5} max={120} value={pet.pomoWork} onChange={(e) => actions.setPet({ pomoWork: Math.max(1, +e.target.value || 25) })} />
            </Field>
            <Field label={L('休息（分钟）', 'Break (min)')}>
              <input className="input" type="number" min={1} max={60} value={pet.pomoBreak} onChange={(e) => actions.setPet({ pomoBreak: Math.max(1, +e.target.value || 5) })} />
            </Field>
          </div>
          <div className="toggle-list">
            <button className={`toggle-row ${pet.sound ? 'is-on' : ''}`} role="switch" aria-checked={pet.sound} onClick={() => actions.setPet({ sound: !pet.sound })}>
              <span>{L('提示音', 'Sound')}</span>
              <i className="switch" />
            </button>
            <button
              className={`toggle-row ${pet.sysNotify && perm === 'granted' ? 'is-on' : ''}`}
              role="switch"
              aria-checked={pet.sysNotify && perm === 'granted'}
              onClick={async () => {
                if (typeof Notification === 'undefined') return;
                let p = Notification.permission;
                if (!pet.sysNotify && p === 'default') p = await Notification.requestPermission();
                setPerm(p);
                actions.setPet({ sysNotify: p === 'granted' ? !pet.sysNotify : false });
              }}
            >
              <span>
                {L('浏览器通知', 'Browser notifications')}
                <small className="muted"> {L('（切到别的标签页也能收到）', '(works from other tabs)')}</small>
              </span>
              <i className="switch" />
            </button>
          </div>
        </div>
      </Card>
    </div>
  );
}

export function ProjectsEditor() {
  const L = useL();
  const p = useStore((s) => s.profile);
  const projects = useStore((s) => s.projects);
  return (
    <>
      <ul className="proj-edit">
        {projects.map((pr) => (
          <li key={pr.id} style={{ '--tone': `var(--p-${pr.color})` } as CSSProperties}>
            <i className="proj-dot" />
            <input className="input" value={pr.name} onChange={(e) => actions.saveProject({ ...pr, name: e.target.value })} aria-label={L('名称', 'Name')} />
            <div className="input-group pe-rate">
              <input className="input" type="number" min={0} value={pr.rate ?? ''} placeholder={String(p.hourlyRate)} onChange={(e) => actions.saveProject({ ...pr, rate: e.target.value === '' ? undefined : +e.target.value })} aria-label={L('时薪', 'Rate')} />
              <span className="input-addon">/h</span>
            </div>
            <Swatches value={pr.color} onChange={(c) => actions.saveProject({ ...pr, color: c })} />
            <Button size="sm" variant="ghost" icon="trash" title={L('删除', 'Delete')} onClick={() => actions.removeProject(pr.id)} />
          </li>
        ))}
      </ul>
      <Button icon="plus" onClick={() => actions.saveProject({ name: L('新项目', 'New project'), color: PALETTE[projects.length % PALETTE.length] })}>
        {L('添加', 'Add')}
      </Button>
    </>
  );
}
