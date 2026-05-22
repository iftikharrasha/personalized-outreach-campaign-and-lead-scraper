// ───────── Email Enrichment (Phase 6) ─────────
// Visual layer for the HTTP+regex email enrichment flow defined in
// PHASE_6_EMAIL_ENRICHMENT.md. The real implementation lives in the worker
// (apps/scraper/src/enrich.ts) — this prototype simulates the worker's
// progress callbacks so the UX can be evaluated without a backend.
//
// What this file owns:
//   • EnrichmentBanner — the active-run banner (mirrors the scraping banner
//     but in the brand-primary palette so it reads as "discovery" not "block")
//   • useEnrichmentSimulator — the in-memory engine: tracks queue, counters,
//     timer, fires onFound(leadId, email) as each lead completes
//   • Find-Email button + searching-state for the existing Email modal
//   • formatRunDuration helper used by both the banner timer + completion toast
//
// The shape of the run mirrors the EnrichmentRun row in the DB schema:
//   { id, leadIds, totalLeads, processedCount, foundCount, failedCount,
//     skippedCount, startedAt, currentLeadId?, status }

// ── Duration formatter ──
// 0:03 / 0:42 / 1:08. Used in the Stop button timer + the completion toast.
function formatRunDuration(ms) {
  if (ms == null) return '0:00';
  const s = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, '0')}`;
}

// ── useEnrichmentSimulator ──
// Walks a leadIds list at ~750ms / lead, randomly marks ~30% as "not found",
// 5% as already-skipped, the rest as successfully enriched. Calls onFound
// with a synthesized info@{domain} address so the row table shows it landing
// live exactly like the real worker would.
function useEnrichmentSimulator({ getLeadById, onFound, onComplete, onCancel }) {
  const [run, setRun] = useState(null);             // active run (or null)
  const [now, setNow]   = useState(Date.now());     // ticking clock for the timer

  const timerRef = useRef(null);                    // per-lead step timer
  const tickRef  = useRef(null);                    // 1s clock for banner timer

  // Latest callbacks via refs so the interval closure always sees fresh ones
  const cbRef = useRef({ getLeadById, onFound, onComplete, onCancel });
  useEffect(() => { cbRef.current = { getLeadById, onFound, onComplete, onCancel }; });

  const stopTimers = () => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    if (tickRef.current)  { clearInterval(tickRef.current); tickRef.current = null; }
  };

  // Start a new run. `entryLeadName` is shown in the banner for 1-lead runs;
  // empty/undefined for bulk runs.
  const startRun = ({ leadIds, skippedUpfront = 0, entryLeadName = '' }) => {
    stopTimers();
    if (!leadIds.length) {
      cbRef.current.onComplete?.({ found: 0, failed: 0, skipped: skippedUpfront, total: skippedUpfront, durationMs: 0, cancelled: false });
      return;
    }
    const newRun = {
      id: 'er_' + Math.random().toString(36).slice(2, 8),
      leadIds, totalLeads: leadIds.length + skippedUpfront,
      processedCount: 0, foundCount: 0, failedCount: 0,
      skippedCount: skippedUpfront,
      currentLeadId: leadIds[0],
      startedAt: Date.now(),
      entryLeadName,
      status: 'RUNNING',
    };
    setRun(newRun);
    setNow(Date.now());
    tickRef.current = setInterval(() => setNow(Date.now()), 250);

    let idx = 0;
    const step = () => {
      setRun((r) => {
        if (!r || r.status !== 'RUNNING') return r;
        const leadId = r.leadIds[idx];
        const lead = cbRef.current.getLeadById?.(leadId);
        // Outcome distribution: 65% found, 5% skipped late, 30% failed.
        const roll = Math.random();
        let nextFound = r.foundCount, nextFail = r.failedCount, nextSkip = r.skippedCount;
        if (roll < 0.65 && lead) {
          // Synthesize an email from the lead's website domain.
          const domain = (lead.website || `${(lead.name || 'lead').toLowerCase().replace(/[^a-z0-9]+/g, '')}.com`).replace(/^https?:\/\//, '').replace(/\/$/, '');
          const localParts = ['hello', 'info', 'contact', 'team', 'inquiries', 'office'];
          const local = localParts[Math.floor(Math.random() * localParts.length)];
          const email = `${local}@${domain}`;
          cbRef.current.onFound?.(leadId, email);
          nextFound += 1;
        } else if (roll < 0.70) {
          nextSkip += 1;
        } else {
          nextFail += 1;
        }
        const nextIdx = idx + 1;
        const done = nextIdx >= r.leadIds.length;
        const next = {
          ...r,
          processedCount: r.processedCount + 1,
          foundCount: nextFound, failedCount: nextFail, skippedCount: nextSkip,
          currentLeadId: done ? null : r.leadIds[nextIdx],
          status: done ? 'COMPLETED' : 'RUNNING',
        };
        idx = nextIdx;
        if (done) {
          stopTimers();
          // Fire completion outside this state-setter
          setTimeout(() => {
            cbRef.current.onComplete?.({
              found: next.foundCount,
              failed: next.failedCount,
              skipped: next.skippedCount,
              total: next.totalLeads,
              durationMs: Date.now() - next.startedAt,
              cancelled: false,
            });
          }, 0);
        } else {
          // pace: 600–900ms per lead, plus a hint of variance for realism
          timerRef.current = setTimeout(step, 600 + Math.random() * 350);
        }
        return next;
      });
    };
    timerRef.current = setTimeout(step, 450);
  };

  const cancelRun = () => {
    stopTimers();
    setRun((r) => {
      if (!r) return r;
      const cancelled = { ...r, status: 'CANCELLED', currentLeadId: null };
      setTimeout(() => {
        cbRef.current.onCancel?.({
          found: cancelled.foundCount,
          failed: cancelled.failedCount,
          skipped: cancelled.skippedCount,
          total: cancelled.totalLeads,
          durationMs: Date.now() - cancelled.startedAt,
        });
      }, 0);
      return null;
    });
  };

  useEffect(() => () => stopTimers(), []);

  const elapsedMs = run ? now - run.startedAt : 0;
  return { run, elapsedMs, startRun, cancelRun };
}

// ── EnrichmentBanner ──
// Shows during a run. Mirrors the scraping-banner shape but uses the brand
// primary-pale palette and a determinate progress bar (we know the total).
// The Stop button hosts the live duration timer — same pattern as scraping.
function EnrichmentBanner({ run, elapsedMs, onStop, currentLeadName }) {
  if (!run) return null;
  const { processedCount, totalLeads, foundCount, failedCount, skippedCount, entryLeadName } = run;
  const isSingle = run.leadIds.length === 1;
  const pct = totalLeads > 0 ? Math.min(100, Math.round((processedCount + skippedCount) / totalLeads * 100)) : 0;
  return (
    <div
      className="mt-6 rounded-card bg-primary-pale/70 dark:bg-primary/10 border border-primary/40 px-5 py-4 anim-fadein"
      style={{ borderRadius: '14px' }}>
      <div className="flex items-start gap-4">
        <div className="w-11 h-11 rounded-full bg-primary text-ink flex items-center justify-center shrink-0 relative">
          <IconMail size={20} />
          <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-ink text-primary flex items-center justify-center">
            <IconSparkles size={9} />
          </span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <div className="text-[15px] font-semibold text-ink dark:text-d-ink">
                {isSingle
                  ? <>Searching for {entryLeadName || 'lead'}’s email…</>
                  : <>Email searching across <span className="tabular-nums">{totalLeads}</span> leads…</>}
              </div>
              <div className="text-[12.5px] text-body dark:text-d-body mt-0.5">
                {currentLeadName
                  ? <>Now fetching <span className="text-ink dark:text-d-ink font-medium">{currentLeadName}</span></>
                  : <>Walking homepage → contact pages · stopping at first verified address</>}
              </div>
            </div>

            <button
              onClick={onStop}
              className="shrink-0 inline-flex items-center gap-2 bg-ink hover:bg-ink/90 text-canvas rounded-full pl-3 pr-1 py-1 text-[13px] font-semibold transition-colors"
              title="Cancel the enrichment run. Already-found emails are kept.">
              <IconStop size={13} />
              Stop
              <span className="ml-1 inline-flex items-center gap-1 bg-canvas/15 px-2 py-0.5 rounded-full text-[12px] tabular-nums font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-primary pulse-dot" />
                {formatRunDuration(elapsedMs)}
              </span>
            </button>
          </div>

          {/* Counters strip */}
          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[12.5px]">
            <CounterPip label="Processed" value={`${processedCount}/${run.leadIds.length}`} />
            <CounterPip label="Found" value={foundCount} tone="positive" />
            <CounterPip label="No email" value={failedCount} tone="mute" />
            <CounterPip label="Skipped" value={skippedCount} tone="mute" sub="already had email" />
          </div>

          {/* Progress bar — determinate, total includes upfront-skipped leads */}
          <div className="mt-3 relative h-1.5 rounded-full bg-primary/15 overflow-hidden">
            <div
              className="absolute inset-y-0 left-0 bg-ink dark:bg-d-ink rounded-full transition-[width] duration-300 ease-out"
              style={{ width: pct + '%' }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── CounterPip ──
// Tiny inline label+value display used inside the enrichment banner. Colored
// dot communicates "what state is this counter measuring".
function CounterPip({ label, value, tone = 'ink', sub }) {
  const dotColor =
    tone === 'positive' ? 'bg-positive' :
    tone === 'negative' ? 'bg-negative' :
    tone === 'mute'     ? 'bg-mute' :
                          'bg-ink dark:bg-d-ink';
  const valColor =
    tone === 'positive' ? 'text-positive' :
    tone === 'negative' ? 'text-negative' :
                          'text-ink dark:text-d-ink';
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cx('w-1.5 h-1.5 rounded-full', dotColor)} />
      <span className="text-mute">{label}</span>
      <span className={cx('font-semibold tabular-nums', valColor)}>{value}</span>
      {sub && <span className="text-mute text-[11.5px]">· {sub}</span>}
    </span>
  );
}

// ── Inline "Searching…" pill for the leads-table email cell ──
// Replaces the "Add email" link while the current lead is the one being
// fetched by the worker. Cheap, recognisable, no layout shift.
function SearchingPill() {
  return (
    <span className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-ink dark:text-d-ink bg-primary-pale dark:bg-primary/15 rounded-full px-2.5 py-1 pulse-search">
      <span className="relative flex w-2 h-2">
        <span className="absolute inset-0 rounded-full bg-primary animate-ping opacity-75" />
        <span className="relative rounded-full w-2 h-2 bg-primary" />
      </span>
      Searching…
    </span>
  );
}

Object.assign(window, {
  formatRunDuration,
  useEnrichmentSimulator,
  EnrichmentBanner,
  CounterPip,
  SearchingPill,
});
