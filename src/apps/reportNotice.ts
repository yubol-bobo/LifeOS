import { notify } from '../os/notify';
import { open } from '../os/router';
import { currentKey, hasContent, periodReport, shiftKey, type ReportKind } from '../store/report';
import { assessmentFor } from '../store/h3';
import { periodName } from './Human3';
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
  for (const kind of ['year', 'quarter', 'month'] as ReportKind[]) {
    const prev = shiftKey(kind, currentKey(kind), -1);
    if (seen[kind] === prev) continue;
    const fresh = !seen[kind]; // first time for this kind: remember where we are, don't announce the past
    seen[kind] = prev;
    if (fresh || s.demo) continue;
    const r = periodReport(s, kind, prev);
    if (!hasContent(r)) continue;
    const label = periodName(kind, prev, zh ? 'zh' : 'en');
    const h3 = !assessmentFor(s, kind, prev);
    const what = kind === 'year' ? ['年报', 'year in review'] : kind === 'quarter' ? ['季报', 'quarterly report'] : ['月报', 'report'];
    notify(
      {
        title: zh ? `${label}${what[0]}已生成 🎉` : `Your ${label} ${what[1]} is ready 🎉`,
        body:
          (zh ? `完成 ${r.questsDone} 个任务 · 专注 ${(r.focusMs / 3_600_000).toFixed(1)} 小时 · 解锁 ${r.achievements.length} 个成就。点这里查看。` : `${r.questsDone} quests · ${(r.focusMs / 3_600_000).toFixed(1)}h focused · ${r.achievements.length} achievements. Click to open.`) +
          (h3 ? (zh ? ' 顺便在「Human 3.0」里给这一期做个评估。' : ' Then place yourself on the Human 3.0 map for this period.') : ''),
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
