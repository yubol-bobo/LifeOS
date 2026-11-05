import { useState } from 'react';
import { parseDay } from '../lib/date';
import { num } from '../lib/format';
import { useL, useLang } from '../lib/i18n';
import { syncScholar } from '../lib/scholar';
import { notify } from '../os/notify';
import { useMetrics } from '../store/hooks';
import { PAPER_XP } from '../store/rules';
import { actions, useStore } from '../store/store';
import { PAPER_FLOW, type Paper, type PaperStatus } from '../store/types';
import { AreaChart, Columns } from '../ui/charts';
import { Icon } from '../ui/Icon';
import { Button, Card, Chip, Empty, Field, Modal, Segmented, Stat } from '../ui/kit';

export function useStatusLabel() {
  const L = useL();
  return (s: PaperStatus) =>
    ({
      idea: L('想法', 'Idea'),
      drafting: L('写作中', 'Drafting'),
      submitted: L('已投稿', 'Submitted'),
      review: L('审稿中', 'In review'),
      accepted: L('已接收', 'Accepted'),
      published: L('已发表', 'Published'),
    })[s];
}

const STATUS_ICON: Record<PaperStatus, string> = { idea: 'sparkles', drafting: 'pencil', submitted: 'send', review: 'hourglass', accepted: 'circle-check', published: 'book-open' };

export function Research() {
  const L = useL();
  const lang = useLang();
  const s = useStore((x) => x);
  const m = useMetrics();
  const label = useStatusLabel();
  const [edit, setEdit] = useState<Partial<Paper> | null>(null);
  const [sync, setSync] = useState(false);
  const [view, setView] = useState<'board' | 'list'>('board');

  const log = s.citationLog.map((x) => ({ x: parseDay(x.date).toLocaleDateString(lang === 'zh' ? 'zh-CN' : 'en-US', { year: '2-digit', month: 'short' }), y: x.total }));
  const pipeline = s.papers.filter((p) => p.status !== 'published').length;
  const sortedPapers = [...s.papers].sort((a, b) => b.citations - a.citations);

  return (
    <div className="app">
      <div className="app-head">
        <div>
          <h1>{L('学术', 'Research')}</h1>
          <p className="muted">{L('从一个想法到一篇被引用的论文，每一步都算数。', 'From a stray idea to a cited paper — every step counts.')}</p>
        </div>
        <div className="row-gap">
          <Button icon="refresh" onClick={() => setSync(true)}>
            {L('同步引用', 'Sync citations')}
          </Button>
          <Button variant="primary" icon="plus" onClick={() => setEdit({ status: 'idea', citations: 0, firstAuthor: true, title: '' })}>
            {L('新论文', 'New paper')}
          </Button>
        </div>
      </div>

      <div className="stats-row">
        <Stat label={L('总引用', 'Citations')} value={num(m.totalCitations)} tone="spirit" />
        <Stat label="h-index" value={m.hIndex} />
        <Stat label="i10-index" value={m.i10} />
        <Stat label={L('已发表 / 接收', 'Published')} value={m.papersPublished} sub={L(`管线中 ${pipeline} 篇`, `${pipeline} in pipeline`)} />
      </div>

      <div className="grid-2-1">
        <Card title={L('累计引用', 'Citations over time')} icon="chart">
          {log.length > 1 ? <AreaChart data={log} tone="spirit" height={220} /> : <Empty icon="chart" title={L('更新引用数后这里会出现曲线', 'Update citation counts to see a curve')} />}
        </Card>
        <Card title={L('每年引用', 'Citations per year')} icon="calendar">
          {s.scholar.byYear?.length ? (
            <Columns data={s.scholar.byYear.slice(-8).map((y) => ({ x: String(y.year), y: y.citations }))} tone="spirit" height={220} />
          ) : (
            <Empty icon="calendar" title={L('同步 OpenAlex 后显示', 'Sync with OpenAlex to fill this')} />
          )}
        </Card>
      </div>

      <Card
        title={L('论文管线', 'Paper pipeline')}
        icon="route"
        action={
          <Segmented
            size="sm"
            value={view}
            onChange={setView}
            options={[
              { value: 'board', label: L('看板', 'Board'), icon: 'grid' },
              { value: 'list', label: L('列表', 'List'), icon: 'list-checks' },
            ]}
          />
        }
      >
        {s.papers.length === 0 ? (
          <Empty icon="book-open" title={L('还没有论文', 'No papers yet')} body={L('手动添加，或从 OpenAlex / Semantic Scholar 同步。', 'Add one by hand, or sync from OpenAlex / Semantic Scholar.')} />
        ) : view === 'board' ? (
          <div className="board">
            {PAPER_FLOW.map((st) => {
              const list = s.papers.filter((p) => p.status === st);
              return (
                <div className="board-col" key={st}>
                  <div className="board-head">
                    <Icon name={STATUS_ICON[st]} size={14} />
                    <span>{label(st)}</span>
                    <span className="num muted">{list.length}</span>
                  </div>
                  <div className="board-xp num">{PAPER_XP[st] ? `+${PAPER_XP[st]} XP` : '\u00a0'}</div>
                  {list.map((p) => {
                    const i = PAPER_FLOW.indexOf(p.status);
                    return (
                      <article className="paper-card" key={p.id}>
                        <button className="paper-title" onClick={() => setEdit(p)}>
                          {p.title}
                        </button>
                        <div className="paper-meta">
                          {p.venue && <span>{p.venue}</span>}
                          {p.year && <span className="num">{p.year}</span>}
                          {p.firstAuthor && <Chip tone="spirit">{L('一作', '1st')}</Chip>}
                        </div>
                        <div className="paper-foot">
                          <span className="num cite">
                            <Icon name="quote" size={12} /> {p.citations}
                          </span>
                          <span className="spacer" />
                          <Button size="sm" variant="ghost" icon="chevron-left" title={L('后退', 'Move back')} disabled={i === 0} onClick={() => actions.setPaperStatus(p.id, PAPER_FLOW[i - 1])} />
                          <Button size="sm" variant="ghost" icon="chevron-right" title={L('推进', 'Advance')} disabled={i === PAPER_FLOW.length - 1} onClick={() => actions.setPaperStatus(p.id, PAPER_FLOW[i + 1])} />
                        </div>
                      </article>
                    );
                  })}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>{L('标题', 'Title')}</th>
                  <th>{L('会议/期刊', 'Venue')}</th>
                  <th className="r">{L('年份', 'Year')}</th>
                  <th>{L('状态', 'Status')}</th>
                  <th className="r">{L('引用', 'Cites')}</th>
                </tr>
              </thead>
              <tbody>
                {sortedPapers.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <button className="link" onClick={() => setEdit(p)}>
                        {p.title}
                      </button>
                      {p.url && (
                        <a href={p.url} target="_blank" rel="noreferrer" className="ext" aria-label="open">
                          <Icon name="external" size={12} />
                        </a>
                      )}
                    </td>
                    <td className="muted">{p.venue}</td>
                    <td className="r num">{p.year ?? '—'}</td>
                    <td>
                      <Chip icon={STATUS_ICON[p.status]}>{label(p.status)}</Chip>
                    </td>
                    <td className="r">
                      <input className="input input-num" type="number" min={0} value={p.citations} onChange={(e) => actions.setCitations(p.id, +e.target.value)} aria-label={L('引用数', 'Citations')} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <PaperEditor value={edit} onClose={() => setEdit(null)} />
      <SyncModal open={sync} onClose={() => setSync(false)} />
    </div>
  );
}

function PaperEditor({ value, onClose }: { value: Partial<Paper> | null; onClose: () => void }) {
  const L = useL();
  const label = useStatusLabel();
  const [d, setD] = useState<Partial<Paper>>({});
  const [key, setKey] = useState<string | undefined>('__');
  const k = value ? (value.id ?? 'new') : undefined;
  if (k !== key) {
    setKey(k);
    if (value) setD(value);
  }
  const p = { status: 'idea', citations: 0, firstAuthor: true, title: '', ...d } as Paper;
  const save = () => {
    if (!p.title.trim()) return;
    actions.savePaper({ ...p, title: p.title.trim(), source: p.source ?? 'manual' });
    onClose();
  };
  return (
    <Modal
      open={!!value}
      onClose={onClose}
      title={p.id ? L('编辑论文', 'Edit paper') : L('新论文', 'New paper')}
      footer={
        <>
          {p.id && (
            <Button variant="danger" icon="trash" onClick={() => (actions.removePaper(p.id), onClose())}>
              {L('删除', 'Delete')}
            </Button>
          )}
          <span className="spacer" />
          <Button variant="ghost" onClick={onClose}>
            {L('取消', 'Cancel')}
          </Button>
          <Button variant="primary" icon="check" onClick={save} disabled={!p.title.trim()}>
            {L('保存', 'Save')}
          </Button>
        </>
      }
    >
      <div className="form">
        <Field label={L('标题', 'Title')}>
          <input className="input" value={p.title} onChange={(e) => setD({ ...p, title: e.target.value })} />
        </Field>
        <div className="row2">
          <Field label={L('会议 / 期刊', 'Venue')}>
            <input className="input" value={p.venue ?? ''} onChange={(e) => setD({ ...p, venue: e.target.value })} placeholder="NeurIPS, Nature…" />
          </Field>
          <Field label={L('年份', 'Year')}>
            <input className="input" type="number" value={p.year ?? ''} onChange={(e) => setD({ ...p, year: e.target.value ? +e.target.value : undefined })} />
          </Field>
        </div>
        <Field label={L('状态', 'Status')}>
          <select className="input" value={p.status} onChange={(e) => setD({ ...p, status: e.target.value as PaperStatus })}>
            {PAPER_FLOW.map((st) => (
              <option key={st} value={st}>
                {label(st)}
                {PAPER_XP[st] ? `  (+${PAPER_XP[st]} XP)` : ''}
              </option>
            ))}
          </select>
        </Field>
        <div className="row2">
          <Field label={L('引用数', 'Citations')}>
            <input className="input" type="number" min={0} value={p.citations} onChange={(e) => setD({ ...p, citations: +e.target.value })} />
          </Field>
          <Field label={L('作者身份', 'Authorship')}>
            <Segmented
              value={p.firstAuthor ? 'first' : 'co'}
              onChange={(v) => setD({ ...p, firstAuthor: v === 'first' })}
              options={[
                { value: 'first', label: L('一作', 'First') },
                { value: 'co', label: L('合作', 'Co-author') },
              ]}
            />
          </Field>
        </div>
        <Field label={L('链接', 'Link')}>
          <input className="input" value={p.url ?? ''} onChange={(e) => setD({ ...p, url: e.target.value })} placeholder="https://doi.org/…" />
        </Field>
      </div>
    </Modal>
  );
}

function SyncModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const L = useL();
  const scholar = useStore((s) => s.scholar);
  const [provider, setProvider] = useState(scholar.provider);
  const [id, setId] = useState(scholar.authorId);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const run = async () => {
    setBusy(true);
    setErr('');
    try {
      const res = await syncScholar(provider, id);
      const { added, updated } = actions.importPapers(res.papers, { provider, authorId: id, byYear: res.byYear });
      notify({ title: L('引用已同步', 'Citations synced'), body: L(`${res.name}：新增 ${added} 篇，更新 ${updated} 篇`, `${res.name}: ${added} added, ${updated} updated`), icon: 'refresh', tone: 'good' });
      onClose();
    } catch (e) {
      setErr(L(`同步失败：${(e as Error).message}。请检查 ID 或网络。`, `Sync failed: ${(e as Error).message}. Check the ID or your connection.`));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={L('同步学术档案', 'Sync scholar profile')}
      footer={
        <>
          <span className="spacer" />
          <Button variant="ghost" onClick={onClose}>
            {L('取消', 'Cancel')}
          </Button>
          <Button variant="primary" icon="refresh" onClick={run} disabled={busy || !id.trim()}>
            {busy ? L('同步中…', 'Syncing…') : L('开始同步', 'Sync now')}
          </Button>
        </>
      }
    >
      <div className="form">
        <Field label={L('数据源', 'Source')}>
          <Segmented
            value={provider}
            onChange={setProvider}
            options={[
              { value: 'openalex', label: 'OpenAlex' },
              { value: 's2', label: 'Semantic Scholar' },
            ]}
          />
        </Field>
        <Field
          label={provider === 'openalex' ? L('OpenAlex 作者 ID 或 ORCID', 'OpenAlex author ID or ORCID') : L('Semantic Scholar 作者 ID', 'Semantic Scholar author ID')}
          hint={
            provider === 'openalex'
              ? L('例如 A5023888391，或 orcid:0000-0002-1825-0097。在 openalex.org 搜索你的名字即可找到。', 'e.g. A5023888391 or orcid:0000-0002-1825-0097 — search your name on openalex.org.')
              : L('作者主页 URL 末尾的数字，例如 semanticscholar.org/author/…/1741101 中的 1741101。', 'The number at the end of your author page URL.')
          }
        >
          <input className="input" value={id} onChange={(e) => setId(e.target.value)} placeholder={provider === 'openalex' ? 'A5023888391' : '1741101'} />
        </Field>
        <p className="muted small">
          {L('按标题匹配：已有论文只更新引用数，新论文以「已发表」加入。Google Scholar 没有公开 API，无法在浏览器中同步。', 'Matched by title: existing papers get fresh citation counts, new ones are added as published. Google Scholar has no public API, so it cannot be synced from a browser.')}
        </p>
        {err && <p className="error">{err}</p>}
      </div>
    </Modal>
  );
}
