// ───────── Edit Campaign modal ─────────
// Opens from the campaign detail page (and from the card overflow menu).
// Mirrors the Create modal but pre-fills from the campaign and adds a
// notification email field — the address that gets pinged when a run
// finishes or fails. Email is optional; if blank, no notifications go out.

function EditCampaignModal({ open, campaign, onClose, onSave, onArchive }) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('restaurants');
  const [customKeyword, setCustomKeyword] = useState('');
  const [country, setCountry] = useState('US');
  const [state, setState] = useState('California');
  const [city, setCity] = useState('');
  const [entireState, setEntireState] = useState(false);
  const [notifyEmail, setNotifyEmail] = useState('');
  const [errors, setErrors] = useState({});

  // Hydrate when opened
  useEffect(() => {
    if (!open || !campaign) return;
    setName(campaign.name || '');
    setCategory(campaign.category || 'restaurants');
    setCustomKeyword(campaign.category === 'custom' ? campaign.keyword : '');
    setCountry(campaign.country || 'US');
    setState(campaign.state || 'California');
    setCity(campaign.city || '');
    setEntireState(!campaign.city);
    setNotifyEmail(campaign.notifyEmail || '');
    setErrors({});
  }, [open, campaign]);

  if (!campaign) return null;

  const derivedKeyword = () => {
    const base = category === 'custom'
      ? customKeyword.trim()
      : (CATEGORIES.find(c => c.value === category)?.label.toLowerCase() || '');
    const loc = entireState ? state : (city || state);
    return base && loc ? `${base} in ${loc}` : base;
  };

  const validate = () => {
    const errs = {};
    if (!name.trim()) errs.name = 'Campaign name is required';
    if (category === 'custom' && !customKeyword.trim()) errs.keyword = 'Enter a custom keyword';
    if (!entireState && !city.trim()) errs.city = 'City is required (or pick Entire State)';
    if (notifyEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(notifyEmail.trim())) {
      errs.email = 'That doesn\'t look like a valid email';
    }
    return errs;
  };

  const submit = () => {
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length) return;
    onSave({
      ...campaign,
      name: name.trim(),
      category,
      keyword: derivedKeyword(),
      country,
      state,
      city: entireState ? '' : city.trim(),
      notifyEmail: notifyEmail.trim(),
    });
  };

  const dirty =
    name !== campaign.name ||
    category !== (campaign.category || 'restaurants') ||
    derivedKeyword() !== campaign.keyword ||
    country !== campaign.country ||
    state !== campaign.state ||
    (entireState ? '' : city) !== (campaign.city || '') ||
    notifyEmail.trim() !== (campaign.notifyEmail || '');

  return (
    <Modal open={open} onClose={onClose} width={580}>
      <div className="flex items-start justify-between mb-5">
        <div>
          <h2 className="text-[22px] font-semibold text-ink dark:text-d-ink">Edit campaign</h2>
          <p className="text-[13px] text-mute mt-1">Changes apply to the next run. Existing leads are not modified.</p>
        </div>
        <button onClick={onClose} className="text-mute hover:text-ink dark:hover:text-d-ink p-1"><IconX size={18} /></button>
      </div>

      <div className="space-y-4">
        <Field label="Campaign name" error={errors.name}>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Give it a memorable name" />
        </Field>

        <Field label="What to scrape">
          <Select value={category} onChange={(e) => setCategory(e.target.value)}>
            {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </Select>
        </Field>

        {category === 'custom' && (
          <Field label="Custom keyword" error={errors.keyword}>
            <Input value={customKeyword} onChange={(e) => setCustomKeyword(e.target.value)} placeholder="vegan bakeries" />
          </Field>
        )}

        <div className="grid grid-cols-2 gap-4">
          <Field label="Country">
            <Select value={country} onChange={(e) => { setCountry(e.target.value); setState(STATES_BY_COUNTRY[e.target.value][0]); }}>
              {COUNTRIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </Select>
          </Field>
          <Field label="State / Region">
            <Select value={state} onChange={(e) => setState(e.target.value)}>
              {STATES_BY_COUNTRY[country].map(s => <option key={s} value={s}>{s}</option>)}
            </Select>
          </Field>
        </div>

        {!entireState && (
          <Field label="City" error={errors.city}>
            <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="San Diego" />
          </Field>
        )}
        <Checkbox checked={entireState} onChange={setEntireState} label={`Scrape entire ${state}`} />

        <div className="h-px bg-line dark:bg-d-line my-1" />

        <Field
          label="Client email"
          hint="We don't scrape emails from Google Maps — add it here once the prospect shares it."
          error={errors.email}
        >
          <Input
            type="email"
            value={notifyEmail}
            onChange={(e) => setNotifyEmail(e.target.value)}
            placeholder="client@example.com"
            leftIcon={<IconMail size={16} />}
          />
        </Field>

        {/* Query preview chip */}
        <div className="rounded-[14px] bg-canvas-soft dark:bg-d-canvas-soft p-3 flex items-start gap-3">
          <div className="mt-0.5 text-mute"><IconSearch size={16} /></div>
          <div className="min-w-0 flex-1">
            <div className="text-[11px] uppercase tracking-wide text-mute font-semibold">Google Maps query</div>
            <div className="text-[14px] font-medium text-ink dark:text-d-ink mt-0.5 truncate">
              {derivedKeyword() || <span className="text-mute italic">Fill in the fields above…</span>}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 -mx-6 px-6 pt-5 border-t border-line dark:border-d-line flex items-center justify-between gap-2">
        <Button
          variant="ghost"
          onClick={() => onArchive?.(campaign)}
          leftIcon={<IconArchive size={14} />}
          className="text-mute hover:!text-negative"
        >
          Archive campaign
        </Button>
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            onClick={submit}
            disabled={!dirty}
            leftIcon={<IconCheck size={14} />}
          >Save changes</Button>
        </div>
      </div>
    </Modal>
  );
}

Object.assign(window, { EditCampaignModal });
