// ───────── Outrich Manager — Home Dashboard (off-doc) ─────────
// A roll-up across all campaigns: outreach funnel, freelance earnings,
// scraper-health KPIs, global run history, and a Winning-Leads table.
//
// Off the original PROJECT_PLAN.md. Added so the user can use the app as
// the operating layer of their freelance business, not just a scraper.
//
// All KPI tiles render via the shared <StatCard> in ui.jsx; the run history
// renders via <RunHistoryCard> in run-history.jsx so this page and the
// Campaign Detail page stay visually parallel and update together.

// — Helpers —
function formatMoney(n) {
  return '$' + (n || 0).toLocaleString('en-US');
}
function formatDuration(mins) {
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

// — Mini bar trend for monthly earnings —
function TrendBars({ data }) {
  const max = Math.max(...data.map((d) => d.earned));
  return (
    <div className="mt-4 flex items-end gap-2 h-12">
      {data.map((d, i) => {
        const isCurrent = i === data.length - 1;
        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
            <div
              className={cx('w-full rounded-[6px] transition-all', isCurrent ? 'bg-primary' : 'bg-line dark:bg-d-line')}
              style={{ height: `${Math.max(8, d.earned / max * 100)}%` }}
              title={`${d.month}: ${formatMoney(d.earned)}`}
            />
            <div className={cx('text-[10px] leading-none', isCurrent ? 'text-positive font-semibold' : 'text-mute')}>{d.month}</div>
          </div>
        );
      })}
    </div>
  );
}

// — Block-cooldown timer, composed via the shared <StatCard>. ─
// Yellow lives only on the timer value (override via valueClassName).
function BlockTimerCard({ secondsLeft }) {
  const [remaining, setRemaining] = useState(secondsLeft);
  useEffect(() => { setRemaining(secondsLeft); }, [secondsLeft]);
  useEffect(() => {
    if (remaining <= 0) return;
    const t = setInterval(() => setRemaining((r) => Math.max(0, r - 1)), 1000);
    return () => clearInterval(t);
  }, [remaining]);

  const pad = (n) => String(n).padStart(2, '0');
  const blocked = remaining > 0;
  const h = Math.floor(remaining / 3600);
  const m = Math.floor(remaining % 3600 / 60);
  const s = remaining % 60;

  if (!blocked) {
    return (
      <StatCard
        label="No active block"
        value="Clear to run"
        valueClassName="text-[28px] !font-bold text-positive"
        icon={<IconCheckCircle size={16} className="text-positive" />}
        sub="No active rate limit. All campaigns can scrape."
      />
    );
  }
  return (
    <StatCard
      label="Block cooldown"
      value={`${pad(h)}:${pad(m)}:${pad(s)}`}
      valueClassName="text-[34px] text-[#b88300] dark:text-[#ffd11a]"
      icon={<IconAlert size={16} />}
      sub="Google rate-limited last run. Scrapes paused until cooldown ends."
    />
  );
}

// — Winning-leads table row (no Status column — those are implicitly closed) —
function WinningLeadRow({ lead, selected, onToggle, onOpenCampaign }) {
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
        <button
          onClick={onOpenCampaign}
          className="text-[12px] text-mute hover:text-ink dark:hover:text-d-ink mt-0.5 inline-flex items-center gap-1"
        >
          <IconMapPin size={10} /> {lead.campaign}
        </button>
      </td>
      <td className="py-3.5 px-3">
        <a href={`tel:${lead.phone}`} className="text-body dark:text-d-body hover:text-ink dark:hover:text-d-ink tabular-nums inline-flex items-center gap-1.5">
          <IconPhone size={12} className="text-mute" />{lead.phone}
        </a>
      </td>
      <td className="py-3.5 px-3">
        {lead.website ? (
          <a href={`https://${lead.website}`} target="_blank" rel="noreferrer"
            className="text-body dark:text-d-body hover:text-ink dark:hover:text-d-ink inline-flex items-center gap-1 max-w-[180px] truncate">
            {lead.website}<IconExternal size={11} className="text-mute shrink-0" />
          </a>
        ) : <span className="text-mute">—</span>}
      </td>
      <td className="py-3.5 px-3 max-w-[260px]">
        <div className="text-[13px] text-body dark:text-d-body line-clamp-1 max-w-[240px]">{lead.notes || <span className="text-mute italic">—</span>}</div>
      </td>
      <td className="py-3.5 px-3 text-right">
        <span className="text-[15px] font-bold tabular-nums text-positive">{formatMoney(lead.raised)}</span>
      </td>
      <td className="py-3.5 px-3 pr-5 text-right text-[12px] text-mute">{lead.addedAt}</td>
    </tr>
  );
}

// — Page —
function DashboardPage({ metrics, closedLeads: closedLeadsProp, campaigns, onOpenCampaign, onGoToScraper }) {
  const [search, setSearch] = useState('');
  const [campaignFilter, setCampaignFilter] = useState('ALL');
  const [selected, setSelected] = useState(new Set());

  const filtered = useMemo(() => {
    return closedLeadsProp.filter((l) => {
      const matchCampaign = campaignFilter === 'ALL' || l.campaignId === campaignFilter;
      const matchSearch = !search || (l.name + l.phone + l.website + l.notes + l.campaign).toLowerCase().includes(search.toLowerCase());
      return matchCampaign && matchSearch;
    });
  }, [closedLeadsProp, campaignFilter, search]);

  const allSelected = filtered.length > 0 && filtered.every((r) => selected.has(r.id));
  const someSelected = filtered.some((r) => selected.has(r.id)) && !allSelected;

  const toggleAll = (on) => {
    const next = new Set(selected);
    filtered.forEach((r) => on ? next.add(r.id) : next.delete(r.id));
    setSelected(next);
  };
  const toggleOne = (id, on) => {
    const next = new Set(selected);
    on ? next.add(id) : next.delete(id);
    setSelected(next);
  };
  const clearSelection = () => setSelected(new Set());

  const totals = metrics.totals;
  const earnings = metrics.earnings;
  const camp = metrics.campaigns;
  const conversion = totals.totalLeads
    ? Math.round((totals.replied + totals.closed) / totals.totalLeads * 100) : 0;
  const repliedOfContactedPct = totals.contacted
    ? Math.round(totals.replied / totals.contacted * 100) : 0;

  const filteredEarnings = filtered.reduce((s, l) => s + (l.raised || 0), 0);

  const runHistorySubtitle =
    `${globalRunHistory.filter(r => r.status === 'COMPLETED').length} completed · ` +
    `${globalRunHistory.filter(r => r.status === 'FAILED').length} failed · ` +
    `${globalRunHistory.filter(r => r.status === 'CANCELLED').length} cancelled`;

  return (
    <div className="px-8 py-10 max-w-[1480px] mx-auto pb-32">
      {/* Header */}
      <PageHeader
        title="Outrich Manager"
        subtitle={`${campaigns.length} campaigns · ${totals.closed} closed deals · ${formatMoney(earnings.totalEarned)} earned to date`}
        actions={
          <Button variant="primary" size="md" onClick={onGoToScraper} leftIcon={<IconMapPin size={14} />}>
            Open scraper
          </Button>
        }
      />

      {/* Row 1 — Outreach funnel */}
      <SectionLabel className="mt-10" title="Outreach funnel" hint="Across all campaigns" />
      <div className="mt-3 grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total leads"
          value={totals.totalLeads.toLocaleString()}
          icon={<IconUser size={18} />}
          sub={`Across ${campaigns.length} campaigns`}
        />
        <StatCard
          label="Contacted"
          value={totals.contacted.toLocaleString()}
          icon={<IconPhone size={18} />}
          sub={`${Math.round(totals.contacted / totals.totalLeads * 100)}% of total`}
        />
        <StatCard
          label="Replied"
          value={totals.replied.toLocaleString()}
          icon={<IconNote size={18} />}
          sub={`${Math.round(totals.replied / totals.totalLeads * 100)}% of total · ${repliedOfContactedPct}% of contacted`}
        />
        <StatCard
          label="Closed"
          value={totals.closed.toLocaleString()}
          icon={<IconCheckCircle size={18} />}
          sub={`${Math.round(totals.closed / totals.totalLeads * 100)}% of total`}
          tone="ink"
        />
      </div>

      {/* Row 2 — Earnings */}
      <SectionLabel className="mt-10" title="Earnings" hint="From closed leads" />
      <div className="mt-3 grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Conversion"
          value={`${conversion}%`}
          icon={<IconSparkles size={18} />}
          sub="replied + closed / total"
        />
        <StatCard
          label="Total earned"
          value={formatMoney(earnings.totalEarned)}
          icon={<IconCheckCircle size={18} />}
          sub={`Avg deal ${formatMoney(earnings.avgDealSize)}`}
        />
        <StatCard
          label="This month"
          value={formatMoney(earnings.thisMonth)}
          icon={<IconArrowRight size={18} />}
          sub={
            <span className="text-positive font-medium">
              ▲ {Math.round((earnings.thisMonth - earnings.lastMonth) / earnings.lastMonth * 100)}% vs last month
            </span>
          }
        />
        <StatCard
          label="Monthly avg."
          value={formatMoney(earnings.monthlyAvg)}
          sub={<TrendBars data={metrics.monthlyTrend} />}
        />
      </div>

      {/* Row 3 — Scraper health */}
      <SectionLabel className="mt-10" title="Campaign health" hint="Performance of the scraper itself" />
      <div className="mt-3 grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total run time"
          value={formatDuration(camp.totalRunsMinutes)}
          icon={<IconHistory size={18} />}
          sub={`${globalRunHistory.length} runs recorded`}
        />
        <StatCard
          label="Avg. completion"
          value={`${camp.avgCompletionMinutes}m`}
          icon={<IconRotate size={18} />}
          sub="per campaign run"
        />
        <StatCard
          label="Avg. dupes"
          value={`${camp.avgDupesPct}%`}
          icon={<IconFilter size={18} />}
          sub="per single run"
        />
        <BlockTimerCard secondsLeft={camp.blockedUntilSec} />
      </div>

      {/* Global Run History — every run across every campaign */}
      <SectionLabel className="mt-12" title="Run history" hint="Every scrape run, across every campaign" />
      <div className="mt-3">
        <RunHistoryCard
          title={`${globalRunHistory.length} runs`}
          subtitle={runHistorySubtitle}
          runs={globalRunHistory}
          showCampaign
          onOpenCampaign={onOpenCampaign}
        />
      </div>

      {/* Winning Leads table */}
      <div className="mt-12 flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-[20px] font-semibold text-ink dark:text-d-ink">Winning Leads</h2>
          <p className="text-[12px] text-mute mt-0.5">
            {filtered.length} of {closedLeadsProp.length} shown ·{' '}
            <span className="text-positive font-semibold">{formatMoney(filteredEarnings)}</span> raised
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Input
            placeholder="Search by name, phone, notes…"
            value={search} onChange={(e) => setSearch(e.target.value)}
            leftIcon={<IconSearch size={16} />}
            className="w-[280px]"
          />
          <Select value={campaignFilter} onChange={(e) => setCampaignFilter(e.target.value)} className="w-[200px]">
            <option value="ALL">All campaigns</option>
            {campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </div>
      </div>

      <Card className="mt-4 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-canvas-soft/60 dark:bg-d-canvas-soft/60">
              <tr className="text-[11px] uppercase tracking-wider text-mute font-semibold">
                <th className="py-3 pl-5 pr-3 w-10">
                  <Checkbox checked={allSelected} indeterminate={someSelected} onChange={toggleAll} />
                </th>
                <th className="py-3 px-3">Business</th>
                <th className="py-3 px-3">Phone</th>
                <th className="py-3 px-3">Website</th>
                <th className="py-3 px-3">Notes</th>
                <th className="py-3 px-3 text-right">Raised</th>
                <th className="py-3 px-3 pr-5 text-right">Added</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((l) => (
                <WinningLeadRow
                  key={l.id} lead={l}
                  selected={selected.has(l.id)}
                  onToggle={(on) => toggleOne(l.id, on)}
                  onOpenCampaign={() => onOpenCampaign(l.campaignId)}
                />
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="py-16 text-center text-mute text-sm">No winning leads match your filters.</td></tr>
              )}
            </tbody>
            {filtered.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-line dark:border-d-line text-[13px] font-semibold bg-canvas-soft/40 dark:bg-d-canvas-soft/40">
                  <td className="py-3 pl-5 pr-3" />
                  <td className="py-3 px-3 text-ink dark:text-d-ink" colSpan={4}>
                    {filtered.length === closedLeadsProp.length ? 'Total raised' : 'Filtered total'}
                  </td>
                  <td className="py-3 px-3 text-right tabular-nums text-positive text-[16px]">{formatMoney(filteredEarnings)}</td>
                  <td className="py-3 px-3 pr-5" />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </Card>

      {/* Reusable bulk actions (no Mark unpaid — removed per review) */}
      <BulkActionsBar
        count={selected.size}
        onClear={clearSelection}
        actions={[
          {
            type: 'menu', label: 'Export',
            icon: <IconDownload size={14} />,
            items: [
              { label: 'Export selected as CSV', onClick: clearSelection },
              { label: 'Generate invoice batch', onClick: clearSelection },
            ],
          },
          { type: 'divider' },
          { type: 'button', label: 'Remove', icon: <IconTrash size={14} />, danger: true, onClick: clearSelection },
        ]}
      />
    </div>
  );
}

function SectionLabel({ title, hint, className = '' }) {
  return (
    <div className={cx('flex items-end justify-between gap-3', className)}>
      <div>
        <h2 className="text-[15px] font-semibold text-ink dark:text-d-ink">{title}</h2>
        {hint && <p className="text-[12px] text-mute mt-0.5">{hint}</p>}
      </div>
    </div>
  );
}

Object.assign(window, { DashboardPage });
