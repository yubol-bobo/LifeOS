import { useRef, useState } from 'react';
import { useL } from '../lib/i18n';
import { notify } from '../os/notify';
import { demoState } from '../store/demo';
import { actions, defaultState, getState, useStore } from '../store/store';
import type { State } from '../store/types';
import { Button, Card, Field, Modal, Segmented } from '../ui/kit';

export function Settings() {
  const L = useL();
  const p = useStore((s) => s.profile);
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
      const d = defaultState();
      actions.replace({ ...d, ...parsed, profile: { ...d.profile, ...parsed.profile } } as State);
      notify({ title: L('数据已恢复', 'Data restored'), icon: 'upload', tone: 'good' });
    } catch {
      notify({ title: L('无法读取这个文件', "Couldn't read that file"), body: L('请选择 LifeOS 导出的 JSON 备份。', 'Pick a JSON backup exported from LifeOS.'), icon: 'info', tone: 'warn' });
    }
  };

  return (
    <div className="app">
      <div className="app-head">
        <div>
          <h1>{L('系统设置', 'Settings')}</h1>
          <p className="muted">{L('LifeOS 完全运行在你的浏览器里。没有账号，没有服务器。', 'LifeOS runs entirely in your browser. No account, no server.')}</p>
        </div>
      </div>

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

        <Card title={L('工作与收入', 'Work & income')} icon="wallet">
          <div className="form">
            <div className="row2">
              <Field label={L('默认时薪', 'Default hourly rate')}>
                <input className="input" type="number" min={0} value={p.hourlyRate} onChange={(e) => actions.profile({ hourlyRate: +e.target.value })} />
              </Field>
              <Field label={L('货币', 'Currency')}>
                <select className="input" value={p.currency} onChange={(e) => actions.profile({ currency: e.target.value })}>
                  {['USD', 'CNY', 'EUR', 'GBP', 'JPY', 'HKD', 'SGD', 'CAD', 'AUD', 'KRW', 'TWD'].map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </Field>
            </div>
            <Field label={L('每日专注目标（分钟）', 'Daily focus goal (minutes)')}>
              <input className="input" type="number" min={15} step={15} value={p.focusGoalMin} onChange={(e) => actions.profile({ focusGoalMin: Math.max(15, +e.target.value || 240) })} />
            </Field>
          </div>
        </Card>

        <Card title={L('数据', 'Data')} icon="download">
          <p className="muted small">{L('数据保存在本机浏览器（localStorage）。换设备或清理浏览器前，请先导出备份。', 'Data lives in this browser (localStorage). Export a backup before switching devices or clearing your browser.')}</p>
          <div className="row-gap wrap">
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
      </div>

      <Card className="about">
        <span className="logo-mark logo-lg" />
        <div>
          <h3>
            LifeOS <span className="muted">1.0</span>
          </h3>
          <p className="muted small">
            {L('开源、本地优先的人生操作系统。快捷键：⌘K / Ctrl+K 打开聚焦搜索。', 'An open-source, local-first operating system for your life. Press ⌘K / Ctrl+K for Spotlight.')}
          </p>
        </div>
      </Card>

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
        <p>{confirm === 'demo' ? L('当前数据会被示例数据替换。建议先导出备份。', 'Your current data will be replaced. Consider exporting a backup first.') : L('任务、里程碑、论文、收入记录和成就都会被删除，个人资料保留。此操作无法撤销。', 'Quests, milestones, papers, sessions and trophies will be deleted; your profile stays. This cannot be undone.')}</p>
      </Modal>
    </div>
  );
}
