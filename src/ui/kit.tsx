import { isValidElement, useEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { Attr } from '../store/types';
import { Icon } from './Icon';

type Tone = 'accent' | 'gold' | 'mind' | 'body' | 'wealth' | 'craft' | 'bond' | 'spirit' | 'ink';

export const toneVar = (t: Tone | Attr) => (t === 'accent' ? 'var(--accent)' : t === 'gold' ? 'var(--gold)' : t === 'ink' ? 'var(--ink)' : `var(--c-${t})`);

/* ---------------- Buttons ---------------- */

export function Button({
  children,
  variant = 'soft',
  size = 'md',
  icon,
  onClick,
  disabled,
  type = 'button',
  title,
  className = '',
  style,
}: {
  children?: ReactNode;
  variant?: 'soft' | 'primary' | 'ghost' | 'danger' | 'gold';
  size?: 'sm' | 'md' | 'lg';
  icon?: string;
  onClick?: () => void;
  disabled?: boolean;
  type?: 'button' | 'submit';
  title?: string;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <button
      type={type}
      title={title}
      aria-label={title}
      disabled={disabled}
      onClick={onClick}
      style={style}
      className={`btn btn-${variant} btn-${size} ${!children ? 'btn-icon' : ''} ${className}`}
    >
      {icon && <Icon name={icon} size={size === 'sm' ? 15 : size === 'lg' ? 20 : 17} />}
      {children && <span>{children}</span>}
    </button>
  );
}

/* ---------------- Surfaces ---------------- */

export function Card({
  children,
  className = '',
  style,
  title,
  icon,
  action,
  tone,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  title?: ReactNode;
  icon?: string;
  action?: ReactNode;
  tone?: Tone | Attr;
}) {
  return (
    <section className={`card ${className}`} style={{ ...(tone ? ({ '--tone': toneVar(tone) } as CSSProperties) : {}), ...style }}>
      {(title || action) && (
        <header className="card-head">
          {icon && (
            <span className="card-glyph">
              <Icon name={icon} size={15} stroke={2.2} />
            </span>
          )}
          <h3>{title}</h3>
          <div className="card-action">{action}</div>
        </header>
      )}
      {children}
    </section>
  );
}

export function Stat({ label, value, sub, tone }: { label: ReactNode; value: ReactNode; sub?: ReactNode; tone?: Tone | Attr }) {
  return (
    <div className="stat" style={tone ? ({ '--tone': toneVar(tone) } as CSSProperties) : undefined}>
      <div className="stat-label">{label}</div>
      <div className="stat-value num">{value}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  );
}

export function Chip({ children, tone, icon, onClick, active }: { children: ReactNode; tone?: Tone | Attr; icon?: string; onClick?: () => void; active?: boolean }) {
  const El = onClick ? 'button' : 'span';
  return (
    <El
      className={`chip ${onClick ? 'chip-btn' : ''} ${active ? 'is-active' : ''}`}
      onClick={onClick}
      style={tone ? ({ '--tone': toneVar(tone) } as CSSProperties) : undefined}
      {...(onClick ? { type: 'button' as const } : {})}
    >
      {icon ? <Icon name={icon} size={13} stroke={2.4} /> : tone ? <i className="chip-dot" /> : null}
      {children}
    </El>
  );
}

/* ---------------- Progress ---------------- */

export function Bar({ value, tone = 'accent', height = 10, label }: { value: number; tone?: Tone | Attr; height?: number; label?: string }) {
  const v = Math.max(0, Math.min(1, value));
  return (
    <div className="bar" style={{ height, '--tone': toneVar(tone) } as CSSProperties} role="progressbar" aria-valuenow={Math.round(v * 100)} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <div className="bar-fill" style={{ width: `${v * 100}%` }} />
    </div>
  );
}

export function Ring({ value, size = 96, stroke = 10, tone = 'accent', children }: { value: number; size?: number; stroke?: number; tone?: Tone | Attr; children?: ReactNode }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value));
  return (
    <div className="ring" style={{ width: size, height: size, '--tone': toneVar(tone) } as CSSProperties}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} className="ring-track" strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          className="ring-fill"
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${c * v} ${c}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div className="ring-center">{children}</div>
    </div>
  );
}

/* ---------------- Check bubble ---------------- */

export function CheckBubble({ checked, onChange, tone = 'accent', label }: { checked: boolean; onChange: () => void; tone?: Tone | Attr; label: string }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      className={`check ${checked ? 'is-on' : ''}`}
      style={{ '--tone': toneVar(tone) } as CSSProperties}
      onClick={onChange}
    >
      <Icon name="check" size={16} stroke={3.2} />
    </button>
  );
}

/* ---------------- Segmented control ---------------- */

export function Segmented<T extends string>({ value, options, onChange, size = 'md' }: { value: T; options: { value: T; label: ReactNode; icon?: string }[]; onChange: (v: T) => void; size?: 'sm' | 'md' }) {
  return (
    <div className={`seg seg-${size}`} role="tablist">
      {options.map((o) => (
        <button key={o.value} type="button" role="tab" aria-selected={o.value === value} className={o.value === value ? 'is-on' : ''} onClick={() => onChange(o.value)}>
          {o.icon && <Icon name={o.icon} size={14} />}
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ---------------- Form fields ---------------- */

export function Field({ label, children, hint }: { label: ReactNode; children: ReactNode; hint?: ReactNode }) {
  // Only wrap native form controls in <label>; groups of buttons get role="group"
  // (a <label> around buttons would forward every click to the first button).
  const native = isValidElement(children) && typeof children.type === 'string' && ['input', 'select', 'textarea'].includes(children.type);
  const Tag = native ? 'label' : 'div';
  return (
    <Tag className="field" {...(native ? {} : { role: 'group', 'aria-label': typeof label === 'string' ? label : undefined })}>
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </Tag>
  );
}

/* ---------------- Modal / sheet ---------------- */

export function Modal({ open, onClose, title, children, footer, width = 520 }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; footer?: ReactNode; width?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    const t = window.setTimeout(() => ref.current?.querySelector<HTMLElement>('input,select,textarea,button.btn-primary')?.focus(), 60);
    return () => {
      window.removeEventListener('keydown', k);
      window.clearTimeout(t);
    };
  }, [open, onClose]);
  if (!open) return null;
  return createPortal(
    <div className="modal-scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" style={{ maxWidth: width }} ref={ref}>
        <header className="modal-head">
          <h2>{title}</h2>
          <Button variant="ghost" size="sm" icon="x" title="Close" onClick={onClose} />
        </header>
        <div className="modal-body">{children}</div>
        {footer && <footer className="modal-foot">{footer}</footer>}
      </div>
    </div>,
    document.body,
  );
}

export function Empty({ icon, title, body, action }: { icon: string; title: ReactNode; body?: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty">
      <div className="empty-art">
        <Icon name={icon} size={26} stroke={2} />
      </div>
      <h4>{title}</h4>
      {body && <p>{body}</p>}
      {action}
    </div>
  );
}

/* ---------------- 3D app icon (dock, launchpad, headers) ---------------- */

export function AppGlyph({ icon, hue, size = 56, badge }: { icon: string; hue: string; size?: number; badge?: ReactNode }) {
  return (
    <span className="glyph" style={{ width: size, height: size, '--hue': hue } as CSSProperties}>
      <span className="glyph-body">
        <Icon name={icon} size={Math.round(size * 0.46)} stroke={2.1} />
      </span>
      {badge != null && <span className="glyph-badge num">{badge}</span>}
    </span>
  );
}
