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
  "simulateEnrichment": false,
  "simulateYelpFetch": false,
  "yelpApiKeyMissing": false,
  "compactSidebar": false
}/*EDITMODE-END*/;

// Map a sidebar id ('gmaps' / 'yelp' / 'linkedin') to a campaign-list route.
const SIDEBAR_TO_SOURCE = { gmaps: 'gmaps', yelp: 'yelp', linkedin: 'linkedin' };
const SOURCE_TO_SIDEBAR = { gmaps: 'gmaps', yelp: 'yelp', linkedin: 'linkedin' };

// Stable id generator for new inbox entities
let _inboxIdCounter = 1000;
const newInboxId = (prefix) => `${prefix}_${Date.now().toString(36)}_${_inboxIdCounter++}`;

function App() {
  const [dark, setDark] = useDarkMode();
  const [collapsed, setCollapsed] = useState(false);
  // Track the user's preferred sidebar width separately so we can force-
  // collapse on /inbox routes (mail-client convention) and restore on exit.
  const userPrefCollapsedRef = useRef(false);
  const [campaigns, setCampaigns] = useState(seedCampaigns);
  // Leads are stored per-campaign so the table only ever renders the right
  // shape. Yelp + LinkedIn leads have different fields from gmaps leads;
  // the detail page picks the right LeadRow* variant based on campaign.source.
  const [leadsByCampaign, setLeadsByCampaign] = useState({
    c1:  seedLeads,
    y1:  seedLeadsYelp,
    ln1: seedLeadsLinkedIn,
  });

  // Modal state
  const [createOpen, setCreateOpen] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState(null);
  const [runModal, setRunModal] = useState(null);

  // Scraping simulation
  const [scrapingCampaignId, setScrapingCampaignId] = useState(null);
  const [scrapingFound, setScrapingFound] = useState(0);
  const scrapingTimerRef = useRef(null);

  // Enrichment — which campaign the active run targets, and which leads
  // just had their email landed (used to flash the row + email cell).
  const [enrichmentCampaignId, setEnrichmentCampaignId] = useState(null);
  const [justFoundIds, setJustFoundIds] = useState(new Set());
  const justFoundTimersRef = useRef(new Map());

  // Yelp fetch — which campaign the active fetch targets, and which leads
  // just landed from the API (used to flash the row, same vocabulary as the
  // enrichment "just-found" pattern).
  const [yelpCampaignId, setYelpCampaignId] = useState(null);
  const [yelpJustFetchedIds, setYelpJustFetchedIds] = useState(new Set());
  const yelpJustFetchedTimersRef = useRef(new Map());

  // Inbox state — threads keyed by campaign. Mirrors §4 of PHASE_8_INBOX.md:
  // thread is anchored to a recipient group at creation, messages always
  // send to that group (with optional skips). Pending selection is the
  // Zustand-bridge analog from §6, kept here as React state since this is
  // a single-page prototype — refreshes still drop it on the floor.
  const [inboxThreadsByCampaign, setInboxThreadsByCampaign] = useState(seedInboxThreads);
  const [pendingInboxSelection, setPendingInboxSelection] = useState(null);
  const [activeInboxCampaignId, setActiveInboxCampaignId] = useState('c1');
  const [activeInboxThreadId, setActiveInboxThreadId] = useState(() => seedInboxThreads.c1?.[0]?.id || null);

  const toast = useToast();

  // Tweaks
  const [t, setTweak] = window.useTweaks(TWEAK_DEFAULTS);

  // Route. shape:
  //   { name: 'home' }
  //   { name: 'list',   source: 'gmaps'|'yelp'|'linkedin' }
  //   { name: 'detail', source: 'gmaps'|'yelp'|'linkedin', id: 'c1' }
  const [route, setRoute] = useState(() => (
    t.startRoute === 'list' ? { name: 'list', source: 'gmaps' } : { name: 'home' }
  ));

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

  // Inbox = three pane → auto-collapse the app sidebar so both extra rails fit.
  // Restore the user's previous preference on leave. (§10 of PHASE_8_INBOX.md)
  useEffect(() => {
    if (route.name === 'inbox') {
      userPrefCollapsedRef.current = collapsed || !!t.compactSidebar;
      setCollapsed(true);
    } else {
      setCollapsed(userPrefCollapsedRef.current);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route.name]);

  // Enrichment engine — driven by the simulator hook from enrichment.jsx.
  // The hook is the source of truth for run state; we react to its callbacks
  // by writing emails into leadsByCampaign and toasting on completion.
  const getLeadById = (id) => {
    for (const cid of Object.keys(leadsByCampaign)) {
      const found = leadsByCampaign[cid].find((l) => l.id === id);
      if (found) return found;
    }
    return null;
  };

  const markJustFound = (leadId) => {
    setJustFoundIds((prev) => {
      const next = new Set(prev); next.add(leadId); return next;
    });
    // Clear the highlight after the CSS animation finishes so the row
    // returns to its normal background.
    const prevTimer = justFoundTimersRef.current.get(leadId);
    if (prevTimer) clearTimeout(prevTimer);
    const handle = setTimeout(() => {
      setJustFoundIds((prev) => {
        const next = new Set(prev); next.delete(leadId); return next;
      });
      justFoundTimersRef.current.delete(leadId);
    }, 2200);
    justFoundTimersRef.current.set(leadId, handle);
  };

  const { run: enrichRun, elapsedMs: enrichElapsedMs, startRun: startEnrichRun, cancelRun: cancelEnrichRun } =
    (window.useEnrichmentSimulator || (() => ({})))({
      getLeadById,
      onFound: (leadId, email) => {
        setLeadsByCampaign((prev) => {
          const out = { ...prev };
          for (const cid of Object.keys(out)) {
            out[cid] = out[cid].map((l) => l.id === leadId ? { ...l, email } : l);
          }
          return out;
        });
        markJustFound(leadId);
      },
      onComplete: ({ found, failed, skipped, total, durationMs }) => {
        setEnrichmentCampaignId(null);
        setTweak('simulateEnrichment', false);
        const time = window.formatRunDuration ? window.formatRunDuration(durationMs) : '';
        if (found === 0 && failed === 0 && skipped > 0) {
          toast.show({ type: 'warning', title: 'No leads to enrich', message: 'All selected leads already had an email.' });
        } else if (found === 0) {
          toast.show({ type: 'warning', title: 'Enrichment complete', message: `Couldn’t find emails for ${failed} lead${failed === 1 ? '' : 's'}. Try again or add manually.` });
        } else {
          toast.show({
            type: 'success',
            title: `Found ${found} email${found === 1 ? '' : 's'}`,
            message: `${found} of ${total} leads enriched in ${time}. ${failed} missed${skipped ? ` · ${skipped} skipped` : ''}.`,
          });
        }
      },
      onCancel: ({ found, durationMs }) => {
        setEnrichmentCampaignId(null);
        setTweak('simulateEnrichment', false);
        const time = window.formatRunDuration ? window.formatRunDuration(durationMs) : '';
        toast.show({
          type: 'warning',
          title: 'Enrichment stopped',
          message: `Cancelled at ${time}. Kept ${found} email${found === 1 ? '' : 's'} found so far.`
        });
      },
    });

  // Entry point used by both single (Email modal “Find Email”) and bulk
  // (floating pill “Find email”) flows. Mirrors the POST /api/enrich
  // pre-flight from §12 of the phase doc: filter out leads that already
  // have an email, count the removed as upfront-skipped, 409-equivalent
  // if nothing remains.
  const findEmailsForLeads = (leadIds) => {
    if (enrichRun) {
      toast.show({ type: 'warning', title: 'Enrichment already running', message: 'Wait for the current run to finish or stop it first.' });
      return;
    }
    if (!leadIds || !leadIds.length) return;
    const eligible = [];
    let skippedUpfront = 0;
    leadIds.forEach((id) => {
      const lead = getLeadById(id);
      if (!lead) return;
      if (lead.email) skippedUpfront += 1;
      else eligible.push(id);
    });
    if (!eligible.length) {
      toast.show({ type: 'warning', title: 'Nothing to enrich', message: 'All selected leads already have an email.' });
      return;
    }
    // Find which campaign owns these leads (the active detail page).
    let owningCampaignId = null;
    for (const cid of Object.keys(leadsByCampaign)) {
      if (leadsByCampaign[cid].some((l) => eligible.includes(l.id))) { owningCampaignId = cid; break; }
    }
    setEnrichmentCampaignId(owningCampaignId);
    const entryName = eligible.length === 1 ? (getLeadById(eligible[0])?.name || '') : '';
    startEnrichRun({ leadIds: eligible, skippedUpfront, entryLeadName: entryName });
  };

  // React to the Tweaks “Simulate enrichment” toggle — mirror the
  // simulateScraping pattern. Picks ~12 leads in the currently visible
  // campaign that don’t yet have an email and runs them through.
  useEffect(() => {
    if (t.simulateEnrichment && !enrichRun && route.name === 'detail') {
      const c = campaigns.find((x) => x.id === route.id);
      if (!c || (c.source !== 'gmaps' && c.source !== 'yelp')) { setTweak('simulateEnrichment', false); return; }
      const candidates = (leadsByCampaign[c.id] || []).filter((l) => !l.email).slice(0, 12);
      if (!candidates.length) {
        toast.show({ type: 'warning', title: 'Nothing to enrich', message: 'Every lead in this campaign already has an email.' });
        setTweak('simulateEnrichment', false);
        return;
      }
      findEmailsForLeads(candidates.map((l) => l.id));
    }
  }, [t.simulateEnrichment, route]);

  // ---- Yelp fetch engine -----------------------------------------------
  // Mirrors the Phase 6 enrichment hookup. Each batch callback synthesizes
  // new lead rows from YELP_FETCH_POOL (so the user sees data land live in
  // the leads table), advances the campaign's apiOffset, and marks the
  // newly-arrived row ids for the row-flash animation.

  const markYelpJustFetched = (leadId) => {
    setYelpJustFetchedIds((prev) => { const next = new Set(prev); next.add(leadId); return next; });
    const prevTimer = yelpJustFetchedTimersRef.current.get(leadId);
    if (prevTimer) clearTimeout(prevTimer);
    const handle = setTimeout(() => {
      setYelpJustFetchedIds((prev) => { const next = new Set(prev); next.delete(leadId); return next; });
      yelpJustFetchedTimersRef.current.delete(leadId);
    }, 2400);
    yelpJustFetchedTimersRef.current.set(leadId, handle);
  };

  // Generate one new Yelp lead row from the synthetic pool. The pool is
  // looped over (with a random salt suffix) so a long fetch run never runs
  // out of names.
  const synthYelpLead = (campaignId, indexHint) => {
    const pool = window.YELP_FETCH_POOL || [];
    if (!pool.length) return null;
    const r = pool[indexHint % pool.length];
    const salt = Math.floor(Math.random() * 9000) + 1000;
    return {
      id: 'yl_' + campaignId + '_' + salt,
      campaignId,
      source: 'yelp',
      name: r[0],
      phone: r[1],
      website: r[2],
      rating: r[3],
      reviews: r[4],
      price: r[5],
      primaryCategory: r[6],
      neighborhood: r[7],
      claimed: r[8],
      email: '',
      status: 'NEW',
      notes: '',
      addedAt: 'just now',
    };
  };

  const { run: yelpRun, elapsedMs: yelpElapsedMs, startRun: startYelpRun, cancelRun: cancelYelpRun } =
    (window.useYelpFetchSimulator || (() => ({})))({
      getCampaignById: (id) => campaigns.find((c) => c.id === id) || null,
      onBatch: ({ campaignId, newLeads, duplicates, offsetAfter }) => {
        // Synthesize new lead rows for the table.
        setLeadsByCampaign((prev) => {
          const existing = prev[campaignId] || [];
          const added = [];
          for (let i = 0; i < newLeads; i++) {
            const l = synthYelpLead(campaignId, existing.length + added.length + i);
            if (l) added.push(l);
          }
          added.forEach((l) => markYelpJustFetched(l.id));
          return { ...prev, [campaignId]: [...added, ...existing] };
        });
        // Advance the campaign's totalLeads counter so the stat card reflects
        // the new rows. apiOffset is updated on completion to keep the run
        // "atomic" from the user's perspective (matches how the worker
        // persists per-batch in real life — close enough for this prototype).
        setCampaigns((cs) => cs.map((c) =>
          c.id === campaignId
            ? { ...c, totalLeads: c.totalLeads + newLeads, newSinceLast: c.newSinceLast + newLeads, apiOffset: offsetAfter }
            : c
        ));
      },
      onComplete: ({ campaignId, fetched, newLeads, duplicates, finalOffset, apiTotalAvailable, durationMs }) => {
        setYelpCampaignId(null);
        setTweak('simulateYelpFetch', false);
        setCampaigns((cs) => cs.map((c) => {
          if (c.id !== campaignId) return c;
          return {
            ...c,
            apiOffset: finalOffset,
            apiTotalAvailable: c.apiTotalAvailable != null ? c.apiTotalAvailable : apiTotalAvailable,
            apiKeywordUsed: c.apiKeywordUsed || c.keyword,
            lastRun: 'just now',
          };
        }));
        const time = window.formatYelpDuration ? window.formatYelpDuration(durationMs) : '';
        toast.show({
          type: 'success',
          title: `Fetched ${fetched} businesses`,
          message: `${newLeads} new lead${newLeads === 1 ? '' : 's'} added · ${duplicates} already in this campaign · ${time}.`,
        });
      },
      onCancel: ({ campaignId, fetched, newLeads, finalOffset, durationMs }) => {
        setYelpCampaignId(null);
        setTweak('simulateYelpFetch', false);
        setCampaigns((cs) => cs.map((c) =>
          c.id === campaignId ? { ...c, apiOffset: finalOffset, lastRun: 'just now' } : c
        ));
        const time = window.formatYelpDuration ? window.formatYelpDuration(durationMs) : '';
        toast.show({
          type: 'warning',
          title: 'Fetch stopped',
          message: `Cancelled at ${time}. Kept ${newLeads} new lead${newLeads === 1 ? '' : 's'} · cursor saved at offset ${finalOffset}.`,
        });
      },
    });

  const startYelpFetch = (campaign, fetchCount) => {
    if (yelpRun) {
      toast.show({ type: 'warning', title: 'Yelp fetch already running', message: 'Wait for the current fetch to finish or stop it first.' });
      return;
    }
    setYelpCampaignId(campaign.id);
    startYelpRun({
      campaignId: campaign.id,
      fetchCount,
      startingOffset: campaign.apiOffset || 0,
      initialTotal: campaign.apiTotalAvailable,
    });
  };

  // React to the Tweaks “Simulate Yelp fetch” toggle. Picks the currently
  // visible Yelp campaign and runs a default-sized fetch through it.
  useEffect(() => {
    if (t.simulateYelpFetch && !yelpRun && route.name === 'detail') {
      const c = campaigns.find((x) => x.id === route.id);
      if (!c || c.source !== 'yelp') { setTweak('simulateYelpFetch', false); return; }
      if (t.yelpApiKeyMissing) {
        toast.show({ type: 'warning', title: 'No Yelp API key', message: 'Toggle off “Simulate missing API key” in Tweaks to run a fetch.' });
        setTweak('simulateYelpFetch', false);
        return;
      }
      const remaining = c.apiTotalAvailable != null ? Math.max(0, c.apiTotalAvailable - (c.apiOffset || 0)) : 250;
      if (remaining <= 0) {
        toast.show({ type: 'warning', title: 'Nothing to fetch', message: 'All available Yelp businesses for this search are already in the leads table.' });
        setTweak('simulateYelpFetch', false);
        return;
      }
      startYelpFetch(c, Math.min(remaining, 150));
    }
  }, [t.simulateYelpFetch, route]);

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
  const goList     = (source = 'gmaps') => setRoute({ name: 'list', source });
  const goDetail   = (c) => {
    // accept either a campaign object or just an id
    if (typeof c === 'string') {
      const found = campaigns.find((x) => x.id === c);
      setRoute({ name: 'detail', source: found?.source || 'gmaps', id: c });
    } else {
      setRoute({ name: 'detail', source: c.source || 'gmaps', id: c.id });
    }
  };
  const goInbox = () => setRoute({ name: 'inbox' });
  const handleNav = (id) => {
    if (id === 'home')  return goHome();
    if (id === 'inbox') return goInbox();
    const source = SIDEBAR_TO_SOURCE[id];
    if (source) return goList(source);
  };

  // ── Inbox mutations ────────────────────────────────────────────────────
  // Each mirrors a single API route from §9 of PHASE_8_INBOX.md.

  // POST /api/inbox/threads
  const createInboxThread = (campaignId, recipients) => {
    if (!recipients?.length) return null;
    const id = newInboxId('th');
    const now = Date.now();
    const rel = 'just now';
    const thread = {
      id, campaignId,
      createdAtRel: rel,
      updatedAtRel: rel,
      updatedAtMs: now,
      recipients: recipients.map((r) => ({
        leadId: r.leadId ?? r.id ?? null,
        email: r.email,
        name: r.name || null,
      })),
      messages: [],
      lastSubject: '(no messages yet)',
    };
    setInboxThreadsByCampaign((prev) => ({
      ...prev,
      [campaignId]: [thread, ...(prev[campaignId] || [])],
    }));
    return id;
  };

  // POST /api/inbox/threads/[threadId]/messages
  const sendInboxMessage = (threadId, payload) => {
    const now = Date.now();
    const messageRecipients = payload.recipients.map((r) => ({
      email: r.email,
      status: r.status || 'SENT',
      smtpMessageId: r.smtpMessageId,
      errorMessage: r.errorMessage,
    }));
    const sent = messageRecipients.filter((r) => r.status === 'SENT').length;
    const failed = messageRecipients.filter((r) => r.status === 'FAILED').length;
    const overall =
      sent === 0 && failed > 0 ? 'FAILED' :
      failed > 0 ? 'PARTIAL' :
      sent > 0 ? 'SENT' : 'DRAFT';
    const newMessage = {
      id: newInboxId('msg'),
      subject: payload.subject,
      fromAddress: MAILHOG_FROM,
      html: payload.html || '',
      text: payload.text || '',
      sentAtRel: 'just now',
      status: overall,
      recipients: messageRecipients,
    };
    setInboxThreadsByCampaign((prev) => {
      const out = { ...prev };
      for (const cid of Object.keys(out)) {
        out[cid] = out[cid].map((t) => {
          if (t.id !== threadId) return t;
          const messages = [...t.messages, newMessage];
          return {
            ...t,
            messages,
            updatedAtMs: now,
            updatedAtRel: 'just now',
            lastSubject: newMessage.subject,
          };
        });
      }
      return out;
    });
  };

  // DELETE /api/inbox/messages/[messageId]
  const deleteInboxMessage = (threadId, messageId) => {
    setInboxThreadsByCampaign((prev) => {
      const out = { ...prev };
      for (const cid of Object.keys(out)) {
        out[cid] = out[cid].map((t) => {
          if (t.id !== threadId) return t;
          const messages = t.messages.filter((m) => m.id !== messageId);
          const last = messages[messages.length - 1];
          return { ...t, messages, lastSubject: last?.subject || '(no messages)' };
        });
      }
      return out;
    });
    toast.show({ type: 'success', title: 'Message deleted', message: 'Stored HTML file removed.' });
  };

  // DELETE /api/inbox/threads/[threadId]
  const deleteInboxThread = (threadId) => {
    let owningCampaign = null;
    setInboxThreadsByCampaign((prev) => {
      const out = { ...prev };
      for (const cid of Object.keys(out)) {
        if (out[cid].some((t) => t.id === threadId)) owningCampaign = cid;
        out[cid] = out[cid].filter((t) => t.id !== threadId);
      }
      return out;
    });
    if (activeInboxThreadId === threadId) setActiveInboxThreadId(null);
    toast.show({ type: 'success', title: 'Thread deleted', message: 'Thread and all messages removed.' });
  };

  // Campaign page → Inbox: pre-flight then route
  const openInboxFromCampaign = (campaignId, leads, opts = {}) => {
    if (!leads.length) {
      toast.show({
        type: 'warning',
        title: 'None of the selected leads have an email',
        message: 'Use Find Email first, or enter emails manually before sending outreach.',
      });
      return;
    }
    if (opts.skipped) {
      toast.show({
        type: 'warning',
        title: `${opts.skipped} lead${opts.skipped === 1 ? '' : 's'} skipped`,
        message: `${opts.skipped} selected lead${opts.skipped === 1 ? ' has' : 's have'} no email — opening Inbox with the rest.`,
      });
    }
    setPendingInboxSelection({ campaignId, leads });
    setActiveInboxCampaignId(campaignId);
    goInbox();
  };

  // Campaign mutations
  const openRunModal = (c) => setRunModal(c);
  // gmaps + linkedin route to RunCampaignModal (append/replace radio).
  // Yelp routes to YelpRunModal (fetch-count input + cursor states).
  const startRun = (modeOrPayload) => {
    const c = runModal;
    setRunModal(null);
    if (!c) return;
    if (c.source === 'yelp') {
      // payload from YelpRunModal: { fetchCount }
      const fetchCount = modeOrPayload?.fetchCount || 100;
      goDetail(c);
      toast.show({ type: 'success', title: 'Yelp fetch started', message: `Fetching up to ${fetchCount} businesses for “${c.keyword}”…` });
      startYelpFetch(c, fetchCount);
      return;
    }
    const mode = modeOrPayload;
    if (mode === 'replace') {
      toast.show({ type: 'warning', title: 'Replacing all leads', message: `Deleted ${c.totalLeads} leads. Scraping started.` });
    } else {
      toast.show({ type: 'success', title: 'Scraping started', message: `Looking for new leads matching "${c.keyword}".` });
    }
    goDetail(c);
    setTweak('simulateScraping', true);
  };

  const createCampaign = (data) => {
    const source = data.source || (route.name === 'list' || route.name === 'detail' ? route.source : 'gmaps') || 'gmaps';
    const newC = {
      id: (source === 'yelp' ? 'y' : source === 'linkedin' ? 'ln' : 'c') + (campaigns.length + 1 + Math.floor(Math.random() * 1000)),
      source,
      ...data,
      notifyEmail: data.notifyEmail || '',
      status: 'ACTIVE',
      totalLeads: 0, contacted: 0, newSinceLast: 0,
      lastRun: 'never',
      progress: 0,
    };
    setCampaigns(cs => [newC, ...cs]);
    setCreateOpen(false);
    toast.show({ type: 'success', title: 'Campaign created', message: `"${newC.name}" is ready. Hit Run to scrape ${SOURCES[source].leadEntity}.` });
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
  const currentSource = route.source || 'gmaps';
  const sidebarActive =
    route.name === 'home'  ? 'home'  :
    route.name === 'inbox' ? 'inbox' :
    SOURCE_TO_SIDEBAR[currentSource] || 'gmaps';
  const visibleCampaigns = (route.name === 'list' || route.name === 'detail')
    ? campaigns.filter((c) => (c.source || 'gmaps') === currentSource)
    : campaigns;

  const breadcrumb =
    route.name === 'home'   ? ['Outrich Manager'] :
    route.name === 'inbox'  ? ['Outrich Manager', 'Inbox'] :
    route.name === 'list'   ? [SOURCES[currentSource].breadcrumb, 'Campaigns'] :
    /* detail */              [SOURCES[currentSource].breadcrumb, 'Campaigns', currentCampaign?.name || ''];

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
              onGoToScraper={() => goList('gmaps')}
            />
          ) : route.name === 'inbox' ? (
            <InboxPage
              campaigns={campaigns}
              leadsByCampaign={leadsByCampaign}
              threadsByCampaign={inboxThreadsByCampaign}
              activeCampaignId={activeInboxCampaignId}
              activeThreadId={activeInboxThreadId}
              pendingSelection={pendingInboxSelection}
              onSelectCampaign={(cid) => {
                setActiveInboxCampaignId(cid);
                const first = inboxThreadsByCampaign[cid]?.[0];
                setActiveInboxThreadId(first?.id || null);
              }}
              onSelectThread={setActiveInboxThreadId}
              onCreateThread={createInboxThread}
              onSendMessage={sendInboxMessage}
              onDeleteThread={deleteInboxThread}
              onDeleteMessage={deleteInboxMessage}
              onClearPending={() => setPendingInboxSelection(null)}
            />
          ) : t.showEmptyState ? (
            <CampaignListPage
              campaigns={[]}
              source={currentSource}
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
              campaigns={visibleCampaigns}
              source={currentSource}
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
              onBack={() => goList(currentCampaign.source || 'gmaps')}
              onRun={() => openRunModal(currentCampaign)}
              onArchive={() => { archiveCampaign(currentCampaign); goList(currentCampaign.source || 'gmaps'); }}
              onEdit={() => setEditingCampaign(currentCampaign)}
              scraping={scrapingCampaignId === currentCampaign.id}
              scrapingFound={scrapingFound}
              onStopScraping={stopScraping}
              onLeadStatusChange={updateLeadStatus}
              onLeadNotesChange={updateLeadNotes}
              onLeadEmailChange={updateLeadEmail}
              onExport={exportCSV}
              enrichRun={enrichmentCampaignId === currentCampaign.id ? enrichRun : null}
              enrichElapsedMs={enrichElapsedMs}
              enrichJustFound={justFoundIds}
              onFindEmails={findEmailsForLeads}
              onStopEnrich={cancelEnrichRun}
              yelpRun={yelpCampaignId === currentCampaign.id ? yelpRun : null}
              yelpElapsedMs={yelpElapsedMs}
              yelpJustFetched={yelpJustFetchedIds}
              onStopYelpFetch={cancelYelpRun}
              onOpenInbox={openInboxFromCampaign}
            />
          ) : (
            <div className="px-8 py-24 text-center text-mute">Campaign not found. <button className="text-ink dark:text-d-ink underline" onClick={() => goList('gmaps')}>Back to campaigns</button></div>
          )}
        </main>
      </div>

      {/* Modals */}
      <CreateCampaignModal
        open={createOpen}
        source={currentSource}
        onClose={() => setCreateOpen(false)}
        onCreate={createCampaign}
        yelpApiKeyMissing={t.yelpApiKeyMissing}
      />
      <EditCampaignModal
        open={!!editingCampaign}
        campaign={editingCampaign}
        onClose={() => setEditingCampaign(null)}
        onSave={saveCampaignEdit}
        onArchive={(c) => { archiveCampaign(c); goList(); }}
      />
      {/* Run modal is source-branched. Yelp opens YelpRunModal; gmaps +
          linkedin keep RunCampaignModal. Both call onStart(payload) and
          the App distinguishes by payload shape. */}
      {runModal?.source === 'yelp' ? (
        window.YelpRunModal ? (
          <YelpRunModal
            open={!!runModal}
            campaign={runModal}
            onClose={() => setRunModal(null)}
            onStart={startRun}
            apiKeyMissing={t.yelpApiKeyMissing}
          />
        ) : null
      ) : (
        <RunCampaignModal
          open={!!runModal}
          campaign={runModal}
          onClose={() => setRunModal(null)}
          onStart={startRun}
        />
      )}

      {/* Tweaks panel */}
      {window.TweaksPanel && (
        <TweaksPanel title="Outrich tweaks">
          <TweakSection label="View">
            <TweakRadio
              label="Start on"
              value={route.name === 'home' ? 'home' : 'list'}
              options={[{ value: 'home', label: 'Manager' }, { value: 'list', label: 'Scraper' }]}
              onChange={(v) => { setTweak('startRoute', v); setRoute(v === 'home' ? { name: 'home' } : { name: 'list', source: 'gmaps' }); }}
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
            <TweakToggle
              label="Simulate email enrichment"
              value={t.simulateEnrichment}
              onChange={(v) => setTweak('simulateEnrichment', v)}
            />
          </TweakSection>
          <TweakSection label="Yelp API">
            <TweakToggle
              label="Simulate Yelp fetch"
              value={t.simulateYelpFetch}
              onChange={(v) => setTweak('simulateYelpFetch', v)}
            />
            <TweakToggle
              label="Simulate missing API key"
              value={t.yelpApiKeyMissing}
              onChange={(v) => setTweak('yelpApiKeyMissing', v)}
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
