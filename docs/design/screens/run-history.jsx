// ───────── Shared Run History components ─────────
// Used by both the Campaign Detail page (filtered to one campaign) and the
// Outrich Manager dashboard (all runs across all campaigns).
//
// Shape of a run entry (see data.jsx):
//   { id, campaignId, campaign, startedAt, finishedAt, status,
//     newLeads, dupes, durationMin, error }
//
// Columns: [Campaign?] · Started · New · Dupes · Notes · Duration · Status
// `Notes` shows the error/cancel reason; runs that completed cleanly show "—".
// `Status` is intentionally last so the badge column lines up with the
// Status-at-far-right convention used in the Leads table.

function RunHistoryTable({ runs, showCampaign = false, onOpenCampaign }) {
  const colCount = showCampaign ? 7 : 6;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left">
        <thead>
          <tr className="text-[11px] uppercase tracking-wider text-mute font-semibold">
            {showCampaign && <th className="py-2.5 pl-5 pr-3">Campaign</th>}
            <th className={cx('py-2.5 px-3', !showCampaign && 'pl-5')}>Started</th>
            <th className="py-2.5 px-3 text-right">New</th>
            <th className="py-2.5 px-3 text-right">Dupes</th>
            <th className="py-2.5 px-3">Notes</th>
            <th className="py-2.5 px-3 text-right">Duration</th>
            <th className="py-2.5 px-3 pr-5 text-right">Status</th>
          </tr>
        </thead>
        <tbody>
          {runs.map((r) =>
          <tr key={r.id} className="border-t border-line/60 dark:border-d-line/60 text-[13px]">
              {showCampaign &&
            <td className="py-3 pl-5 pr-3">
                  <button
                onClick={() => onOpenCampaign?.(r.campaignId)}
                className="text-ink dark:text-d-ink font-medium hover:underline truncate max-w-[220px] inline-block text-left">
                
                    {r.campaign}
                  </button>
                </td>
            }
              <td className={cx('py-3 px-3 text-ink dark:text-d-ink', !showCampaign && 'pl-5')}>{r.startedAt}</td>
              <td className="py-3 px-3 text-right tabular-nums text-ink dark:text-d-ink font-medium">{r.newLeads}</td>
              <td className="py-3 px-3 text-right tabular-nums text-mute">{r.dupes}</td>
              <td className="py-3 px-3 text-[12.5px] text-mute max-w-[280px] truncate">{r.error || '—'}</td>
              <td className="py-3 px-3 text-right tabular-nums text-mute">{r.durationMin}m</td>
              <td className="py-3 px-3 pr-5 text-right">
                <Badge
                  size="sm"
                  tone={
                    r.status === 'COMPLETED' ? 'positive' :
                    r.status === 'FAILED' ? 'negative' :
                    r.status === 'CANCELLED' ? 'mute' :
                    'warning'
                  }>
                  {r.status}
                </Badge>
              </td>
            </tr>
          )}
          {runs.length === 0 &&
          <tr><td colSpan={colCount} className="py-12 text-center text-mute text-sm">No runs yet.</td></tr>
          }
        </tbody>
      </table>
    </div>);

}

// Collapsible card-shell around the table. One source of truth for the header
// row (icon + title + subtitle + chevron) used on both screens.
function RunHistoryCard({ title = 'Run history', subtitle, runs, showCampaign, onOpenCampaign, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Card>
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-6 py-4 text-left">
        
        <div className="flex items-center gap-3">
          <span className="text-mute"><IconHistory size={18} /></span>
          <div>
            <div className="text-[15px] font-semibold text-ink dark:text-d-ink">{title}</div>
            {subtitle && <div className="text-[12px] text-mute mt-0.5">{subtitle}</div>}
          </div>
        </div>
        {open ? <IconChevronUp size={18} className="text-mute" /> : <IconChevronDown size={18} className="text-mute" />}
      </button>
      {open &&
      <div className="px-2 pb-2 anim-fadein">
          <RunHistoryTable runs={runs} showCampaign={showCampaign} onOpenCampaign={onOpenCampaign} />
        </div>
      }
    </Card>);

}

Object.assign(window, { RunHistoryTable, RunHistoryCard });