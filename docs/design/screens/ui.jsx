// ───────── UI primitives ─────────
const { useState, useEffect, useRef, useMemo, useCallback, createContext, useContext } = React;

// classnames helper
const cx = (...xs) => xs.filter(Boolean).join(' ');

// ── Button ──
function Button({
  variant = 'secondary', size = 'md',
  children, className = '', leftIcon, rightIcon,
  loading, disabled, ...rest
}) {
  const base = 'inline-flex items-center justify-center gap-2 font-semibold transition-colors select-none disabled:opacity-50 disabled:cursor-not-allowed';
  const variants = {
    primary: 'bg-primary text-ink hover:bg-primary-hover',
    secondary: 'bg-canvas-soft text-ink hover:bg-line dark:bg-d-canvas dark:text-d-ink dark:hover:bg-d-line',
    chip:      'bg-canvas text-ink hover:bg-canvas-soft border border-line dark:bg-d-canvas dark:text-d-ink dark:hover:bg-d-line dark:border-d-line',
    ghost: 'bg-transparent text-ink hover:bg-canvas-soft dark:text-d-ink dark:hover:bg-d-canvas',
    destructive: 'bg-negative text-white hover:bg-[#b62a30]',
    outline: 'bg-transparent text-ink border border-line hover:bg-canvas-soft dark:text-d-ink dark:border-d-line dark:hover:bg-d-canvas'
  };
  const sizes = {
    sm: 'text-sm px-3 py-1.5 rounded-[14px]',
    md: 'text-[15px] px-5 py-2.5 rounded-[18px]',
    lg: 'text-base px-6 py-3 rounded-[24px]'
  };
  return (
    <button
      className={cx(base, variants[variant], sizes[size], className)}
      disabled={disabled || loading}
      {...rest}>
      
      {leftIcon}
      <span>{children}</span>
      {rightIcon}
    </button>);

}

// ── Card ──
function Card({ className = '', children, ...rest }) {
  return (
    <div
      className={cx('bg-canvas dark:bg-d-canvas rounded-card', className)}
      {...rest}>
      {children}</div>);

}

// ── Badge ──
function Badge({ tone = 'neutral', size = 'md', className = '', children, dot, onClick }) {
  const tones = {
    neutral: 'bg-canvas-soft text-ink dark:bg-d-canvas-soft dark:text-d-ink',
    positive: 'bg-primary-pale text-[#054d28]',
    warning: 'bg-[#ffd11a]/25 text-[#7a4500] dark:text-[#ffd11a]',
    negative: 'bg-red-100 text-[#a7000d] dark:bg-red-900/30 dark:text-red-300',
    purple: 'bg-[#f3e8ff] text-[#6b21a8] dark:bg-purple-900/30 dark:text-purple-300',
    mute: 'bg-[#f5f5f4] text-mute dark:bg-d-canvas-soft dark:text-d-mute',
    primary: 'bg-primary text-ink',
    info: 'bg-[#dbeafe] text-[#1e3a8a] dark:bg-blue-900/30 dark:text-blue-300'
  };
  const sizes = {
    sm: 'text-[10px] px-2 py-[2px]',
    md: 'text-xs px-3 py-1',
  };
  return (
    <span
      onClick={onClick}
      className={cx(
        'inline-flex items-center gap-1.5 font-semibold rounded-full',
        sizes[size] || sizes.md,
        tones[tone],
        onClick && 'cursor-pointer hover:opacity-90',
        className
      )}>
      
      {dot && <span className={cx('w-1.5 h-1.5 rounded-full', dot)} />}
      {children}
    </span>);

}

// ── StatusDot ──
function StatusDot({ status }) {
  const map = {
    ACTIVE: { color: 'bg-positive', ring: 'ring-positive/20', label: 'Active' },
    PAUSED: { color: 'bg-warning', ring: 'ring-warning/20', label: 'Paused' },
    ARCHIVED: { color: 'bg-mute', ring: 'ring-mute/20', label: 'Archived' },
    SCRAPING: { color: 'bg-positive', ring: 'ring-positive/30', label: 'Scraping' }
  };
  const s = map[status] || map.ACTIVE;
  return (
    <span className="inline-flex items-center gap-2 text-xs font-medium text-body dark:text-d-body">
      <span className={cx('relative w-2 h-2 rounded-full', s.color, status === 'SCRAPING' && 'pulse-dot')}>
        <span className={cx('absolute inset-0 rounded-full ring-2', s.ring)} />
      </span>
      {s.label}
    </span>);

}

// ── Input ──
function Input({ className = '', leftIcon, rightSlot, ...rest }) {
  return (
    <div className={cx('relative', className)}>
      {leftIcon &&
      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-mute dark:text-d-mute pointer-events-none">
          {leftIcon}
        </span>
      }
      <input
        className={cx(
          'w-full bg-canvas dark:bg-d-canvas text-ink dark:text-d-ink',
          'border border-line dark:border-d-line rounded-[12px]',
          'px-4 py-2.5 text-[15px] placeholder:text-mute dark:placeholder:text-d-mute',
          'focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent',
          leftIcon && 'pl-10',
          rightSlot && 'pr-10'
        )}
        {...rest} />
      
      {rightSlot &&
      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-mute">
          {rightSlot}
        </span>
      }
    </div>);

}

// ── Select (shadcn-style custom dropdown, portaled) ──
// API kept identical to the previous native <select>: pass <option value=…>
// children plus `value` and `onChange`. Children are extracted, the trigger
// is rendered in place, and the popover is portaled to document.body with
// position:fixed so it escapes any ancestor `overflow:hidden` (e.g. the
// pagination Select inside the leads Card).
function Select({ className = '', children, value, onChange, placeholder, disabled, ...rest }) {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const [coords, setCoords] = useState(null);
  const triggerRef = useRef(null);
  const popoverRef = useRef(null);
  const listRef = useRef(null);

  // Flatten children → [{ value, label, disabled? }]
  const options = useMemo(() => {
    const out = [];
    React.Children.forEach(children, (child) => {
      if (!child || child.type !== 'option') return;
      out.push({
        value: child.props.value ?? '',
        label: child.props.children,
        disabled: !!child.props.disabled,
      });
    });
    return out;
  }, [children]);

  const selected = options.find((o) => String(o.value) === String(value));

  // Outside click — must include the portaled popover
  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => {
      if (triggerRef.current && triggerRef.current.contains(e.target)) return;
      if (popoverRef.current && popoverRef.current.contains(e.target)) return;
      setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') { setOpen(false); return; }
      if (e.key === 'ArrowDown') { e.preventDefault(); setHighlight(h => Math.min(options.length - 1, h + 1)); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlight(h => Math.max(0, h - 1)); }
      else if (e.key === 'Enter') {
        const o = options[highlight];
        if (o && !o.disabled) { commit(o.value); }
      }
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, highlight, options]);

  // Measure on open + on resize. Close on outside scroll.
  useEffect(() => {
    if (!open) { setCoords(null); return; }
    const measure = () => {
      const r = triggerRef.current?.getBoundingClientRect();
      if (!r) return;
      setCoords({ top: r.bottom + 4, left: r.left, width: r.width });
    };
    measure();
    const onScroll = () => setOpen(false);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', measure);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', measure);
    };
  }, [open]);

  // When opening, highlight the current value
  useEffect(() => {
    if (open) {
      const idx = options.findIndex(o => String(o.value) === String(value));
      setHighlight(idx >= 0 ? idx : 0);
    }
  }, [open, value, options]);

  // Scroll the highlighted item into view
  useEffect(() => {
    if (!open || !listRef.current) return;
    const el = listRef.current.querySelector(`[data-idx="${highlight}"]`);
    if (el && el.scrollIntoView) {
      const list = listRef.current;
      const top = el.offsetTop, bottom = top + el.offsetHeight;
      if (top < list.scrollTop) list.scrollTop = top;
      else if (bottom > list.scrollTop + list.clientHeight) list.scrollTop = bottom - list.clientHeight;
    }
  }, [highlight, open]);

  const commit = (v) => {
    setOpen(false);
    onChange?.({ target: { value: v } });
  };

  const display = selected ? selected.label : (placeholder || <span className="text-mute">Select…</span>);

  return (
    <div className={cx('relative', className)} {...rest}>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => setOpen(o => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={cx(
          'w-full text-left flex items-center justify-between gap-2',
          'bg-canvas dark:bg-d-canvas text-ink dark:text-d-ink',
          'border border-line dark:border-d-line rounded-[12px]',
          'px-4 py-2.5 text-[15px]',
          'hover:border-mute dark:hover:border-d-mute transition-colors',
          'focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent',
          disabled && 'opacity-50 cursor-not-allowed',
          open && 'ring-2 ring-primary border-transparent'
        )}
      >
        <span className="truncate">{display}</span>
        <IconChevronDown
          size={16}
          className={cx('text-mute shrink-0 transition-transform', open && 'rotate-180')}
        />
      </button>

      {open && coords && ReactDOM.createPortal(
        <div
          ref={popoverRef}
          role="listbox"
          style={{ position: 'fixed', top: coords.top, left: coords.left, minWidth: coords.width, zIndex: 100 }}
          className={cx(
            'anim-fadein',
            'bg-canvas dark:bg-d-canvas border border-line dark:border-d-line rounded-[14px] p-1',
            'shadow-[0_18px_40px_-16px_rgba(0,0,0,0.25)]'
          )}
        >
          <ul ref={listRef} className="max-h-[260px] overflow-auto py-0.5">
            {options.length === 0 && (
              <li className="px-3 py-2 text-sm text-mute">No options</li>
            )}
            {options.map((o, i) => {
              const isSel = String(o.value) === String(value);
              const isHi  = i === highlight;
              return (
                <li
                  key={String(o.value) + i}
                  data-idx={i}
                  role="option"
                  aria-selected={isSel}
                  onMouseEnter={() => setHighlight(i)}
                  onClick={() => !o.disabled && commit(o.value)}
                  className={cx(
                    'flex items-center justify-between gap-2 px-3 py-2 text-[14px] rounded-[10px] cursor-pointer',
                    o.disabled
                      ? 'text-mute cursor-not-allowed'
                      : isHi
                        ? 'bg-canvas-soft dark:bg-d-canvas-soft text-ink dark:text-d-ink'
                        : 'text-ink dark:text-d-ink'
                  )}
                >
                  <span className="truncate">{o.label}</span>
                  {isSel && <IconCheck size={14} className="text-positive shrink-0" />}
                </li>
              );
            })}
          </ul>
        </div>,
        document.body
      )}
    </div>
  );
}

// ── Checkbox ──
function Checkbox({ checked, onChange, indeterminate, className = '', label }) {
  const ref = useRef(null);
  useEffect(() => {if (ref.current) ref.current.indeterminate = !!indeterminate;}, [indeterminate]);
  return (
    <label className={cx('inline-flex items-center gap-2 cursor-pointer select-none', className)}>
      <span className="relative inline-flex">
        <input
          ref={ref}
          type="checkbox"
          checked={!!checked}
          onChange={(e) => onChange?.(e.target.checked)}
          className="peer sr-only" />
        
        <span className={cx(
          'w-4 h-4 rounded-[5px] border transition-colors',
          'border-line dark:border-d-line bg-canvas dark:bg-d-canvas-soft',
          'peer-checked:bg-primary peer-checked:border-primary',
          'peer-focus-visible:ring-2 peer-focus-visible:ring-primary peer-focus-visible:ring-offset-1'
        )} />
        {checked &&
        <IconCheck size={12} strokeWidth={3} className="absolute inset-0 m-auto text-ink pointer-events-none" />
        }
        {indeterminate && !checked &&
        <span className="absolute inset-0 m-auto w-2 h-0.5 bg-ink rounded pointer-events-none" />
        }
      </span>
      {label && <span className="text-sm text-ink dark:text-d-ink">{label}</span>}
    </label>);

}

// ── Modal ──
function Modal({ open, onClose, children, width = 520, labelledBy }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {if (e.key === 'Escape') onClose?.();};
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4 anim-fadein"
      role="dialog" aria-modal="true" aria-labelledby={labelledBy}>
      
      <div className="absolute inset-0 bg-ink/55 backdrop-blur-[2px]" onClick={onClose} />
      <div
        className="relative bg-canvas dark:bg-d-canvas text-ink dark:text-d-ink rounded-card p-6 w-full anim-scalein shadow-[0_30px_80px_-20px_rgba(0,0,0,0.35)]"
        style={{ maxWidth: width }}
        onClick={(e) => e.stopPropagation()}>
        
        {children}
      </div>
    </div>);

}

// ── Tabs ──
function Tabs({ value, onChange, items }) {
  return (
    <div role="tablist" className="inline-flex items-center gap-1 p-1 rounded-full bg-canvas-soft dark:bg-d-canvas-soft">
      {items.map((it) => {
        const active = value === it.value;
        return (
          <button
            key={it.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(it.value)}
            className={cx(
              'px-4 py-1.5 text-sm font-medium rounded-full transition-colors',
              active ?
              'bg-canvas text-ink dark:bg-d-canvas dark:text-d-ink shadow-[0_1px_2px_rgba(0,0,0,0.05)]' :
              'text-body hover:text-ink dark:text-d-body dark:hover:text-d-ink'
            )}>
            
            {it.label}{it.count !== undefined && <span className="ml-1.5 text-mute text-xs">{it.count}</span>}
          </button>);

      })}
    </div>);

}

// ── Progress bar ──
function Progress({ value, className = '' }) {
  return (
    <div className={cx('w-full h-1 rounded-full bg-line dark:bg-d-line overflow-hidden', className)}>
      <div
        className="h-full bg-primary rounded-full transition-all duration-500"
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
      
    </div>);

}

// ── Toast context ──
const ToastContext = createContext(null);
const useToast = () => useContext(ToastContext);

function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const show = useCallback((t) => {
    const id = Math.random().toString(36).slice(2);
    const toast = { id, type: 'success', ...t };
    setToasts((arr) => [...arr, toast]);
    if (toast.type === 'success') {
      setTimeout(() => setToasts((arr) => arr.filter((x) => x.id !== id)), 3200);
    }
  }, []);
  const dismiss = useCallback((id) => setToasts((arr) => arr.filter((x) => x.id !== id)), []);

  return (
    <ToastContext.Provider value={{ show, dismiss }}>
      {children}
      <div className="fixed z-[60] bottom-4 right-4 flex flex-col gap-2 w-[340px] max-w-[calc(100vw-32px)]">
        {toasts.map((t) => <ToastCard key={t.id} toast={t} onClose={() => dismiss(t.id)} />)}
      </div>
    </ToastContext.Provider>);

}

function ToastCard({ toast, onClose }) {
  // Success and error toasts are inverted vs the page (dark in light mode,
  // white in dark mode) so they stand out from the canvas background.
  // Warning stays on its yellow tint per design.
  const shells = {
    success: {
      wrap:  'bg-ink text-canvas border border-positive/60 dark:bg-canvas dark:text-ink dark:border-primary-pale',
      body:  'text-canvas-soft/80 dark:text-body',
      close: 'text-canvas-soft/60 hover:text-canvas dark:text-mute dark:hover:text-ink',
      icon:  <IconCheckCircle size={18} className="text-positive" />,
    },
    error: {
      wrap:  'bg-ink text-canvas border-l-4 border-negative dark:bg-canvas dark:text-ink shadow-[0_8px_24px_-8px_rgba(0,0,0,0.25)]',
      body:  'text-canvas-soft/80 dark:text-body',
      close: 'text-canvas-soft/60 hover:text-canvas dark:text-mute dark:hover:text-ink',
      icon:  <IconAlert size={18} className="text-negative" />,
    },
    warning: {
      wrap:  'bg-[#ffd11a]/20 border border-[#ffd11a]/40 text-ink dark:text-d-ink',
      body:  'text-body dark:text-d-body',
      close: 'text-mute hover:text-ink dark:hover:text-d-ink',
      icon:  <IconAlert size={18} className="text-[#7a4500]" />,
    },
  };
  const s = shells[toast.type] || shells.success;
  return (
    <div className={cx('rounded-[16px] p-4 anim-fadein flex items-start gap-3 shadow-[0_10px_30px_-12px_rgba(0,0,0,0.18)]', s.wrap)}>
      <div className="mt-0.5">{s.icon}</div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold">{toast.title}</div>
        {toast.message && <div className={cx('text-[13px] mt-0.5', s.body)}>{toast.message}</div>}
        {toast.action &&
          <button onClick={toast.action.onClick} className="mt-2 text-sm font-semibold underline underline-offset-2">{toast.action.label}</button>
        }
      </div>
      <button onClick={onClose} className={s.close}><IconX size={16} /></button>
    </div>);

}

// ── Dropdown menu (lightweight) ──
function Menu({ trigger, items, align = 'right', position = 'down' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const onDoc = (e) => {if (ref.current && !ref.current.contains(e.target)) setOpen(false);};
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);
  return (
    <div className="relative inline-block" ref={ref}>
      <span onClick={() => setOpen((o) => !o)}>{trigger}</span>
      {open &&
      <div className={cx(
        'absolute min-w-[180px] bg-canvas dark:bg-d-canvas border border-line dark:border-d-line rounded-[14px] p-1.5 z-30 anim-fadein',
        'shadow-[0_18px_40px_-16px_rgba(0,0,0,0.25)]',
        align === 'right' ? 'right-0' : 'left-0',
        position === 'up' ? 'bottom-full mb-2' : 'top-full mt-2'
      )}>
          {items.map((it, i) => it.divider ?
        <div key={i} className="my-1 h-px bg-line dark:bg-d-line" /> :

        <button
          key={i}
          onClick={() => {setOpen(false);it.onClick?.();}}
          className={cx(
            'w-full text-left px-3 py-2 text-sm rounded-[10px] flex items-center gap-2 whitespace-nowrap',
            it.danger ? 'text-negative hover:bg-red-50 dark:hover:bg-red-900/20' :
            'text-ink dark:text-d-ink hover:bg-canvas-soft dark:hover:bg-d-canvas-soft'
          )}>
          
              {it.icon}{it.label}
            </button>
        )}
        </div>
      }
    </div>);

}

// ── StatCard (canonical KPI tile) ──
// Single source of truth for the rectangular metric tiles used on both the
// Manager dashboard and the Campaign Detail page. Composed by BlockTimerCard
// for the cooldown timer too.
//   tone:
//     'canvas'  — default white card (light) / d-canvas (dark)
//     'primary' — pale-lime tint
//     'ink'     — inverted near-black card with light text
//   valueClassName  — override the 40px black value styling (e.g. yellow timer)
//   accent          — arbitrary node rendered at the bottom of the card
function StatCard({ label, value, sub, icon, tone = 'canvas', valueClassName = '', accent }) {
  const tones = {
    canvas:  'bg-canvas dark:bg-d-canvas',
    primary: 'bg-primary-pale dark:bg-primary/15 text-ink dark:text-d-ink',
    ink:     'bg-ink text-canvas dark:bg-d-canvas dark:text-d-ink',
  };
  const isInk = tone === 'ink';
  return (
    <Card className={cx('p-5 flex flex-col gap-3 min-h-[136px]', tones[tone])}>
      <div className="flex items-start justify-between gap-2">
        <div className={cx('text-[12px] uppercase tracking-wide font-semibold', isInk ? 'text-canvas-soft/70' : 'text-mute')}>{label}</div>
        {icon && <span className={cx('shrink-0', isInk ? 'text-primary' : 'text-mute')}>{icon}</span>}
      </div>
      <div className={cx(
        'text-[40px] font-black leading-none tabular-nums',
        isInk ? 'text-canvas' : 'text-ink dark:text-d-ink',
        valueClassName,
      )}>
        {value}
      </div>
      {sub && (
        <div className={cx('text-[12px] mt-auto', isInk ? 'text-canvas-soft/70' : 'text-mute')}>
          {sub}
        </div>
      )}
      {accent}
    </Card>
  );
}

Object.assign(window, {
  cx, Button, Card, Badge, StatusDot, Input, Select, Checkbox,
  Modal, Tabs, Progress, ToastProvider, useToast, Menu,
  StatCard,
});