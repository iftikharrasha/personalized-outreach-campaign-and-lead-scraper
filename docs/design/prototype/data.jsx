// ───────── Mock data ─────────

const CATEGORIES = [
  { value: 'restaurants',    label: 'Restaurants' },
  { value: 'dentists',       label: 'Dentists' },
  { value: 'lawyers',        label: 'Personal Injury Lawyers' },
  { value: 'plumbers',       label: 'Plumbers' },
  { value: 'cafes',          label: 'Cafes & Coffee Shops' },
  { value: 'gyms',           label: 'Gyms & Fitness' },
  { value: 'auto',           label: 'Auto Repair Shops' },
  { value: 'custom',         label: 'Custom keyword…' },
];

const COUNTRIES = [
  { value: 'US', label: 'United States' },
  { value: 'CA', label: 'Canada' },
  { value: 'GB', label: 'United Kingdom' },
  { value: 'AU', label: 'Australia' },
];

const STATES_BY_COUNTRY = {
  US: ['California','New York','Illinois','Texas','Florida','Washington','Massachusetts','Colorado','Georgia','Oregon'],
  CA: ['Ontario','Quebec','British Columbia','Alberta'],
  GB: ['England','Scotland','Wales','Northern Ireland'],
  AU: ['New South Wales','Victoria','Queensland','Western Australia'],
};

const seedCampaigns = [
  {
    id: 'c1',
    name: 'San Diego Restaurants',
    keyword: 'restaurants in San Diego',
    category: 'restaurants',
    country: 'US', state: 'California', city: 'San Diego',
    notifyEmail: 'you@outrich.app',
    status: 'ACTIVE',
    totalLeads: 142, contacted: 45, newSinceLast: 47,
    lastRun: '2h ago',
    progress: 32,
  },
  {
    id: 'c2',
    name: 'LA Personal Injury Lawyers',
    keyword: 'personal injury lawyers in Los Angeles',
    category: 'lawyers',
    country: 'US', state: 'California', city: 'Los Angeles',
    status: 'ACTIVE',
    totalLeads: 89, contacted: 23, newSinceLast: 52,
    lastRun: '1d ago',
    progress: 26,
    notifyEmail: 'you@outrich.app',
  },
  {
    id: 'c3',
    name: 'Chicago Dentists',
    keyword: 'dentists in Chicago',
    category: 'dentists',
    country: 'US', state: 'Illinois', city: 'Chicago',
    status: 'PAUSED',
    totalLeads: 201, contacted: 78, newSinceLast: 28,
    lastRun: '3d ago',
    progress: 39,
    notifyEmail: '',
  },
  {
    id: 'c4',
    name: 'NY Cafes',
    keyword: 'cafes in Manhattan',
    category: 'cafes',
    country: 'US', state: 'New York', city: 'Manhattan',
    status: 'ARCHIVED',
    totalLeads: 55, contacted: 20, newSinceLast: 14,
    lastRun: '1w ago',
    progress: 36,
    notifyEmail: '',
  },
  {
    id: 'c5',
    name: 'Austin Plumbers',
    keyword: 'plumbers in Austin',
    category: 'plumbers',
    country: 'US', state: 'Texas', city: 'Austin',
    status: 'ACTIVE',
    totalLeads: 67, contacted: 12, newSinceLast: 19,
    lastRun: '5h ago',
    progress: 18,
  },
  {
    id: 'c6',
    name: 'Seattle Auto Repair',
    keyword: 'auto repair shops in Seattle',
    category: 'auto',
    country: 'US', state: 'Washington', city: 'Seattle',
    status: 'ACTIVE',
    totalLeads: 118, contacted: 34, newSinceLast: 38,
    lastRun: '8h ago',
    progress: 29,
  },
];

const STATUS_OPTIONS = [
  { value: 'NEW',       label: 'New',       tone: 'neutral' },
  { value: 'CONTACTED', label: 'Contacted', tone: 'warning' },
  { value: 'REPLIED',   label: 'Replied',   tone: 'positive' },
  { value: 'IGNORED',   label: 'Ignored',   tone: 'mute' },
  { value: 'CLOSED',    label: 'Closed',    tone: 'purple' },
];

// 30 mock leads for San Diego Restaurants (c1)
const leadNamesPool = [
  ['Sushi Ota', '619-270-1140', 'sushiota.com'],
  ['Born & Raised', '619-202-4577', 'bornandraisedsteak.com'],
  ['Hodad\'s Ocean Beach', '619-224-4623', 'hodadies.com'],
  ['Cesarina', '619-226-6222', 'cesarinarestaurant.com'],
  ['Juniper & Ivy', '619-269-9036', 'juniperandivy.com'],
  ['Lola 55 Tacos', '619-542-9155', 'lola55.com'],
  ['Communal Coffee', '619-795-2901', 'communalcoffee.com'],
  ['The Crack Shack', '619-795-3299', 'crackshack.com'],
  ['Herb & Wood', '619-955-8495', 'herbandwood.com'],
  ['Cowboy Star', '619-450-5880', 'thecowboystar.com'],
  ['Kettner Exchange', '619-255-2001', 'kettnerexchange.com'],
  ['Cori Pastificio', '619-457-1075', ''],
  ['Tahona', '619-573-0289', 'tahonasd.com'],
  ['Cesar\'s Kitchen', '619-302-9120', ''],
  ['Buona Forchetta', '619-381-4844', 'buonaforchettasd.com'],
  ['Trust Restaurant', '619-795-6901', 'trustrestaurantsd.com'],
  ['Cucina Urbana', '619-239-2222', 'cucinaurbana.com'],
  ['Officine Buona Forchetta', '619-906-9510', ''],
  ['Carnitas\' Snack Shack', '619-294-7675', 'carnitassnackshack.com'],
  ['Mr. A\'s', '619-239-1377', 'asrestaurant.com'],
  ['Cucina Sorella', '619-281-9100', 'cucinasorella.com'],
  ['Soda & Swine', '619-269-9036', 'sodaandswine.com'],
  ['Bracero Cocina', '619-756-7864', ''],
  ['Cesar\'s Coffee', '619-294-1234', ''],
  ['Polite Provisions', '619-269-4701', 'politeprovisions.com'],
  ['North Park Coffee', '619-269-9999', ''],
  ['Tribute Pizza', '619-516-4260', 'tributepizza.com'],
  ['Liberty Public Market', '619-487-9346', 'libertypublicmarket.com'],
  ['Common Theory', '858-271-1991', 'commontheorysd.com'],
  ['Rustic Root', '619-232-1747', 'rusticrootsd.com'],
];

const seedLeads = leadNamesPool.map((row, i) => {
  const statuses = ['NEW','NEW','NEW','NEW','NEW','CONTACTED','CONTACTED','REPLIED','IGNORED','CLOSED','NEW','CONTACTED','REPLIED','NEW','NEW','CONTACTED','NEW','REPLIED','NEW','CONTACTED','NEW','NEW','CLOSED','NEW','CONTACTED','NEW','NEW','REPLIED','NEW','IGNORED'];
  const notesPool = {
    1: 'Owner mentioned a marketing budget — call back Friday.',
    5: 'Got voicemail, left message about lunch promo.',
    7: 'Wants a follow-up email with pricing.',
    11: 'Not interested right now — try Q3.',
    14: 'Sent intro email + sample menu.',
  };
  // Emails are NOT scraped (per the plan); the user enters them manually after
  // a lead replies. A few sample emails are pre-filled so the column looks real.
  const emailPool = {
    1: 'info@bornandraisedsteak.com',
    5: 'orders@lola55.com',
    7: 'hello@crackshack.com',
    11: '',
    14: 'manager@buonaforchettasd.com',
    17: 'hi@trustrestaurantsd.com',
    22: '',
  };
  return {
    id: 'l' + i,
    campaignId: 'c1',
    name: row[0],
    phone: row[1],
    website: row[2],
    email: emailPool[i] || '',
    rating: (3.8 + Math.random() * 1.2).toFixed(1),
    reviews: 20 + Math.floor(Math.random() * 600),
    status: statuses[i % statuses.length],
    notes: notesPool[i] || '',
    addedAt: ['1d ago','2d ago','3d ago','4d ago','1w ago','2w ago','3w ago'][i % 7],
  };
});

const seedRunHistory = [
  { id: 'r1', startedAt: '2h ago',  finishedAt: '2h ago',  status: 'COMPLETED', newLeads: 47, dupes: 8,  error: null, durationMin: 11 },
  { id: 'r2', startedAt: '1d ago',  finishedAt: '1d ago',  status: 'COMPLETED', newLeads: 32, dupes: 14, error: null, durationMin: 9  },
  { id: 'r3', startedAt: '3d ago',  finishedAt: '3d ago',  status: 'FAILED',    newLeads: 0,  dupes: 0,  error: 'Rate limited by Google. Wait ~6h and retry.', durationMin: 2 },
  { id: 'r4', startedAt: '4d ago',  finishedAt: '4d ago',  status: 'CANCELLED', newLeads: 12, dupes: 2,  error: 'Stopped by user', durationMin: 4 },
  { id: 'r5', startedAt: '6d ago',  finishedAt: '6d ago',  status: 'COMPLETED', newLeads: 51, dupes: 6,  error: null, durationMin: 12 },
];

// ───────── Business metrics & closed-lead earnings (for /managerial dashboard) ─────────
// Cross-campaign metrics shown on the Outrich Manager home page.
// This data is OFF-DOC: not in PROJECT_PLAN.md, added to support the home-dashboard ask.
const businessMetrics = {
  totals: {
    totalLeads: 672,
    contacted: 218,
    replied: 64,
    closed: 18,
  },
  earnings: {
    totalEarned: 15420,
    thisMonth: 5440,
    lastMonth: 3880,
    monthlyAvg: 4115,
    avgDealSize: 857,
  },
  campaigns: {
    totalRunsMinutes: 142,        // total time campaigns have run, in minutes
    avgCompletionMinutes: 9,      // average campaign run duration
    avgDupesPct: 17,              // average dupes percentage per run
    blockedUntilSec: 4 * 60 * 60 + 32 * 60, // 4h 32m remaining on block timer
  },
  monthlyTrend: [
    { month: 'Dec', earned: 2200, closed: 3 },
    { month: 'Jan', earned: 3100, closed: 4 },
    { month: 'Feb', earned: 2750, closed: 3 },
    { month: 'Mar', earned: 3880, closed: 5 },
    { month: 'Apr', earned: 5440, closed: 6 },
    { month: 'May', earned: 4115, closed: 4 },
  ],
};

const closedLeads = [
  { id: 'cl1', campaign: 'San Diego Restaurants',  campaignId: 'c1', name: 'Born & Raised',     phone: '619-202-4577', website: 'bornandraisedsteak.com', status: 'CLOSED', notes: 'Website redesign + monthly retainer.',          addedAt: '3w ago', raised: 2400 },
  { id: 'cl2', campaign: 'LA Personal Injury',     campaignId: 'c2', name: 'Hodge & Associates', phone: '213-455-9100', website: 'hodgeandassociates.com',  status: 'CLOSED', notes: 'Landing page + intake form.',                  addedAt: '1mo ago', raised: 1800 },
  { id: 'cl3', campaign: 'Chicago Dentists',       campaignId: 'c3', name: 'Lincoln Park Dental', phone: '312-555-0143', website: 'lincolnparkdental.com',  status: 'CLOSED', notes: 'Booking system integration.',                   addedAt: '2mo ago', raised: 3200 },
  { id: 'cl4', campaign: 'San Diego Restaurants',  campaignId: 'c1', name: 'Cesarina',           phone: '619-226-6222', website: 'cesarinarestaurant.com', status: 'CLOSED', notes: 'Photography refresh + menu site.',              addedAt: '2mo ago', raised: 1200 },
  { id: 'cl5', campaign: 'Austin Plumbers',        campaignId: 'c5', name: 'BlueWrench Plumbing', phone: '512-555-9203', website: 'bluewrench.io',         status: 'CLOSED', notes: 'Lead capture + Google Ads landing.',            addedAt: '3mo ago', raised: 940  },
  { id: 'cl6', campaign: 'Seattle Auto Repair',    campaignId: 'c6', name: 'Northgate Auto Co.', phone: '206-555-7720', website: 'northgateauto.com',     status: 'CLOSED', notes: 'Brand identity + Shopify setup.',               addedAt: '3mo ago', raised: 2750 },
  { id: 'cl7', campaign: 'LA Personal Injury',     campaignId: 'c2', name: 'Vega Law Group',      phone: '310-555-2244', website: 'vegalawgroup.com',       status: 'CLOSED', notes: 'Quarterly content retainer.',                   addedAt: '4mo ago', raised: 1500 },
  { id: 'cl8', campaign: 'San Diego Restaurants',  campaignId: 'c1', name: 'Trust Restaurant',    phone: '619-795-6901', website: 'trustrestaurantsd.com',  status: 'CLOSED', notes: 'Reservation widget.',                           addedAt: '5mo ago', raised: 1630 },
];

// Project-wide run history (every campaign, every run) — shown on the Manager
// dashboard. The per-campaign Run History on the detail page is just this list
// filtered by campaignId.
const globalRunHistory = [
  { id: 'gr1',  campaignId: 'c1', campaign: 'San Diego Restaurants', startedAt: '2h ago',  finishedAt: '2h ago',  status: 'COMPLETED', newLeads: 47, dupes: 8,  durationMin: 11, error: null },
  { id: 'gr2',  campaignId: 'c5', campaign: 'Austin Plumbers',       startedAt: '5h ago',  finishedAt: '5h ago',  status: 'COMPLETED', newLeads: 19, dupes: 3,  durationMin: 7,  error: null },
  { id: 'gr3',  campaignId: 'c6', campaign: 'Seattle Auto Repair',   startedAt: '8h ago',  finishedAt: '8h ago',  status: 'COMPLETED', newLeads: 38, dupes: 11, durationMin: 13, error: null },
  { id: 'gr4',  campaignId: 'c2', campaign: 'LA Personal Injury',    startedAt: '1d ago',  finishedAt: '1d ago',  status: 'COMPLETED', newLeads: 52, dupes: 6,  durationMin: 10, error: null },
  { id: 'gr5',  campaignId: 'c1', campaign: 'San Diego Restaurants', startedAt: '1d ago',  finishedAt: '1d ago',  status: 'COMPLETED', newLeads: 32, dupes: 14, durationMin: 9,  error: null },
  { id: 'gr6',  campaignId: 'c3', campaign: 'Chicago Dentists',      startedAt: '2d ago',  finishedAt: '2d ago',  status: 'FAILED',    newLeads: 0,  dupes: 0,  durationMin: 3,  error: 'Google rate-limited — cooldown started' },
  { id: 'gr7',  campaignId: 'c1', campaign: 'San Diego Restaurants', startedAt: '3d ago',  finishedAt: '3d ago',  status: 'FAILED',    newLeads: 0,  dupes: 0,  durationMin: 2,  error: 'Rate limited by Google' },
  { id: 'gr8',  campaignId: 'c1', campaign: 'San Diego Restaurants', startedAt: '4d ago',  finishedAt: '4d ago',  status: 'CANCELLED', newLeads: 12, dupes: 2,  durationMin: 4,  error: 'Stopped by user' },
  { id: 'gr9',  campaignId: 'c5', campaign: 'Austin Plumbers',       startedAt: '5d ago',  finishedAt: '5d ago',  status: 'COMPLETED', newLeads: 28, dupes: 4,  durationMin: 8,  error: null },
  { id: 'gr10', campaignId: 'c1', campaign: 'San Diego Restaurants', startedAt: '6d ago',  finishedAt: '6d ago',  status: 'COMPLETED', newLeads: 51, dupes: 6,  durationMin: 12, error: null },
];

Object.assign(window, {
  CATEGORIES, COUNTRIES, STATES_BY_COUNTRY,
  seedCampaigns, seedLeads, seedRunHistory, STATUS_OPTIONS,
  businessMetrics, closedLeads,
  globalRunHistory,
});
