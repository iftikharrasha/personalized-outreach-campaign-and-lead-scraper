// ───────── Reusable bulk action bar ─────────
// Floating pill that appears at the bottom-center when one or more rows are
// selected. Used by the Campaign Detail page and the Closed Leads table on
// the Outrich Manager dashboard.
//
// Props:
//   count            number — rows currently selected
//   onClear          () => void — dismiss / clear selection
//   actions          array of action descriptors:
//                       { type: 'menu',   label, icon?, items: [{label, onClick}] }
//                       { type: 'button', label, icon?, onClick, danger? }
//                       { type: 'divider' }
//
function BulkActionsBar({ count, onClear, actions = [] }) {
  if (!count) return null;
  // Center against the content area, not the viewport — the sidebar takes
  // 64–240px of left space. App.jsx sets a `--sidebar-w` CSS var on <html>
  // when the sidebar toggles; we read it here and shift the pill right by
  // half of that so it sits in the visual center between sidebar and viewport.
  return (
    <div
      className="fixed bottom-6 z-30"
      style={{ left: 'calc(50% + (var(--sidebar-w, 240px) / 2))', transform: 'translateX(-50%)' }}
    >
      <div className="anim-fadein bg-ink dark:bg-d-canvas text-canvas dark:text-d-ink rounded-full pl-5 pr-2 py-2 flex items-center gap-3 shadow-[0_18px_50px_-12px_rgba(0,0,0,0.4)] border border-ink dark:border-d-line">
        <span className="text-sm font-semibold tabular-nums">{count} selected</span>
        <span className="w-px h-5 bg-white/15" />

        {actions.map((a, i) => {
          if (a.type === 'divider') {
            return <span key={i} className="w-px h-5 bg-white/15" />;
          }
          if (a.type === 'menu') {
            return (
              <Menu
                key={i}
                align="left"
                position="up"
                trigger={
                  <button className="text-sm px-3 py-1.5 rounded-full hover:bg-white/10 inline-flex items-center gap-1.5">
                    {a.icon}{a.label} <IconChevronDown size={14} className="rotate-180" />
                  </button>
                }
                items={a.items}
              />
            );
          }
          return (
            <button
              key={i}
              onClick={a.onClick}
              className={cx(
                'text-sm px-3 py-1.5 rounded-full inline-flex items-center gap-1.5 transition-colors',
                a.highlight
                  ? 'bg-primary text-ink hover:bg-primary-hover font-semibold'
                  : 'hover:bg-white/10',
                a.danger && !a.highlight && 'text-red-300'
              )}
            >
              {a.icon}{a.label}
            </button>
          );
        })}

        <button
          onClick={onClear}
          aria-label="Clear selection"
          className="ml-1 p-1.5 rounded-full hover:bg-white/10"
        >
          <IconX size={14} />
        </button>
      </div>
    </div>
  );
}

Object.assign(window, { BulkActionsBar });
