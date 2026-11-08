import { useState } from 'react';
import { useBoardDrag } from '../ui/useBoardDrag';
import { dayKey, parseDay } from '../lib/date';
import { num } from '../lib/format';
import { useL, useLang } from '../lib/i18n';
import { syncScholar } from '../lib/scholar';
import { loadFeed, useScholarFeed, type ScholarFeed } from '../lib/scholarFeed';
import { notify } from '../os/notify';
import { useMetrics } from '../store/hooks';
import { PAPER_XP } from '../store/rules';
import { actions, scholarBound, useStore } from '../store/store';
import { PAPER_FLOW, type Paper, type PaperStatus } from '../store/types';
import { AreaChart, Columns, Sparkline } from '../ui/charts';
import { Icon } from '../ui/Icon';
import { Button, Card, Chip, Empty, Field, Modal, Segmented, Stat } from '../ui/kit';
import { ProjectSelect, ProjectTag } from './goals';

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
  const feed = useScholarFeed();
  const bound = useStore((x) => (feed ? scholarBound(x, feed) : false));
  const fmap = new Map((feed?.papers ?? []).map((p) => [p.id, p]));
  const fOf = (p: Paper) => (p.scholarId ? fmap.get(p.scholarId) : undefined);
  const sortedPapers = [...s.papers].sort((a, b) => Number(!!a.removed) - Number(!!b.removed) || b.citations - a.citations);

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
        <Stat label={L('总引用', 'Citations')} value={num(m.totalCitations)} tone="spirit" sub={feed?.deltas.d7 != null ? L(`近 7 天 ${feed.deltas.d7 >= 0 ? '+' : ''}${feed.deltas.d7}`, `7d ${feed.deltas.d7 >= 0 ? '+' : ''}${feed.deltas.d7}`) : undefined} />
        <Stat label="h-index" value={m.hIndex} />
        <Stat label="i10-index" value={m.i10} />
        <Stat label={L('已发表 / 接收', 'Published')} value={m.papersPublished} sub={L(`管线中 ${pipeline} 篇`, `${pipeline} in pipeline`)} />
      </div>

      {feed && (bound ? (
        <ScholarCard feed={feed} />
      ) : (
        <Card title="Google Scholar" icon="graduation">
          <div className="gs-claim">
            <p>
              {L('这个网站自带一个自动同步的 Google Scholar 数据源', 'This site comes with an auto-synced Google Scholar feed')}
              {feed.profile.name ? `：${feed.profile.name}` : ''} <span className="muted small">({feed.authorId})</span>
              {L('。如果这是你的主页，绑定后论文和引用会自动合并进你的 LifeOS；如果你只是来试用或 fork 的，忽略即可。', '. If it’s your profile, bind it and papers and citations merge into your LifeOS automatically; if you’re just trying LifeOS or forked it, ignore this.')}
            </p>
            <Button variant="primary" icon="check" onClick={() => actions.bindScholarFeed(feed)}>
              {L('这是我的，绑定', 'It’s mine — bind it')}
            </Button>
          </div>
        </Card>
      ))}

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
          <PaperBoard papers={s.papers} onOpen={setEdit} fOf={fOf} />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>{L('标题', 'Title')}</th>
                  <th>{L('会议/期刊', 'Venue')}</th>
                  <th className="r">{L('年份', 'Year')}</th>
                  <th>{L('状态', 'Status')}</th>
                  <th className="r">{L('近 7 天', '7d')}</th>
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
                      {p.removed && (
                        <>
                          {' '}
                          <Chip>{L('已从主页消失', 'Gone from profile')}</Chip>
                        </>
                      )}
                    </td>
                    <td className="muted">{p.venue}</td>
                    <td className="r num">{p.year ?? '—'}</td>
                    <td>
                      <Chip icon={STATUS_ICON[p.status]}>{label(p.status)}</Chip>
                    </td>
                    <td className="r num">{fOf(p)?.d7 != null ? <span className={fOf(p)!.d7! > 0 ? 'pos' : 'muted'}>{fOf(p)!.d7! > 0 ? `+${fOf(p)!.d7}` : '0'}</span> : <span className="muted">—</span>}</td>
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

const DAY_MS = 86_400_000;
/** When the paper entered its current stage, if we know. */
const enteredAt = (p: Paper) => [...(p.history ?? [])].reverse().find((m) => m.status === p.status)?.at;

/**
 * Kanban board. Drag a card to another column to change its stage (the time is recorded);
 * mouse drags start after a few pixels, touch drags after a short press so the board still scrolls.
 * The ‹ › buttons remain for keyboards and precise moves.
 */
function PaperBoard({ papers, onOpen, fOf }: { papers: Paper[]; onOpen: (p: Paper) => void; fOf: (p: Paper) => { d7?: number | null } | undefined }) {
  const L = useL();
  const lang = useLang();
  const label = useStatusLabel();
  const [now] = useState(() => Date.now());
  const { drag, board, start, ghostEl, justDragged } = useBoardDrag<PaperStatus>((id, _from, to) => {
    actions.setPaperStatus(id, to);
    const d = new Date().toLocaleDateString(lang === 'zh' ? 'zh-CN' : 'en-US', { month: 'short', day: 'numeric' });
    notify({ title: L(`已移到「${label(to)}」`, `Moved to ${label(to)}`), body: L(`变更时间已记录：${d}`, `Recorded on ${d}`), icon: STATUS_ICON[to], tone: to === 'accepted' || to === 'published' ? 'gold' : 'info' });
  });

  const dragged = drag ? papers.find((p) => p.id === drag.id) : undefined;
  return (
    <div className={`board ${drag ? 'is-dragging' : ''}`} ref={board}>
      {PAPER_FLOW.map((stage) => {
        const list = papers.filter((p) => p.status === stage);
        const over = drag?.over === stage && drag.from !== stage;
        return (
          <div className={`board-col ${over ? 'is-over' : ''}`} key={stage} data-col={stage}>
            <div className="board-head">
              <Icon name={STATUS_ICON[stage]} size={14} />
              <span>{label(stage)}</span>
              <span className="num muted">{list.length}</span>
            </div>
            <div className="board-xp num">{PAPER_XP[stage] ? `+${PAPER_XP[stage]} XP` : '\u00a0'}</div>
            {list.map((p) => {
              const i = PAPER_FLOW.indexOf(p.status);
              const since = enteredAt(p);
              const days = since != null ? Math.max(0, Math.floor((now - since) / DAY_MS)) : null;
              return (
                <article className={`paper-card ${drag?.id === p.id ? 'is-dragging' : ''}`} key={p.id} onPointerDown={(e) => start(e, p.id, p.status)}>
                  <button className="paper-title" onClick={() => !justDragged() && onOpen(p)}>
                    {p.title}
                  </button>
                  <div className="paper-meta">
                    {p.venue && <span>{p.venue}</span>}
                    {p.year && <span className="num">{p.year}</span>}
                    {p.firstAuthor && <Chip tone="spirit">{L('一作', '1st')}</Chip>}
                    {p.removed && <Chip>{L('已从主页消失', 'Gone from profile')}</Chip>}
                    <ProjectTag id={p.projectId} />
                  </div>
                  <div className="paper-foot">
                    <span className="num cite">
                      <Icon name="quote" size={12} /> {p.citations}
                      {(fOf(p)?.d7 ?? 0) > 0 && <span className="cite-up">+{fOf(p)!.d7}</span>}
                    </span>
                    {days != null && (
                      <span className="paper-age num" title={L(`${dayKey(since!)} 进入「${label(p.status)}」`, `${label(p.status)} since ${dayKey(since!)}`)}>
                        <Icon name="clock" size={11} /> {days === 0 ? L('今天', 'today') : L(`${days} 天`, `${days}d`)}
                      </span>
                    )}
                    <span className="spacer" />
                    <span data-nodrag className="pf-arrows">
                      <Button size="sm" variant="ghost" icon="chevron-left" title={L('后退', 'Move back')} disabled={i === 0} onClick={() => actions.setPaperStatus(p.id, PAPER_FLOW[i - 1])} />
                      <Button size="sm" variant="ghost" icon="chevron-right" title={L('推进', 'Advance')} disabled={i === PAPER_FLOW.length - 1} onClick={() => actions.setPaperStatus(p.id, PAPER_FLOW[i + 1])} />
                    </span>
                  </div>
                </article>
              );
            })}
            {over && <div className="board-drop">{L('放到这里', 'Drop here')}</div>}
          </div>
        );
      })}
      {dragged &&
        ghostEl(
          <>
            <b>{dragged.title}</b>
            <span className="muted small">{drag?.over && drag.over !== dragged.status ? `${label(dragged.status)} → ${label(drag.over)}` : label(dragged.status)}</span>
          </>,
        )}
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
  const hist = useStore((x) => (p.id ? x.papers.find((q) => q.id === p.id)?.history : undefined));
  const today = dayKey();
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
        {p.id && (
          <Field label={L('进展记录', 'Stage history')} hint={hist?.length ? L('日期可以改，比如你晚了几天才拖动卡片', 'Dates are editable, e.g. if you moved the card a few days late') : undefined}>
            {hist?.length ? (
              <ol className="paper-hist">
                {hist.map((m, i) => {
                  const gap = i > 0 ? Math.round((m.at - hist[i - 1].at) / DAY_MS) : null;
                  const midnight = parseDay(dayKey(m.at)).getTime();
                  return (
                    <li key={`${i}-${m.at}`}>
                      <Chip icon={STATUS_ICON[m.status]}>{label(m.status)}</Chip>
                      <input
                        className="input input-date"
                        type="date"
                        max={today}
                        value={dayKey(m.at)}
                        aria-label={L('日期', 'Date')}
                        onChange={(e) => e.target.value && actions.setPaperMoveTime(p.id, i, parseDay(e.target.value).getTime() + (m.at - midnight))}
                      />
                      <span className="muted small num">{gap != null ? L(`+${gap} 天`, `+${gap}d`) : L('开始', 'start')}</span>
                      <span className="spacer" />
                      <Button size="sm" variant="ghost" icon="x" title={L('删除这条记录', 'Remove this entry')} onClick={() => actions.removePaperMove(p.id, i)} />
                    </li>
                  );
                })}
              </ol>
            ) : (
              <p className="muted small">{L('这篇论文还没有进展记录。之后每次改变状态（拖动卡片、点 ‹ ›、或在这里改状态），时间都会记在这里。', 'No stage history yet. From now on, every stage change (dragging the card, the ‹ › buttons, or the status above) is recorded here with its date.')}</p>
            )}
          </Field>
        )}
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
        <Field label={L('属于哪个项目', 'Project')}>
          <ProjectSelect value={p.projectId} onChange={(v) => setD({ ...p, projectId: v })} />
        </Field>
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
  // Google Scholar is fetched by the repo's scheduled workflow; here we show its status and bind it
  const feed = useScholarFeed();
  const bound = useStore((x) => (feed ? scholarBound(x, feed) : false));
  const lastApplied = useStore((x) => x.scholar.gsFetch);
  const bindFeed = () => {
    if (!feed) return;
    if (bound) actions.applyScholarFeed(feed);
    else actions.bindScholarFeed(feed);
    notify({ title: bound ? L('已是最新', 'Up to date') : L('已绑定 Google Scholar', 'Google Scholar bound'), body: L(`${feed.papers.length} 篇论文已合并进「学术」，之后每次抓取都会自动更新。`, `${feed.papers.length} papers merged into Research; every new fetch updates them automatically.`), icon: 'graduation', tone: 'good' });
    onClose();
  };

  const run = async () => {
    if (provider === 'gscholar') return bindFeed();
    setBusy(true);
    setErr('');
    try {
      const res = await syncScholar(provider as 'openalex' | 's2', id);
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
          {provider === 'gscholar' ? (
            <Button variant="primary" icon={bound ? 'check' : 'graduation'} onClick={bindFeed} disabled={!feed || (bound && lastApplied === feed.lastFetch)}>
              {!feed ? L('等待第一次自动抓取', 'Waiting for the first fetch') : !bound ? L('这是我的，绑定并合并', 'It’s mine — bind & merge') : lastApplied === feed.lastFetch ? L('已是最新 ✓', 'Up to date ✓') : L('合并最新数据', 'Merge the latest fetch')}
            </Button>
          ) : (
            <Button variant="primary" icon="refresh" onClick={run} disabled={busy || !id.trim()}>
              {busy ? L('同步中…', 'Syncing…') : L('开始同步', 'Sync now')}
            </Button>
          )}
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
              { value: 'gscholar', label: 'Google Scholar' },
            ]}
          />
        </Field>
        {provider === 'gscholar' ? (
          <div className="gs-setup">
            {feed ? (
              <div className={`gs-status ${bound ? 'is-bound' : ''}`}>
                <b>
                  <Icon name="circle-check" size={15} /> {L('自动同步正常', 'Auto-sync is working')}
                </b>
                <span>
                  {feed.profile.name || feed.authorId} · {L(`${feed.papers.length} 篇论文`, `${feed.papers.length} papers`)}
                  {feed.totals ? L(` · ${feed.totals.citations} 次引用`, ` · ${feed.totals.citations} citations`) : ''}
                </span>
                <span className="muted small">
                  {feed.lastFetch ? L(`上次抓取：${ago(feed.lastFetch, L)}`, `Last fetch: ${ago(feed.lastFetch, L)}`) : ''}
                  {feed.nextFetch ? ` · ${feed.nextFetch <= Date.now() ? L('下次：一小时内', 'next: within the hour') : L(`下次：约 ${until(feed.nextFetch, L)}`, `next: in about ${until(feed.nextFetch, L)}`)}` : ''} · {L(`本月已用 ${feed.callsThisMonth}/${feed.monthlyLimit ?? 100} 次 SerpAPI 调用`, `${feed.callsThisMonth}/${feed.monthlyLimit ?? 100} SerpAPI calls this month`)}
                </span>
                <span className="small">{bound ? L('已绑定到这个 LifeOS：每次打开「学术」都会自动合并最新的论文和引用。', 'Bound to this LifeOS: the latest papers and citations merge in automatically whenever you open Research.') : L('还没绑定到这个 LifeOS：点下面的按钮，把这些论文和引用合并进来。', 'Not bound to this LifeOS yet: use the button below to merge these papers and citations in.')}</span>
              </div>
            ) : (
              <p className="gs-status is-wait">{L('还没有抓取到数据。确认下面的 Secret / Variable 已设置，然后等定时任务运行一次（或在仓库的 Actions → Deploy to GitHub Pages 里点 Run workflow）。', 'No data fetched yet. Check the secret / variable below, then wait for the scheduled run (or Actions → Deploy to GitHub Pages → Run workflow in your repo).')}</p>
            )}
            {feed && <ScholarNow feed={feed} />}
            <p>{L('设置方法：', 'Setup:')}</p>
            <ol>
              <li>{L('GitHub 仓库 → Settings → Secrets and variables → Actions', 'GitHub repo → Settings → Secrets and variables → Actions')}</li>
              <li>
                {L('Secret：', 'Secret: ')}
                <code>SERPAPI_KEY</code>
              </li>
              <li>
                {L('Variable：', 'Variable: ')}
                <code>SCHOLAR_ID</code> {L('（Scholar 主页网址中 user= 后面的部分）', '(the user= part of your Scholar profile URL)')}
              </li>
              <li>{L('可选 Variable：SCHOLAR_INTERVAL_HOURS（每隔几小时抓一次，默认 8）、SCHOLAR_MONTHLY_LIMIT（每月最多调用几次，默认 100，即免费额度）。间隔太短、额度不够撑到月底时，会自动拉开一点间隔。', 'Optional variables: SCHOLAR_INTERVAL_HOURS (hours between fetches, default 8) and SCHOLAR_MONTHLY_LIMIT (calls per month, default 100, the free plan). If the interval would run out of budget before the month ends, fetches are spaced out a little more.')}</li>
            </ol>
          </div>
        ) : (
        <>
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
          {L('按标题匹配：已有论文只更新引用数，新论文以「已发表」加入。', 'Matched by title: existing papers get fresh citation counts, new ones are added as published.')}
        </p>
        </>
        )}
        {err && <p className="error">{err}</p>}
      </div>
    </Modal>
  );
}

/** The repo's "Run workflow" page, when the site is served from GitHub Pages (<owner>.github.io/<repo>). */
function actionsUrl() {
  const m = location.hostname.match(/^([\w-]+)\.github\.io$/i);
  if (!m) return null;
  const repo = location.pathname.split('/').filter(Boolean)[0] || `${m[1]}.github.io`;
  return `https://github.com/${m[1]}/${repo}/actions/workflows/deploy.yml`;
}

/** How the schedule works, plus "fetch now" (a manual workflow run) and "check for new data". */
function ScholarNow({ feed }: { feed: ScholarFeed }) {
  const L = useL();
  const [checking, setChecking] = useState(false);
  const url = actionsUrl();
  const every = feed.intervalHours ?? 8;
  const pace = feed.paceHours ?? every;
  const check = async () => {
    setChecking(true);
    const before = feed.lastFetch;
    const f = await loadFeed(true);
    setChecking(false);
    const fresh = !!f?.lastFetch && f.lastFetch !== before;
    notify({ title: fresh ? L('拿到新数据了', 'New data is in') : L('还没有新数据', 'Nothing new yet'), body: fresh ? L(`抓取于 ${ago(f!.lastFetch!, L)}`, `Fetched ${ago(f!.lastFetch!, L)}`) : L('手动运行一般要 1–2 分钟才会上线，稍后再点一次。', 'A manual run usually takes 1–2 minutes to go live; try again shortly.'), icon: 'refresh', tone: fresh ? 'good' : 'info' });
  };
  return (
    <div className="gs-now">
      <p>
        {L(`由仓库的定时任务借助 SerpAPI 自动抓取：每 ${every} 小时一次`, `Fetched by the repo’s scheduled workflow via SerpAPI, every ${every} h`)}
        {pace > every + 0.05 ? L(`（本月为了额度够用，实际约每 ${pace} 小时）`, ` (about every ${pace} h this month, so the budget lasts)`) : ''}
        {L(`，每月最多 ${feed.monthlyLimit ?? 100} 次调用。GitHub 的定时任务有时会晚一点开始。`, `, at most ${feed.monthlyLimit ?? 100} calls a month. GitHub sometimes starts scheduled runs a little late.`)}
      </p>
      <div className="row-gap wrap">
        {url && (
          <a className="btn btn-soft btn-sm" href={url} target="_blank" rel="noreferrer">
            <Icon name="zap" size={15} />
            <span>{L('立即抓取（去 GitHub 运行）', 'Fetch now (run on GitHub)')}</span>
          </a>
        )}
        <Button size="sm" variant="ghost" icon="refresh" disabled={checking} onClick={() => void check()}>
          {checking ? L('检查中…', 'Checking…') : L('检查新数据', 'Check for new data')}
        </Button>
      </div>
      {url && <p className="muted small">{L('打开的页面里点「Run workflow」→ 绿色的「Run workflow」，1–2 分钟后回来点「检查新数据」。手动运行会立即抓取，不受间隔限制，但仍算进每月额度。', 'On that page click “Run workflow” → the green “Run workflow”, then come back in 1–2 minutes and click “Check for new data”. A manual run fetches right away, ignoring the interval, but still counts toward the monthly budget.')}</p>}
    </div>
  );
}

function until(ts: number, L: (zh: string, en: string) => string) {
  const m = Math.max(1, Math.round((ts - Date.now()) / 60_000));
  if (m < 60) return L(`${m} 分钟后`, `${m} min`);
  const h = Math.round(m / 6) / 10;
  return L(`${h} 小时后`, `${h} h`);
}

function ago(ts: number, L: (zh: string, en: string) => string) {
  const m = Math.max(0, Math.round((Date.now() - ts) / 60_000));
  if (m < 60) return L(`${m} 分钟前`, `${m} min ago`);
  const h = Math.round(m / 60);
  if (h < 48) return L(`${h} 小时前`, `${h} h ago`);
  return L(`${Math.round(h / 24)} 天前`, `${Math.round(h / 24)} d ago`);
}

function ScholarCard({ feed }: { feed: ScholarFeed }) {
  const L = useL();
  const movers = feed.papers.filter((p) => !p.removed && (p.d7 ?? 0) > 0).sort((a, b) => (b.d7 ?? 0) - (a.d7 ?? 0));
  const added = feed.papers.filter((p) => feed.changes.added.includes(p.id));
  const removed = feed.papers.filter((p) => p.removed);
  const D = ({ v, label }: { v: number | null; label: string }) => (
    <div className="gs-delta">
      <span className="muted small">{label}</span>
      <strong className={`num ${v != null && v > 0 ? 'pos' : ''}`}>{v == null ? '—' : `${v > 0 ? '+' : ''}${v}`}</strong>
    </div>
  );
  return (
    <Card
      title="Google Scholar"
      icon="graduation"
      action={
        <span className="muted small">
          {feed.lastFetch ? L(`${ago(feed.lastFetch, L)}同步 · 每 ${feed.paceHours ?? feed.intervalHours ?? 8} 小时自动更新 · 本月 API ${feed.callsThisMonth}/${feed.monthlyLimit ?? 100}`, `Synced ${ago(feed.lastFetch, L)} · auto every ${feed.paceHours ?? feed.intervalHours ?? 8} h · ${feed.callsThisMonth}/${feed.monthlyLimit ?? 100} calls this month`) : ''}
        </span>
      }
    >
      <div className="gs-grid">
        <div className="gs-left">
          {feed.profile.name && (
            <p className="gs-name">
              <strong>{feed.profile.name}</strong>
              {feed.profile.affiliations && <span className="muted small"> · {feed.profile.affiliations}</span>}
            </p>
          )}
          <div className="gs-deltas">
            <D v={feed.deltas.d1} label={L('较上次', 'Since last day')} />
            <D v={feed.deltas.d7} label={L('近 7 天', '7 days')} />
            <D v={feed.deltas.d30} label={L('近 30 天', '30 days')} />
          </div>
          {(added.length > 0 || removed.length > 0) && (
            <div className="gs-changes">
              {added.map((p) => (
                <p key={p.id}>
                  <Chip tone="wealth">{L('新增', 'New')}</Chip> {p.title}
                </p>
              ))}
              {removed.map((p) => (
                <p key={p.id} className="muted">
                  <Chip>{L('已消失', 'Removed')}</Chip> {p.title}
                </p>
              ))}
            </div>
          )}
        </div>
        <div>
          <p className="muted small" style={{ marginBottom: 8 }}>
            {L('本周引用增长最多', 'Top movers this week')}
          </p>
          {movers.length === 0 ? (
            <p className="muted small">{L('这周还没有新的引用，数据会每 8 小时刷新。', 'No new citations this week yet — refreshes every 8 hours.')}</p>
          ) : (
            <ul className="gs-movers">
              {movers.slice(0, 5).map((p) => (
                <li key={p.id}>
                  <span className="gs-title">{p.title}</span>
                  <Sparkline values={p.series.filter((v): v is number => v != null)} tone="spirit" width={70} height={24} />
                  <span className="num pos">+{p.d7}</span>
                  <span className="num muted small">{p.citations}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Card>
  );
}
