// ───────── Campaign Detail Page ─────────

function CampaignDetailPage({ campaign, leads, onBack, onRun, onArchive, onEdit, scraping, onStopScraping, scrapingFound, onLeadStatusChange, onLeadNotesChange, onLeadEmailChange, onExport }) {
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
      const matchSearch = !search || (l.name + l.phone + l.website + (l.email || '') + l.notes).toLowerCase().includes(search.toLowerCase());
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
        
        <IconChevronLeft size={14} /> All campaigns
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
            <IconMapPin size={11} /> USA <span className="text-line dark:text-d-line">›</span> {campaign.state} <span className="text-line dark:text-d-line">›</span> {campaign.city || 'Entire State'}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {scraping ?
          <Button variant="destructive" size="md" onClick={onStopScraping} leftIcon={<IconStop size={14} />}>
              Stop scraping
            </Button> :

          <Button variant="primary" size="md" onClick={onRun} leftIcon={<IconPlay size={14} />}>
              Run campaign
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

      {/* Scraping banner */}
      {scraping &&
      <div className="mt-6 rounded-card bg-[#fff7d6] dark:bg-[#3a3206] border border-[#ffd11a]/40 px-5 py-4 flex items-center gap-4 anim-fadein" style={{ borderRadius: "10px" }}>
          <div className="w-10 h-10 rounded-full bg-[#ffd11a]/30 flex items-center justify-center text-[#7a4500] dark:text-[#ffd11a] shrink-0">
            <IconSparkles size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="text-[15px] font-semibold text-ink dark:text-d-ink">Scraping in progress…</div>
              <span className="text-[13px] text-body dark:text-d-body">
                <span className="font-semibold text-ink dark:text-d-ink tabular-nums">{scrapingFound}</span> leads found · ~3s polling
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
        <StatCard label="Total leads" value={stats.total} icon={<IconUser size={18} />} />
        <StatCard label="New" value={stats.new} sub={stats.new > 0 ? `${Math.round(stats.new / Math.max(1, stats.total) * 100)}% of total` : '—'} icon={<IconSparkles size={18} />} />
        <StatCard label="Contacted" value={stats.contacted} icon={<IconPhone size={18} />} />
        <StatCard label="Conversion" value={`${stats.conversion}%`} sub="replied + closed / total" icon={<IconCheckCircle size={18} />} />
      </div>

      {/* Toolbar */}
      <div className="mt-8 flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-[20px] font-semibold text-ink dark:text-d-ink">Leads</h2>
          <p className="text-[12px] text-mute mt-0.5">{filtered.length} of {leads.length} shown</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Input
            placeholder="Search by name, phone, notes…"
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
                <th className="py-3 px-3">Business</th>
                <th className="py-3 px-3">Phone</th>
                <th className="py-3 px-3">Email</th>
                <th className="py-3 px-3">Website</th>
                <th className="py-3 px-3">Notes</th>
                <th className="py-3 px-3">Added</th>
                <th className="py-3 px-3 pr-5 text-right">Status</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((l) =>
              <LeadRow
                key={l.id} lead={l}
                selected={selected.has(l.id)}
                onToggle={(on) => toggleOne(l.id, on)}
                onStatusChange={(s) => onLeadStatusChange(l.id, s)}
                onEditNotes={() => setEditingNotes(l)}
                onEditEmail={() => setEditingEmail(l)} />

              )}
              {pageRows.length === 0 &&
              <tr><td colSpan={8} className="py-16 text-center text-mute text-sm">No leads match your filters.</td></tr>
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

      {/* Bulk action bar — extracted to <BulkActionsBar /> */}
      <BulkActionsBar
        count={selected.size}
        onClear={clearSelection}
        actions={[
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
        onSave={(email) => {onLeadEmailChange?.(editingEmail.id, email);setEditingEmail(null);}} />
      }
    </div>);

}

Object.assign(window, { CampaignDetailPage });

function LeadRow({ lead, selected, onToggle, onStatusChange, onEditNotes, onEditEmail }) {
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
      selected && 'bg-primary-pale/40 dark:bg-primary/10'
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
        <button onClick={onEditEmail} className="inline-flex items-center gap-1.5 text-body dark:text-d-body hover:text-ink dark:hover:text-d-ink truncate max-w-[180px]" title={lead.email}>
            <IconMail size={12} className="text-mute shrink-0" />
            <span className="truncate">{lead.email}</span>
          </button> :

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

function EmailModal({ lead, onClose, onSave }) {
  const [text, setText] = useState(lead.email || '');
  const [error, setError] = useState('');
  const submit = () => {
    const v = text.trim();
    if (v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
      setError('That doesn\'t look like a valid email');
      return;
    }
    onSave(v);
  };
  return (
    <Modal open={true} onClose={onClose} width={480}>
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="text-[18px] font-semibold text-ink dark:text-d-ink">Email for {lead.name}</h2>
          <p className="text-[12px] text-mute mt-0.5">Manually entered — emails aren't scraped from Google Maps.</p>
        </div>
        <button onClick={onClose} className="text-mute hover:text-ink dark:hover:text-d-ink p-1"><IconX size={18} /></button>
      </div>
      <Input
        autoFocus
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