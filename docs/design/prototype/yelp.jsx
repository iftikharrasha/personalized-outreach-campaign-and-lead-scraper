// ───────── Yelp API adapter (Phase 7) ─────────
// Visual layer for the Yelp Fusion API fetch flow. The real implementation
// lives in the worker (apps/scraper/src/yelp-fetch.ts) — this prototype
// simulates its progress callbacks so the UX can be evaluated without a
// backend. The Yelp campaign is a stateful cursor; once a campaign has been
// run, its keyword is locked (see edit-modal) and the cursor (apiOffset)
// advances per batch so progress survives crashes and cancellation.
//
// What this file owns:
//   • YelpRunModal — 4 states: first-run / resume / fully-fetched / no-key.
//     Reuses the shared Modal primitive. NOT branched off RunCampaignModal,
//     because the input shape (fetch-count, not append/replace) is genuinely
//     different and forcing both into one component would confuse it.
//   • useYelpFetchSimulator — fakes the batch loop: 50 businesses per request,
//     advances cursor per batch, reports new/duplicates, supports cancel.
//   • YelpFetchBanner — active-run banner; mirrors EnrichmentBanner's shape
//     (primary-pale palette, live counters, determinate progress, stop+timer).
//   • YelpProgressLine — small "X fetched · Y available" footer line used on
//     the Yelp campaign card; honest copy with first-run fallback.
//   • A small bank of synthetic Yelp business rows the simulator appends to
//     the leads table so a fetch run feels real on screen.

// ── Format helpers ──
// Used by both the banner timer and the completion toast.
function formatYelpDuration(ms) {
  if (ms == null) return '0:00';
  const s = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, '0')}`;
}

// ── Synthetic Yelp businesses (fallback fetch pool) ──
// The simulator pulls from this when it needs a "new" lead to flow in. They
// roughly look like real Yelp results — neighborhood + category + rating +
// claimed flag — so the row that lands on screen looks at home in the table.
const YELP_FETCH_POOL = [
['Birch Coffee', '718-555-2941', 'birchcoffee.com', 4.5, 412, '$', 'Coffee & Tea', 'Park Slope', true],
['Brunswick', '718-555-1872', 'brunswickbk.com', 4.3, 286, '$$', 'Cafes', 'Greenpoint', true],
['Variety', '718-555-4480', 'varietycoffee.com', 4.4, 798, '$', 'Coffee & Tea', 'Williamsburg', true],
['Toby\'s Estate', '718-555-7733', 'tobysestate.com', 4.6, 533, '$$', 'Coffee & Tea', 'Williamsburg', true],
['Hungry Ghost', '347-555-9821', '', 4.2, 122, '$', 'Coffee & Tea', 'Fort Greene', false],
['Café Grumpy', '718-555-3140', 'cafegrumpy.com', 4.4, 942, '$$', 'Coffee & Tea', 'Park Slope', true],
['Stumptown', '718-555-2228', 'stumptowncoffee.com', 4.5, 1140, '$', 'Coffee & Tea', 'DUMBO', true],
['Black Brick', '347-555-7008', 'blackbrickcoffee.com', 4.1, 68, '$', 'Coffee & Tea', 'Bushwick', false],
['Roebling Tea', '718-555-6605', '', 4.2, 215, '$$', 'Cafes', 'Williamsburg', true],
['Konditori', '347-555-3320', 'konditori-nyc.com', 4.3, 312, '$', 'Coffee & Tea', 'Park Slope', true],
['Café Madeline', '347-555-8801', '', 4.0, 96, '$', 'Cafes', 'Prospect Heights', false],
['Sey Coffee', '347-555-1290', 'seycoffee.com', 4.7, 1830, '$$', 'Coffee & Tea', 'East Williamsburg', true]];


// ── useYelpFetchSimulator ──
// Drives the run from start to stop. Mirrors the worker loop in §10:
//   1. Read cursor (apiOffset, apiTotalAvailable).
//   2. Plan ceil(fetchCount / 50) requests of 50 each.
//   3. Per batch: yield results, advance offset, capture total on req #1.
//   4. Stop on target reached / fewer than 50 returned / cancellation.
// Cancellation persists progress: apiOffset survives at the last good batch.
function useYelpFetchSimulator({ getCampaignById, onBatch, onComplete, onCancel }) {
  const [run, setRun] = useState(null);
  const [now, setNow] = useState(Date.now());
  const stepRef = useRef(null);
  const tickRef = useRef(null);
  const cbRef = useRef({ getCampaignById, onBatch, onComplete, onCancel });
  useEffect(() => {cbRef.current = { getCampaignById, onBatch, onComplete, onCancel };});

  const stopTimers = () => {
    if (stepRef.current) {clearTimeout(stepRef.current);stepRef.current = null;}
    if (tickRef.current) {clearInterval(tickRef.current);tickRef.current = null;}
  };

  const startRun = ({ campaignId, fetchCount, startingOffset = 0, initialTotal = null }) => {
    stopTimers();
    const batches = Math.max(1, Math.ceil(fetchCount / 50));
    const newRun = {
      id: 'yf_' + Math.random().toString(36).slice(2, 8),
      campaignId,
      fetchCount,
      startingOffset,
      currentOffset: startingOffset,
      apiTotalAvailable: initialTotal,
      batchesPlanned: batches,
      batchesDone: 0,
      fetched: 0,
      newLeads: 0,
      duplicates: 0,
      status: 'RUNNING',
      startedAt: Date.now()
    };
    setRun(newRun);
    setNow(Date.now());
    tickRef.current = setInterval(() => setNow(Date.now()), 250);

    let i = 0;
    const step = () => {
      setRun((r) => {
        if (!r || r.status !== 'RUNNING') return r;
        // Each batch is exactly 50 businesses (or fewer on the last call if
        // the total runs out — Yelp returns short and we stop).
        const isLast = i === r.batchesPlanned - 1;
        const totalSoFar = r.fetchCount;
        const batchSize = isLast ? totalSoFar - r.fetched : 50;
        // Yelp's reported total: captured on the *first* request. We simulate
        // a realistic number — usually larger than fetchCount.
        const apiTotalAvailable =
        r.apiTotalAvailable != null ? r.apiTotalAvailable :
        i === 0 ? Math.max(r.currentOffset + r.fetchCount, 240 + Math.floor(Math.random() * 600)) : null;
        // Dedupe distribution: 80–95% new, rest duplicates. Mirrors the
        // honest-counter principle in §9.
        const dupRate = 0.04 + Math.random() * 0.13;
        const dups = Math.round(batchSize * dupRate);
        const news = batchSize - dups;
        // Emit the batch upward so app.jsx can append new lead rows.
        cbRef.current.onBatch?.({
          campaignId: r.campaignId,
          newLeads: news,
          duplicates: dups,
          offsetAfter: r.currentOffset + batchSize
        });
        const nextRun = {
          ...r,
          apiTotalAvailable,
          batchesDone: r.batchesDone + 1,
          currentOffset: r.currentOffset + batchSize,
          fetched: r.fetched + batchSize,
          newLeads: r.newLeads + news,
          duplicates: r.duplicates + dups
        };
        i += 1;
        if (i >= nextRun.batchesPlanned) {
          stopTimers();
          setTimeout(() => {
            cbRef.current.onComplete?.({
              campaignId: nextRun.campaignId,
              fetched: nextRun.fetched,
              newLeads: nextRun.newLeads,
              duplicates: nextRun.duplicates,
              finalOffset: nextRun.currentOffset,
              apiTotalAvailable: nextRun.apiTotalAvailable,
              durationMs: Date.now() - nextRun.startedAt
            });
          }, 0);
          return { ...nextRun, status: 'COMPLETED' };
        }
        stepRef.current = setTimeout(step, 650 + Math.random() * 300);
        return nextRun;
      });
    };
    stepRef.current = setTimeout(step, 350);
  };

  const cancelRun = () => {
    stopTimers();
    setRun((r) => {
      if (!r) return r;
      setTimeout(() => {
        cbRef.current.onCancel?.({
          campaignId: r.campaignId,
          fetched: r.fetched,
          newLeads: r.newLeads,
          duplicates: r.duplicates,
          finalOffset: r.currentOffset,
          apiTotalAvailable: r.apiTotalAvailable,
          durationMs: Date.now() - r.startedAt
        });
      }, 0);
      return null;
    });
  };

  useEffect(() => () => stopTimers(), []);

  const elapsedMs = run ? now - run.startedAt : 0;
  return { run, elapsedMs, startRun, cancelRun };
}

// ── YelpFetchBanner ──
// Shows during an active Yelp fetch. Same visual chassis as EnrichmentBanner
// (primary-pale tint, ink Stop button with embedded timer, determinate bar)
// so the two "engine" surfaces feel like a family. Copy is fetch-flavored:
// "Fetching from Yelp Fusion API…", batches-of-50 progress, honest counters.
function YelpFetchBanner({ run, elapsedMs, onStop, campaignName }) {
  if (!run) return null;
  const total = run.fetchCount;
  const pct = Math.min(100, Math.round(run.fetched / total * 100));
  const batchLabel = `Batch ${Math.min(run.batchesDone + 1, run.batchesPlanned)} of ${run.batchesPlanned}`;
  return (
    <div
      className="mt-6 rounded-card bg-primary-pale/70 dark:bg-primary/10 border border-primary/40 px-5 py-4 anim-fadein"
      style={{ borderRadius: '14px' }}>
      <div className="flex items-start gap-4">
        <div className="w-11 h-11 rounded-full bg-primary text-ink flex items-center justify-center shrink-0 relative">
          <IconStar size={20} />
          <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-ink text-primary flex items-center justify-center">
            <IconNetwork size={9} />
          </span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <div className="text-[15px] font-semibold text-ink dark:text-d-ink">
                Fetching <span className="tabular-nums">{total}</span> businesses from Yelp…
              </div>
              <div className="text-[12.5px] text-body dark:text-d-body mt-0.5">
                {batchLabel} · Yelp Fusion API · 50 per request
              </div>
            </div>

            <button
              onClick={onStop}
              className="shrink-0 inline-flex items-center gap-2 bg-ink hover:bg-ink/90 text-canvas rounded-full pl-3 pr-1 py-1 text-[13px] font-semibold transition-colors"
              title="Cancel the fetch. Already-fetched leads are kept and the cursor stays at the last completed batch.">
              <IconStop size={13} />
              Stop
              <span className="ml-1 inline-flex items-center gap-1 bg-canvas/15 px-2 py-0.5 rounded-full text-[12px] tabular-nums font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-primary pulse-dot" />
                {formatYelpDuration(elapsedMs)}
              </span>
            </button>
          </div>

          {/* Counters strip — Fetched / New / Duplicates / Cursor.
               The cursor pip is unique to Yelp; it exists so a user who
               cancels mid-run can see exactly where the next run will pick
               up from. */}
          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[12.5px]">
            {window.CounterPip ?
            <>
                <CounterPip label="Fetched" value={`${run.fetched}/${total}`} />
                <CounterPip label="New leads" value={run.newLeads} tone="positive" />
                <CounterPip label="Duplicates" value={run.duplicates} tone="mute" sub="already in this campaign" />
                <span className="inline-flex items-center gap-1.5 text-[12.5px] text-mute">
                  <IconNetwork size={11} />
                  <span>Cursor</span>
                  <span className="font-semibold tabular-nums text-ink dark:text-d-ink">offset {run.currentOffset}</span>
                </span>
              </> :
            null}
          </div>

          {/* Progress bar — determinate (we know the fetch target). */}
          <div className="mt-3 relative h-1.5 rounded-full bg-primary/15 overflow-hidden">
            <div
              className="absolute inset-y-0 left-0 bg-ink dark:bg-d-ink rounded-full transition-[width] duration-300 ease-out"
              style={{ width: pct + '%' }} />
            
          </div>
        </div>
      </div>
    </div>);

}

// ── YelpProgressLine ──
// Replaces the "Last run · +N new" footer on Yelp campaign cards when the
// campaign has a cursor. Honest-language: "100 fetched · 312 available."
// Before the first run, falls back to the standard "never" copy so the card
// doesn't lie about availability (§8).
function YelpProgressLine({ campaign }) {
  const offset = campaign.apiOffset || 0;
  const total = campaign.apiTotalAvailable;
  // Pre-first-run: no real total to display.
  if (offset === 0 || total == null) {
    return (
      <div className="text-[12px] text-mute flex items-center gap-1.5">
        <IconHistory size={12} />
        Last run {campaign.lastRun} · <span className="text-mute italic">cursor not started</span>
      </div>);

  }
  const pct = Math.min(100, Math.round(offset / total * 100));
  const fullyFetched = offset >= total;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-[12px]">
        <span className="text-mute flex items-center gap-1.5">
          <IconHistory size={12} /> {campaign.lastRun}
        </span>
        <span className="font-semibold tabular-nums text-ink dark:text-d-ink">
          {offset.toLocaleString()} <span className="text-mute font-normal">/</span> {total.toLocaleString()}
          <span className="text-mute font-normal text-[11px] ml-1">fetched</span>
        </span>
      </div>
      <div className="relative h-1 rounded-full bg-canvas-soft dark:bg-d-canvas-soft overflow-hidden">
        <div
          className={cx(
            'absolute inset-y-0 left-0 rounded-full transition-[width] duration-300',
            fullyFetched ? 'bg-positive' : 'bg-ink dark:bg-d-ink'
          )}
          style={{ width: pct + '%' }} />
        
      </div>
      {fullyFetched &&
      <div className="text-[11px] text-positive font-medium flex items-center gap-1">
          <IconCheckCircle size={11} /> All available businesses fetched
        </div>
      }
    </div>);

}

// ── YelpRunModal ──
// Drives a Yelp fetch. Four mutually-exclusive states; the right one is
// chosen by the campaign's cursor + the API-key flag.
function YelpRunModal({ open, onClose, campaign, onStart, apiKeyMissing }) {
  // Local fetch-count input. Defaults to 500 first-run, or remaining for resume.
  const [fetchCount, setFetchCount] = useState(500);
  useEffect(() => {
    if (!open || !campaign) return;
    const remaining = campaign.apiTotalAvailable != null ?
    Math.max(0, campaign.apiTotalAvailable - (campaign.apiOffset || 0)) :
    null;
    if (remaining != null && remaining > 0) {
      setFetchCount(Math.min(remaining, 250));
    } else {
      setFetchCount(500);
    }
  }, [open, campaign]);

  if (!campaign) return null;
  const offset = campaign.apiOffset || 0;
  const total = campaign.apiTotalAvailable;
  const remaining = total != null ? Math.max(0, total - offset) : null;
  // State selection — exclusive.
  const isFirstRun = offset === 0 || total == null;
  const isFullyFetched = total != null && offset >= total;
  const isResume = !isFirstRun && !isFullyFetched;
  // Caps per §9.
  const cap = isFirstRun ? 1000 : remaining;
  const clamp = (n) => {
    const v = Math.max(1, Math.min(cap || 1, Math.floor(Number(n) || 0)));
    return v;
  };
  const canStart = !apiKeyMissing && !isFullyFetched && fetchCount >= 1 && fetchCount <= (cap || 1);

  return (
    <Modal open={open} onClose={onClose} width={560}>
      <div className="flex items-start justify-between mb-5">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-wider font-semibold text-primary-deep bg-primary-pale rounded-full px-2 py-0.5">
              <IconStar size={11} /> Yelp · API
            </span>
            {isResume &&
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-mute bg-canvas-soft dark:bg-d-canvas-soft rounded-full px-2 py-0.5">
                <IconNetwork size={10} /> Resume
              </span>
            }
          </div>
          <h2 className="text-[22px] font-semibold text-ink dark:text-d-ink truncate">Fetch from Yelp</h2>
          <p className="text-[13px] text-mute mt-1 truncate">{campaign.name}</p>
        </div>
        <button onClick={onClose} className="text-mute hover:text-ink dark:hover:text-d-ink p-1"><IconX size={18} /></button>
      </div>

      {/* Search summary — the locked keyword + location. Cursor-style chip
           to communicate "this campaign IS this search" (§5). */}
      <div className="rounded-[14px] bg-canvas-soft dark:bg-d-canvas-soft px-4 py-3 mb-5 flex items-start gap-3">
        <div className="mt-0.5 text-mute"><IconSearch size={16} /></div>
        <div className="min-w-0 flex-1">
          <div className="text-[11px] uppercase tracking-wide text-mute font-semibold">Yelp search</div>
          <div className="text-[15px] font-medium text-ink dark:text-d-ink mt-0.5 truncate">"{campaign.keyword}"</div>
          <div className="text-[11.5px] text-mute mt-1 flex items-center gap-1.5">
            <IconMapPin size={11} /> {campaign.city}{campaign.state ? `, ${abbrevState(campaign.state)}` : ''}
            {!isFirstRun &&
            <>
                <span className="text-line dark:text-d-line mx-1">·</span>
                <IconLock size={11} />
                <span>Keyword locked</span>
              </>
            }
          </div>
        </div>
      </div>

      {/* State-specific body */}
      {apiKeyMissing ?
      <YelpStateNoKey /> :
      isFullyFetched ?
      <YelpStateFullyFetched total={total} /> :

      <YelpFetchBody
        isFirstRun={isFirstRun}
        offset={offset}
        total={total}
        remaining={remaining}
        fetchCount={fetchCount}
        setFetchCount={setFetchCount}
        cap={cap}
        clamp={clamp} />

      }

      <div className="mt-6 -mx-6 px-6 pt-5 border-t border-line dark:border-d-line flex items-center justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button
          variant="primary"
          disabled={!canStart}
          onClick={() => onStart({ fetchCount: clamp(fetchCount) })}
          rightIcon={<IconPlay size={13} />}>
          {isFullyFetched ? 'Nothing to fetch' : isResume ? `Fetch ${clamp(fetchCount)} more` : `Fetch ${clamp(fetchCount)} businesses`}
        </Button>
      </div>
    </Modal>);

}

// ── YelpFetchBody ──
// The shared form body for first-run + resume. Differs only in copy + cap.
function YelpFetchBody({ isFirstRun, offset, total, remaining, fetchCount, setFetchCount, cap, clamp }) {
  // Quick-pick chips: a handful of preset fetch sizes that respect the cap.
  // Helps the user avoid typing — most people will tap rather than think
  // about a number.
  const presets = [50, 100, 250, 500, 1000].filter((n) => n <= cap);
  return (
    <>
      {/* Context line */}
      <div className="mb-4 text-[13px] text-body dark:text-d-body leading-relaxed">
        {isFirstRun ?
        <>
            This is the campaign's <span className="font-semibold text-ink dark:text-d-ink">first run</span>. Yelp returns up to <span className="font-semibold text-ink dark:text-d-ink">1,000 businesses</span> per search; we won't know the real available count until the first request comes back.
          </> :

        <>
            You've fetched <span className="font-semibold text-ink dark:text-d-ink tabular-nums">{offset.toLocaleString()}</span> of <span className="font-semibold text-ink dark:text-d-ink tabular-nums">{total.toLocaleString()}</span> businesses. <span className="font-semibold text-ink dark:text-d-ink tabular-nums">{remaining.toLocaleString()}</span> remain.
          </>
        }
      </div>

      {/* Fetch count input */}
      <div>
        <div className="flex items-baseline justify-between mb-2">
          <label className="text-[13px] font-semibold text-ink dark:text-d-ink">How many leads you want to scrap?

          </label>
          <span className="text-[11.5px] text-mute">
            Max <span className="tabular-nums font-medium text-body dark:text-d-body">{cap.toLocaleString()}</span>
          </span>
        </div>
        <div className="flex items-center gap-2 mb-3">
          <button
            onClick={() => setFetchCount(clamp(fetchCount - 50))}
            className="w-9 h-9 rounded-full bg-canvas-soft dark:bg-d-canvas-soft hover:bg-line dark:hover:bg-d-line text-ink dark:text-d-ink transition-colors flex items-center justify-center"
            aria-label="Decrease by 50">
            <span className="text-[15px] font-semibold">−</span>
          </button>
          <div className="relative flex-1">
            <Input
              type="number"
              value={fetchCount}
              onChange={(e) => setFetchCount(e.target.value === '' ? '' : Number(e.target.value))}
              onBlur={(e) => setFetchCount(clamp(e.target.value))}
              className="text-center text-[18px] font-semibold tabular-nums"
              min={1}
              max={cap} />
            
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-mute pointer-events-none">businesses</span>
          </div>
          <button
            onClick={() => setFetchCount(clamp(fetchCount + 50))}
            className="w-9 h-9 rounded-full bg-canvas-soft dark:bg-d-canvas-soft hover:bg-line dark:hover:bg-d-line text-ink dark:text-d-ink transition-colors flex items-center justify-center"
            aria-label="Increase by 50">
            <span className="text-[15px] font-semibold">+</span>
          </button>
        </div>

        {/* Preset chips */}
        {presets.length > 0 &&
        <div className="flex flex-wrap gap-1.5">
            {presets.map((n) =>
          <button
            key={n}
            onClick={() => setFetchCount(n)}
            className={cx(
              'text-[12px] font-medium rounded-full px-2.5 py-1 transition-colors',
              fetchCount === n ?
              'bg-primary text-ink' :
              'bg-canvas-soft hover:bg-line dark:bg-d-canvas-soft dark:hover:bg-d-line text-body dark:text-d-body'
            )}>
                {n.toLocaleString()}
              </button>
          )}
          </div>
        }
      </div>

      {/* Honest-toast preview — exactly mirrors what the completion toast
           will say so the user isn't surprised when "fetched ≠ new leads." */}
      <div className="mt-5 rounded-[14px] border border-line dark:border-d-line bg-canvas-soft/40 dark:bg-d-canvas-soft/40 p-3.5 flex items-start gap-2.5">
        <span className="mt-0.5 text-mute"><IconInfo size={14} /></span>
        <div className="text-[12.5px] text-body dark:text-d-body leading-relaxed">
          <span className="font-medium text-ink dark:text-d-ink">Fetched ≠ new leads.</span>
          {' '}Yelp's response can include businesses we already have for this campaign. Those count as <span className="font-medium text-ink dark:text-d-ink">duplicates</span>, not new leads. The completion summary breaks it down honestly: <span className="italic text-mute">"Fetched {Math.min(fetchCount || 0, cap)} · X new · Y duplicates."</span>
        </div>
      </div>

      {/* Cost / request math */}
      <div className="mt-3 text-[11.5px] text-mute flex flex-wrap items-center gap-x-4 gap-y-1">
        <span className="inline-flex items-center gap-1"><IconNetwork size={11} /> {Math.ceil((fetchCount || 0) / 50)} API requests of 5,000 / day</span>
        <span className="inline-flex items-center gap-1"><IconClock size={11} /> ~{Math.max(1, Math.ceil((fetchCount || 0) / 50))} seconds</span>
        {isFirstRun &&
        <span className="inline-flex items-center gap-1"><IconLock size={11} /> Keyword will lock after this run</span>
        }
      </div>
    </>);

}

// ── YelpStateNoKey ──
// Shown when YELP_API_KEY is missing/empty. Hard-block the run; the user
// can still see the campaign and the modal works, but Start is disabled.
function YelpStateNoKey() {
  return (
    <div className="rounded-[14px] bg-red-50 dark:bg-red-900/20 border border-red-200/60 dark:border-red-800/60 p-4">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/40 text-negative flex items-center justify-center shrink-0">
          <IconAlert size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[15px] font-semibold text-[#7a0009] dark:text-red-200">No Yelp API key configured</div>
          <p className="text-[13px] text-[#a7000d]/85 dark:text-red-300 mt-1 leading-relaxed">
            Outrich uses the Yelp Fusion API — you need a free API key from{' '}
            <span className="font-mono text-[12px] bg-red-100/60 dark:bg-red-900/40 px-1 py-0.5 rounded">yelp.com/developers</span>.
            Add it to <span className="font-mono text-[12px] bg-red-100/60 dark:bg-red-900/40 px-1 py-0.5 rounded">.env</span> as{' '}
            <span className="font-mono text-[12px] bg-red-100/60 dark:bg-red-900/40 px-1 py-0.5 rounded">YELP_API_KEY=…</span> then restart the worker.
          </p>
          <div className="mt-2 text-[11.5px] text-mute">
            Free tier: 5,000 requests/day · plenty for normal use
          </div>
        </div>
      </div>
    </div>);

}

// ── YelpStateFullyFetched ──
// Cursor has reached Yelp's reported total. The only way to "search more" is
// a new campaign — that's the §5 cursor model talking. Run button disabled.
function YelpStateFullyFetched({ total }) {
  return (
    <div className="rounded-[14px] bg-primary-pale/50 dark:bg-primary/10 border border-primary/40 p-4">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-primary text-ink flex items-center justify-center shrink-0">
          <IconCheckCircle size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[15px] font-semibold text-ink dark:text-d-ink">
            All <span className="tabular-nums">{total.toLocaleString()}</span> businesses fetched
          </div>
          <p className="text-[13px] text-body dark:text-d-body mt-1 leading-relaxed">
            Yelp doesn't have any more results for this exact search. To search a different keyword or a different city, create a new campaign — Yelp campaigns are bound to one specific search by design.
          </p>
        </div>
      </div>
    </div>);

}

Object.assign(window, {
  formatYelpDuration,
  YELP_FETCH_POOL,
  useYelpFetchSimulator,
  YelpFetchBanner,
  YelpProgressLine,
  YelpRunModal
});