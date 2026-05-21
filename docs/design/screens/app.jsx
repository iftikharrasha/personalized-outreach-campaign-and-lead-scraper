// ───────── App entry ─────────

// Persist dark mode
function useDarkMode() {
  const [dark, setDark] = useState(() => {
    const v = localStorage.getItem('outrich-dark');
    if (v != null) return v === '1';
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches || false;
  });
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem('outrich-dark', dark ? '1' : '0');
  }, [dark]);
  return [dark, setDark];
}

// Tweakable defaults
const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "startRoute": "home",
  "showEmptyState": false,
  "simulateScraping": false,
  "compactSidebar": false
}/*EDITMODE-END*/;

function App() {
  const [dark, setDark] = useDarkMode();
  const [collapsed, setCollapsed] = useState(false);
  const [campaigns, setCampaigns] = useState(seedCampaigns);
  const [leadsByCampaign, setLeadsByCampaign] = useState({ c1: seedLeads });

  // Modal state
  const [createOpen, setCreateOpen] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState(null);
  const [runModal, setRunModal] = useState(null);

  // Scraping simulation
  const [scrapingCampaignId, setScrapingCampaignId] = useState(null);
  const [scrapingFound, setScrapingFound] = useState(0);
  const scrapingTimerRef = useRef(null);

  const toast = useToast();

  // Tweaks
  const [t, setTweak] = window.useTweaks(TWEAK_DEFAULTS);

  // Route — initial value derived from "startRoute" tweak so we can preview either page
  const [route, setRoute] = useState(() => ({ name: t.startRoute === 'list' ? 'list' : 'home' }));

  // React to "simulateScraping" tweak
  useEffect(() => {
    if (t.simulateScraping && route.name === 'detail' && !scrapingCampaignId) {
      startScraping(route.id);
    }
    if (!t.simulateScraping && scrapingCampaignId) {
      stopScrapingSilently();
    }
  }, [t.simulateScraping, route]);

  useEffect(() => { setCollapsed(!!t.compactSidebar); }, [t.compactSidebar]);

  // Publish sidebar width as a CSS variable so the floating bulk-action pill
  // can center itself against the content area, not the viewport.
  useEffect(() => {
    document.documentElement.style.setProperty('--sidebar-w', collapsed ? '64px' : '240px');
  }, [collapsed]);

  const startScraping = (campaignId) => {
    if (scrapingTimerRef.current) clearInterval(scrapingTimerRef.current);
    setScrapingCampaignId(campaignId);
    setScrapingFound(0);
    let n = 0;
    scrapingTimerRef.current = setInterval(() => {
      n += Math.floor(Math.random() * 4) + 1;
      setScrapingFound(n);
      if (n >= 47) clearInterval(scrapingTimerRef.current);
    }, 1100);
  };
  const stopScrapingSilently = () => {
    if (scrapingTimerRef.current) clearInterval(scrapingTimerRef.current);
    setScrapingCampaignId(null);
    setScrapingFound(0);
  };
  const stopScraping = () => {
    stopScrapingSilently();
    toast.show({ type: 'warning', title: 'Scrape cancelled', message: 'Stopped at ' + scrapingFound + ' new leads. Already-saved leads stay in the database.' });
    setTweak('simulateScraping', false);
  };

  // Navigation
  const goHome     = () => setRoute({ name: 'home' });
  const goList     = () => setRoute({ name: 'list' });
  const goDetail   = (c) => setRoute({ name: 'detail', id: typeof c === 'string' ? c : c.id });
  const handleNav = (id) => id === 'home' ? goHome() : goList();

  // Campaign mutations
  const openRunModal = (c) => setRunModal(c);
  const startRun = (mode) => {
    const c = runModal;
    setRunModal(null);
    if (!c) return;
    if (mode === 'replace') {
      toast.show({ type: 'warning', title: 'Replacing all leads', message: `Deleted ${c.totalLeads} leads. Scraping started.` });
    } else {
      toast.show({ type: 'success', title: 'Scraping started', message: `Looking for new leads matching "${c.keyword}".` });
    }
    goDetail(c);
    setTweak('simulateScraping', true);
  };

  const createCampaign = (data) => {
    const newC = {
      id: 'c' + (campaigns.length + 1 + Math.floor(Math.random() * 1000)),
      ...data,
      notifyEmail: '',
      status: 'ACTIVE',
      totalLeads: 0, contacted: 0, newSinceLast: 0,
      lastRun: 'never',
      progress: 0,
    };
    setCampaigns(cs => [newC, ...cs]);
    setCreateOpen(false);
    toast.show({ type: 'success', title: 'Campaign created', message: `"${newC.name}" is ready. Hit Run to scrape leads.` });
  };

  const saveCampaignEdit = (updated) => {
    setCampaigns(cs => cs.map(c => c.id === updated.id ? { ...c, ...updated } : c));
    setEditingCampaign(null);
    toast.show({ type: 'success', title: 'Campaign updated', message: `Saved changes to "${updated.name}".` });
  };

  const pauseCampaign = (c) => {
    setCampaigns(cs => cs.map(x => x.id === c.id ? { ...x, status: 'PAUSED' } : x));
    toast.show({ type: 'success', title: 'Campaign paused', message: `${c.name} won't run until resumed.` });
  };
  const restoreCampaign = (c) => {
    setCampaigns(cs => cs.map(x => x.id === c.id ? { ...x, status: 'ACTIVE' } : x));
    toast.show({ type: 'success', title: c.status === 'ARCHIVED' ? 'Campaign restored' : 'Campaign resumed', message: c.name });
  };
  const archiveCampaign = (c) => {
    setCampaigns(cs => cs.map(x => x.id === c.id ? { ...x, status: 'ARCHIVED' } : x));
    setEditingCampaign(null);
    toast.show({ type: 'success', title: 'Campaign archived', message: `${c.name} moved to Archived.` });
  };

  // Lead mutations
  const updateLeadStatus = (id, status) => {
    setLeadsByCampaign(prev => {
      const out = { ...prev };
      for (const cid of Object.keys(out)) out[cid] = out[cid].map(l => l.id === id ? { ...l, status } : l);
      return out;
    });
    const label = STATUS_OPTIONS.find(s => s.value === status)?.label || status;
    toast.show({ type: 'success', title: 'Status updated', message: `Lead marked as ${label}.` });
  };
  const updateLeadNotes = (id, notes) => {
    setLeadsByCampaign(prev => {
      const out = { ...prev };
      for (const cid of Object.keys(out)) out[cid] = out[cid].map(l => l.id === id ? { ...l, notes } : l);
      return out;
    });
    toast.show({ type: 'success', title: 'Note saved', message: 'Tracked in lead_history.' });
  };
  const updateLeadEmail = (id, email) => {
    setLeadsByCampaign(prev => {
      const out = { ...prev };
      for (const cid of Object.keys(out)) out[cid] = out[cid].map(l => l.id === id ? { ...l, email } : l);
      return out;
    });
    toast.show({ type: 'success', title: email ? 'Email saved' : 'Email cleared', message: email ? `Client email set to ${email}.` : 'Email removed from this lead.' });
  };
  const exportCSV = (which) => {
    toast.show({ type: 'success', title: 'Export ready', message: `CSV download started (${which} leads).` });
  };

  // Derived
  const currentCampaign = route.name === 'detail' ? campaigns.find(c => c.id === route.id) : null;
  const currentLeads = route.name === 'detail' ? (leadsByCampaign[route.id] || []) : [];
  const sidebarActive = route.name === 'home' ? 'home' : 'gmaps';

  const breadcrumb =
    route.name === 'home'   ? ['Outrich Manager'] :
    route.name === 'list'   ? ['Google Maps Scraper', 'Campaigns'] :
    /* detail */              ['Google Maps Scraper', 'Campaigns', currentCampaign?.name || ''];

  return (
    <div className="min-h-screen flex bg-canvas-soft dark:bg-d-canvas-soft text-ink dark:text-d-ink">
      <Sidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed(c => !c)}
        active={sidebarActive}
        onNavigate={handleNav}
      />
      <div className="flex-1 min-w-0 flex flex-col">
        <Header
          breadcrumb={breadcrumb}
          onMenuClick={() => setCollapsed(c => !c)}
          dark={dark}
          onToggleDark={() => setDark(d => !d)}
        />
        <main className="flex-1">
          {route.name === 'home' ? (
            <DashboardPage
              metrics={businessMetrics}
              closedLeads={closedLeads}
              campaigns={campaigns}
              onOpenCampaign={(id) => goDetail(id)}
              onGoToScraper={goList}
            />
          ) : t.showEmptyState ? (
            <CampaignListPage
              campaigns={[]}
              onCreate={() => setCreateOpen(true)}
              emptyState
              onOpen={goDetail}
              onRun={openRunModal}
              onPause={pauseCampaign}
              onRestore={restoreCampaign}
              onArchive={archiveCampaign}
            />
          ) : route.name === 'list' ? (
            <CampaignListPage
              campaigns={campaigns}
              onOpen={goDetail}
              onRun={openRunModal}
              onCreate={() => setCreateOpen(true)}
              onPause={pauseCampaign}
              onRestore={restoreCampaign}
              onArchive={archiveCampaign}
            />
          ) : currentCampaign ? (
            <CampaignDetailPage
              campaign={currentCampaign}
              leads={currentLeads}
              onBack={goList}
              onRun={() => openRunModal(currentCampaign)}
              onArchive={() => { archiveCampaign(currentCampaign); goList(); }}
              onEdit={() => setEditingCampaign(currentCampaign)}
              scraping={scrapingCampaignId === currentCampaign.id}
              scrapingFound={scrapingFound}
              onStopScraping={stopScraping}
              onLeadStatusChange={updateLeadStatus}
              onLeadNotesChange={updateLeadNotes}
              onLeadEmailChange={updateLeadEmail}
              onExport={exportCSV}
            />
          ) : (
            <div className="px-8 py-24 text-center text-mute">Campaign not found. <button className="text-ink dark:text-d-ink underline" onClick={goList}>Back to campaigns</button></div>
          )}
        </main>
      </div>

      {/* Modals */}
      <CreateCampaignModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreate={createCampaign}
      />
      <EditCampaignModal
        open={!!editingCampaign}
        campaign={editingCampaign}
        onClose={() => setEditingCampaign(null)}
        onSave={saveCampaignEdit}
        onArchive={(c) => { archiveCampaign(c); goList(); }}
      />
      <RunCampaignModal
        open={!!runModal}
        campaign={runModal}
        onClose={() => setRunModal(null)}
        onStart={startRun}
      />

      {/* Tweaks panel */}
      {window.TweaksPanel && (
        <TweaksPanel title="Outrich tweaks">
          <TweakSection label="View">
            <TweakRadio
              label="Start on"
              value={route.name === 'home' ? 'home' : 'list'}
              options={[{ value: 'home', label: 'Manager' }, { value: 'list', label: 'Scraper' }]}
              onChange={(v) => { setTweak('startRoute', v); setRoute({ name: v }); }}
            />
            <TweakToggle
              label="Compact sidebar"
              value={t.compactSidebar}
              onChange={(v) => setTweak('compactSidebar', v)}
            />
          </TweakSection>
          <TweakSection label="Scraper demo state">
            <TweakToggle
              label="Show empty state"
              value={t.showEmptyState}
              onChange={(v) => setTweak('showEmptyState', v)}
            />
            <TweakToggle
              label="Simulate scraping"
              value={t.simulateScraping}
              onChange={(v) => setTweak('simulateScraping', v)}
            />
          </TweakSection>
          <TweakSection label="Theme">
            <TweakToggle
              label="Dark mode"
              value={dark}
              onChange={(v) => setDark(v)}
            />
          </TweakSection>
          <TweakSection label="Trigger toasts">
            <TweakButton label="Success" onClick={() => toast.show({ type: 'success', title: 'Lead exported', message: 'CSV downloaded.' })} />
            <TweakButton label="Warning" onClick={() => toast.show({ type: 'warning', title: 'Google rate-limited', message: 'Pausing scrape. Retry in ~6h.' })} secondary />
            <TweakButton label="Error" onClick={() => toast.show({ type: 'error', title: 'Worker crashed', message: 'Run marked FAILED. See logs.' })} secondary />
          </TweakSection>
        </TweaksPanel>
      )}
    </div>
  );
}

// Mount
ReactDOM.createRoot(document.getElementById('root')).render(
  <ToastProvider>
    <App />
  </ToastProvider>
);
