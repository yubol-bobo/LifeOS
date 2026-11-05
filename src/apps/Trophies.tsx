import type { CSSProperties } from 'react';
import { num } from '../lib/format';
import { useL, useLang } from '../lib/i18n';
import { ATTR_META, useMetrics } from '../store/hooks';
import { ACHIEVEMENTS, attrLevel, LEVEL_TITLES, levelTitle, TIER_LABEL } from '../store/rules';
import { useStore } from '../store/store';
import { ATTRS } from '../store/types';
import { Icon } from '../ui/Icon';
import { Bar, Card, Ring } from '../ui/kit';

export function Trophies() {
  const L = useL();
  const lang = useLang();
  const m = useMetrics();
  const unlocked = useStore((s) => s.achievements);
  const count = Object.keys(unlocked).length;
  const nextTitle = LEVEL_TITLES.find((t) => t[0] > m.level.level);

  return (
    <div className="app">
      <div className="app-head">
        <div>
          <h1>{L('成就', 'Trophies')}</h1>
          <p className="muted">{L(`已解锁 ${count} / ${ACHIEVEMENTS.length} 枚徽章。`, `${count} of ${ACHIEVEMENTS.length} badges unlocked.`)}</p>
        </div>
      </div>

      <div className="grid-1-2">
        <Card className="level-card">
          <Ring value={m.level.progress} size={150} stroke={14}>
            <span className="ring-num num xl">{m.level.level}</span>
            <span className="ring-cap">LEVEL</span>
          </Ring>
          <div className="level-text">
            <h2>{levelTitle(m.level.level, lang)}</h2>
            <p className="num">
              {num(m.xp)} XP · {L('距下一级', 'Next level in')} {num(m.level.span - m.level.into)}
            </p>
            {nextTitle && <p className="muted small">{L(`Lv.${nextTitle[0]} 解锁称号「${nextTitle[1]}」`, `Lv.${nextTitle[0]} unlocks “${nextTitle[2]}”`)}</p>}
          </div>
        </Card>
        <Card title={L('属性', 'Attributes')} icon="sparkles">
          <div className="attr-grid">
            {ATTRS.map((a) => {
              const xp = m.attrXp[a];
              const lv = attrLevel(xp);
              const lo = 40 * (lv - 1) ** 2;
              const hi = 40 * lv ** 2;
              return (
                <div className="attr-card" key={a} style={{ '--tone': `var(--c-${a})` } as CSSProperties}>
                  <span className="attr-ic">
                    <Icon name={ATTR_META[a].icon} size={18} />
                  </span>
                  <div className="attr-body">
                    <div className="attr-top">
                      <strong>{lang === 'zh' ? ATTR_META[a].zh : ATTR_META[a].en}</strong>
                      <span className="num">Lv.{lv}</span>
                    </div>
                    <Bar value={(xp - lo) / (hi - lo)} tone={a} height={7} />
                    <span className="muted small num">{num(xp)} XP</span>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      <div className="medal-grid">
        {ACHIEVEMENTS.map((a) => {
          const at = unlocked[a.id];
          const v = Math.min(a.target, a.value(m));
          const [title, desc] = lang === 'zh' ? a.zh : a.en;
          return (
            <article key={a.id} className={`medal-card tier-${a.tier} ${at ? 'is-on' : ''}`}>
              <div className="medal">
                <span className="medal-face">
                  <Icon name={at ? a.icon : 'lock'} size={26} stroke={2.2} />
                </span>
              </div>
              <strong>{title}</strong>
              <span className="muted small">{desc}</span>
              {at ? (
                <span className="medal-date small">
                  {TIER_LABEL[a.tier][lang === 'zh' ? 0 : 1]} · {new Date(at).toLocaleDateString()}
                </span>
              ) : (
                <div className="medal-progress">
                  <Bar value={v / a.target} tone="gold" height={6} />
                  <span className="muted small num">
                    {num(v, v % 1 ? 1 : 0)} / {num(a.target)}
                  </span>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}
