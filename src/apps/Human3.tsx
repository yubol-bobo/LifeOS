import { useMemo, useState, type CSSProperties } from 'react';
import { activeProvider } from '../ai/config';
import { AiError, generate } from '../ai/generate';
import { addDays, dayKey, daysBetween, parseDay } from '../lib/date';
import { useL, useLang } from '../lib/i18n';
import { notify } from '../os/notify';
import { useAttrs } from '../store/attrs';
import { assessmentFor, assessments, fmtPos, h3Evidence, isMetatype, latestBefore, LEVEL_NAME, PHASE_META, QUAD_META, QUADS, quadOf, stepOf, type QuadEvidence } from '../store/h3';
import { currentKey, periodBounds, shiftKey, type ReportKind } from '../store/report';
import { actions, getState, useStore } from '../store/store';
import type { H3Assessment, H3Position, H3Quad } from '../store/types';
import { Icon } from '../ui/Icon';
import { Button, Card, Empty, Modal, Segmented } from '../ui/kit';

const KIND_LABEL: Record<ReportKind, [string, string]> = { month: ['本月', 'This month'], quarter: ['本季度', 'This quarter'], year: ['今年', 'This year'] };

/** "2026 年 11 月" · "2026 Q4" · "2026" */
export function periodName(kind: ReportKind, key: string, lang: 'zh' | 'en') {
  if (kind === 'year') return lang === 'zh' ? `${key} 年` : key;
  if (kind === 'quarter') return lang === 'zh' ? `${key.slice(0, 4)} 年第 ${key.slice(6)} 季度` : `${key.slice(0, 4)} Q${key.slice(6)}`;
  return parseDay(`${key}-01`).toLocaleDateString(lang === 'zh' ? 'zh-CN' : 'en-US', { year: 'numeric', month: 'long' });
}

/* ------------------------------------------------------------------ */

export function Human3View() {
  const L = useL();
  const lang = useLang();
  const list = useStore((s) => s.h3?.assessments ?? []);
  const [kind, setKind] = useState<ReportKind>('month');
  const [wizard, setWizard] = useState<{ kind: ReportKind; key: string } | null>(null);
  const [mapOpen, setMapOpen] = useState(false);
  const latest = list.at(-1);
  const prev = latest ? latestBefore(getState(), latest.date, latest.id) : undefined;
  // early in a new period, the one that just ended is what you'd want to assess
  const cur = currentKey(kind);
  const before = shiftKey(kind, cur, -1);
  const early = daysBetween(periodBounds(kind, cur).first, dayKey()) < 7;
  const key = early && !assessmentFor(getState(), kind, before) ? before : cur;
  const existing = assessmentFor(getState(), kind, key);
  const n = (t: [string, string]) => (lang === 'zh' ? t[0] : t[1]);

  return (
    <div className="h3">
      <Card className="h3-intro">
        <div className="h3-intro-row">
          <div>
            <h3>{L('Human 3.0 视角', 'The Human 3.0 lens')}</h3>
            <p className="muted small">
              {L(
                '借用 Dan Koe 的 Human 3.0 地图：生活分成心智、身体、精神、事业四个象限，每个象限都在 1.0 随大流者 → 2.0 个人主义者 → 3.0 综合者 的某一级，每一级又经过「不协调 → 迷茫 → 发现」三个阶段，写成「事业 2.1」。每月、每季度、每年给自己定个位，就能看到走了多远、现在在哪、下一步往哪使劲。',
                'Borrowing Dan Koe’s Human 3.0 map: life splits into four quadrants (Mind, Body, Spirit, Vocation); each sits at a level, 1.0 Conformist → 2.0 Individualist → 3.0 Synthesist, and each level passes through Dissonance → Uncertainty → Discovery, written “Vocation 2.1”. Place yourself each month, quarter and year to see how far you’ve come, where you are and where to push next.',
              )}
            </p>
          </div>
          <div className="h3-start">
            <Segmented
              value={kind}
              onChange={setKind}
              options={(['month', 'quarter', 'year'] as ReportKind[]).map((k) => ({ value: k, label: L(KIND_LABEL[k][0], KIND_LABEL[k][1]) }))}
            />
            <Button variant="primary" icon={existing ? 'pencil' : 'target'} onClick={() => setWizard({ kind, key })}>
              {existing ? L(`修改 ${periodName(kind, key, 'zh')} 的评估`, `Edit ${periodName(kind, key, 'en')}`) : L(`评估 ${periodName(kind, key, 'zh')}`, `Assess ${periodName(kind, key, 'en')}`)}
            </Button>
            <button type="button" className="link-btn small" onClick={() => setMapOpen(true)}>
              {L('属性怎么对应象限？', 'How attributes map to quadrants')}
            </button>
          </div>
        </div>
      </Card>

      {!latest ? (
        <Card>
          <Empty icon="target" title={L('还没有评估', 'No assessment yet')} body={L('做第一次评估，给四个象限各定一个位置。之后每次评估都会和上一次对比。', 'Do your first assessment to place each quadrant. Every later one is compared with the one before.')} />
        </Card>
      ) : (
        <>
          <div className="h3-now">
            <Card title={L(`现在的位置 · ${periodName(latest.kind, latest.key, lang)}`, `Where you are · ${periodName(latest.kind, latest.key, lang)}`)} icon="target" action={isMetatype(latest) ? <span className="h3-meta">3.0+ Metatype</span> : undefined}>
              <div className="h3-quads">
                {QUADS.map((q) => {
                  const p = latest.quads[q];
                  const before = prev?.quads[q];
                  const d = before ? stepOf(p) - stepOf(before) : null;
                  return (
                    <div key={q} className="h3-quad" style={{ '--q': QUAD_META[q].color } as CSSProperties}>
                      <div className="h3-quad-top">
                        <Icon name={QUAD_META[q].icon} size={16} />
                        <b>{n(QUAD_META[q].name)}</b>
                        <span className="h3-pos num">{fmtPos(p)}</span>
                        {d != null && d !== 0 && <span className={`num small ${d > 0 ? 'pos' : 'neg'}`}>{d > 0 ? `▲ ${d}` : `▼ ${-d}`}</span>}
                      </div>
                      <Ladder p={p} before={before} />
                      <p className="small">
                        <b>{n(LEVEL_NAME[p.level])}</b> · {n(PHASE_META[p.phase].name)}
                      </p>
                      {p.note && <p className="muted small">{p.note}</p>}
                      {p.next && (
                        <p className="h3-next small">
                          <Icon name="arrow-up" size={12} /> {p.next}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
              {latest.summary && <p className="h3-summary">{latest.summary}</p>}
            </Card>
            <Card title={L('四个象限', 'The four quadrants')} icon="grid">
              <Radar now={latest} before={prev} />
              <p className="muted small center">{prev ? L(`实线：${periodName(latest.kind, latest.key, 'zh')} · 虚线：${periodName(prev.kind, prev.key, 'zh')}`, `Solid: ${periodName(latest.kind, latest.key, 'en')} · dashed: ${periodName(prev.kind, prev.key, 'en')}`) : L('再评估一次就能看到对比', 'Assess again to see the comparison')}</p>
            </Card>
          </div>

          <Card title={L('下一步往哪使劲', 'Where to push next')} icon="arrow-up">
            <NextSteps latest={latest} />
          </Card>

          {list.length > 1 && (
            <Card title={L('一路走来', 'Progress over time')} icon="chart">
              <History list={list} />
            </Card>
          )}

          <Card title={L('全部评估', 'All assessments')} icon="clock">
            <ul className="h3-list">
              {[...list].reverse().map((a) => (
                <li key={a.id}>
                  <b>{periodName(a.kind, a.key, lang)}</b>
                  <span className="muted small">{a.date}</span>
                  <span className="h3-list-pos">
                    {QUADS.map((q) => (
                      <span key={q} style={{ '--q': QUAD_META[q].color } as CSSProperties} className="num">
                        {n(QUAD_META[q].name).split(' ')[0]} {fmtPos(a.quads[q])}
                      </span>
                    ))}
                  </span>
                  <span className="spacer" />
                  <Button size="sm" variant="ghost" icon="pencil" title={L('修改', 'Edit')} onClick={() => setWizard({ kind: a.kind, key: a.key })} />
                  <Button size="sm" variant="ghost" icon="trash" title={L('删除', 'Delete')} onClick={() => actions.deleteH3(a.id)} />
                </li>
              ))}
            </ul>
          </Card>
        </>
      )}
      {wizard && <H3Wizard kind={wizard.kind} pkey={wizard.key} onClose={() => setWizard(null)} />}
      <MapModal open={mapOpen} onClose={() => setMapOpen(false)} />
    </div>
  );
}

/* ---------------- small visuals ---------------- */

/** Nine steps, 1.1 → 3.3, with the current one lit and the previous one ringed. */
export function Ladder({ p, before }: { p: Pick<H3Position, 'level' | 'phase'>; before?: Pick<H3Position, 'level' | 'phase'> }) {
  const at = stepOf(p);
  const was = before ? stepOf(before) : null;
  return (
    <div className="h3-ladder" aria-label={`${fmtPos(p)} / 3.3`}>
      {[1, 2, 3].map((lv) => (
        <span key={lv} className="h3-rung">
          {[1, 2, 3].map((ph) => {
            const k = (lv - 1) * 3 + ph;
            return <i key={k} className={`${k <= at ? 'on' : ''} ${k === at ? 'is-now' : ''} ${k === was && was !== at ? 'is-was' : ''}`} />;
          })}
          <small>{lv}.0</small>
        </span>
      ))}
    </div>
  );
}

function Radar({ now, before }: { now: H3Assessment; before?: H3Assessment }) {
  const lang = useLang();
  const CX = 160;
  const CY = 135;
  const R = 92;
  const angle = (i: number) => -Math.PI / 2 + (i * Math.PI) / 2;
  const pt = (i: number, v: number) => [CX + Math.cos(angle(i)) * R * (v / 9), CY + Math.sin(angle(i)) * R * (v / 9)];
  const path = (a: H3Assessment) => QUADS.map((q, i) => pt(i, stepOf(a.quads[q])).join(',')).join(' ');
  return (
    <svg className="h3-radar" viewBox="0 0 320 270" width="100%" height={270}>
      {[3, 6, 9].map((v) => (
        <polygon key={v} points={QUADS.map((_, i) => pt(i, v).join(',')).join(' ')} fill="none" stroke="var(--line-2, rgba(0,0,0,.12))" strokeWidth={1} />
      ))}
      {QUADS.map((_, i) => {
        const [x, y] = pt(i, 9);
        return <line key={i} x1={CX} y1={CY} x2={x} y2={y} stroke="var(--line-2, rgba(0,0,0,.12))" />;
      })}
      {before && <polygon points={path(before)} fill="none" stroke="var(--ink-3, #999)" strokeWidth={2} strokeDasharray="5 4" />}
      <polygon points={path(now)} fill="color-mix(in oklab, var(--accent) 22%, transparent)" stroke="var(--accent)" strokeWidth={2.5} />
      {QUADS.map((q, i) => {
        const [x, y] = pt(i, stepOf(now.quads[q]));
        const [lx, ly] = pt(i, 10.2);
        const anchor = i === 1 ? 'start' : i === 3 ? 'end' : 'middle';
        return (
          <g key={q}>
            <circle cx={x} cy={y} r={5} fill={QUAD_META[q].color} stroke="var(--surface, #fff)" strokeWidth={2} />
            <text x={lx} y={ly + (i === 0 ? -2 : i === 2 ? 12 : 4)} textAnchor={anchor} fontSize={12} fontWeight={700} fill="var(--ink-2, #444)">
              {(lang === 'zh' ? QUAD_META[q].name[0] : QUAD_META[q].name[1]).split(' ')[0]} {fmtPos(now.quads[q])}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function History({ list }: { list: H3Assessment[] }) {
  const lang = useLang();
  const W = 1000;
  const H = 240;
  const pad = { l: 36, r: 14, t: 12, b: 28 };
  const x = (i: number) => pad.l + (list.length === 1 ? 0 : (i / (list.length - 1)) * (W - pad.l - pad.r));
  const y = (v: number) => pad.t + (1 - (v - 1) / 8) * (H - pad.t - pad.b);
  return (
    <div className="h3-hist">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxHeight: 260 }}>
        {[1, 4, 7].map((v) => (
          <g key={v}>
            <line x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} stroke="var(--line, rgba(0,0,0,.08))" />
            <text x={pad.l - 6} y={y(v) + 4} textAnchor="end" fontSize={11} fill="var(--ink-3, #999)">
              {(v + 2) / 3}.0
            </text>
          </g>
        ))}
        {QUADS.map((q) => (
          <g key={q}>
            <polyline fill="none" stroke={QUAD_META[q].color} strokeWidth={2.5} points={list.map((a, i) => `${x(i)},${y(stepOf(a.quads[q]))}`).join(' ')} />
            {list.map((a, i) => (
              <circle key={a.id} cx={x(i)} cy={y(stepOf(a.quads[q]))} r={3.5} fill={QUAD_META[q].color} />
            ))}
          </g>
        ))}
        {list.map((a, i) => (
          <text key={a.id} x={x(i)} y={H - 8} textAnchor={i === 0 ? 'start' : i === list.length - 1 ? 'end' : 'middle'} fontSize={11} fill="var(--ink-3, #999)">
            {periodName(a.kind, a.key, lang)}
          </text>
        ))}
      </svg>
      <p className="h3-legend small">
        {QUADS.map((q) => (
          <span key={q}>
            <i style={{ background: QUAD_META[q].color }} /> {(lang === 'zh' ? QUAD_META[q].name[0] : QUAD_META[q].name[1]).split(' ')[0]}
          </span>
        ))}
      </p>
    </div>
  );
}

function NextSteps({ latest }: { latest: H3Assessment }) {
  const L = useL();
  const lang = useLang();
  const n = (t: [string, string]) => (lang === 'zh' ? t[0] : t[1]);
  const order = [...QUADS].sort((a, b) => stepOf(latest.quads[a]) - stepOf(latest.quads[b]));
  const low = order[0];
  return (
    <ul className="h3-steps">
      {order.map((q) => {
        const p = latest.quads[q];
        const target = p.phase < 3 ? null : p.level < 3 ? ((p.level + 1) as 1 | 2 | 3) : null;
        return (
          <li key={q} style={{ '--q': QUAD_META[q].color } as CSSProperties}>
            <span className="h3-step-q">
              <Icon name={QUAD_META[q].icon} size={14} /> {n(QUAD_META[q].name)} <b className="num">{fmtPos(p)}</b>
              {q === low && <span className="h3-focus">{L('最该先补', 'Start here')}</span>}
            </span>
            <span className="small">
              {p.next || (
                <span className="muted">
                  {target
                    ? L(`快到 ${target}.0 了：${QUAD_META[q].levels[target - 1][0]}`, `Close to ${target}.0: ${QUAD_META[q].levels[target - 1][1]}`)
                    : p.level === 3 && p.phase === 3
                      ? L('已经在最高处：保持，并把经验带到其他象限。', 'At the top: keep it, and bring what works here to the other quadrants.')
                      : L(`走完这一级的「${PHASE_META[(p.phase + 1) as 2 | 3].name[0]}」：${PHASE_META[(p.phase + 1) as 2 | 3].desc[0]}`, `Move on to ${PHASE_META[(p.phase + 1) as 2 | 3].name[1]}: ${PHASE_META[(p.phase + 1) as 2 | 3].desc[1]}`)}
                </span>
              )}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/* ---------------- the assessment wizard ---------------- */

const blank = (): Record<H3Quad, H3Position> => ({ mind: { level: 1, phase: 1 }, body: { level: 1, phase: 1 }, spirit: { level: 1, phase: 1 }, vocation: { level: 1, phase: 1 } });

function H3Wizard({ kind, pkey, onClose }: { kind: ReportKind; pkey: string; onClose: () => void }) {
  const L = useL();
  const lang = useLang();
  const s = useStore((x) => x);
  const n = (t: [string, string]) => (lang === 'zh' ? t[0] : t[1]);
  const existing = assessmentFor(s, kind, pkey);
  const prev = latestBefore(s, existing?.date ?? dayKey(), existing?.id);
  const [quads, setQuads] = useState<Record<H3Quad, H3Position>>(() => structuredClone(existing?.quads ?? prev?.quads ?? blank()));
  const [summary, setSummary] = useState(existing?.summary ?? '');
  const [step, setStep] = useState(0); // 0..3 quadrants, 4 summary
  const [ai, setAi] = useState<'idle' | 'busy' | 'done'>('idle');
  const [aiErr, setAiErr] = useState('');
  const ev = useMemo(() => h3Evidence(s, kind, pkey), [s, kind, pkey]);
  const evPrev = useMemo(() => h3Evidence(s, kind, shiftKey(kind, pkey, -1)), [s, kind, pkey]);
  const prov = activeProvider();
  const set = (q: H3Quad, patch: Partial<H3Position>) => setQuads((v) => ({ ...v, [q]: { ...v[q], ...patch } }));

  const askAi = async () => {
    if (!prov) return;
    setAi('busy');
    setAiErr('');
    try {
      const text = await generate({ provider: { ...prov, search: undefined }, system: aiSystem(lang), user: aiUser(getState(), kind, pkey, ev, prev, lang), onText: () => {} });
      const json = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1));
      const next = structuredClone(quads);
      for (const q of QUADS) {
        const r = json.quads?.[q] ?? json[q];
        if (!r) continue;
        const lv = Math.min(3, Math.max(1, Math.round(+r.level))) as 1 | 2 | 3;
        const ph = Math.min(3, Math.max(1, Math.round(+r.phase))) as 1 | 2 | 3;
        next[q] = { level: lv || next[q].level, phase: ph || next[q].phase, note: String(r.why ?? r.note ?? next[q].note ?? '').slice(0, 400), next: String(r.next ?? next[q].next ?? '').slice(0, 300) };
      }
      setQuads(next);
      if (json.summary) setSummary(String(json.summary).slice(0, 600));
      setAi('done');
    } catch (e) {
      setAi('idle');
      setAiErr(e instanceof AiError ? e.message : L('没读懂 AI 的回答，再试一次或者自己填。', 'Couldn’t read the AI’s answer; try again or fill it in yourself.'));
    }
  };
  const save = () => {
    actions.saveH3({ id: existing?.id, kind, key: pkey, date: existing?.date ?? dayKey(), quads, summary: summary.trim() || undefined, ai: ai === 'done' || existing?.ai || undefined });
    notify({ title: L('评估已保存', 'Assessment saved'), body: QUADS.map((q) => `${n(QUAD_META[q].name).split(' ')[0]} ${fmtPos(quads[q])}`).join(' · '), icon: 'target', tone: 'good' });
    onClose();
  };
  const q = QUADS[step];

  return (
    <Modal
      open
      onClose={onClose}
      width={760}
      title={L(`Human 3.0 评估 · ${periodName(kind, pkey, 'zh')}`, `Human 3.0 assessment · ${periodName(kind, pkey, 'en')}`)}
      footer={
        <>
          <span className="h3-dots">
            {[0, 1, 2, 3, 4].map((i) => (
              <i key={i} className={i === step ? 'on' : ''} onClick={() => setStep(i)} />
            ))}
          </span>
          <span className="spacer" />
          {step > 0 && (
            <Button variant="ghost" onClick={() => setStep(step - 1)}>
              {L('上一步', 'Back')}
            </Button>
          )}
          {step < 4 ? (
            <Button variant="primary" onClick={() => setStep(step + 1)}>
              {L('下一步', 'Next')}
            </Button>
          ) : (
            <Button variant="primary" icon="check" onClick={save}>
              {L('保存评估', 'Save assessment')}
            </Button>
          )}
        </>
      }
    >
      <div className="h3-wiz">
        <div className="h3-ai">
          <Button size="sm" icon="sparkles" disabled={!prov || ai === 'busy'} onClick={() => void askAi()}>
            {ai === 'busy' ? L('宠物在想…', 'Thinking…') : ai === 'done' ? L('再问一次宠物', 'Ask the pet again') : L('让宠物根据数据先给个建议', 'Let the pet suggest from your data')}
          </Button>
          <span className="muted small">{prov ? L('它会读这段时间的数据和复盘，给每个象限一个位置和理由，你再改。', 'It reads this period’s data and reviews, suggests a position and why for each quadrant; you adjust.') : L('在 系统设置 → AI 宠物 里接入 AI 后可用。', 'Connect an AI provider in Settings → AI to use this.')}</span>
          {aiErr && <span className="error small">{aiErr}</span>}
        </div>

        {step < 4 ? (
          <div className="h3-step" style={{ '--q': QUAD_META[q].color } as CSSProperties}>
            <h3>
              <Icon name={QUAD_META[q].icon} size={18} /> {n(QUAD_META[q].name)} <span className="h3-pos num">{fmtPos(quads[q])}</span>
            </h3>
            <p className="muted small">{n(QUAD_META[q].covers)}</p>
            <Evidence e={ev[q]} p={evPrev[q]} />
            {prev && <p className="small muted">{L(`上次（${periodName(prev.kind, prev.key, 'zh')}）：${fmtPos(prev.quads[q])}`, `Last time (${periodName(prev.kind, prev.key, 'en')}): ${fmtPos(prev.quads[q])}`)}</p>}
            <p className="h3-ask">{L('你现在在哪一级？', 'Which level are you at?')}</p>
            <div className="h3-levels">
              {([1, 2, 3] as const).map((lv) => (
                <button key={lv} type="button" className={quads[q].level === lv ? 'is-on' : ''} onClick={() => set(q, { level: lv })}>
                  <b>
                    {lv}.0 · {n(LEVEL_NAME[lv])}
                  </b>
                  <span>{n(QUAD_META[q].levels[lv - 1])}</span>
                </button>
              ))}
            </div>
            <p className="h3-ask">{L('在这一级走到哪了？', 'How far into this level?')}</p>
            <div className="h3-phases">
              {([1, 2, 3] as const).map((ph) => (
                <button key={ph} type="button" className={quads[q].phase === ph ? 'is-on' : ''} onClick={() => set(q, { phase: ph })}>
                  <b>
                    .{ph} {n(PHASE_META[ph].name)}
                  </b>
                  <span>{n(PHASE_META[ph].desc)}</span>
                </button>
              ))}
            </div>
            <div className="row2">
              <label className="field">
                <span className="field-label">{L('为什么是这里（可选）', 'Why here (optional)')}</span>
                <textarea className="input" rows={3} value={quads[q].note ?? ''} onChange={(e) => set(q, { note: e.target.value })} placeholder={L('这段时间发生了什么、感觉卡在哪', 'What happened, where it feels stuck')} />
              </label>
              <label className="field">
                <span className="field-label">{L('下一步往哪使劲', 'What to work on next')}</span>
                <textarea className="input" rows={3} value={quads[q].next ?? ''} onChange={(e) => set(q, { next: e.target.value })} placeholder={L('一两件具体的事', 'One or two concrete things')} />
              </label>
            </div>
          </div>
        ) : (
          <div className="h3-step">
            <h3>
              <Icon name="target" size={18} /> {L('总结', 'Summary')}
            </h3>
            <div className="h3-sum-grid">
              {QUADS.map((qq) => (
                <div key={qq} style={{ '--q': QUAD_META[qq].color } as CSSProperties}>
                  <b>{n(QUAD_META[qq].name)}</b>
                  <span className="h3-pos num">{fmtPos(quads[qq])}</span>
                  <Ladder p={quads[qq]} before={prev?.quads[qq]} />
                </div>
              ))}
            </div>
            <label className="field">
              <span className="field-label">{L('这段时间的一句话（可选）', 'This period in a sentence (optional)')}</span>
              <textarea className="input" rows={3} value={summary} onChange={(e) => setSummary(e.target.value)} />
            </label>
          </div>
        )}
      </div>
    </Modal>
  );
}

function Evidence({ e, p }: { e: QuadEvidence; p: QuadEvidence }) {
  const L = useL();
  const lang = useLang();
  const d = (a: number, b: number) => (a === b ? '' : a > b ? ` ▲${a - b}` : ` ▼${b - a}`);
  return (
    <div className="h3-ev">
      <span>
        <b className="num">+{e.xp}</b> XP<small className={e.xp >= p.xp ? 'pos' : 'neg'}>{d(e.xp, p.xp)}</small>
      </span>
      <span>
        <b className="num">{e.quests}</b> {L('件完成', 'done')}
        <small className={e.quests >= p.quests ? 'pos' : 'neg'}>{d(e.quests, p.quests)}</small>
      </span>
      {e.rate != null && (
        <span>
          <b className="num">{Math.round(e.rate * 100)}%</b> {L('习惯坚持', 'habits kept')}
        </span>
      )}
      {e.extra.map((x) => (
        <span key={x.label[1]}>
          <b className="num">{x.value}</b> {lang === 'zh' ? x.label[0] : x.label[1]}
        </span>
      ))}
      <small className="muted">{L('与上一期相比', 'vs the period before')}</small>
    </div>
  );
}

/* ---------------- AI suggestion ---------------- */

function aiSystem(lang: 'zh' | 'en') {
  const zh = lang === 'zh';
  return `${zh ? '你是用户 LifeOS 里的成长教练。' : 'You are the growth coach inside the user’s LifeOS.'} Use Dan Koe's HUMAN 3.0 map: four quadrants (mind, body, spirit, vocation); levels 1 = Conformist (borrowed scripts), 2 = Individualist (own path), 3 = Synthesist (integrates perspectives, builds new systems); phases inside a level 1 = Dissonance, 2 = Uncertainty, 3 = Discovery.
${zh ? '根据给你的这段时间的数据、复盘摘录和上一次评估，给每个象限一个位置。要谨慎、具体，只依据给出的事实；数据少时偏保守，并在理由里说明。' : 'From the period’s data, review excerpts and the last assessment, place each quadrant. Be careful and specific; rely only on the facts given; with little data stay conservative and say so.'}
${zh ? '理由和下一步用中文，每条不超过 60 字；下一步要具体可做。' : 'Write why and next in English, each under 35 words; next steps must be concrete.'}
Reply with JSON only, no prose: {"quads":{"mind":{"level":1-3,"phase":1-3,"why":"...","next":"..."},"body":{...},"spirit":{...},"vocation":{...}},"summary":"${zh ? '一句话总结' : 'one-sentence summary'}"}`;
}

function aiUser(s: ReturnType<typeof getState>, kind: ReportKind, key: string, ev: Record<H3Quad, QuadEvidence>, prev: H3Assessment | undefined, lang: 'zh' | 'en') {
  const { first, end } = periodBounds(kind, key);
  const last = addDays(end, -1) < dayKey() ? addDays(end, -1) : dayKey();
  const lines: string[] = [`Period: ${kind} ${key} (${first} to ${last})`];
  const attrsBy: Record<H3Quad, string[]> = { mind: [], body: [], spirit: [], vocation: [] };
  for (const a of s.attributes) attrsBy[quadOf(s, a.id)].push(lang === 'zh' ? a.zh : a.en);
  for (const q of QUADS) {
    const e = ev[q];
    lines.push(`${q} (attributes: ${attrsBy[q].join(', ') || '—'}): +${e.xp} XP, ${e.quests} quests done, habits kept ${e.rate == null ? 'n/a' : Math.round(e.rate * 100) + '%'}; ${e.extra.map((x) => `${x.label[1]} ${x.value}`).join('; ')}`);
  }
  const quests = s.quests.filter((q) => q.kind === 'daily' && !q.archived).map((q) => `${q.title} [${quadOf(s, q.attr)}]`);
  if (quests.length) lines.push(`Daily habits: ${quests.slice(0, 20).join('; ')}`);
  const projects = s.projects.filter((p) => p.status === 'active').map((p) => p.name);
  if (projects.length) lines.push(`Active projects: ${projects.join('; ')}`);
  const notes: string[] = [];
  for (let d = first; d <= last; d = addDays(d, 1)) {
    const r = s.reviews[d];
    if (!r) continue;
    const bits = [r.win && `win: ${r.win}`, r.lesson && `lesson: ${r.lesson}`, r.friction && `friction: ${r.friction}`, r.grateful && `grateful: ${r.grateful}`].filter(Boolean);
    if (bits.length) notes.push(`${d} ${bits.join(' | ')}`);
  }
  if (notes.length) lines.push(`Review excerpts:\n${notes.slice(-25).join('\n').slice(0, 3500)}`);
  if (prev) lines.push(`Last assessment (${prev.kind} ${prev.key}): ${QUADS.map((q) => `${q} ${fmtPos(prev.quads[q])}${prev.quads[q].next ? ` (next: ${prev.quads[q].next})` : ''}`).join('; ')}`);
  return lines.join('\n');
}

/* ---------------- attribute → quadrant map ---------------- */

function MapModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const L = useL();
  const lang = useLang();
  const attrs = useAttrs();
  const s = useStore((x) => x);
  return (
    <Modal open={open} onClose={onClose} title={L('属性 → 象限', 'Attributes → quadrants')}>
      <p className="muted small">{L('每个属性获得的经验算进哪个象限，评估时会显示成每个象限的「证据」。', 'Which quadrant each attribute’s XP counts toward; shown as each quadrant’s evidence when you assess.')}</p>
      <ul className="h3-map">
        {attrs.list.map((a) => (
          <li key={a.id}>
            <span>{attrs.label(a.id)}</span>
            <select
              className="input"
              value={quadOf(s, a.id)}
              onChange={(e) => actions.setH3Map({ ...Object.fromEntries(attrs.list.map((x) => [x.id, quadOf(s, x.id)])), [a.id]: e.target.value as H3Quad })}
            >
              {QUADS.map((q) => (
                <option key={q} value={q}>
                  {lang === 'zh' ? QUAD_META[q].name[0] : QUAD_META[q].name[1]}
                </option>
              ))}
            </select>
          </li>
        ))}
      </ul>
    </Modal>
  );
}

export { assessments };
