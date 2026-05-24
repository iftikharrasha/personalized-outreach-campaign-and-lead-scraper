// ───────── Mock data ─────────

// ── Sources ───────────────────────────────────────────────────────────────
// Each scraper has its own vocabulary. Centralised here so the screens can
// re-label themselves (sidebar, breadcrumb, query preview, run modal copy)
// off a single source descriptor instead of hard-coding "Google Maps" in
// twelve places.
const SOURCES = {
  gmaps: {
    id: 'gmaps',
    label: 'Google Maps',
    sidebar: 'Google Maps Scraper',
    breadcrumb: 'Google Maps Scraper',
    queryLabel: 'Google Maps query',
    queryHint:  'The exact query that will be searched on Google Maps',
    locationKind: 'city',        // city + state under a country
    leadEntity:   'businesses',
    leadEntityOne:'business',
    statePlaceholder: 'San Diego',
    emptyTitle: 'No campaigns yet',
    emptyBody:  'Create your first campaign to start scraping leads from Google Maps. Each campaign is a single keyword tied to a location.',
    blockedCopy:'Google rate-limited last run. Scrapes paused until cooldown ends.',
  },
  yelp: {
    id: 'yelp',
    label: 'Yelp',
    sidebar: 'Yelp API',
    breadcrumb: 'Yelp API',
    queryLabel: 'Yelp search',
    queryHint:  'Yelp uses category + city. Same shape as the URL bar on yelp.com — fetched via the Yelp Fusion API.',
    locationKind: 'city',
    leadEntity:   'businesses',
    leadEntityOne:'business',
    statePlaceholder: 'Brooklyn',
    // Phase 7 — Yelp uses the Fusion API, NOT scraping. Copy reflects that:
    // no CAPTCHAs, no proxy talk, no “scroll the results panel.” It is plain
    // HTTP, paginated, capped at 1,000 businesses per search.
    emptyTitle: 'No Yelp campaigns yet',
    emptyBody:  'Each campaign is one Yelp search — one keyword in one city. Outrich fetches the data through the official Yelp Fusion API, paginated 50 at a time, up to 1,000 businesses per search.',
    blockedCopy:'Yelp rate-limited last run (5,000 requests/day). Resume tomorrow — your cursor is preserved.',
    // Yelp-specific microcopy used by the run banner + card progress line.
    actionVerb: 'Fetch',         // “Fetch from Yelp”, “Fetching…”
    actionVerbPast: 'fetched',   // “500 fetched”
    runModalTitle: 'Fetch from Yelp',
  },
  linkedin: {
    id: 'linkedin',
    label: 'LinkedIn',
    sidebar: 'LinkedIn Scraper',
    breadcrumb: 'LinkedIn Scraper',
    queryLabel: 'LinkedIn People search',
    queryHint:  'Built from job title + metro + industry. Mirrors the LinkedIn People search URL.',
    locationKind: 'metro',       // metro area + industry, no state
    leadEntity:   'people',
    leadEntityOne:'person',
    statePlaceholder: 'Greater New York Area',
    emptyTitle: 'No LinkedIn campaigns yet',
    emptyBody:  'Each campaign targets one job title + one metro. The scraper opens People search and collects up to 100 profiles per page until you hit the weekly view ceiling.',
    blockedCopy:'LinkedIn flagged the session — weekly view limit hit. Wait until Monday.',
  },
};

// Per-source category dropdowns. CATEGORIES (alias of gmaps) is kept for
// backward compat with anything that imports it directly.
const CATEGORIES_BY_SOURCE = {
  gmaps: [
    { value: 'restaurants',    label: 'Restaurants' },
    { value: 'dentists',       label: 'Dentists' },
    { value: 'lawyers',        label: 'Personal Injury Lawyers' },
    { value: 'plumbers',       label: 'Plumbers' },
    { value: 'cafes',          label: 'Cafes & Coffee Shops' },
    { value: 'gyms',           label: 'Gyms & Fitness' },
    { value: 'auto',           label: 'Auto Repair Shops' },
    { value: 'custom',         label: 'Custom keyword…' },
  ],
  yelp: [
    { value: 'restaurants',    label: 'Restaurants' },
    { value: 'coffee',         label: 'Coffee & Tea' },
    { value: 'bars',           label: 'Bars & Nightlife' },
    { value: 'beauty',         label: 'Beauty & Spas' },
    { value: 'home_services',  label: 'Home Services' },
    { value: 'health',         label: 'Health & Medical' },
    { value: 'auto',           label: 'Automotive' },
    { value: 'pets',           label: 'Pet Services' },
    { value: 'custom',         label: 'Custom keyword…' },
  ],
  linkedin: [
    { value: 'founder',        label: 'Founders & CEOs' },
    { value: 'marketing_dir',  label: 'Marketing Directors' },
    { value: 'sales_vp',       label: 'VPs of Sales' },
    { value: 'eng_lead',       label: 'Engineering Leads' },
    { value: 'recruiter',      label: 'Recruiters & Talent' },
    { value: 'product',        label: 'Product Managers' },
    { value: 'ops',            label: 'COO / Operations Heads' },
    { value: 'custom',         label: 'Custom title…' },
  ],
};
// Legacy alias — old imports still work
const CATEGORIES = CATEGORIES_BY_SOURCE.gmaps;

// LinkedIn doesn't search by state — it uses metro areas + industry filter.
const LINKEDIN_METROS = [
  'San Francisco Bay Area',
  'Greater New York Area',
  'Los Angeles Metro',
  'Greater Boston Area',
  'Greater Chicago Area',
  'Austin, Texas Area',
  'Seattle Area',
  'Denver Metro Area',
  'Atlanta Metro Area',
  'Miami / Fort Lauderdale Area',
  'United States',
];
const LINKEDIN_INDUSTRIES = [
  'Any industry',
  'Software',
  'E-commerce',
  'Healthcare',
  'Real Estate',
  'Marketing & Advertising',
  'Finance',
  'Hospitality',
  'Education',
  'Construction',
  'Manufacturing',
  'Legal Services',
];
const LINKEDIN_SENIORITY = [
  'Any seniority',
  'Owner / Partner',
  'CXO',
  'VP',
  'Director',
  'Manager',
  'Senior IC',
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
    source: 'gmaps',
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
    source: 'gmaps',
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
    source: 'gmaps',
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
    source: 'gmaps',
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
    source: 'gmaps',
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
    source: 'gmaps',
    name: 'Seattle Auto Repair',
    keyword: 'auto repair shops in Seattle',
    category: 'auto',
    country: 'US', state: 'Washington', city: 'Seattle',
    status: 'ACTIVE',
    totalLeads: 118, contacted: 34, newSinceLast: 38,
    lastRun: '8h ago',
    progress: 29,
  },

  // ── Yelp campaigns ──
  // Yelp scraping targets the same kind of local-business outreach as the
  // Google Maps source. Search params live on yelp.com URLs:
  //   yelp.com/search?find_desc={keyword}&find_loc={location}
  // Extra fields per business: price level ($–$$$$), rating, review count,
  // category list, neighborhood, claimed-vs-unclaimed flag.
  // Yelp campaigns now carry the Phase 7 cursor fields:
  //   apiOffset          — next offset to fetch (multiple of 50)
  //   apiKeywordUsed     — keyword the cursor is valid for (locked after run 1)
  //   apiTotalAvailable  — Yelp's reported total for this search (null pre-run)
  // Four campaigns demo the four UI states: resume mid-cursor, fully fetched,
  // paused mid-cursor, and never-run-yet (first-run modal copy).
  {
    id: 'y1',
    source: 'yelp',
    name: 'Brooklyn Coffee Shops',
    keyword: 'coffee in Brooklyn, NY',
    category: 'coffee',
    country: 'US', state: 'New York', city: 'Brooklyn',
    status: 'ACTIVE',
    totalLeads: 87, contacted: 31, newSinceLast: 22,
    lastRun: '3h ago',
    progress: 35,
    notifyEmail: 'you@outrich.app',
    apiOffset: 100, apiTotalAvailable: 312, apiKeywordUsed: 'coffee in Brooklyn, NY',
  },
  {
    id: 'y2',
    source: 'yelp',
    name: 'Miami Fine Dining',
    keyword: 'fine dining in Miami, FL',
    category: 'restaurants',
    country: 'US', state: 'Florida', city: 'Miami',
    status: 'ACTIVE',
    totalLeads: 64, contacted: 18, newSinceLast: 31,
    lastRun: '1d ago',
    progress: 28,
    notifyEmail: '',
    // Fully fetched — apiOffset has reached apiTotalAvailable. Run button
    // shows the “all businesses fetched” state in the YelpRunModal.
    apiOffset: 200, apiTotalAvailable: 200, apiKeywordUsed: 'fine dining in Miami, FL',
  },
  {
    id: 'y3',
    source: 'yelp',
    name: 'Austin Nail Salons',
    keyword: 'nail salons in Austin, TX',
    category: 'beauty',
    country: 'US', state: 'Texas', city: 'Austin',
    status: 'PAUSED',
    totalLeads: 103, contacted: 28, newSinceLast: 16,
    lastRun: '2d ago',
    progress: 27,
    notifyEmail: '',
    apiOffset: 150, apiTotalAvailable: 720, apiKeywordUsed: 'nail salons in Austin, TX',
  },
  {
    id: 'y4',
    source: 'yelp',
    name: 'Denver Home Services',
    keyword: 'plumbers in Denver, CO',
    category: 'home_services',
    country: 'US', state: 'Colorado', city: 'Denver',
    status: 'ACTIVE',
    // Never run — totalLeads 0, apiOffset 0, apiTotalAvailable null.
    // Used to demo the first-run modal copy ("up to 1,000 businesses").
    totalLeads: 0, contacted: 0, newSinceLast: 0,
    lastRun: 'never',
    progress: 0,
    notifyEmail: '',
    apiOffset: 0, apiTotalAvailable: null, apiKeywordUsed: null,
  },

  // ── LinkedIn campaigns ──
  // Different shape from Google Maps + Yelp: we're scraping *people*, not
  // businesses. Fields per profile: full name, headline, current role,
  // current company, location, connection degree (2nd/3rd/Out of network),
  // mutual count, profile URL. No phone, no website — email is optional
  // and stays manual (LinkedIn doesn't expose it).
  // Status maps cleanly: NEW → CONTACTED (connection request sent) →
  // REPLIED (accepted + replied to first message) → CLOSED.
  {
    id: 'ln1',
    source: 'linkedin',
    name: 'SF Bay Area Founders',
    keyword: 'Founder OR CEO · Software · SF Bay Area',
    category: 'founder',
    country: 'US', state: 'California', city: 'San Francisco Bay Area',
    industry: 'Software',
    seniority: 'Owner / Partner',
    status: 'ACTIVE',
    totalLeads: 76, contacted: 41, newSinceLast: 18,
    lastRun: '4h ago',
    progress: 54,
    notifyEmail: 'you@outrich.app',
  },
  {
    id: 'ln2',
    source: 'linkedin',
    name: 'NYC Marketing Directors',
    keyword: 'Marketing Director · E-commerce · Greater New York',
    category: 'marketing_dir',
    country: 'US', state: 'New York', city: 'Greater New York Area',
    industry: 'E-commerce',
    seniority: 'Director',
    status: 'ACTIVE',
    totalLeads: 124, contacted: 67, newSinceLast: 29,
    lastRun: '1d ago',
    progress: 54,
    notifyEmail: '',
  },
  {
    id: 'ln3',
    source: 'linkedin',
    name: 'Boston Engineering Leads',
    keyword: 'VP Engineering OR Head of Engineering · Boston',
    category: 'eng_lead',
    country: 'US', state: 'Massachusetts', city: 'Greater Boston Area',
    industry: 'Software',
    seniority: 'VP',
    status: 'PAUSED',
    totalLeads: 58, contacted: 22, newSinceLast: 12,
    lastRun: '4d ago',
    progress: 38,
    notifyEmail: '',
  },
  {
    id: 'ln4',
    source: 'linkedin',
    name: 'LA Tech Recruiters',
    keyword: 'Technical Recruiter · Los Angeles Metro',
    category: 'recruiter',
    country: 'US', state: 'California', city: 'Los Angeles Metro',
    industry: 'Software',
    seniority: 'Manager',
    status: 'ACTIVE',
    totalLeads: 92, contacted: 38, newSinceLast: 24,
    lastRun: '9h ago',
    progress: 41,
    notifyEmail: '',
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

// ── Yelp leads (for y1: Brooklyn Coffee Shops) ──
// Yelp gives us richer business cards than Google Maps: price level,
// star rating, review count, neighborhood, category list, and a
// "Claimed" flag (whether the owner verified the listing). All of these
// surface as columns or chips on the leads table.
const yelpLeadsPool = [
  // [name, phone, website, rating, reviews, price, primaryCategory, neighborhood, claimed]
  ['Devoción',              '347-294-7724', 'devocion.com',           4.6, 1284, '$$', 'Coffee & Tea',          'Williamsburg', true ],
  ['Variety Coffee Roasters','718-628-6300', 'varietycoffeeroasters.com',4.4, 962,  '$$', 'Coffee & Tea',          'Bushwick',     true ],
  ['Sey Coffee',            '718-484-1340', 'seycoffee.com',          4.7, 1573, '$$', 'Coffee & Tea, Cafes',   'East Williamsburg', true ],
  ['Toby\'s Estate',        '347-457-6160', 'tobysestate.com',        4.3, 1108, '$$', 'Coffee & Tea',          'Williamsburg', true ],
  ['Café Grumpy',           '718-989-5444', 'cafegrumpy.com',         4.2, 489,  '$',  'Coffee & Tea, Bakeries','Greenpoint',   true ],
  ['Hungry Ghost',          '718-484-7521', 'hungryghostbrooklyn.com',4.5, 712,  '$',  'Coffee & Tea',          'Fort Greene',  true ],
  ['Konditori',             '718-384-6373', 'konditori-nyc.com',      4.3, 351,  '$',  'Coffee & Tea, Bakeries','Park Slope',   false],
  ['Bowery Coffee',         '929-298-0044', '',                       4.1, 246,  '$',  'Coffee & Tea',          'Crown Heights',false],
  ['Mast Books & Coffee',   '347-294-1822', 'mastbooksnyc.com',       4.6, 197,  '$$', 'Coffee & Tea, Bookstores','Bushwick',  true ],
  ['Brooklyn Roasting Co.', '718-855-1000', 'brooklynroasting.com',   4.4, 1842, '$',  'Coffee Roasteries',     'DUMBO',        true ],
  ['Parlor Coffee',         '',             'parlorcoffee.com',       4.7, 184,  '$$', 'Coffee & Tea',          'Sunset Park',  false],
  ['Hidden Grounds',        '347-294-3920', '',                       4.0, 92,   '$',  'Coffee & Tea',          'Williamsburg', false],
  ['Stovetop Coffee',       '347-457-3001', 'stovetopcoffee.com',     4.8, 142,  '$$', 'Coffee & Tea',          'Carroll Gardens',true],
  ['Forty Weight',          '718-389-2110', '',                       4.5, 89,   '$',  'Coffee & Tea',          'Greenpoint',   true ],
  ['Cafe Reggio Brooklyn',  '718-555-0188', '',                       4.2, 233,  '$',  'Coffee & Tea, Italian', 'Bay Ridge',    false],
  ['Ovenly Cafe',           '347-689-3608', 'oven.ly',                4.4, 567,  '$$', 'Bakeries, Coffee & Tea','Greenpoint',   true ],
  ['Little Skips',          '718-484-0980', 'littleskips.com',        4.1, 421,  '$',  'Coffee & Tea',          'Bushwick',     true ],
  ['Café Mogador',          '718-486-9222', 'cafemogador.com',        4.2, 1287, '$$', 'Mediterranean, Coffee', 'Williamsburg', true ],
  ['Black Brick',           '718-907-4500', '',                       4.5, 312,  '$$', 'Coffee & Tea',          'Williamsburg', true ],
  ['Joe Coffee Bk',         '212-555-0193', 'joecoffeecompany.com',   4.0, 421,  '$',  'Coffee & Tea',          'Cobble Hill',  true ],
  ['West~bourne Coffee',    '',             '',                       4.3, 67,   '$$', 'Coffee & Tea',          'Brooklyn Heights', false],
  ['Coyote Coffee Bar',     '347-689-1245', 'coyote.coffee',          4.7, 281,  '$$', 'Coffee & Tea',          'Park Slope',   true ],
  ['Madman Espresso',       '929-208-7700', 'madmanespresso.com',     4.6, 314,  '$$', 'Coffee & Tea',          'DUMBO',        true ],
  ['Whirlybird',            '',             '',                       4.4, 105,  '$',  'Coffee & Tea',          'Bed-Stuy',     false],
  ['Cup of Gold',           '718-921-4456', '',                       4.3, 78,   '$',  'Coffee & Tea',          'Sunset Park',  false],
];
const yelpStatuses = ['NEW','NEW','CONTACTED','REPLIED','NEW','NEW','CONTACTED','NEW','NEW','CONTACTED','NEW','IGNORED','REPLIED','NEW','NEW','CONTACTED','NEW','REPLIED','NEW','CLOSED','NEW','NEW','CONTACTED','NEW','NEW'];
const yelpNotesPool = {
  2: 'Owner answered the phone — wants a sample of website redesigns next week.',
  3: 'Manager replied via DM. Sent them three site references.',
  6: 'Left voicemail re: online ordering integration.',
  9: 'Asked about a delivery flow rebuild. Pricing on Tuesday.',
  12: 'Closed: lead designer for new menu rollout. $1,400.',
  15: 'Wants pricing for SEO + Yelp profile cleanup.',
  17: 'Asked us to follow up after their spring renovation.',
  19: 'CLOSED — full Squarespace rebuild, signed off Friday.',
  22: 'Got Instagram referral. Discovery call booked.',
};
const seedLeadsYelp = yelpLeadsPool.map((row, i) => ({
  id: 'yl' + i,
  campaignId: 'y1',
  source: 'yelp',
  name: row[0],
  phone: row[1],
  website: row[2],
  rating: row[3],
  reviews: row[4],
  price: row[5],
  primaryCategory: row[6],
  neighborhood: row[7],
  claimed: row[8],
  email: '',
  status: yelpStatuses[i] || 'NEW',
  notes: yelpNotesPool[i] || '',
  addedAt: ['1d ago','2d ago','3d ago','4d ago','5d ago','1w ago','2w ago'][i % 7],
}));

// ── LinkedIn leads (for ln1: SF Bay Area Founders) ──
// People, not businesses. We extract from People-search cards:
//   - Full name + headline
//   - Current role + current company (parsed out of the headline)
//   - Location (metro string LinkedIn shows)
//   - Connection degree: 2nd / 3rd / Out of network
//   - Mutual connections count (clickable on LinkedIn)
//   - Profile URL slug
// No phone, no website. Email stays manual — LinkedIn never exposes it.
const linkedinLeadsPool = [
  // [name, role, company, location, degree, mutuals, slug, premium]
  ['Maya Chen',        'Founder & CEO',          'Stealth (Logistics)',   'San Francisco, CA',  '2nd', 12, 'maya-chen-04',     true ],
  ['Ravi Subramanian', 'Co-founder, CEO',        'Vellum AI',             'San Francisco, CA',  '2nd', 28, 'ravisub',          false],
  ['Liana Park',       'Founder',                'Field Notes (YC W25)',  'San Jose, CA',       '3rd', 4,  'lianapark',        true ],
  ['Theo Martinez',    'CEO',                    'Northbeam Robotics',    'Palo Alto, CA',      '2nd', 19, 'theom',            true ],
  ['Anjali Desai',     'Founder & CTO',          'Routebox',              'San Francisco, CA',  '2nd', 35, 'anjalidesai',      false],
  ['Sam Whitaker',     'Founder',                'Hatchet (Devtools)',    'Oakland, CA',        '3rd', 2,  'swhitaker',        false],
  ['Priya Iyer',       'Co-founder',             'Cofactor Bio',          'San Francisco, CA',  '2nd', 11, 'piyer',            true ],
  ['Daniel Okafor',    'Founder & CEO',          'Quill Finance',         'San Francisco, CA',  '2nd', 7,  'okafor',           true ],
  ['Hannah Goldberg',  'Founder',                'Marble (E-commerce)',   'Berkeley, CA',       '3rd', 1,  'hannahg',          false],
  ['Wei Zhang',        'CEO & Co-founder',       'PulseGrid',             'San Francisco, CA',  '2nd', 22, 'weizhang-pg',      false],
  ['Marcus Bell',      'Founder',                'Tangent Labs',          'Mountain View, CA',  '2nd', 14, 'marcusbell',       true ],
  ['Sofia Almeida',    'Founder & CEO',          'Brillo (Consumer SaaS)','San Francisco, CA',  '3rd', 0,  'sofia-almeida',    true ],
  ['Aaron Kapoor',     'CEO',                    'Underline Inc.',        'San Francisco, CA',  '2nd', 17, 'aaronkapoor',      false],
  ['Nikki Park',       'Co-founder, COO',        'Cardinal AI',           'San Mateo, CA',      '2nd', 25, 'nikkipark',        true ],
  ['Eli Brenner',      'Founder & CEO',          'Greenframe',            'San Francisco, CA',  '3rd', 3,  'elibrenner',       false],
  ['Yusuf Adebayo',    'CEO',                    'Lapwing Systems',       'San Francisco, CA',  '2nd', 9,  'yadebayo',         false],
  ['Tessa Holloway',   'Founder',                'Atrium Health Tech',    'Sausalito, CA',      '3rd', 5,  'tessah',           true ],
  ['Jonas Wirth',      'Co-founder & CTO',       'Northbase',             'San Francisco, CA',  '2nd', 31, 'jonasw',           true ],
  ['Carmen Vasquez',   'Founder & CEO',          'Sundial (Wellness)',    'San Francisco, CA',  '2nd', 13, 'cvasquez',         false],
  ['Ben Yi',           'Founder',                'Pebble Robotics',       'Redwood City, CA',   '3rd', 1,  'ben-yi',           false],
  ['Asha Mehta',       'Co-founder, CEO',        'Forge Climate',         'Berkeley, CA',       '2nd', 18, 'amehta',           true ],
  ['Felix Bauer',      'Founder & CEO',          'Stitchwork',            'San Francisco, CA',  '3rd', 0,  'felixbauer',       false],
  ['Olivia Reed',      'Founder',                'Nimbus Insurance',      'San Francisco, CA',  '2nd', 11, 'oliviareed',       true ],
  ['Hiroshi Tanaka',   'Co-founder & CEO',       'Lattice Genomics',      'South San Francisco','2nd', 23, 'hiroshi-t',        true ],
  ['Camille Dubois',   'Founder',                'Trellis (Marketplace)', 'San Francisco, CA',  '2nd', 8,  'camilledubois',    false],
];
const linkedinStatuses = ['CONTACTED','REPLIED','NEW','CONTACTED','REPLIED','NEW','CONTACTED','CONTACTED','NEW','REPLIED','NEW','NEW','CONTACTED','REPLIED','NEW','CONTACTED','NEW','REPLIED','CONTACTED','NEW','CLOSED','NEW','REPLIED','CONTACTED','NEW'];
const linkedinNotesPool = {
  0: 'Sent connection note: "Saw your post on warehouse routing — happy to share what we did for X."',
  1: 'Replied. Booked a call for Thursday at 11am PT.',
  3: 'Connected but no reply yet. Follow up next week.',
  4: 'Replied: not actively hiring agencies, refer me to their head of design.',
  7: 'Sent a 2-step InMail sequence. Day 4.',
  9: 'Replied + asked for case studies. Sent the e-comm deck.',
  13: 'Closed-won — landing page sprint, $3,200.',
  17: 'Replied politely declining. Tag for re-engagement Q4.',
  20: 'Closed in May. Retained for design system buildout, $4,800.',
  22: 'Asked for pricing. Sent options.',
};
const linkedinEmailPool = {
  1: 'ravi@vellum.ai',
  4: 'anjali@routebox.com',
  9: 'wei@pulsegrid.io',
  13: 'nikki@cardinal.ai',
  20: 'asha@forgeclimate.com',
};
const seedLeadsLinkedIn = linkedinLeadsPool.map((row, i) => ({
  id: 'lnl' + i,
  campaignId: 'ln1',
  source: 'linkedin',
  name: row[0],
  role: row[1],
  company: row[2],
  location: row[3],
  degree: row[4],
  mutuals: row[5],
  profileSlug: row[6],
  premium: row[7],
  headline: `${row[1]} at ${row[2]}`,
  email: linkedinEmailPool[i] || '',
  status: linkedinStatuses[i] || 'NEW',
  notes: linkedinNotesPool[i] || '',
  addedAt: ['1d ago','2d ago','3d ago','4d ago','5d ago','1w ago','2w ago'][i % 7],
}));

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
  SOURCES, CATEGORIES_BY_SOURCE,
  LINKEDIN_METROS, LINKEDIN_INDUSTRIES, LINKEDIN_SENIORITY,
  seedCampaigns, seedLeads, seedLeadsYelp, seedLeadsLinkedIn,
  seedRunHistory, STATUS_OPTIONS,
  businessMetrics, closedLeads,
  globalRunHistory,
});
