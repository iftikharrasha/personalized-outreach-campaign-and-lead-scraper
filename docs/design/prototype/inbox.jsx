// ───────── Phase 8 — Inbox UI ─────────
// Three-pane mail client: Campaigns rail · Threads rail · Main pane.
// See uploads/PHASE_8_INBOX.md for the full spec.
//
// Conceptual model: a thread is anchored to a recipient group at creation
// time. New Message inside a thread sends to that same group. Coming from
// the campaign page = new thread, every time (never matched/merged).

// ─── Helpers ───────────────────────────────────────────────────────────────

function aggregateMsgStatus(recipients) {
  if (!recipients || !recipients.length) return 'DRAFT';
  const sent = recipients.filter((r) => r.status === 'SENT').length;
  const failed = recipients.filter((r) => r.status === 'FAILED').length;
  if (sent === 0 && failed > 0) return 'FAILED';
  if (failed > 0) return 'PARTIAL';
  if (sent === recipients.length) return 'SENT';
  return 'DRAFT';
}

function copyToClipboard(text) {
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text);
  } else {
    const ta = document.createElement('textarea');
    ta.value = text; document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); } catch (_) {}
    document.body.removeChild(ta);
  }
}

// Normalize a website string into a click-able URL. Leads sometimes store
// "example.com" without a protocol; prepend https:// in that case.
function websiteHref(w) {
  if (!w) return null;
  return /^https?:\/\//i.test(w) ? w : `https://${w}`;
}

// ─── HTML preview iframe ───────────────────────────────────────────────────
// Wrapper is 750px wide (per design feedback) so a 600px email body sits
// centered with 75px of breathing room on each side — that's where the
// email's body background color shows through, which is what makes the
// preview "look right" against the canvas-soft page background.
function HtmlPreview({ html, height = 380, width = 750 }) {
  if (!html) return null;
  return (
    <div className="mx-auto" style={{ maxWidth: width }}>
      <div
        className="rounded-[14px] overflow-hidden border border-line dark:border-d-line"
        style={{ background: '#fff', boxShadow: '0 10px 28px -16px rgba(0,0,0,0.18)' }}
      >
        <iframe
          title="email-preview"
          srcDoc={html}
          sandbox=""
          style={{ width: '100%', height, border: 0, display: 'block', background: '#fff' }}
        />
      </div>
    </div>
  );
}

// ─── Recipient chip ────────────────────────────────────────────────────────
// Business name (if present) → opens the lead's website in a new tab.
// Email text → copies to clipboard, optional onCopyEmail callback fires a
// toast in the parent. Remove (×) is rendered only when onRemove is passed.
function RecipientChip({ name, email, website, onRemove, onCopyEmail, dimmed }) {
  const href = websiteHref(website);
  const handleEmail = (e) => {
    e.preventDefault(); e.stopPropagation();
    copyToClipboard(email);
    onCopyEmail?.(email);
  };

  return (
    <span
      className={cx(
        'inline-flex items-center gap-1.5 max-w-full pl-2.5 pr-1.5 py-1 rounded-full text-[12.5px] font-medium border transition-colors',
        dimmed
          ? 'bg-canvas-soft/60 dark:bg-d-canvas-soft/60 text-mute border-line dark:border-d-line line-through'
          : 'bg-canvas-soft dark:bg-d-canvas-soft text-ink dark:text-d-ink border-line dark:border-d-line'
      )}
    >
      <span className="truncate max-w-[240px]">
        {name && (
          href ? (
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className="text-ink dark:text-d-ink hover:text-[#1f6b00] dark:hover:text-primary transition-colors"
              title={`Open ${name} site`}
              onClick={(e) => e.stopPropagation()}
            >
              {name}
            </a>
          ) : (
            <span className="text-ink dark:text-d-ink">{name}</span>
          )
        )}
        {name && <span className="text-mute font-normal mx-1">·</span>}
        <button
          type="button"
          onClick={handleEmail}
          className="text-mute hover:text-ink dark:hover:text-d-ink transition-colors"
          title="Click to copy email"
        >
          {email}
        </button>
      </span>
      {onRemove && (
        <button
          onClick={onRemove}
          aria-label={`Remove ${email}`}
          className="shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-mute hover:bg-line dark:hover:bg-d-line hover:text-ink dark:hover:text-d-ink"
        >
          <IconX size={10} />
        </button>
      )}
    </span>
  );
}

// ─── Recipient list with overflow ──────────────────────────────────────────
// First `maxInline` chips render in a single flex-wrap row; the rest collapse
// into an "and N more" pill that opens a popover. Each row in the popover
// has its own click-to-copy and (if onRemove is set) a hover-to-reveal trash.
// Used in: the composer's To field, and the thread-view recipient header.
function RecipientList({ recipients, maxInline = 3, onRemove, emptyText, onCopyEmail }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const inline = recipients.slice(0, maxInline);
  const rest = recipients.slice(maxInline);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  return (
    <div ref={wrapRef} className="relative">
      <div className="flex flex-wrap gap-1.5 items-center">
        {recipients.length === 0 && (
          <span className="text-[12.5px] text-mute italic">{emptyText || 'No recipients.'}</span>
        )}
        {inline.map((r) => (
          <RecipientChip
            key={r.email}
            name={r.name}
            email={r.email}
            website={r.website}
            onRemove={onRemove ? () => onRemove(r) : undefined}
            onCopyEmail={onCopyEmail}
          />
        ))}
        {rest.length > 0 && (
          <button
            onClick={() => setOpen((v) => !v)}
            className={cx(
              'inline-flex items-center gap-1 pl-3 pr-2 py-1 rounded-full text-[12.5px] font-semibold border transition-colors',
              open
                ? 'bg-primary-pale dark:bg-primary/20 text-ink dark:text-d-ink border-primary'
                : 'bg-canvas dark:bg-d-canvas text-ink dark:text-d-ink border-line dark:border-d-line hover:border-mute'
            )}
            aria-expanded={open}
          >
            and {rest.length} more
            <IconChevronDown size={11} className={cx('text-mute transition-transform', open && 'rotate-180')} />
          </button>
        )}
      </div>

      {open && rest.length > 0 && (
        <div className="absolute z-30 left-0 mt-2 w-[380px] max-w-[92vw] bg-canvas dark:bg-d-canvas rounded-[14px] border border-line dark:border-d-line shadow-[0_18px_40px_-16px_rgba(0,0,0,0.25)] p-1.5 anim-fadein">
          <div className="flex items-center justify-between px-2.5 py-1.5">
            <div className="text-[10.5px] uppercase tracking-wider font-semibold text-mute">
              {rest.length} more recipient{rest.length === 1 ? '' : 's'}
            </div>
            <button
              onClick={() => setOpen(false)}
              className="text-mute hover:text-ink dark:hover:text-d-ink p-0.5 rounded"
              aria-label="Close"
            >
              <IconX size={12} />
            </button>
          </div>
          <ul className="max-h-[280px] overflow-y-auto">
            {rest.map((r) => {
              const href = websiteHref(r.website);
              return (
                <li
                  key={r.email}
                  className="group flex items-center gap-2 px-2.5 py-1.5 rounded-[10px] hover:bg-canvas-soft dark:hover:bg-d-canvas-soft"
                >
                  <div className="min-w-0 flex-1">
                    {r.name && (
                      href ? (
                        <a
                          href={href}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[13px] font-medium text-ink dark:text-d-ink truncate block hover:text-[#1f6b00] dark:hover:text-primary"
                        >
                          {r.name}
                        </a>
                      ) : (
                        <span className="text-[13px] font-medium text-ink dark:text-d-ink truncate block">{r.name}</span>
                      )
                    )}
                    <button
                      onClick={() => { copyToClipboard(r.email); onCopyEmail?.(r.email); }}
                      className="text-[11.5px] text-mute hover:text-ink dark:hover:text-d-ink truncate block w-full text-left"
                      title="Click to copy email"
                    >
                      {r.email}
                    </button>
                  </div>
                  {onRemove && (
                    <button
                      onClick={() => onRemove(r)}
                      aria-label="Remove recipient"
                      title="Remove from thread"
                      className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-md text-mute hover:text-negative hover:bg-red-50 dark:hover:bg-red-900/20"
                    >
                      <IconTrash size={12} />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

// ─── HTML drop zone ────────────────────────────────────────────────────────
function HtmlDropZone({ html, onChange }) {
  const [hover, setHover] = useState(false);
  const taRef = useRef(null);

  const onDrop = (e) => {
    e.preventDefault();
    setHover(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => onChange(String(reader.result || ''));
      reader.readAsText(file);
      return;
    }
    const txt = e.dataTransfer?.getData('text/html') || e.dataTransfer?.getData('text/plain');
    if (txt) onChange(txt);
  };

  const onPaste = (e) => {
    const cd = e.clipboardData;
    const htmlPaste = cd?.getData('text/html');
    const textPaste = cd?.getData('text/plain');
    if (htmlPaste || textPaste) {
      e.preventDefault();
      onChange(htmlPaste || textPaste);
    }
  };

  if (!html) {
    return (
      <div
        onDragOver={(e) => { e.preventDefault(); setHover(true); }}
        onDragLeave={() => setHover(false)}
        onDrop={onDrop}
        onPaste={onPaste}
        tabIndex={0}
        ref={taRef}
        role="textbox"
        aria-label="Paste or drop HTML"
        className={cx(
          'rounded-[16px] border-2 border-dashed p-8 text-center cursor-text transition-colors',
          'focus:outline-none focus:ring-2 focus:ring-primary',
          hover
            ? 'border-primary bg-primary-pale/40 dark:bg-primary/10'
            : 'border-line dark:border-d-line bg-canvas-soft/40 dark:bg-d-canvas-soft/40'
        )}
      >
        <div className="mx-auto w-12 h-12 rounded-full bg-canvas dark:bg-d-canvas border border-line dark:border-d-line flex items-center justify-center text-mute mb-3">
          <IconMail size={20} />
        </div>
        <div className="text-[14.5px] font-semibold text-ink dark:text-d-ink">Drop an .html file, or paste HTML</div>
        <div className="text-[12.5px] text-mute mt-1 leading-relaxed max-w-[360px] mx-auto">
          The preview below renders live at 750px wide so a 600px email body has breathing room on each side. Paste new HTML to replace.
        </div>
        <div className="mt-3 flex items-center justify-center gap-2 text-[11px] text-mute">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-canvas dark:bg-d-canvas border border-line dark:border-d-line font-mono">⌘V</span>
          <span>or drag a file here</span>
        </div>
      </div>
    );
  }

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setHover(true); }}
      onDragLeave={() => setHover(false)}
      onDrop={onDrop}
      onPaste={onPaste}
      tabIndex={0}
      className={cx(
        'rounded-[16px] border bg-canvas-soft/50 dark:bg-d-canvas-soft/50 p-4 transition-colors',
        'focus:outline-none focus:ring-2 focus:ring-primary',
        hover ? 'border-primary' : 'border-line dark:border-d-line'
      )}
    >
      <div className="flex items-center justify-between gap-2 mb-3 px-1">
        <div className="text-[12px] text-mute font-medium flex items-center gap-1.5">
          <IconCheck size={13} className="text-positive" /> HTML loaded · <span className="tabular-nums">{html.length.toLocaleString()}</span> chars
        </div>
        <button
          onClick={() => onChange('')}
          className="text-[12px] text-mute hover:text-negative px-2 py-1 rounded-md"
        >
          Clear
        </button>
      </div>
      <HtmlPreview html={html} height={440} />
      <div className="text-center mt-3 text-[11px] text-mute">
        Paste new HTML to replace, or drop another file.
      </div>
    </div>
  );
}

// ─── Plain-text editor ─────────────────────────────────────────────────────
function PlainTextEditor({ value, onChange }) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={'Hi {{name}},\n\nWrite your message in plain text. Recipients will see this exactly as typed — no HTML rendering.\n\n— You\nOutrich Studio'}
      rows={10}
      className="w-full bg-canvas dark:bg-d-canvas border border-line dark:border-d-line rounded-[14px] px-4 py-3 text-[14px] leading-relaxed text-ink dark:text-d-ink placeholder:text-mute focus:outline-none focus:ring-2 focus:ring-primary resize-y"
      style={{ fontFamily: '"SF Mono", ui-monospace, Menlo, monospace' }}
    />
  );
}

// ─── Body-mode tab switcher ────────────────────────────────────────────────
// "Plain Text" is the default and what most outreach should use.
// "HTML Template" is the dressed-up path. Only the active mode's value is
// sent — switching modes does NOT clear the other side, so the user can
// toggle back and forth while drafting.
function BodyTabs({ mode, onChange }) {
  const items = [
    { v: 'text', label: 'Plain Text' },
    { v: 'html', label: 'HTML Template' },
  ];
  return (
    <div role="tablist" className="inline-flex items-center gap-1 p-1 rounded-full bg-canvas-soft dark:bg-d-canvas-soft border border-line dark:border-d-line">
      {items.map((t) => {
        const active = mode === t.v;
        return (
          <button
            key={t.v}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(t.v)}
            className={cx(
              'px-4 py-1.5 text-[12.5px] font-semibold rounded-full transition-colors',
              active
                ? 'bg-canvas dark:bg-d-canvas text-ink dark:text-d-ink shadow-[0_1px_2px_rgba(0,0,0,0.06)]'
                : 'text-mute hover:text-ink dark:hover:text-d-ink'
            )}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

// ─── Recipient search (for "+ New Compose") ────────────────────────────────
function RecipientSearch({ campaignLeads, exclude, onAdd }) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const excludeSet = useMemo(() => new Set((exclude || []).map((x) => x.email)), [exclude]);
  const results = useMemo(() => {
    const base = (campaignLeads || []).filter((l) => l.email && !excludeSet.has(l.email));
    if (!q.trim()) return base.slice(0, 8);
    const needle = q.toLowerCase();
    return base.filter((l) =>
      (l.name || '').toLowerCase().includes(needle) ||
      (l.email || '').toLowerCase().includes(needle)
    ).slice(0, 8);
  }, [q, campaignLeads, excludeSet]);

  return (
    <div className="relative">
      <Input
        value={q}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Search leads by name or email…"
        leftIcon={<IconSearch size={15} />}
      />
      {open && results.length > 0 && (
        <div className="absolute z-20 left-0 right-0 mt-1.5 bg-canvas dark:bg-d-canvas rounded-[14px] border border-line dark:border-d-line shadow-[0_18px_40px_-16px_rgba(0,0,0,0.25)] p-1 anim-fadein">
          <div className="text-[10.5px] uppercase tracking-wider font-semibold text-mute px-3 py-1.5">
            From this campaign · with email
          </div>
          {results.map((l) => (
            <button
              key={l.id}
              onMouseDown={(e) => { e.preventDefault(); onAdd({ leadId: l.id, email: l.email, name: l.name, website: l.website }); setQ(''); }}
              className="w-full text-left flex items-center gap-2 px-3 py-2 rounded-[10px] hover:bg-canvas-soft dark:hover:bg-d-canvas-soft"
            >
              <div className="min-w-0 flex-1">
                <div className="text-[13.5px] font-medium text-ink dark:text-d-ink truncate">{l.name}</div>
                <div className="text-[12px] text-mute truncate">{l.email}</div>
              </div>
              <IconPlus size={14} className="text-mute shrink-0" />
            </button>
          ))}
        </div>
      )}
      {open && q && results.length === 0 && (
        <div className="absolute z-20 left-0 right-0 mt-1.5 bg-canvas dark:bg-d-canvas rounded-[14px] border border-line dark:border-d-line p-3 text-[12.5px] text-mute anim-fadein">
          No leads in this campaign match "<span className="text-ink dark:text-d-ink">{q}</span>".
        </div>
      )}
    </div>
  );
}

// ─── Status pill (button only — breakdown lives separately) ────────────────
// Refactored from the original: previously the per-recipient breakdown
// dropped inside the pill's wrapper, which made the pill itself shift
// rightward when expanded. Now the pill is just a button with controlled
// open state, and MessageCard renders the breakdown as its own block.
function StatusPill({ recipients, open, onToggle }) {
  const sent = recipients.filter((r) => r.status === 'SENT').length;
  const failed = recipients.filter((r) => r.status === 'FAILED').length;
  const pending = recipients.filter((r) => r.status === 'PENDING').length;
  const total = recipients.length;
  const tone = failed === total ? 'negative' : failed > 0 ? 'warning' : 'positive';
  const summary =
    failed === 0 && pending === 0
      ? `${sent} sent`
      : failed === total
      ? `${failed} failed`
      : `${sent} sent · ${failed} failed${pending ? ` · ${pending} pending` : ''}`;

  return (
    <button
      onClick={onToggle}
      className="inline-flex items-center gap-1.5"
      aria-expanded={open}
    >
      <Badge tone={tone} size="sm">{summary}</Badge>
      <IconChevronDown size={12} className={cx('text-mute transition-transform', open && 'rotate-180')} />
    </button>
  );
}

function RecipientBreakdown({ recipients }) {
  return (
    <div className="mt-3 rounded-[10px] border border-line dark:border-d-line bg-canvas-soft/60 dark:bg-d-canvas-soft/60 divide-y divide-line dark:divide-d-line overflow-hidden">
      {recipients.map((r, i) => (
        <div key={i} className="flex items-center justify-between gap-3 px-3 py-1.5 text-[12px]">
          <span className="font-mono text-[11.5px] text-ink dark:text-d-ink truncate">{r.email}</span>
          <span className="shrink-0 flex items-center gap-2">
            {r.status === 'SENT' ? (
              <span className="text-positive font-semibold">sent</span>
            ) : r.status === 'FAILED' ? (
              <span className="text-negative font-semibold" title={r.errorMessage}>failed</span>
            ) : (
              <span className="text-mute">{(r.status || '').toLowerCase()}</span>
            )}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Message card (one entry in the thread scroll stack) ───────────────────
function MessageCard({ message, onDelete }) {
  const [breakdownOpen, setBreakdownOpen] = useState(false);
  return (
    <article
      className="bg-canvas dark:bg-d-canvas rounded-card border border-line dark:border-d-line p-5"
      data-message-id={message.id}
    >
      <header className="flex items-start gap-3 mb-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-[17px] font-semibold text-ink dark:text-d-ink leading-snug">{message.subject}</h3>
          <div className="text-[12px] text-mute mt-1 flex items-center gap-2 flex-wrap">
            <span>From <span className="font-mono text-[11.5px] text-body dark:text-d-body">{message.fromAddress}</span></span>
            <span className="text-line dark:text-d-line">·</span>
            <span>{message.sentAtRel}</span>
            <span className="text-line dark:text-d-line">·</span>
            <span>{message.recipients.length} recipient{message.recipients.length === 1 ? '' : 's'}</span>
          </div>
        </div>
        <div className="shrink-0 flex items-center gap-2">
          <StatusPill
            recipients={message.recipients}
            open={breakdownOpen}
            onToggle={() => setBreakdownOpen((v) => !v)}
          />
          <button
            onClick={onDelete}
            className="p-1.5 rounded-[8px] text-mute hover:text-negative hover:bg-red-50 dark:hover:bg-red-900/20"
            aria-label="Delete message"
            title="Delete message"
          >
            <IconTrash size={14} />
          </button>
        </div>
      </header>

      {/* Per-recipient breakdown — rendered as its own block, not inside
          the StatusPill, so opening it doesn't shove the pill around. */}
      {breakdownOpen && <RecipientBreakdown recipients={message.recipients} />}

      {message.errorMessage && (
        <div className="mb-3 mt-3 rounded-[12px] border border-red-200/60 dark:border-red-800/60 bg-red-50 dark:bg-red-900/20 px-3 py-2 text-[12.5px] text-[#a7000d] dark:text-red-300">
          {message.errorMessage}
        </div>
      )}

      <div className="mt-3">
        {message.html ? (
          <HtmlPreview html={message.html} height={380} />
        ) : message.text ? (
          <pre className="font-sans text-[13.5px] text-body dark:text-d-body whitespace-pre-wrap bg-canvas-soft/60 dark:bg-d-canvas-soft/60 rounded-[12px] p-4 max-w-[750px] mx-auto">{message.text}</pre>
        ) : (
          <div className="text-[12.5px] text-mute italic text-center py-6">Body unavailable.</div>
        )}
      </div>
    </article>
  );
}

// ─── Composer ──────────────────────────────────────────────────────────────
// Body is a single source — Plain Text OR HTML Template, never both. The
// active tab is what gets sent; the other side is cleared at send time.
function Composer({ mode, defaultRecipients = [], campaignLeads = [], onSend, onCancel, onCopyEmail, sending }) {
  const [recipients, setRecipients] = useState(defaultRecipients);
  const [subject, setSubject] = useState('');
  const [bodyMode, setBodyMode] = useState('text');   // default: plain text
  const [html, setHtml] = useState('');
  const [text, setText] = useState('');

  useEffect(() => { setRecipients(defaultRecipients); }, [defaultRecipients]);

  const activeBody = bodyMode === 'html' ? html : text;
  const canSend = recipients.length > 0 && subject.trim() && activeBody.trim() && !sending;

  const remove = (r) => setRecipients((rs) => rs.filter((x) => x.email !== r.email));

  const add = (r) => {
    if (recipients.some((x) => x.email === r.email)) return;
    setRecipients((rs) => [...rs, r]);
  };

  const send = () => {
    if (!canSend) return;
    onSend({
      subject: subject.trim(),
      // Only the active mode's body gets sent — the other is dropped so the
      // server side never receives stale draft content the user can't see.
      html: bodyMode === 'html' ? html : '',
      text: bodyMode === 'text' ? text : '',
      recipients,
    });
    setSubject(''); setHtml(''); setText(''); setBodyMode('text');
  };

  return (
    <div className="bg-canvas dark:bg-d-canvas rounded-card border border-line dark:border-d-line overflow-hidden">
      <div className="divide-y divide-line dark:divide-d-line">
        {/* From — read-only */}
        <div className="flex items-baseline gap-3 px-5 py-3">
          <span className="text-[12px] uppercase tracking-wide font-semibold text-mute w-14 shrink-0">From</span>
          <span className="text-[13.5px] font-mono text-body dark:text-d-body">{MAILHOG_FROM}</span>
          <span className="text-[11px] text-mute italic ml-auto shrink-0">read-only · MailHog</span>
        </div>

        {/* To — overflow into "+N more" pill instead of stacking */}
        <div className="px-5 py-3">
          <div className="flex items-baseline gap-3 mb-2">
            <span className="text-[12px] uppercase tracking-wide font-semibold text-mute w-14 shrink-0">To</span>
            <span className="text-[12px] text-mute">{recipients.length} recipient{recipients.length === 1 ? '' : 's'}</span>
            {mode === 'in-thread' && (
              <span className="text-[11px] text-mute italic ml-auto">remove chips to skip for this send</span>
            )}
          </div>
          <div className="pl-[68px]">
            <RecipientList
              recipients={recipients}
              maxInline={3}
              onRemove={remove}
              onCopyEmail={onCopyEmail}
              emptyText="No recipients yet."
            />
          </div>
          {mode === 'new-thread' && (
            <div className="pl-[68px] mt-3">
              <RecipientSearch campaignLeads={campaignLeads} exclude={recipients} onAdd={add} />
            </div>
          )}
        </div>

        {/* Subject */}
        <div className="flex items-center gap-3 px-5 py-2">
          <span className="text-[12px] uppercase tracking-wide font-semibold text-mute w-14 shrink-0">Subject</span>
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="What's this about?"
            className="flex-1 bg-transparent text-[15px] font-medium text-ink dark:text-d-ink placeholder:text-mute placeholder:font-normal py-1.5 focus:outline-none"
            maxLength={998}
          />
        </div>
      </div>

      {/* Body — tabbed editor. ONE active mode at a time. */}
      <div className="px-5 py-4 bg-canvas-soft/40 dark:bg-d-canvas-soft/40">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
          <BodyTabs mode={bodyMode} onChange={setBodyMode} />
          <span className="text-[11px] text-mute italic">
            {bodyMode === 'text'
              ? 'Plain text — fastest to write, best deliverability.'
              : 'HTML — paste or drop a designed template.'}
          </span>
        </div>
        {bodyMode === 'text' ? (
          <PlainTextEditor value={text} onChange={setText} />
        ) : (
          <HtmlDropZone html={html} onChange={setHtml} />
        )}
      </div>

      {/* Footer */}
      <div className="px-5 py-3.5 border-t border-line dark:border-d-line flex items-center justify-between gap-3 bg-canvas dark:bg-d-canvas">
        <div className="text-[11.5px] text-mute">
          {sending ? (
            <span className="inline-flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-positive pulse-dot" /> Sending {recipients.length} message{recipients.length === 1 ? '' : 's'}…
            </span>
          ) : canSend ? (
            <>Ready to send <span className="font-semibold text-ink dark:text-d-ink">{bodyMode === 'text' ? 'plain text' : 'HTML'}</span> to <span className="text-ink dark:text-d-ink font-semibold tabular-nums">{recipients.length}</span> recipient{recipients.length === 1 ? '' : 's'}.</>
          ) : (
            <span>Add a recipient, a subject, and a body to send.</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {onCancel && <Button variant="ghost" size="sm" onClick={onCancel}>{mode === 'in-thread' ? 'Cancel' : 'Discard'}</Button>}
          <Button
            variant="primary"
            size="sm"
            onClick={send}
            disabled={!canSend}
            rightIcon={<IconArrowRight size={13} />}
          >
            {sending ? 'Sending…' : 'Send'}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Thread view ───────────────────────────────────────────────────────────
function ThreadView({ thread, campaign, campaignLeads, onSend, onDeleteMessage, onDeleteThread, onRemoveRecipient, onCopyEmails, onCopyEmail, sending }) {
  const [composerOpen, setComposerOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const scrollRef = useRef(null);

  // Auto-pin to bottom on:
  //   - thread switch (mount + thread.id change)
  //   - new message arriving (messages.length grows)
  //   - composer opening (new message expansion sits at the bottom)
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    // RAF lets the composer's DOM lay out before we measure.
    requestAnimationFrame(() => { el.scrollTop = el.scrollHeight; });
  }, [thread.id, thread.messages.length, composerOpen]);

  // Hydrate each recipient with the live website for click-through.
  const recipientsHydrated = useMemo(
    () => thread.recipients.map((r) => ({
      ...r,
      website: r.website || campaignLeads.find((l) => l.id === r.leadId)?.website || null,
    })),
    [thread.recipients, campaignLeads]
  );

  const handleSend = (payload) => {
    onSend(thread.id, payload);
    setComposerOpen(false);
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Sticky header — recipients (overflow into +N more) + actions */}
      <div className="shrink-0 border-b border-line dark:border-d-line bg-canvas dark:bg-d-canvas px-6 py-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="text-[11px] uppercase tracking-wider font-semibold text-mute mb-2">
              Thread · {thread.recipients.length} recipient{thread.recipients.length === 1 ? '' : 's'} · {thread.messages.length} message{thread.messages.length === 1 ? '' : 's'}
            </div>
            <div>
              <RecipientList
                recipients={recipientsHydrated}
                maxInline={3}
                onRemove={(r) => onRemoveRecipient(thread.id, r.email)}
                onCopyEmail={onCopyEmail}
                emptyText="No recipients."
              />
            </div>
          </div>
          <div className="shrink-0 flex items-center gap-1.5">
            <Button
              size="sm"
              variant="chip"
              leftIcon={<IconLink size={13} />}
              onClick={() => onCopyEmails(thread)}
            >
              Copy emails
            </Button>
            <button
              onClick={() => setConfirmDelete({ kind: 'thread' })}
              className="p-2 rounded-[10px] text-mute hover:text-negative hover:bg-red-50 dark:hover:bg-red-900/20"
              title="Delete thread"
              aria-label="Delete thread"
            >
              <IconTrash size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Scrollable message stack */}
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto px-6 py-6 space-y-4 bg-canvas-soft/40 dark:bg-d-canvas-soft/40">
        {thread.messages.map((m) => (
          <MessageCard
            key={m.id}
            message={m}
            onDelete={() => setConfirmDelete({ kind: 'message', id: m.id })}
          />
        ))}

        {composerOpen && (
          <div className="anim-fadein">
            <Composer
              mode="in-thread"
              defaultRecipients={recipientsHydrated}
              campaignLeads={campaignLeads}
              onCancel={() => setComposerOpen(false)}
              onSend={handleSend}
              onCopyEmail={onCopyEmail}
              sending={sending}
            />
          </div>
        )}
      </div>

      {!composerOpen && (
        <div className="shrink-0 border-t border-line dark:border-d-line bg-canvas dark:bg-d-canvas px-6 py-3.5 flex items-center justify-between gap-3">
          <div className="text-[12px] text-mute">
            Send another message to the same group. Remove chips in the composer to skip recipients for one send.
          </div>
          <Button
            variant="primary"
            size="sm"
            leftIcon={<IconPlus size={13} />}
            onClick={() => setComposerOpen(true)}
          >
            New message
          </Button>
        </div>
      )}

      {confirmDelete && (
        <Modal open={true} onClose={() => setConfirmDelete(null)} width={440}>
          <h3 className="text-[19px] font-semibold text-ink dark:text-d-ink">
            Delete this {confirmDelete.kind}?
          </h3>
          <p className="text-[13.5px] text-body dark:text-d-body mt-2 leading-relaxed">
            {confirmDelete.kind === 'thread'
              ? `The thread, all ${thread.messages.length} message${thread.messages.length === 1 ? '' : 's'}, and the stored HTML files will be permanently removed. Recipients aren't notified.`
              : 'The message and its stored HTML file will be permanently removed. The thread and other messages stay.'}
          </p>
          <div className="mt-5 flex items-center justify-end gap-2">
            <Button variant="ghost" onClick={() => setConfirmDelete(null)}>Cancel</Button>
            <Button
              variant="destructive"
              leftIcon={<IconTrash size={13} />}
              onClick={() => {
                if (confirmDelete.kind === 'thread') onDeleteThread(thread.id);
                else onDeleteMessage(thread.id, confirmDelete.id);
                setConfirmDelete(null);
              }}
            >
              Delete
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── Campaigns rail (leftmost of the three) ────────────────────────────────
// Each row carries a "#source · N threads" meta-line so the operator can
// tell at a glance which scraper this outreach campaign originates from.
function InboxCampaignsRail({ campaigns, threadsByCampaign, activeCampaignId, onSelect }) {
  const populated = useMemo(() => {
    return campaigns
      .filter((c) => (threadsByCampaign[c.id] || []).length > 0)
      .map((c) => {
        const threads = threadsByCampaign[c.id];
        const last = threads.reduce((max, t) => (t.updatedAtMs > max ? t.updatedAtMs : max), 0);
        const totalMessages = threads.reduce((s, t) => s + t.messages.length, 0);
        return { ...c, _threadCount: threads.length, _msgCount: totalMessages, _lastMs: last };
      })
      .sort((a, b) => b._lastMs - a._lastMs);
  }, [campaigns, threadsByCampaign]);

  return (
    <aside className="w-[228px] shrink-0 h-full border-r border-line dark:border-d-line bg-canvas dark:bg-d-canvas flex flex-col min-h-0">
      <div className="shrink-0 px-4 py-3 border-b border-line dark:border-d-line flex items-center justify-between">
        <div>
          <div className="text-[10.5px] uppercase tracking-wider font-semibold text-mute">Campaigns</div>
          <div className="text-[13px] font-semibold text-ink dark:text-d-ink mt-0.5">With outreach</div>
        </div>
        <span className="text-[11px] text-mute tabular-nums">{populated.length}</span>
      </div>

      <ul className="flex-1 min-h-0 overflow-y-auto p-2 space-y-0.5">
        {populated.length === 0 && (
          <li className="px-3 py-6 text-center text-[12.5px] text-mute leading-relaxed">
            No outreach yet. Send your first message from any campaign.
          </li>
        )}
        {populated.map((c) => {
          const active = c.id === activeCampaignId;
          const Icon = c.source === 'yelp' ? IconStar : c.source === 'linkedin' ? IconBriefcase : IconMapPin;
          return (
            <li key={c.id}>
              <button
                onClick={() => onSelect(c.id)}
                className={cx(
                  'relative w-full text-left rounded-[12px] px-3 py-2.5 transition-colors',
                  active
                    ? 'bg-primary-pale/60 dark:bg-primary/15 text-ink dark:text-d-ink'
                    : 'hover:bg-canvas-soft dark:hover:bg-d-canvas-soft text-body dark:text-d-body'
                )}
              >
                {active && <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full bg-primary" />}
                <div className="flex items-start gap-2">
                  <Icon size={13} className={cx('mt-1 shrink-0', active ? 'text-ink dark:text-d-ink' : 'text-mute')} />
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-semibold truncate text-ink dark:text-d-ink">{c.name}</div>
                    <div className="text-[11px] text-mute mt-0.5 flex items-center gap-1.5">
                      <span className="font-mono text-[10.5px] text-ink/70 dark:text-d-ink/70">#{c.source}</span>
                      <span className="text-line dark:text-d-line">·</span>
                      <span className="tabular-nums">{c._threadCount} thread{c._threadCount === 1 ? '' : 's'}</span>
                    </div>
                  </div>
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}

// ─── Threads rail (middle) ─────────────────────────────────────────────────
// Header order is intentionally Title → "THREADS" label (per design feedback)
// — the campaign name is the answer to "where am I", the label is the chrome.
// The right corner shows the message count instead of a Copy-emails icon
// (operators use the per-thread Copy emails button in the main pane).
function InboxThreadsRail({ campaign, threads, activeThreadId, onSelectThread, onNewCompose, onDeleteThread }) {
  const sorted = useMemo(
    () => [...(threads || [])].sort((a, b) => b.updatedAtMs - a.updatedAtMs),
    [threads]
  );
  const totalMessages = useMemo(
    () => sorted.reduce((s, t) => s + t.messages.length, 0),
    [sorted]
  );

  return (
    <aside className="w-[330px] shrink-0 h-full border-r border-line dark:border-d-line bg-canvas dark:bg-d-canvas flex flex-col min-h-0">
      <div className="shrink-0 px-4 py-3 border-b border-line dark:border-d-line">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0 flex-1">
            <div
              className="text-[14px] font-semibold text-ink dark:text-d-ink truncate"
            >
              {campaign?.name || '—'}
            </div>
            <div className="text-[10.5px] uppercase tracking-wider font-semibold text-mute mt-1">Threads</div>
          </div>
          <div className="shrink-0 text-right">
            <div className="text-[20px] font-black tabular-nums text-ink dark:text-d-ink leading-none">{totalMessages}</div>
            <div className="text-[9.5px] uppercase tracking-wider font-semibold text-mute mt-1">
              {totalMessages === 1 ? 'message' : 'messages'}
            </div>
          </div>
        </div>
        <Button
          variant="primary"
          size="sm"
          className="w-full"
          leftIcon={<IconPlus size={13} />}
          onClick={onNewCompose}
        >
          New compose
        </Button>
      </div>

      <ul className="flex-1 min-h-0 overflow-y-auto">
        {sorted.length === 0 && (
          <li className="px-4 py-10 text-center text-[12.5px] text-mute leading-relaxed">
            No threads yet for this campaign.
          </li>
        )}
        {sorted.map((t) => {
          const active = t.id === activeThreadId;
          const summary =
            t.recipients.slice(0, 2).map((r) => r.name || r.email.split('@')[0]).join(', ') +
            (t.recipients.length > 2 ? `, +${t.recipients.length - 2}` : '');
          return (
            <li key={t.id} className="border-b border-line/60 dark:border-d-line/60 group">
              <button
                onClick={() => onSelectThread(t.id)}
                className={cx(
                  'relative w-full text-left px-4 py-3 transition-colors',
                  active
                    ? 'bg-primary-pale/60 dark:bg-primary/15'
                    : 'hover:bg-canvas-soft dark:hover:bg-d-canvas-soft'
                )}
              >
                {active && <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full bg-primary" />}
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[13px] font-semibold text-ink dark:text-d-ink truncate flex-1">{summary}</span>
                  <span className="text-[10.5px] text-mute tabular-nums shrink-0">{t.updatedAtRel}</span>
                </div>
                <div className="text-[12.5px] text-mute truncate mt-0.5">{t.lastSubject}</div>
                <div className="flex items-center justify-between gap-2 mt-1.5">
                  <span className="inline-flex items-center gap-1 text-[10.5px] text-mute">
                    <Badge tone="mute" size="sm">{t.messages.length} msg</Badge>
                  </span>
                  <button
                    onClick={(e) => { e.stopPropagation(); onDeleteThread(t); }}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md text-mute hover:text-negative hover:bg-red-50 dark:hover:bg-red-900/20"
                    aria-label="Delete thread"
                  >
                    <IconTrash size={12} />
                  </button>
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}

// ─── Inbox page (the three-pane shell) ─────────────────────────────────────
function InboxPage({
  campaigns,
  leadsByCampaign,
  threadsByCampaign,
  activeCampaignId,
  activeThreadId,
  pendingSelection,
  onSelectCampaign,
  onSelectThread,
  onCreateThread,
  onSendMessage,
  onDeleteThread,
  onDeleteMessage,
  onRemoveRecipient,
  onClearPending,
}) {
  const [composeMode, setComposeMode] = useState(null);
  const [sending, setSending] = useState(false);
  const toast = useToast();

  // Toast helper for click-to-copy on chips.
  const onCopyEmail = useCallback((email) => {
    toast.show({
      type: 'success',
      title: 'Email copied',
      message: `${email} is on your clipboard.`,
    });
  }, [toast]);

  // Consume pending selection on mount / when it appears.
  useEffect(() => {
    if (!pendingSelection) return;
    const { campaignId, leads } = pendingSelection;
    onClearPending();
    if (!leads.length) return;
    const tid = onCreateThread(
      campaignId,
      leads.map((l) => ({ leadId: l.id, email: l.email, name: l.name, website: l.website }))
    );
    onSelectCampaign(campaignId);
    if (tid) {
      onSelectThread(tid);
      toast.show({
        type: 'success',
        title: 'Thread created',
        message: `${leads.length} recipient${leads.length === 1 ? '' : 's'} — compose your first message below.`,
      });
    }
  }, [pendingSelection]);

  const activeCampaign = useMemo(
    () => campaigns.find((c) => c.id === activeCampaignId) || null,
    [campaigns, activeCampaignId]
  );
  const activeThreads = activeCampaign ? threadsByCampaign[activeCampaign.id] || [] : [];
  const activeThread = useMemo(
    () => activeThreads.find((t) => t.id === activeThreadId) || null,
    [activeThreads, activeThreadId]
  );
  const campaignLeads = activeCampaign ? leadsByCampaign[activeCampaign.id] || [] : [];

  const copyEmails = (thread) => {
    const list = thread.recipients.map((r) => r.email).join(', ');
    copyToClipboard(list);
    toast.show({
      type: 'success',
      title: 'Recipients copied',
      message: `${thread.recipients.length} email${thread.recipients.length === 1 ? '' : 's'} on your clipboard — paste into Gmail/Outlook.`,
    });
  };

  const simulateSend = (threadId, payload) => {
    setSending(true);
    setTimeout(() => {
      const enriched = {
        ...payload,
        recipients: payload.recipients.map((r) => {
          const fail = Math.random() < 0.08;
          return fail
            ? { email: r.email, status: 'FAILED', errorMessage: 'SMTP 550 — recipient rejected' }
            : { email: r.email, status: 'SENT', smtpMessageId: 'mh-' + Math.random().toString(36).slice(2, 8) };
        }),
      };
      onSendMessage(threadId, enriched);
      setSending(false);
      const fails = enriched.recipients.filter((r) => r.status === 'FAILED').length;
      toast.show({
        type: fails === enriched.recipients.length ? 'error' : fails > 0 ? 'warning' : 'success',
        title: fails === 0 ? 'Message sent' : fails === enriched.recipients.length ? 'Send failed' : 'Sent with errors',
        message:
          fails === 0
            ? `Delivered to all ${enriched.recipients.length} recipient${enriched.recipients.length === 1 ? '' : 's'} via MailHog.`
            : `${enriched.recipients.length - fails} sent · ${fails} failed. Check the per-recipient breakdown.`,
      });
    }, 700 + Math.random() * 400);
  };

  const startNewCompose = () => {
    if (!activeCampaignId) return;
    setComposeMode('new-thread');
  };
  const sendNewThread = ({ subject, html, text, recipients }) => {
    const newRecipients = recipients.map((r) => ({ leadId: r.leadId ?? null, email: r.email, name: r.name || null, website: r.website || null }));
    const newThreadId = onCreateThread(activeCampaignId, newRecipients);
    if (!newThreadId) return;
    onSelectThread(newThreadId);
    setComposeMode(null);
    setTimeout(() => simulateSend(newThreadId, { subject, html, text, recipients: newRecipients }), 60);
  };

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 64px)' }}>
      {/* Page header strip */}
      <div className="shrink-0 px-6 py-3 border-b border-line dark:border-d-line bg-canvas-soft/60 dark:bg-d-canvas-soft/60 flex items-center justify-between">
        <div>
          <h1 className="text-[18px] font-semibold text-ink dark:text-d-ink leading-none">Inbox</h1>
          <p className="text-[12px] text-mute mt-1">Send outreach via MailHog · per-recipient logging · copy to Gmail when ready to ship.</p>
        </div>
        <div className="hidden md:flex items-center gap-2">
          <a
            href="https://mailhog.site/dashboard"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-canvas dark:bg-d-canvas border border-line dark:border-d-line hover:border-mute transition-colors group"
            title="Open MailHog Dashboard in a new tab"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-positive pulse-dot" />
            <span className="text-[11.5px] text-ink dark:text-d-ink font-semibold">MailHog: Dashboard</span>
            <IconExternal size={11} className="text-mute group-hover:text-ink dark:group-hover:text-d-ink transition-colors" />
          </a>
        </div>
      </div>

      {/* Three panes */}
      <div className="flex-1 min-h-0 flex">
        <InboxCampaignsRail
          campaigns={campaigns}
          threadsByCampaign={threadsByCampaign}
          activeCampaignId={activeCampaignId}
          onSelect={(cid) => { onSelectCampaign(cid); setComposeMode(null); }}
        />
        {activeCampaign ? (
          <InboxThreadsRail
            campaign={activeCampaign}
            threads={activeThreads}
            activeThreadId={activeThreadId}
            onSelectThread={(tid) => { onSelectThread(tid); setComposeMode(null); }}
            onNewCompose={startNewCompose}
            onDeleteThread={(t) => onDeleteThread(t.id)}
          />
        ) : (
          <div className="w-[330px] shrink-0 border-r border-line dark:border-d-line bg-canvas dark:bg-d-canvas flex items-center justify-center text-[12.5px] text-mute px-6 text-center">
            Pick a campaign on the left.
          </div>
        )}

        <main className="flex-1 min-w-0 min-h-0 bg-canvas-soft/40 dark:bg-d-canvas-soft/40">
          {composeMode === 'new-thread' && activeCampaign ? (
            <div className="h-full overflow-y-auto px-6 py-6">
              <div className="max-w-[940px] mx-auto">
                <div className="mb-4">
                  <div className="text-[11px] uppercase tracking-wider font-semibold text-mute">New compose</div>
                  <h2 className="text-[22px] font-semibold text-ink dark:text-d-ink mt-1">Pick recipients & send</h2>
                  <p className="text-[13px] text-mute mt-1">
                    The recipient group becomes this thread's anchor — every follow-up sends to the same list.
                  </p>
                </div>
                <Composer
                  mode="new-thread"
                  defaultRecipients={[]}
                  campaignLeads={campaignLeads}
                  onCancel={() => setComposeMode(null)}
                  onSend={sendNewThread}
                  onCopyEmail={onCopyEmail}
                  sending={sending}
                />
              </div>
            </div>
          ) : activeThread ? (
            <ThreadView
              thread={activeThread}
              campaign={activeCampaign}
              campaignLeads={campaignLeads}
              onSend={simulateSend}
              onDeleteMessage={onDeleteMessage}
              onDeleteThread={onDeleteThread}
              onRemoveRecipient={onRemoveRecipient}
              onCopyEmails={copyEmails}
              onCopyEmail={onCopyEmail}
              sending={sending}
            />
          ) : activeCampaign ? (
            <InboxPlaceholder
              title="Select a thread or compose new"
              body="Every message you send is logged here. Coming from the campaign page creates a fresh thread; manual compose lets you pick anyone in this campaign with an email."
              icon={<IconMail size={28} />}
            />
          ) : (
            <InboxPlaceholder
              title="No campaign selected"
              body="Click a campaign on the left to see its outreach threads. Campaigns appear here once you've sent at least one message from their page."
              icon={<IconLayout size={28} />}
            />
          )}
        </main>
      </div>
    </div>
  );
}

function InboxPlaceholder({ title, body, icon }) {
  return (
    <div className="h-full flex items-center justify-center px-6 text-center">
      <div className="max-w-[380px]">
        <div className="mx-auto w-16 h-16 rounded-full bg-canvas dark:bg-d-canvas border border-line dark:border-d-line flex items-center justify-center text-mute mb-4">
          {icon}
        </div>
        <h3 className="text-[18px] font-semibold text-ink dark:text-d-ink">{title}</h3>
        <p className="text-[13px] text-mute mt-2 leading-relaxed">{body}</p>
      </div>
    </div>
  );
}

Object.assign(window, {
  InboxPage,
  Composer,
  HtmlPreview,
  RecipientChip,
  RecipientList,
  RecipientSearch,
  HtmlDropZone,
  PlainTextEditor,
  BodyTabs,
  ThreadView,
  MessageCard,
  StatusPill,
  RecipientBreakdown,
  InboxCampaignsRail,
  InboxThreadsRail,
  aggregateMsgStatus,
});
