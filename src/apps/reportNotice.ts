import { notify } from '../os/notify';
import { open } from '../os/router';
import { currentKey, hasContent, periodReport, shiftKey, type ReportKind } from '../store/report';
import { getState } from '../store/store';
import { reportTarget } from './Report';

const SEEN = 'lifeos:report-seen';

/**
 * Once per new month (and per new year): "your report for last month is ready", which opens it.
 * Only when that period actually has something in it.
 */
export function announceReports() {
  let seen: Record<string, string> = {};
  try {
    seen = JSON.parse(localStorage.getItem(SEEN) || '{}');
  } catch {
    /* ignore */
  }
  const s = getState();
  if (!s.onboarded) return;
  const zh = s.profile.lang === 'zh';
  const fresh = !seen.month && !seen.year; // first run: remember where we are, don't announce the past
  for (const kind of ['year', 'month'] as ReportKind[]) {
    const prev = shiftKey(kind, currentKey(kind), -1);
    if (seen[kind] === prev) continue;
    seen[kind] = prev;
    if (fresh || s.demo) continue;
    const r = periodReport(s, kind, prev);
    if (!hasContent(r)) continue;
    const label = kind === 'year' ? (zh ? `${prev} 年` : prev) : new Date(`${prev}-01T12:00`).toLocaleDateString(zh ? 'zh-CN' : 'en-US', { year: 'numeric', month: 'long' });
    notify(
      {
        title: zh ? `${label}${kind === 'year' ? '年报' : '月报'}已生成 🎉` : `Your ${label} ${kind === 'year' ? 'year in review' : 'report'} is ready 🎉`,
        body: zh ? `完成 ${r.questsDone} 个任务 · 专注 ${(r.focusMs / 3_600_000).toFixed(1)} 小时 · 解锁 ${r.achievements.length} 个成就。点这里查看。` : `${r.questsDone} quests · ${(r.focusMs / 3_600_000).toFixed(1)}h focused · ${r.achievements.length} achievements. Click to open.`,
        icon: 'chart',
        tone: 'gold',
        onOpen: () => {
          open('report');
          reportTarget(kind, prev);
        },
      },
      15_000,
    );
  }
  try {
    localStorage.setItem(SEEN, JSON.stringify(seen));
  } catch {
    /* ignore */
  }
}
