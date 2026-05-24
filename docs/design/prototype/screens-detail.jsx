// ───────── Campaign Detail Page ─────────
// Source-aware: the leads table renders different columns + a different
// <LeadRow*> component depending on campaign.source.
//   gmaps    → business name | phone | email | website | notes | added | status
//   yelp     → business name | phone | rating | price | neighborhood | notes | status
//   linkedin → person name | title | company | location | connection | notes | status
//
// Stat cards, scraping banner, run history card, bulk actions stay identical
// across sources — that's the spine of the design.

function CampaignDetailPage({ campaign, leads, onBack, onRun, onArchive, onEdit, scraping, onStopScraping, scrapingFound, onLeadStatusChange, onLeadNotesChange, onLeadEmailChange, onExport, enrichRun, enrichElapsedMs, enrichJustFound, onFindEmails, onStopEnrich, yelpRun, yelpElapsedMs, onStopYelpFetch, yelpJustFetched, onOpenInbox }) {
  const src = SOURCES[campaign.source] || SOURCES.gmaps;
  const isYelp     = campaign.source === 'yelp';
  const isLinkedIn = campaign.source === 'linkedin';
  const entity = src.leadEntity;
  const entityCap = entity.charAt(0).toUpperCase() + entity.slice(1);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [selected, setSelected] = useState(new Set());
  const [editingNotes, setEditingNotes] = useState(null);
  const [editingEmail, setEditingEmail] = useState(null);

  // reset selection when filter changes
  useEffect(() => {setPage(1);}, [statusFilter, search, pageSize]);

  const filtered = useMemo(() => {
    return leads.filter((l) => {
      const matchStatus = statusFilter === 'ALL' || l.status === statusFilter;
      const searchable = (l.name || '') + (l.phone || '') + (l.website || '') + (l.email || '') + (l.notes || '') +
        (l.role || '') + (l.company || '') + (l.location || '') + (l.headline || '') +
        (l.neighborhood || '') + (l.primaryCategory || '');
      const matchSearch = !search || searchable.toLowerCase().includes(search.toLowerCase());
      return matchStatus && matchSearch;
    });
  }, [leads, statusFilter, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);

  const stats = useMemo(() => {
    const total = leads.length;
    const newCount = leads.filter((l) => l.status === 'NEW').length;
    const contacted = leads.filter((l) => ['CONTACTED', 'REPLIED', 'CLOSED'].includes(l.status)).length;
    const replied = leads.filter((l) => l.status === 'REPLIED' || l.status === 'CLOSED').length;
    return {
      total,
      new: newCount,
      contacted,
      conversion: total ? Math.round(replied / total * 100) : 0
    };
  }, [leads]);

  const allOnPageSelected = pageRows.length > 0 && pageRows.every((r) => selected.has(r.id));
  const someOnPageSelected = pageRows.some((r) => selected.has(r.id)) && !allOnPageSelected;

  const togglePage = (on) => {
    const next = new Set(selected);
    pageRows.forEach((r) => on ? next.add(r.id) : next.delete(r.id));
    setSelected(next);
  };
  const toggleOne = (id, on) => {
    const next = new Set(selected);
    on ? next.add(id) : next.delete(id);
    setSelected(next);
  };
  const clearSelection = () => setSelected(new Set());

  return (
    <div className="px-8 py-8 max-w-[1480px] mx-auto pb-32">
      {/* Top: back + breadcrumb */}
      <button
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-[13px] text-mute hover:text-ink dark:hover:text-d-ink mb-5 transition-colors">
        
        <IconChevronLeft size={14} /> All {src.label} campaigns
      </button>

      {/* Header */}
      <div className="flex items-start justify-between gap-6 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-[32px] sm:text-[36px] font-bold text-ink dark:text-d-ink leading-tight tracking-tight">
              {campaign.name}
            </h1>
            <Badge
              tone={campaign.status === 'ACTIVE' ? 'positive' : campaign.status === 'PAUSED' ? 'warning' : 'mute'}
              dot={campaign.status === 'ACTIVE' ? 'bg-positive' : campaign.status === 'PAUSED' ? 'bg-warning' : 'bg-mute'}>
              
              {campaign.status}
            </Badge>
          </div>
          <div className="text-[15px] text-body dark:text-d-body mt-1">"{campaign.keyword}"</div>
          <div className="text-[12px] text-mute mt-1.5 flex items-center gap-1.5">
            {isLinkedIn ? (
              <>
                <IconBriefcase size={11} />
                {campaign.industry || 'Any industry'} <span className="text-line dark:text-d-line">›</span> {campaign.city}
                {campaign.seniority && campaign.seniority !== 'Any seniority' && (
                  <>
                    <span className="text-line dark:text-d-line">›</span>
                    {campaign.seniority}
                  </>
                )}
              </>
            ) : (
              <>
                <IconMapPin size={11} /> USA <span className="text-line dark:text-d-line">›</span> {campaign.state} <span className="text-line dark:text-d-line">›</span> {campaign.city || 'Entire State'}
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {scraping ?
          <Button variant="destructive" size="md" onClick={onStopScraping} leftIcon={<IconStop size={14} />}>
              Stop scraping
            </Button> :
          yelpRun ?
          <Button variant="destructive" size="md" onClick={onStopYelpFetch} leftIcon={<IconStop size={14} />}>
              Stop fetching
            </Button> :
          <Button variant="primary" size="md" onClick={onRun} leftIcon={isYelp ? <IconNetwork size={14} /> : <IconPlay size={14} />}>
              {isYelp ? 'Fetch from Yelp' : 'Run campaign'}
            </Button>
          }
          <Menu
            trigger={<Button variant="chip" size="md" rightIcon={<IconChevronDown size={14} />} leftIcon={<IconDownload size={14} />}>Export</Button>}
            items={[
            { label: 'Export all leads (CSV)', icon: <IconDownload size={14} />, onClick: () => onExport('all') },
            { label: 'Export filtered (CSV)', icon: <IconFilter size={14} />, onClick: () => onExport('filtered') },
            { label: 'Export selected (CSV)', icon: <IconCheck size={14} />, onClick: () => onExport('selected') }]
            } />
          
          <Button variant="chip" size="md" onClick={onEdit} leftIcon={<IconEdit size={14} />}>Edit</Button>
          <Button variant="chip" size="md" onClick={onArchive} leftIcon={<IconArchive size={14} />}>Archive</Button>
        </div>
      </div>

      {/* Yelp fetch banner — appears during an active Yelp API fetch. Sits
          above the scraping banner; only one of them can ever be active for
          a given campaign (a campaign's source is fixed). */}
      {yelpRun && campaign.source === 'yelp' && window.YelpFetchBanner && (
        <YelpFetchBanner
          run={yelpRun}
          elapsedMs={yelpElapsedMs}
          onStop={onStopYelpFetch}
          campaignName={campaign.name}
        />
      )}

      {/* Email enrichment banner — appears whenever an EnrichmentRun is
          active for this campaign. Both gmaps + yelp campaigns can be
          enriched (Yelp leads carry websiteUrl per Phase 7 §3). */}
      {enrichRun && (campaign.source === 'gmaps' || campaign.source === 'yelp') && (
        <EnrichmentBanner
          run={enrichRun}
          elapsedMs={enrichElapsedMs}
          onStop={onStopEnrich}
          currentLeadName={enrichRun.currentLeadId ? (leads.find((l) => l.id === enrichRun.currentLeadId)?.name) : ''}
        />
      )}

      {/* Scraping banner */}
      {scraping &&
      <div className="mt-6 rounded-card bg-[#fff7d6] dark:bg-[#3a3206] border border-[#ffd11a]/40 px-5 py-4 flex items-center gap-4 anim-fadein" style={{ borderRadius: "10px" }}>
          <div className="w-10 h-10 rounded-full bg-[#ffd11a]/30 flex items-center justify-center text-[#7a4500] dark:text-[#ffd11a] shrink-0">
            <IconSparkles size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="text-[15px] font-semibold text-ink dark:text-d-ink">Scraping {src.label} in progress…</div>
              <span className="text-[13px] text-body dark:text-d-body">
                <span className="font-semibold text-ink dark:text-d-ink tabular-nums">{scrapingFound}</span> {entity} found · ~3s polling
              </span>
            </div>
            <div className="mt-2 relative h-1 rounded-full bg-[#ffd11a]/20 overflow-hidden">
              <div className="absolute inset-y-0 w-1/3 bg-[#ffd11a] rounded-full bar-indeterm" />
            </div>
          </div>
        </div>
      }

      {/* Stat cards */}
      <div className="mt-6 grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label={`Total ${entity}`} value={stats.total} icon={isLinkedIn ? <IconUser size={18} /> : <IconUser size={18} />} />
        <StatCard label="New" value={stats.new} sub={stats.new > 0 ? `${Math.round(stats.new / Math.max(1, stats.total) * 100)}% of total` : '—'} icon={<IconSparkles size={18} />} />
        <StatCard label={isLinkedIn ? 'Reached out' : 'Contacted'} value={stats.contacted} icon={isLinkedIn ? <IconNetwork size={18} /> : <IconPhone size={18} />} />
        <StatCard label="Conversion" value={`${stats.conversion}%`} sub="replied + closed / total" icon={<IconCheckCircle size={18} />} />
      </div>

      {/* Toolbar */}
      <div className="mt-8 flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-[20px] font-semibold text-ink dark:text-d-ink">{entityCap}</h2>
          <p className="text-[12px] text-mute mt-0.5">{filtered.length} of {leads.length} shown</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Input
            placeholder={isLinkedIn ? 'Search by name, title, company…' : 'Search by name, phone, notes…'}
            value={search} onChange={(e) => setSearch(e.target.value)}
            leftIcon={<IconSearch size={16} />}
            className="w-[280px]" />
          
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-[170px]">
            <option value="ALL">All statuses</option>
            {STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </Select>
        </div>
      </div>

      {/* Leads table card */}
      <Card className="mt-4 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-canvas-soft/60 dark:bg-d-canvas-soft/60">
              <tr className="text-[11px] uppercase tracking-wider text-mute font-semibold">
                <th className="py-3 pl-5 pr-3 w-10">
                  <Checkbox
                    checked={allOnPageSelected}
                    indeterminate={someOnPageSelected}
                    onChange={togglePage} />
                  
                </th>
                {isLinkedIn ? (
                  <>
                    <th className="py-3 px-3">Person</th>
                    <th className="py-3 px-3">Role @ Company</th>
                    <th className="py-3 px-3">Location</th>
                    <th className="py-3 px-3">Connection</th>
                    <th className="py-3 px-3">Notes</th>
                    <th className="py-3 px-3">Added</th>
                    <th className="py-3 px-3 pr-5 text-right">Status</th>
                  </>
                ) : isYelp ? (
                  <>
                    <th className="py-3 px-3">Business</th>
                    <th className="py-3 px-3">Phone</th>
                    <th className="py-3 px-3">Email</th>
                    <th className="py-3 px-3">Rating</th>
                    <th className="py-3 px-3">Neighborhood</th>
                    <th className="py-3 px-3">Notes</th>
                    <th className="py-3 px-3">Added</th>
                    <th className="py-3 px-3 pr-5 text-right">Status</th>
                  </>
                ) : (
                  <>
                    <th className="py-3 px-3">Business</th>
                    <th className="py-3 px-3">Phone</th>
                    <th className="py-3 px-3">Email</th>
                    <th className="py-3 px-3">Website</th>
                    <th className="py-3 px-3">Notes</th>
                    <th className="py-3 px-3">Added</th>
                    <th className="py-3 px-3 pr-5 text-right">Status</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {pageRows.map((l) => {
                const common = {
                  key: l.id, lead: l,
                  selected: selected.has(l.id),
                  onToggle: (on) => toggleOne(l.id, on),
                  onStatusChange: (s) => onLeadStatusChange(l.id, s),
                  onEditNotes: () => setEditingNotes(l),
                };
                if (isLinkedIn) return <LeadRowLinkedIn {...common} />;
                if (isYelp)     return (
                  <LeadRowYelp
                    {...common}
                    justFetched={yelpJustFetched?.has(l.id)}
                    onEditEmail={() => setEditingEmail(l)}
                    searching={enrichRun?.currentLeadId === l.id}
                    justFound={enrichJustFound?.has(l.id)}
                  />
                );
                return (
                  <LeadRow
                    {...common}
                    onEditEmail={() => setEditingEmail(l)}
                    searching={enrichRun?.currentLeadId === l.id}
                    justFound={enrichJustFound?.has(l.id)}
                  />
                );
              })}
              {pageRows.length === 0 &&
              <tr><td colSpan={isLinkedIn ? 8 : isYelp ? 9 : 8} className="py-16 text-center text-mute text-sm">No {entity} match your filters.</td></tr>
              }
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between gap-4 px-5 py-3.5 border-t border-line dark:border-d-line text-[13px]">
          <div className="text-mute">
            Showing <span className="text-ink dark:text-d-ink font-medium">{filtered.length === 0 ? 0 : (page - 1) * pageSize + 1}–{Math.min(filtered.length, page * pageSize)}</span> of {filtered.length}
          </div>
          <div className="flex items-center gap-3">
            <Select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))} className="w-[88px] text-[13px]">
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </Select>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1.5 rounded-[10px] hover:bg-canvas-soft dark:hover:bg-d-canvas-soft text-ink dark:text-d-ink disabled:opacity-30 disabled:cursor-not-allowed">
                <IconChevronLeft size={16} /></button>
              <div className="px-2 text-mute">Page <span className="text-ink dark:text-d-ink font-medium">{page}</span> of {totalPages}</div>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-1.5 rounded-[10px] hover:bg-canvas-soft dark:hover:bg-d-canvas-soft text-ink dark:text-d-ink disabled:opacity-30 disabled:cursor-not-allowed">
                <IconChevronRight size={16} /></button>
            </div>
          </div>
        </div>
      </Card>

      {/* Run history — per-campaign view of the shared component */}
      <div className="mt-6">
        <RunHistoryCard
          runs={seedRunHistory}
          subtitle={`${seedRunHistory.length} runs for this campaign — see all runs on the Manager dashboard`} />
        
      </div>

      {/* Bulk action bar — extracted to <BulkActionsBar />.
          Find Email is enabled for any source whose leads carry websites —
          gmaps + yelp. LinkedIn leads have no website field so the action
          would have nothing to crawl. */}
      <BulkActionsBar
        count={selected.size}
        onClear={clearSelection}
        actions={[
        ...((campaign.source === 'gmaps' || campaign.source === 'yelp') ? [{
          type: 'button',
          label: 'Find email',
          icon: <IconMail size={14} />,
          highlight: true,
          onClick: () => {
            onFindEmails?.(Array.from(selected));
            clearSelection();
          }
        }, { type: 'divider' }] : []),
        // Phase 8 — Inbox button. Pre-flight: filter leads without an email
        // and surface a confirm if some get skipped (§7 of PHASE_8_INBOX.md).
        ...(onOpenInbox ? [{
          type: 'button',
          label: 'Inbox',
          icon: <IconMail size={14} />,
          onClick: () => {
            const ids = Array.from(selected);
            const picked = leads.filter((l) => ids.includes(l.id));
            const withEmail = picked.filter((l) => l.email);
            const missing = picked.length - withEmail.length;
            if (withEmail.length === 0) {
              // toast surfaced upstream; no-op here besides bailing
              onOpenInbox(campaign.id, [], { reason: 'no-emails' });
              clearSelection();
              return;
            }
            if (missing > 0 && !window.confirm(`${missing} of ${picked.length} selected leads have no email and will be skipped.\n\nCreate the thread with the remaining ${withEmail.length} recipient${withEmail.length === 1 ? '' : 's'}?`)) {
              return;
            }
            onOpenInbox(campaign.id, withEmail.map((l) => ({ id: l.id, email: l.email, name: l.name })), { skipped: missing });
            clearSelection();
          }
        }, { type: 'divider' }] : []),
        {
          type: 'menu',
          label: 'Set status',
          items: STATUS_OPTIONS.map((s) => ({
            label: s.label,
            onClick: () => {
              selected.forEach((id) => onLeadStatusChange(id, s.value));
              clearSelection();
            }
          }))
        },
        {
          type: 'button',
          label: 'Export',
          icon: <IconDownload size={14} />,
          onClick: () => onExport('selected')
        },
        { type: 'divider' },
        {
          type: 'button',
          label: 'Delete',
          icon: <IconTrash size={14} />,
          danger: true,
          onClick: clearSelection
        }]
        } />
      

      {/* Notes modal */}
      {editingNotes &&
      <NotesModal
        lead={editingNotes}
        onClose={() => setEditingNotes(null)}
        onSave={(notes) => {onLeadNotesChange(editingNotes.id, notes);setEditingNotes(null);}} />

      }

      {/* Email modal */}
      {editingEmail &&
      <EmailModal
        lead={editingEmail}
        onClose={() => setEditingEmail(null)}
        onSave={(email) => {onLeadEmailChange?.(editingEmail.id, email);setEditingEmail(null);}}
        onFindEmail={() => { onFindEmails?.([editingEmail.id]); setEditingEmail(null); }}
        canEnrich={campaign.source === 'gmaps' || campaign.source === 'yelp'} />
      }
    </div>);

}

Object.assign(window, { CampaignDetailPage });

// ── Reusable status-dropdown cell ──
// Renders <Badge> + chevron; clicking opens a portaled dropdown with the
// status options. Extracted so all three LeadRow* variants share identical
// behaviour without duplicating the portal + outside-click logic.
function StatusCell({ status, onChange }) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState(null);
  const triggerRef = useRef(null);
  const dropdownRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => {
      if (triggerRef.current && triggerRef.current.contains(e.target)) return;
      if (dropdownRef.current && dropdownRef.current.contains(e.target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const measure = () => {
      const r = triggerRef.current?.getBoundingClientRect();
      if (r) setCoords({ top: r.bottom + 6, left: r.left });
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

  const meta = STATUS_OPTIONS.find((s) => s.value === status) || STATUS_OPTIONS[0];

  return (
    <>
      <button ref={triggerRef} onClick={() => setOpen((o) => !o)} className="inline-flex items-center gap-1">
        <Badge tone={meta.tone}>{meta.label}</Badge>
        <IconChevronDown size={12} className={cx('text-mute transition-transform', open && 'rotate-180')} />
      </button>
      {open && coords && ReactDOM.createPortal(
        <div
          ref={dropdownRef}
          style={{ position: 'fixed', top: coords.top, left: coords.left, zIndex: 100 }}
          className="bg-canvas dark:bg-d-canvas border border-line dark:border-d-line rounded-[14px] p-1.5 min-w-[170px] anim-fadein shadow-[0_18px_40px_-16px_rgba(0,0,0,0.25)]">
          {STATUS_OPTIONS.map((s) => (
            <button
              key={s.value}
              onClick={() => { onChange(s.value); setOpen(false); }}
              className={cx(
                'w-full flex items-center justify-between gap-2 px-2.5 py-1.5 text-sm rounded-[10px] hover:bg-canvas-soft dark:hover:bg-d-canvas-soft',
                s.value === status && 'bg-canvas-soft dark:bg-d-canvas-soft'
              )}>
              <Badge tone={s.tone}>{s.label}</Badge>
              {s.value === status && <IconCheck size={14} className="text-positive" />}
            </button>
          ))}
        </div>,
        document.body
      )}
    </>
  );
}

// ── Star rating cell (Yelp) ──
// Compact: one Yelp-red star, the numeric rating, and the review count in
// parens. Resists growing the column — the rating is a glanceable signal,
// not the focus of the row.
function YelpRating({ rating, reviews }) {
  return (
    <div className="inline-flex items-center gap-1 whitespace-nowrap">
      <IconStar size={13} className="text-[#d32323] shrink-0" fill="currentColor" strokeWidth={0} />
      <span className="text-[13px] tabular-nums text-ink dark:text-d-ink font-semibold">{rating.toFixed(1)}</span>
      <span className="text-[11.5px] text-mute tabular-nums">({reviews.toLocaleString()})</span>
    </div>
  );
}

// ── Yelp lead row ──
function LeadRowYelp({ lead, selected, onToggle, onStatusChange, onEditNotes, justFetched, onEditEmail, searching, justFound }) {
  return (
    <tr className={cx(
      'group border-t border-line/60 dark:border-d-line/60 text-[14px]',
      'hover:bg-canvas-soft/60 dark:hover:bg-d-canvas-soft/60 transition-colors',
      selected && 'bg-primary-pale/40 dark:bg-primary/10',
      (justFetched || justFound) && 'flash-found'
    )}>
      <td className="py-3.5 pl-5 pr-3"><Checkbox checked={selected} onChange={onToggle} /></td>

      <td className="py-3.5 px-3">
        <div className="flex items-center gap-2">
          <div className="font-semibold text-ink dark:text-d-ink truncate max-w-[200px]">{lead.name}</div>
          {lead.claimed && (
            <span title="Claimed on Yelp" className="text-positive shrink-0"><IconCheckCircle size={13} /></span>
          )}
        </div>
        <div className="text-[12px] text-mute mt-0.5 truncate max-w-[220px]">{lead.primaryCategory}</div>
      </td>

      <td className="py-3.5 px-3 whitespace-nowrap">
        {lead.phone ? (
          <a href={`tel:${lead.phone}`} className="text-body dark:text-d-body hover:text-ink dark:hover:text-d-ink tabular-nums inline-flex items-center gap-1.5">
            <IconPhone size={12} className="text-mute" />{lead.phone}
          </a>
        ) : <span className="text-mute">—</span>}
      </td>

      {/* Email cell — same vocabulary as gmaps. Yelp leads carry a websiteUrl
          so Phase 6 enrichment works on them with zero source-specific code
          (Phase 7 §3). Clicking opens the EmailModal with the Find-email
          auto-panel for leads that don't have an email yet. */}
      <td className="py-3.5 px-3 min-w-[200px]">
        {lead.email ? (
          <button onClick={onEditEmail} className={cx(
            'inline-flex items-center gap-1.5 text-body dark:text-d-body hover:text-ink dark:hover:text-d-ink truncate max-w-[220px]',
            justFound && 'pop-email text-ink dark:text-d-ink font-medium'
          )} title={lead.email}>
            <IconMail size={12} className={cx('shrink-0', justFound ? 'text-primary' : 'text-mute')} />
            <span className="truncate">{lead.email}</span>
            {justFound && <IconSparkles size={11} className="text-positive shrink-0" />}
          </button>
        ) : searching ? (
          <SearchingPill />
        ) : (
          <button onClick={onEditEmail} className="text-mute hover:text-ink dark:hover:text-d-ink text-[13px] inline-flex items-center gap-1 opacity-70 group-hover:opacity-100 transition-opacity whitespace-nowrap">
            <IconMail size={12} /> Add email
          </button>
        )}
      </td>

      {/* Rating + Price stacked: one red star + numeric rating + review count
          on top; dollar-signs row below. Kept narrow on purpose — this is
          glanceable metadata, not the row's focal point. */}
      <td className="py-3.5 px-3 w-[1%] whitespace-nowrap">
        <div className="flex flex-col gap-0.5">
          <YelpRating rating={lead.rating} reviews={lead.reviews} />
          <div className="leading-none">
            <span className="text-[12px] font-semibold text-positive tabular-nums">{lead.price}</span>
            <span className="text-[12px] text-line dark:text-d-line tabular-nums">{'$$$$'.slice(lead.price.length)}</span>
          </div>
        </div>
      </td>

      <td className="py-3.5 px-3 max-w-[180px]">
        <span className="inline-flex items-center gap-1 text-[12px] font-medium text-body dark:text-d-body bg-canvas-soft dark:bg-d-canvas-soft rounded-full px-2.5 py-1 truncate max-w-[170px]">
          <IconMapPin size={10} />{lead.neighborhood}
        </span>
      </td>

      <td className="py-3.5 px-3 max-w-[260px]">
        {lead.notes ?
          <button onClick={onEditNotes} className="text-left text-[13px] text-body dark:text-d-body hover:text-ink dark:hover:text-d-ink line-clamp-1 max-w-[240px]">
            {lead.notes}
          </button> :
          <button onClick={onEditNotes} className="text-mute hover:text-ink dark:hover:text-d-ink text-[13px] inline-flex items-center gap-1 opacity-70 group-hover:opacity-100 transition-opacity">
            <IconNote size={12} /> Add note
          </button>
        }
      </td>

      <td className="py-3.5 px-3 text-[12px] text-mute">{lead.addedAt}</td>

      <td className="py-3.5 px-3 pr-5 text-right">
        <StatusCell status={lead.status} onChange={onStatusChange} />
      </td>
    </tr>
  );
}

// ── LinkedIn lead row ──
// No phone, no website. Profile URL is the canonical handle. Connection
// degree gets its own pill with brand-neutral color (we don't ape LinkedIn's
// exact UI here).
function LeadRowLinkedIn({ lead, selected, onToggle, onStatusChange, onEditNotes }) {
  const degreeTone = lead.degree === '2nd' ? 'positive' : lead.degree === '3rd' ? 'warning' : 'mute';
  return (
    <tr className={cx(
      'group border-t border-line/60 dark:border-d-line/60 text-[14px]',
      'hover:bg-canvas-soft/60 dark:hover:bg-d-canvas-soft/60 transition-colors',
      selected && 'bg-primary-pale/40 dark:bg-primary/10'
    )}>
      <td className="py-3.5 pl-5 pr-3"><Checkbox checked={selected} onChange={onToggle} /></td>

      <td className="py-3.5 px-3">
        <div className="flex items-center gap-2.5">
          {/* Avatar fallback — initials */}
          <div className="w-9 h-9 rounded-full bg-canvas-soft dark:bg-d-canvas-soft text-ink dark:text-d-ink flex items-center justify-center text-[12px] font-semibold shrink-0">
            {lead.name.split(' ').map(p => p[0]).slice(0, 2).join('')}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <div className="font-semibold text-ink dark:text-d-ink truncate max-w-[180px]">{lead.name}</div>
              {lead.premium && (
                <span title="LinkedIn Premium" className="text-[#b88300] dark:text-[#ffd11a] text-[10px] font-bold border border-current rounded-[3px] px-1 leading-tight">in</span>
              )}
            </div>
            <a href={`https://www.linkedin.com/in/${lead.profileSlug}`} target="_blank" rel="noreferrer"
              className="text-[11px] text-mute hover:text-ink dark:hover:text-d-ink inline-flex items-center gap-1 mt-0.5">
              /in/{lead.profileSlug} <IconExternal size={10} />
            </a>
          </div>
        </div>
      </td>

      <td className="py-3.5 px-3 max-w-[260px]">
        <div className="font-medium text-ink dark:text-d-ink truncate max-w-[240px]">{lead.role}</div>
        <div className="text-[12px] text-mute mt-0.5 truncate max-w-[240px] inline-flex items-center gap-1">
          <IconBuilding size={10} />{lead.company}
        </div>
      </td>

      <td className="py-3.5 px-3">
        <span className="inline-flex items-center gap-1 text-[12px] font-medium text-body dark:text-d-body bg-canvas-soft dark:bg-d-canvas-soft rounded-full px-2.5 py-1">
          <IconMapPin size={10} />{lead.location}
        </span>
      </td>

      <td className="py-3.5 px-3">
        <div className="flex items-center gap-2">
          <Badge tone={degreeTone} size="sm">{lead.degree}</Badge>
          {lead.mutuals > 0 && (
            <span className="text-[11px] text-mute tabular-nums inline-flex items-center gap-1">
              <IconNetwork size={11} />{lead.mutuals} mutual{lead.mutuals === 1 ? '' : 's'}
            </span>
          )}
        </div>
      </td>

      <td className="py-3.5 px-3 max-w-[260px]">
        {lead.notes ?
          <button onClick={onEditNotes} className="text-left text-[13px] text-body dark:text-d-body hover:text-ink dark:hover:text-d-ink line-clamp-1 max-w-[240px]">
            {lead.notes}
          </button> :
          <button onClick={onEditNotes} className="text-mute hover:text-ink dark:hover:text-d-ink text-[13px] inline-flex items-center gap-1 opacity-70 group-hover:opacity-100 transition-opacity">
            <IconNote size={12} /> Add note
          </button>
        }
      </td>

      <td className="py-3.5 px-3 text-[12px] text-mute">{lead.addedAt}</td>

      <td className="py-3.5 px-3 pr-5 text-right">
        <StatusCell status={lead.status} onChange={onStatusChange} />
      </td>
    </tr>
  );
}

Object.assign(window, { StatusCell, YelpRating, LeadRowYelp, LeadRowLinkedIn });

function LeadRow({ lead, selected, onToggle, onStatusChange, onEditNotes, onEditEmail, searching, justFound }) {
  const [statusOpen, setStatusOpen] = useState(false);
  const [coords, setCoords] = useState(null);
  const triggerRef = useRef(null);
  const dropdownRef = useRef(null);

  // Outside-click: ignore clicks inside trigger OR portaled dropdown
  useEffect(() => {
    if (!statusOpen) return;
    const onDoc = (e) => {
      if (triggerRef.current && triggerRef.current.contains(e.target)) return;
      if (dropdownRef.current && dropdownRef.current.contains(e.target)) return;
      setStatusOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [statusOpen]);

  // Reposition while open (close on scroll for simplicity — fixed pos doesn't follow)
  useEffect(() => {
    if (!statusOpen) return;
    const measure = () => {
      const r = triggerRef.current?.getBoundingClientRect();
      if (r) setCoords({ top: r.bottom + 6, left: r.left });
    };
    measure();
    const onScroll = () => setStatusOpen(false);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', measure);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', measure);
    };
  }, [statusOpen]);

  const toggle = () => setStatusOpen((o) => !o);
  const statusMeta = STATUS_OPTIONS.find((s) => s.value === lead.status) || STATUS_OPTIONS[0];

  return (
    <tr className={cx(
      'group border-t border-line/60 dark:border-d-line/60 text-[14px]',
      'hover:bg-canvas-soft/60 dark:hover:bg-d-canvas-soft/60 transition-colors',
      selected && 'bg-primary-pale/40 dark:bg-primary/10',
      justFound && 'flash-found'
    )}>
      <td className="py-3.5 pl-5 pr-3">
        <Checkbox checked={selected} onChange={onToggle} />
      </td>
      <td className="py-3.5 px-3">
        <div className="font-semibold text-ink dark:text-d-ink truncate max-w-[220px]">{lead.name}</div>
      </td>
      <td className="py-3.5 px-3">
        <a href={`tel:${lead.phone}`} className="text-body dark:text-d-body hover:text-ink dark:hover:text-d-ink tabular-nums inline-flex items-center gap-1.5">
          <IconPhone size={12} className="text-mute" />
          {lead.phone}
        </a>
      </td>
      <td className="py-3.5 px-3 max-w-[200px]">
        {lead.email ?
        <button onClick={onEditEmail} className={cx(
          'inline-flex items-center gap-1.5 text-body dark:text-d-body hover:text-ink dark:hover:text-d-ink truncate max-w-[180px]',
          justFound && 'pop-email text-ink dark:text-d-ink font-medium'
        )} title={lead.email}>
            <IconMail size={12} className={cx('shrink-0', justFound ? 'text-primary' : 'text-mute')} />
            <span className="truncate">{lead.email}</span>
            {justFound && <IconSparkles size={11} className="text-positive shrink-0" />}
          </button> :
        searching ?
        <SearchingPill /> :
        <button onClick={onEditEmail} className="text-mute hover:text-ink dark:hover:text-d-ink text-[13px] inline-flex items-center gap-1 opacity-70 group-hover:opacity-100 transition-opacity">
            <IconMail size={12} /> Add email
          </button>
        }
      </td>
      <td className="py-3.5 px-3">
        {lead.website ?
        <a href={`https://${lead.website}`} target="_blank" rel="noreferrer"
        className="text-body dark:text-d-body hover:text-ink dark:hover:text-d-ink inline-flex items-center gap-1 max-w-[180px] truncate">
            {lead.website}
            <IconExternal size={11} className="text-mute shrink-0" />
          </a> :
        <span className="text-mute">—</span>}
      </td>
      <td className="py-3.5 px-3 max-w-[260px]">
        {lead.notes ?
        <button onClick={onEditNotes} className="text-left text-[13px] text-body dark:text-d-body hover:text-ink dark:hover:text-d-ink line-clamp-1 max-w-[240px]">
            {lead.notes}
          </button> :

        <button onClick={onEditNotes} className="text-mute hover:text-ink dark:hover:text-d-ink text-[13px] inline-flex items-center gap-1 opacity-70 group-hover:opacity-100 transition-opacity">
            <IconNote size={12} /> Add note
          </button>
        }
      </td>
      <td className="py-3.5 px-3 text-[12px] text-mute">{lead.addedAt}</td>
      <td className="py-3.5 px-3 pr-5 text-right">
        <button
          ref={triggerRef}
          onClick={toggle}
          className="inline-flex items-center gap-1">
          
          <Badge tone={statusMeta.tone}>{statusMeta.label}</Badge>
          <IconChevronDown size={12} className={cx('text-mute transition-transform', statusOpen && 'rotate-180')} />
        </button>
        {statusOpen && coords && ReactDOM.createPortal(
          <div
            ref={dropdownRef}
            style={{ position: 'fixed', top: coords.top, left: coords.left, zIndex: 100 }}
            className="bg-canvas dark:bg-d-canvas border border-line dark:border-d-line rounded-[14px] p-1.5 min-w-[170px] anim-fadein shadow-[0_18px_40px_-16px_rgba(0,0,0,0.25)]">
            
            {STATUS_OPTIONS.map((s) =>
            <button
              key={s.value}
              onClick={() => {onStatusChange(s.value);setStatusOpen(false);}}
              className={cx(
                'w-full flex items-center justify-between gap-2 px-2.5 py-1.5 text-sm rounded-[10px] hover:bg-canvas-soft dark:hover:bg-d-canvas-soft',
                s.value === lead.status && 'bg-canvas-soft dark:bg-d-canvas-soft'
              )}>
              
                <Badge tone={s.tone}>{s.label}</Badge>
                {s.value === lead.status && <IconCheck size={14} className="text-positive" />}
              </button>
            )}
          </div>,
          document.body
        )}
      </td>
    </tr>);

}

function EmailModal({ lead, onClose, onSave, onFindEmail, canEnrich }) {
  const [text, setText] = useState(lead.email || '');
  const [error, setError] = useState('');
  const hasExisting = !!lead.email;
  const submit = () => {
    const v = text.trim();
    if (v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
      setError('That doesn\'t look like a valid email');
      return;
    }
    onSave(v);
  };
  const cleanDomain = (lead.website || '').replace(/^https?:\/\//, '').replace(/\/$/, '');
  return (
    <Modal open={true} onClose={onClose} width={520}>
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="text-[18px] font-semibold text-ink dark:text-d-ink">Email for {lead.name}</h2>
          <p className="text-[12px] text-mute mt-0.5">
            {canEnrich
              ? <>Auto-find crawls the lead’s website (homepage → contact pages) and stops at the first verified address. Or type one in manually.</>
              : <>Manually entered — emails aren’t scraped from this source.</>}
          </p>
        </div>
        <button onClick={onClose} className="text-mute hover:text-ink dark:hover:text-d-ink p-1"><IconX size={18} /></button>
      </div>

      {/* Auto-find panel — gmaps leads w/ no existing email. Primary action. */}
      {canEnrich && !hasExisting && (
        <div className="mb-5 border border-primary/40 bg-primary-pale/50 dark:bg-primary/10 p-4" style={{ borderRadius: '14px' }}>
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-full bg-primary text-ink flex items-center justify-center shrink-0">
              <IconSparkles size={16} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[14px] font-semibold text-ink dark:text-d-ink">Find it automatically</div>
              <div className="text-[12.5px] text-body dark:text-d-body mt-0.5">
                We’ll crawl <span className="font-medium text-ink dark:text-d-ink">{cleanDomain || 'the website'}</span> and pull a real contact email. Usually 1–2 seconds.
              </div>
            </div>
            <Button variant="primary" size="md" onClick={onFindEmail} leftIcon={<IconMail size={14} />}>
              Find email
            </Button>
          </div>
          <div className="mt-3 pl-12 text-[11.5px] text-mute leading-relaxed">
            Skips placeholder addresses and image filenames · prefers <span className="font-medium text-body dark:text-d-body">@{cleanDomain || 'domain.com'}</span> over third-party addresses
          </div>
        </div>
      )}

      {/* Manual entry */}
      <div className="flex items-center justify-between mb-2">
        <label className="text-[11px] uppercase tracking-wider font-semibold text-mute">
          {canEnrich && !hasExisting ? 'Or enter manually' : 'Email address'}
        </label>
        {hasExisting && canEnrich && (
          <button onClick={onFindEmail} className="text-[12px] text-mute hover:text-ink dark:hover:text-d-ink inline-flex items-center gap-1">
            <IconRotate size={11} /> Re-find
          </button>
        )}
      </div>
      <Input
        autoFocus={hasExisting}
        type="email"
        value={text}
        onChange={(e) => {setText(e.target.value);setError('');}}
        placeholder="client@example.com"
        leftIcon={<IconMail size={16} />} />
      {error && <div className="text-[12px] text-negative mt-2">{error}</div>}
      <div className="mt-5 flex items-center justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="primary" onClick={submit} leftIcon={<IconCheck size={14} />}>Save email</Button>
      </div>
    </Modal>);

}

function NotesModal({ lead, onClose, onSave }) {
  const [text, setText] = useState(lead.notes || '');
  return (
    <Modal open={true} onClose={onClose} width={520}>
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="text-[18px] font-semibold text-ink dark:text-d-ink">Note for {lead.name}</h2>
          <p className="text-[12px] text-mute mt-0.5">Saved changes are tracked in lead_history.</p>
        </div>
        <button onClick={onClose} className="text-mute hover:text-ink dark:hover:text-d-ink p-1"><IconX size={18} /></button>
      </div>
      <textarea
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="What's worth remembering about this lead?"
        rows={6}
        className="w-full bg-canvas dark:bg-d-canvas text-ink dark:text-d-ink border border-line dark:border-d-line rounded-[14px] px-4 py-3 text-[14px] placeholder:text-mute focus:outline-none focus:ring-2 focus:ring-primary" />
      
      <div className="mt-5 flex items-center justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="primary" onClick={() => onSave(text)} leftIcon={<IconCheck size={14} />}>Save note</Button>
      </div>
    </Modal>);

}

Object.assign(window, { CampaignDetailPage });