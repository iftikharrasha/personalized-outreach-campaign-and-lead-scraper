// ───────── Screens ─────────

// ── Sidebar (inverted palette) ──
function Sidebar({ collapsed, onToggle, active = 'home', onNavigate }) {
  const items = [
    { id: 'home',     icon: <IconLayout    size={20} />, label: 'Outrich Manager' },
    { id: 'gmaps',    icon: <IconMapPin    size={20} />, label: 'Google Maps' },
    { id: 'yelp',     icon: <IconStar      size={20} />, label: 'Yelp' },
    { id: 'linkedin', icon: <IconBriefcase size={20} />, label: 'LinkedIn' },
  ];

  const futureItems = [
    { id: 'instagram',  icon: <IconGlobe size={20} />, label: 'Instagram',  soon: true },
    { id: 'ypages',     icon: <IconNetwork size={20} />, label: 'YellowPages', soon: true },
  ];
  // Sidebar is inverted vs main content:
  //   light theme  → ink (near-black) sidebar with light text
  //   dark theme   → canvas (off-white) sidebar with ink text
  // Tailwind utility classes below all read "light value dark:dark value".

  return (
    <aside
      className={cx(
        'relative shrink-0 sticky top-0 h-screen flex flex-col transition-all duration-200',
        'bg-ink text-canvas-soft dark:bg-canvas dark:text-ink',
        'border-r border-black/20 dark:border-line',
        collapsed ? 'w-[64px]' : 'w-[240px]'
      )}>

      {/* Logo */}
      <div className={cx('flex items-center gap-2.5 h-16 px-4', collapsed && 'justify-center px-0')}>
        <LogoMark size={28} />
        {!collapsed &&
        <div className="leading-tight">
            <div className="text-[15px] font-bold text-canvas dark:text-ink">Outrich</div>
            <div className="text-[11px] text-canvas-soft/55 dark:text-mute -mt-0.5">Lead Scraper</div>
          </div>
        }
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 pt-4">
        <div className={cx('px-3 mb-2 text-[11px] uppercase tracking-wider font-semibold', 'text-canvas-soft/45 dark:text-mute', collapsed && 'hidden')}>
          Workspace
        </div>
        <ul className="space-y-1">
          {items.map((it) => {
            const isActive = it.id === active;
            return (
              <li key={it.id}>
                <a
                  href="#"
                  onClick={(e) => {e.preventDefault();onNavigate?.(it.id);}}
                  className={cx(
                    'relative flex items-center gap-3 rounded-[14px] px-3 py-2.5 text-[14px] font-medium transition-colors',
                    isActive ?
                    'bg-primary/20 text-canvas dark:bg-primary-pale dark:text-ink' :
                    'text-canvas-soft/75 hover:bg-white/[0.07] hover:text-canvas dark:text-body dark:hover:bg-canvas-soft dark:hover:text-ink',
                    collapsed && 'justify-center px-0'
                  )}>
                  
                  {isActive && <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-full bg-primary" />}
                  <span className={cx(isActive ? 'text-canvas dark:text-ink' : 'text-canvas-soft/55 dark:text-mute')}>{it.icon}</span>
                  {!collapsed && <span className="truncate">{it.label}</span>}
                </a>
              </li>);

          })}
        </ul>

        {/* Coming soon sources */}
        <div className={cx('px-3 mt-6 mb-2 text-[11px] uppercase tracking-wider font-semibold', 'text-canvas-soft/45 dark:text-mute', collapsed && 'hidden')}>
          Coming soon
        </div>
        <ul className="space-y-1">
          {futureItems.map((it) =>
          <li key={it.id}>
              <span
              className={cx(
                'relative flex items-center gap-3 rounded-[14px] px-3 py-2.5 text-[14px] font-medium cursor-not-allowed',
                'text-canvas-soft/35 dark:text-mute',
                collapsed && 'justify-center px-0'
              )}
              title={`${it.label} — coming in v2`}>
              
                <span>{it.icon}</span>
                {!collapsed &&
              <span className="flex items-center gap-2 truncate">
                    {it.label}
                    <span className="text-[10px] uppercase tracking-wide bg-white/10 dark:bg-canvas-soft text-canvas-soft/70 dark:text-mute px-1.5 py-0.5 rounded-full">v2</span>
                  </span>
              }
              </span>
            </li>
          )}
        </ul>
      </nav>

      {/* Account row — collapse toggle sits to the right, aligned with the
          "You / localhost" block. « when expanded, » when collapsed. */}
      <div className="border-t border-white/10 dark:border-line p-2">
        <div className={cx('flex items-center gap-3 px-3 py-2', collapsed && 'justify-center px-0')}>
          <div className="w-8 h-8 rounded-full bg-primary text-ink flex items-center justify-center text-xs font-semibold">YA</div>
          {!collapsed && (
            <div className="leading-tight min-w-0 flex-1">
              <div className="text-[13px] font-semibold text-canvas dark:text-ink truncate">You</div>
              <div className="text-[11px] text-canvas-soft/55 dark:text-mute truncate">localhost</div>
            </div>
          )}
          {!collapsed && (
            <button
              onClick={onToggle}
              aria-label="Collapse sidebar"
              className={cx(
                'shrink-0 w-7 h-7 rounded-full flex items-center justify-center',
                'bg-white/10 text-canvas hover:bg-white/20',
                'dark:bg-canvas-soft dark:text-ink dark:hover:bg-line',
                'transition-colors'
              )}
            >
              <IconChevronsLeft size={13} />
            </button>
          )}
        </div>
        {collapsed && (
          <button
            onClick={onToggle}
            aria-label="Expand sidebar"
            className={cx(
              'mt-1 mx-auto flex w-7 h-7 rounded-full items-center justify-center',
              'bg-white/10 text-canvas hover:bg-white/20',
              'dark:bg-canvas-soft dark:text-ink dark:hover:bg-line',
              'transition-colors'
            )}
          >
            <IconChevronsLeft size={13} className="rotate-180" />
          </button>
        )}
      </div>
    </aside>);

}

// ── Header (breadcrumb + theme toggle) ──
function Header({ onMenuClick, breadcrumb, dark, onToggleDark }) {
  return (
    <header className="sticky top-0 z-20 h-16 bg-canvas/90 dark:bg-d-canvas/90 backdrop-blur border-b border-line dark:border-d-line">
      <div className="h-full flex items-center justify-between px-6">
        <div className="flex items-center gap-3">
          <button
            onClick={onMenuClick}
            className="md:hidden p-2 rounded-[10px] hover:bg-canvas-soft dark:hover:bg-d-canvas-soft text-ink dark:text-d-ink"
            aria-label="Toggle menu">
            <IconMenu size={18} />
          </button>
          <div className="text-[13px] text-mute flex items-center gap-1.5">
            {breadcrumb?.map((b, i) =>
              <React.Fragment key={i}>
                {i > 0 && <span className="text-line dark:text-d-line">/</span>}
                <span className={i === breadcrumb.length - 1 ? 'text-ink dark:text-d-ink font-medium' : ''}>{b}</span>
              </React.Fragment>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onToggleDark}
            className="p-2.5 rounded-full hover:bg-canvas-soft dark:hover:bg-d-canvas-soft text-ink dark:text-d-ink"
            aria-label="Toggle dark mode">
            {dark ? <IconSun size={18} /> : <IconMoon size={18} />}
          </button>
        </div>
      </div>
    </header>);
}

// ── Campaign card ──
function CampaignCard({ c, onOpen, onRun, onPause, onRestore, onArchive }) {
  const isArchived = c.status === 'ARCHIVED';
  const isPaused = c.status === 'PAUSED';
  const isLinkedIn = c.source === 'linkedin';
  const isYelp     = c.source === 'yelp';
  const leadNoun   = isLinkedIn ? 'People' : 'Leads';

  // Location chip differs per source:
  //   gmaps / yelp  → "USA · CA · San Diego"
  //   linkedin      → "Software · SF Bay Area"  (industry + metro)
  const locationChip = isLinkedIn ? (
    <span className="inline-flex items-center gap-1 text-[11.5px] font-medium text-body dark:text-d-body bg-canvas-soft dark:bg-d-canvas-soft rounded-full px-2.5 py-1">
      <IconBriefcase size={11} />
      {c.industry || 'Any industry'} · {c.city}
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-[11.5px] font-medium text-body dark:text-d-body bg-canvas-soft dark:bg-d-canvas-soft rounded-full px-2.5 py-1">
      <IconMapPin size={11} />
      USA · {abbrevState(c.state)} · {c.city}
    </span>
  );

  return (
    <Card className="p-6 group hover:translate-y-[-2px] transition-transform duration-200 cursor-default flex flex-col gap-4">
      {/* Top: name + menu */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-[17px] font-semibold text-ink dark:text-d-ink leading-snug truncate">{c.name}</h3>
          <div className="text-[13px] text-mute mt-0.5 truncate">{c.keyword}</div>
        </div>
        <Menu
          trigger={
          <button className="p-1.5 -mr-1.5 rounded-[10px] text-mute hover:text-ink dark:hover:text-d-ink hover:bg-canvas-soft dark:hover:bg-d-canvas-soft opacity-0 group-hover:opacity-100 transition-opacity">
              <IconMoreH size={18} />
            </button>
          }
          items={[
          { label: 'Edit', icon: <IconEdit size={14} />, onClick: () => onOpen(c) },
          { label: 'Duplicate', icon: <IconPlus size={14} />, onClick: () => {} },
          { divider: true },
          { label: isArchived ? 'Restore' : 'Archive', icon: <IconArchive size={14} />, onClick: () => isArchived ? onRestore(c) : onArchive(c) }]
          } />
        
      </div>

      {/* Location pill + status */}
      <div className="flex items-center gap-2 flex-wrap">
        {locationChip}
        <StatusDot status={c.status} />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className="text-[26px] font-bold leading-none text-ink dark:text-d-ink tabular-nums">{c.totalLeads}</div>
          <div className="text-[11px] text-mute mt-1 uppercase tracking-wide">{leadNoun}</div>
        </div>
        <div>
          <div className="text-[26px] font-bold leading-none text-ink dark:text-d-ink tabular-nums">{c.contacted}</div>
          <div className="text-[11px] text-mute mt-1 uppercase tracking-wide">{isLinkedIn ? 'Reached out' : 'Contacted'}</div>
        </div>
      </div>

      {/* Progress */}
      <div>
        <Progress value={c.progress} />
        <div className="mt-2 flex items-center justify-between text-[12px]">
          <span className="text-mute">Outreach progress</span>
          <span className="font-semibold text-ink dark:text-d-ink">{c.progress}%</span>
        </div>
      </div>

      {/* Footer line */}
      <div className="text-[12px] text-mute flex items-center gap-1.5">
        <IconHistory size={12} />
        Last run {c.lastRun} · <span className="text-positive font-medium">+{c.newSinceLast} new</span>
      </div>

      {/* Buttons */}
      <div className="flex items-center gap-2 pt-1">
        <Button size="sm" variant="secondary" onClick={() => onOpen(c)} className="flex-1">Open</Button>
        {!isArchived &&
        <Button
          size="sm"
          variant="primary"
          onClick={() => onRun(c)}
          leftIcon={<IconPlay size={13} />}
          disabled={isPaused}
          className="flex-1">
          Run</Button>
        }
        {!isArchived &&
        <Button size="sm" variant="ghost"
        onClick={() => isPaused ? onRestore(c) : onPause(c)}
        leftIcon={isPaused ? <IconPlay size={13} /> : <IconPause size={13} />}
        className="!px-3"
        aria-label={isPaused ? 'Resume' : 'Pause'} />

        }
        {isArchived &&
        <Button size="sm" variant="secondary" onClick={() => onRestore(c)} className="flex-1">Restore</Button>
        }
      </div>
    </Card>);

}

function abbrevState(name) {
  const map = { California: 'CA', 'New York': 'NY', Illinois: 'IL', Texas: 'TX', Florida: 'FL', Washington: 'WA', Massachusetts: 'MA', Colorado: 'CO', Georgia: 'GA', Oregon: 'OR' };
  return map[name] || (name || '').slice(0, 2).toUpperCase();
}

// ── Campaign list page ──
function CampaignListPage({ campaigns, onOpen, onRun, onCreate, onPause, onRestore, onArchive, emptyState, source = 'gmaps' }) {
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState('all');
  const src = SOURCES[source] || SOURCES.gmaps;

  const filtered = useMemo(() => {
    return campaigns.filter((c) => {
      const matchSearch = !search || (c.name + c.keyword).toLowerCase().includes(search.toLowerCase());
      const matchTab = tab === 'all' || c.status.toLowerCase() === tab;
      return matchSearch && matchTab;
    });
  }, [campaigns, search, tab]);

  const counts = useMemo(() => ({
    all: campaigns.length,
    active: campaigns.filter((c) => c.status === 'ACTIVE').length,
    paused: campaigns.filter((c) => c.status === 'PAUSED').length,
    archived: campaigns.filter((c) => c.status === 'ARCHIVED').length
  }), [campaigns]);

  if (emptyState) {
    return (
      <div className="px-8 py-10">
        <PageHeader title={`${src.label} campaigns`} actions={<Button variant="primary" size="lg" leftIcon={<IconPlus size={16} />} onClick={onCreate}>New Campaign</Button>} />
        <EmptyState onCreate={onCreate} source={source} />
      </div>);

  }

  const totalLeads = campaigns.reduce((s, c) => s + c.totalLeads, 0);
  const noun = src.leadEntity;

  return (
    <div className="px-8 py-10 max-w-[1480px] mx-auto">
      <PageHeader
        title={`${src.label} campaigns`}
        subtitle={`${counts.active} active · ${totalLeads.toLocaleString()} ${noun} scraped`}
        actions={
        <Button variant="primary" size="lg" leftIcon={<IconPlus size={16} />} onClick={onCreate}>
            New Campaign
          </Button>
        } />
      

      {/* Filter row */}
      <div className="mt-8 flex flex-wrap items-center gap-3 justify-between">
        <div className="flex items-center gap-3 flex-1 min-w-[280px] max-w-[420px]">
          <Input
            placeholder="Search campaigns…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            leftIcon={<IconSearch size={16} />}
            className="flex-1" />
          
        </div>
        <Tabs
          value={tab}
          onChange={setTab}
          items={[
          { value: 'all', label: 'All', count: counts.all },
          { value: 'active', label: 'Active', count: counts.active },
          { value: 'paused', label: 'Paused', count: counts.paused },
          { value: 'archived', label: 'Archived', count: counts.archived }]
          } />
        
      </div>

      {/* Grid */}
      <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6">
        {filtered.map((c) =>
        <CampaignCard
          key={c.id} c={c}
          onOpen={onOpen} onRun={onRun}
          onPause={onPause} onRestore={onRestore} onArchive={onArchive} />

        )}
        {filtered.length === 0 &&
        <div className="col-span-full py-20 text-center text-mute text-sm">
            No campaigns match your filters.
          </div>
        }
      </div>
    </div>);

}

// ── Page header ──
function PageHeader({ title, subtitle, actions, breadcrumb }) {
  return (
    <div className="flex items-start justify-between gap-6 flex-wrap">
      <div>
        {breadcrumb}
        <h1 className="text-[32px] sm:text-[36px] font-bold text-ink dark:text-d-ink leading-tight tracking-tight">{title}</h1>
        {subtitle && <p className="text-[14px] text-mute mt-1.5">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>);

}

// ── Empty state ──
function EmptyState({ onCreate, source = 'gmaps' }) {
  const src = SOURCES[source] || SOURCES.gmaps;
  const icon = source === 'yelp' ? <IconStar size={36} /> :
               source === 'linkedin' ? <IconBriefcase size={36} /> :
               <IconMapPin size={36} />;
  return (
    <div className="mt-24 flex flex-col items-center text-center max-w-[440px] mx-auto">
      <div className="w-20 h-20 rounded-full bg-canvas dark:bg-d-canvas flex items-center justify-center text-mute mb-6">
        {icon}
      </div>
      <h2 className="text-[24px] font-semibold text-ink dark:text-d-ink">{src.emptyTitle}</h2>
      <p className="text-[14px] text-mute mt-2 leading-relaxed">
        {src.emptyBody}
      </p>
      <Button variant="primary" size="lg" leftIcon={<IconPlus size={16} />} onClick={onCreate} className="mt-7">
        Create your first campaign
      </Button>
    </div>);

}

// ── Create Campaign modal ──
function CreateCampaignModal({ open, onClose, onCreate, source = 'gmaps' }) {
  const src = SOURCES[source] || SOURCES.gmaps;
  const cats = CATEGORIES_BY_SOURCE[source] || CATEGORIES_BY_SOURCE.gmaps;
  const isLinkedIn = source === 'linkedin';

  const [name, setName] = useState('');
  const [category, setCategory] = useState(cats[0].value);
  const [customKeyword, setCustomKeyword] = useState('');
  // gmaps / yelp use country + state + city
  const [country, setCountry] = useState('US');
  const [state, setState] = useState('California');
  const [city, setCity] = useState('');
  const [entireState, setEntireState] = useState(false);
  // linkedin uses metro + industry + seniority instead
  const [metro, setMetro]         = useState(LINKEDIN_METROS[0]);
  const [industry, setIndustry]   = useState(LINKEDIN_INDUSTRIES[0]);
  const [seniority, setSeniority] = useState(LINKEDIN_SENIORITY[0]);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (open) {
      setName('');
      setCategory(cats[0].value);
      setCustomKeyword('');
      setCountry('US'); setState('California'); setCity(''); setEntireState(false);
      setMetro(LINKEDIN_METROS[0]); setIndustry(LINKEDIN_INDUSTRIES[0]); setSeniority(LINKEDIN_SENIORITY[0]);
      setErrors({});
    }
  }, [open, source]);

  const baseLabel = () => {
    if (category === 'custom') return customKeyword.trim();
    return cats.find((c) => c.value === category)?.label.toLowerCase() || '';
  };

  const derivedKeyword = () => {
    const base = baseLabel();
    if (isLinkedIn) {
      const parts = [base];
      if (industry && industry !== 'Any industry') parts.push(industry);
      parts.push(metro);
      return base ? parts.filter(Boolean).join(' · ') : '';
    }
    const loc = entireState ? state : city ? city : state;
    return base && loc ? `${base} in ${loc}` : base;
  };

  const submit = () => {
    const errs = {};
    if (!name.trim()) errs.name = 'Campaign name is required';
    if (category === 'custom' && !customKeyword.trim()) errs.keyword = isLinkedIn ? 'Enter a custom title' : 'Enter a custom keyword';
    if (!isLinkedIn && !entireState && !city.trim()) errs.city = 'City is required (or pick Entire State)';
    setErrors(errs);
    if (Object.keys(errs).length) return;

    const payload = isLinkedIn ? {
      source,
      name: name.trim(),
      keyword: derivedKeyword(),
      category,
      country, state: '', city: metro,
      industry, seniority,
    } : {
      source,
      name: name.trim(),
      keyword: derivedKeyword(),
      category,
      country, state,
      city: entireState ? '' : city.trim(),
    };
    onCreate(payload);
  };

  return (
    <Modal open={open} onClose={onClose} width={560}>
      <div className="flex items-start justify-between mb-5">
        <div>
          <h2 className="text-[22px] font-semibold text-ink dark:text-d-ink">New {src.label} campaign</h2>
          <p className="text-[13px] text-mute mt-1">
            {isLinkedIn
              ? 'One campaign = one job title + one metro. Industry narrows the result set further.'
              : 'One campaign = one search keyword + one location.'}
          </p>
        </div>
        <button onClick={onClose} className="text-mute hover:text-ink dark:hover:text-d-ink p-1"><IconX size={18} /></button>
      </div>

      <div className="space-y-4">
        <Field label="Campaign name" hint={isLinkedIn ? 'e.g. "SF Bay Area Founders"' : 'e.g. "San Diego Restaurants"'} error={errors.name}>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Give it a memorable name" />
        </Field>

        <Field label={isLinkedIn ? 'Target role' : 'What to scrape'}>
          <Select value={category} onChange={(e) => setCategory(e.target.value)}>
            {cats.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </Select>
        </Field>

        {category === 'custom' &&
          <Field label={isLinkedIn ? 'Custom title' : 'Custom keyword'} hint={isLinkedIn ? 'e.g. "Head of Growth"' : 'The exact query that will be searched'} error={errors.keyword}>
            <Input value={customKeyword} onChange={(e) => setCustomKeyword(e.target.value)} placeholder={isLinkedIn ? 'Head of Growth' : 'vegan bakeries'} />
          </Field>
        }

        {isLinkedIn ? (
          <>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Metro area">
                <Select value={metro} onChange={(e) => setMetro(e.target.value)}>
                  {LINKEDIN_METROS.map((m) => <option key={m} value={m}>{m}</option>)}
                </Select>
              </Field>
              <Field label="Seniority filter">
                <Select value={seniority} onChange={(e) => setSeniority(e.target.value)}>
                  {LINKEDIN_SENIORITY.map((s) => <option key={s} value={s}>{s}</option>)}
                </Select>
              </Field>
            </div>
            <Field label="Industry">
              <Select value={industry} onChange={(e) => setIndustry(e.target.value)}>
                {LINKEDIN_INDUSTRIES.map((i) => <option key={i} value={i}>{i}</option>)}
              </Select>
            </Field>
            <div className="rounded-[14px] bg-[#fff7d6]/60 dark:bg-[#3a3206]/40 border border-[#ffd11a]/30 p-3 flex items-start gap-2.5">
              <span className="text-[#7a4500] dark:text-[#ffd11a] mt-0.5"><IconAlert size={14} /></span>
              <div className="text-[12px] text-body dark:text-d-body leading-relaxed">
                LinkedIn caps People-search at <span className="font-semibold">~1,000 profiles</span> per query and ~80 commercial profile-views per week on a free account. The scraper paginates respectfully and stops at the limit.
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Country">
                <Select value={country} onChange={(e) => {setCountry(e.target.value);setState(STATES_BY_COUNTRY[e.target.value][0]);}}>
                  {COUNTRIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                </Select>
              </Field>
              <Field label="State / Region">
                <Select value={state} onChange={(e) => setState(e.target.value)}>
                  {STATES_BY_COUNTRY[country].map((s) => <option key={s} value={s}>{s}</option>)}
                </Select>
              </Field>
            </div>

            {!entireState &&
              <Field label={source === 'yelp' ? 'City or neighborhood' : 'City'} error={errors.city}>
                <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder={src.statePlaceholder} />
              </Field>
            }
            <Checkbox checked={entireState} onChange={setEntireState} label={`Scrape entire ${state}`} />
          </>
        )}

        {/* Preview chip */}
        <div className="rounded-[14px] bg-canvas-soft dark:bg-d-canvas-soft p-3 flex items-start gap-3 mt-2">
          <div className="mt-0.5 text-mute"><IconSearch size={16} /></div>
          <div className="min-w-0 flex-1">
            <div className="text-[11px] uppercase tracking-wide text-mute font-semibold">{src.queryLabel}</div>
            <div className="text-[14px] font-medium text-ink dark:text-d-ink mt-0.5 truncate">
              {derivedKeyword() || <span className="text-mute italic">Fill in the fields above…</span>}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 -mx-6 px-6 pt-5 border-t border-line dark:border-d-line flex items-center justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="primary" onClick={submit} rightIcon={<IconArrowRight size={14} />}>Create campaign</Button>
      </div>
    </Modal>);

}

function Field({ label, hint, error, children }) {
  return (
    <div>
      <div className="text-[13px] font-semibold text-ink dark:text-d-ink mb-1.5">{label}</div>
      {children}
      {error ?
      <div className="text-[12px] text-negative mt-1.5">{error}</div> :
      hint && <div className="text-[12px] text-mute mt-1.5">{hint}</div>
      }
    </div>);

}

// ── Run Campaign modal ──
function RunCampaignModal({ open, onClose, campaign, onStart }) {
  const [mode, setMode] = useState('append');
  useEffect(() => {if (open) setMode('append');}, [open]);
  if (!campaign) return null;
  const src = SOURCES[campaign.source] || SOURCES.gmaps;
  const isLinkedIn = campaign.source === 'linkedin';
  const entity = src.leadEntity;
  return (
    <Modal open={open} onClose={onClose} width={520}>
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="text-[20px] font-semibold text-ink dark:text-d-ink">Run {src.label} campaign</h2>
          <p className="text-[13px] text-mute mt-1">{campaign.name}</p>
        </div>
        <button onClick={onClose} className="text-mute hover:text-ink dark:hover:text-d-ink p-1"><IconX size={18} /></button>
      </div>

      <div className="rounded-[14px] bg-canvas-soft dark:bg-d-canvas-soft px-4 py-3 mb-5">
        <div className="text-[11px] uppercase tracking-wide text-mute font-semibold">{src.queryLabel}</div>
        <div className="text-[15px] font-medium text-ink dark:text-d-ink mt-0.5 truncate">"{campaign.keyword}"</div>
      </div>

      <div className="space-y-3">
        <RadioCard
          checked={mode === 'append'}
          onChange={() => setMode('append')}
          title={`Add new ${entity} only`}
          desc={isLinkedIn
            ? 'Existing profiles stay. Duplicates (same profile URL) are skipped automatically.'
            : 'Existing leads stay. Duplicates (by website or phone) are skipped automatically.'} />
        
        <RadioCard
          checked={mode === 'replace'}
          onChange={() => setMode('replace')}
          title={`Replace all ${entity}`}
          desc={`Deletes all ${campaign.totalLeads} existing ${entity} before scraping. Use only if the data is stale.`}
          danger />
        
      </div>

      {mode === 'replace' &&
      <div className="mt-4 rounded-[14px] bg-red-50 dark:bg-red-900/20 border border-red-200/60 dark:border-red-800/60 p-3.5 flex items-start gap-2.5">
          <span className="text-negative mt-0.5"><IconAlert size={16} /></span>
          <div className="text-[13px] text-[#a7000d] dark:text-red-300 leading-relaxed">
            <strong className="font-semibold">This is destructive.</strong> All {campaign.totalLeads} existing {entity} — including their statuses, notes, and history — will be permanently deleted before scraping starts.
          </div>
        </div>
      }

      {isLinkedIn && (
        <div className="mt-4 rounded-[14px] bg-canvas-soft/70 dark:bg-d-canvas-soft/70 border border-line dark:border-d-line p-3.5 flex items-start gap-2.5">
          <span className="text-mute mt-0.5"><IconBriefcase size={14} /></span>
          <div className="text-[12px] text-body dark:text-d-body leading-relaxed">
            The scraper signs in with your saved cookies and respects LinkedIn's view limits — it stops automatically when the weekly cap is reached.
          </div>
        </div>
      )}

      <div className="mt-6 -mx-6 px-6 pt-5 border-t border-line dark:border-d-line flex items-center justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="primary" onClick={() => onStart(mode)} rightIcon={<IconPlay size={13} />}>Start scraping</Button>
      </div>
    </Modal>);

}

function RadioCard({ checked, onChange, title, desc, danger }) {
  return (
    <label className={cx(
      'flex items-start gap-3 p-4 rounded-[16px] border cursor-pointer transition-colors',
      checked ?
      danger ? 'border-negative bg-red-50/50 dark:bg-red-900/10' : 'border-primary bg-primary-pale/40 dark:bg-primary/10' :
      'border-line dark:border-d-line hover:border-mute'
    )}>
      <input type="radio" checked={checked} onChange={onChange} className="sr-only" />
      <span className={cx(
        'mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors',
        checked ? danger ? 'border-negative' : 'border-primary' : 'border-mute'
      )}>
        {checked && <span className={cx('w-2 h-2 rounded-full', danger ? 'bg-negative' : 'bg-primary')} />}
      </span>
      <div className="min-w-0">
        <div className="text-[14px] font-semibold text-ink dark:text-d-ink">{title}</div>
        <div className="text-[13px] text-body dark:text-d-body mt-0.5 leading-relaxed">{desc}</div>
      </div>
    </label>);

}

Object.assign(window, {
  Sidebar, Header, CampaignListPage, EmptyState,
  CreateCampaignModal, RunCampaignModal, PageHeader, CampaignCard
});