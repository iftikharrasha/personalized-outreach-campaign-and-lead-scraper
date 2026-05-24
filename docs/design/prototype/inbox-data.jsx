// ───────── Phase 8 — Inbox seed data ─────────
// Mocked threads + messages used by the Inbox feature. Mirrors the data
// model in uploads/PHASE_8_INBOX.md §4 closely enough that hooking up a
// real backend is mostly a swap of these constants for fetch() calls.
//
//   InboxThread     → { id, campaignId, createdAt, updatedAt, recipients[], messages[], lastSubject }
//   InboxRecipient  → { leadId, email, name }
//   InboxMessage    → { id, subject, fromAddress, html, text, sentAt, status, recipients[] }
//   InboxMsgRecipient → { email, status, errorMessage? }

const MAILHOG_FROM = 'outreach@outrich.localhost';

// ── Sample HTML bodies ──
// Realistic-ish marketing emails. We render them inside a 600px iframe via
// srcDoc — feels exactly like Gmail's preview pane.

const SAMPLE_HTML_RESERVATIONS = `<!doctype html><html><head><meta charset="utf-8"><style>
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif;margin:0;background:#f6f6f4;color:#1a1a1a;line-height:1.55;}
.wrap{max-width:540px;margin:0 auto;padding:0;background:#fff;}
.hero{padding:36px 32px 24px;border-bottom:1px solid #eee;}
.hero h1{margin:0 0 8px;font-size:22px;font-weight:700;letter-spacing:-0.01em;color:#0e0f0c;}
.hero .sub{color:#666;font-size:13.5px;margin:0;}
.body{padding:28px 32px;}
.body p{margin:0 0 16px;font-size:14.5px;color:#2a2a2a;}
.body strong{color:#0e0f0c;}
.cta{margin:24px 0;}
.btn{display:inline-block;background:#9fe870;color:#0e0f0c;padding:12px 22px;border-radius:10px;text-decoration:none;font-weight:600;font-size:14px;}
.foot{padding:18px 32px 28px;border-top:1px solid #eee;color:#888;font-size:12px;}
.foot a{color:#666;text-decoration:underline;}
</style></head><body><div class="wrap">
<div class="hero"><h1>Quick question about your reservation page</h1><p class="sub">Outrich Studio · Restaurant web design</p></div>
<div class="body">
<p>Hey,</p>
<p>I came across your spot and loved the menu — but the <strong>reservation page</strong> takes 6+ seconds to load on a phone. That window between 7&ndash;9pm is when people decide where to eat tonight; a slow page costs bookings.</p>
<p>I rebuild restaurant landing pages in about a week. Recent client (Cesarina) saw <strong>+28% reservations in month one</strong>.</p>
<p>Want me to send a 2-minute Loom showing exactly what I'd change on yours?</p>
<div class="cta"><a href="#" class="btn">Send the Loom →</a></div>
<p style="color:#666;font-size:13px;">— You<br/>Outrich Studio</p>
</div>
<div class="foot">Sent because we think we can help. <a href="#">Unsubscribe</a></div>
</div></body></html>`;

const SAMPLE_HTML_FOLLOWUP = `<!doctype html><html><head><meta charset="utf-8"><style>
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif;margin:0;background:#fff;color:#1a1a1a;line-height:1.6;font-size:15px;}
.wrap{max-width:540px;margin:0 auto;padding:36px 32px;}
.wrap p{margin:0 0 16px;}
.sig{margin-top:24px;color:#777;font-size:13px;}
.bar{display:inline-block;height:3px;width:36px;background:#9fe870;border-radius:2px;margin-bottom:18px;}
</style></head><body><div class="wrap">
<span class="bar"></span>
<p>Quick bump on this — I know inboxes are noisy.</p>
<p>If the timing is off, no worries. Just let me know if there's a better month and I'll circle back.</p>
<p>If you'd rather I never email again, just reply "stop" and I'll mark you done.</p>
<p class="sig">— You<br/>Outrich Studio · you@outrich.app</p>
</div></body></html>`;

const SAMPLE_HTML_COFFEE = `<!doctype html><html><head><meta charset="utf-8"><style>
body{font-family:Georgia,"Times New Roman",serif;margin:0;background:#fbfaf6;color:#2a241d;line-height:1.6;}
.wrap{max-width:560px;margin:0 auto;padding:40px 32px;}
.eyebrow{font-family:-apple-system,sans-serif;font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:#8b7d63;margin-bottom:8px;}
h1{font-size:26px;font-weight:normal;margin:0 0 20px;letter-spacing:-0.01em;color:#1a140d;}
p{margin:0 0 16px;font-size:15.5px;}
.divider{border:none;border-top:1px solid #d8cfb8;margin:24px 0;}
.btn{display:inline-block;background:#1a140d;color:#fbfaf6;padding:11px 20px;border-radius:4px;text-decoration:none;font-family:-apple-system,sans-serif;font-size:13.5px;font-weight:600;letter-spacing:0.02em;}
</style></head><body><div class="wrap">
<div class="eyebrow">Outrich Studio · for coffee shops</div>
<h1>Your Yelp page is doing more work than your website.</h1>
<p>Saw your shop on Yelp — 4.6 stars, great reviews. But the website it links to is a Squarespace template from 2019 that doesn't take orders.</p>
<p>I build small, fast coffee-shop sites that handle pickup, gift cards, and wholesale inquiries — usually in 7&ndash;10 days for under $2k.</p>
<p>Worth a 15-min look?</p>
<hr class="divider"/>
<a href="#" class="btn">Pick a time →</a>
</div></body></html>`;

// ── Seed threads, by campaign ──
// Three demo states:
//   c1: 3 threads — covers SENT, PARTIAL, FAILED message statuses
//   c2: 1 thread (lawyer)
//   y1: 2 threads on a Yelp campaign — proves the inbox is source-agnostic

const seedInboxThreads = {
  c1: [
    {
      id: 'th_c1_a',
      campaignId: 'c1',
      createdAtRel: '5 days ago',
      updatedAtRel: '2 days ago',
      updatedAtMs: Date.now() - 2 * 86400000,
      recipients: [
        { leadId: 'l1', email: 'info@bornandraisedsteak.com', name: 'Born & Raised' },
        { leadId: 'l5', email: 'orders@lola55.com',          name: 'Lola 55 Tacos' },
        { leadId: 'l14', email: 'manager@buonaforchettasd.com', name: 'Buona Forchetta' },
        { leadId: 'l7', email: 'hello@crackshack.com',       name: 'The Crack Shack' },
      ],
      messages: [
        {
          id: 'msg_c1_a_1',
          subject: 'Quick question about your reservation page',
          fromAddress: MAILHOG_FROM,
          html: SAMPLE_HTML_RESERVATIONS,
          text: 'Hey — your reservation page is slow. I rebuild restaurant sites. Worth a chat?',
          sentAtRel: '5 days ago',
          status: 'SENT',
          recipients: [
            { email: 'info@bornandraisedsteak.com', status: 'SENT', smtpMessageId: 'mh-001' },
            { email: 'orders@lola55.com',          status: 'SENT', smtpMessageId: 'mh-002' },
            { email: 'manager@buonaforchettasd.com', status: 'SENT', smtpMessageId: 'mh-003' },
            { email: 'hello@crackshack.com',       status: 'SENT', smtpMessageId: 'mh-004' },
          ],
        },
        {
          id: 'msg_c1_a_2',
          subject: 'Following up — restaurant site rebuild',
          fromAddress: MAILHOG_FROM,
          html: SAMPLE_HTML_FOLLOWUP,
          text: '',
          sentAtRel: '2 days ago',
          status: 'PARTIAL',
          recipients: [
            { email: 'info@bornandraisedsteak.com', status: 'SENT',   smtpMessageId: 'mh-021' },
            { email: 'orders@lola55.com',           status: 'FAILED', errorMessage: 'Mailbox quota exceeded' },
            { email: 'manager@buonaforchettasd.com', status: 'SENT',  smtpMessageId: 'mh-022' },
            { email: 'hello@crackshack.com',        status: 'SENT',   smtpMessageId: 'mh-023' },
          ],
        },
      ],
    },
    {
      id: 'th_c1_b',
      campaignId: 'c1',
      createdAtRel: '2 weeks ago',
      updatedAtRel: '6 days ago',
      updatedAtMs: Date.now() - 6 * 86400000,
      recipients: [
        { leadId: 'l17', email: 'hi@trustrestaurantsd.com', name: 'Trust Restaurant' },
      ],
      messages: [
        {
          id: 'msg_c1_b_1',
          subject: 'Loom for Trust — homepage redesign concept',
          fromAddress: MAILHOG_FROM,
          html: SAMPLE_HTML_RESERVATIONS,
          text: '',
          sentAtRel: '6 days ago',
          status: 'SENT',
          recipients: [
            { email: 'hi@trustrestaurantsd.com', status: 'SENT', smtpMessageId: 'mh-104' },
          ],
        },
      ],
    },
    {
      id: 'th_c1_c',
      campaignId: 'c1',
      createdAtRel: '1 month ago',
      updatedAtRel: '3 weeks ago',
      updatedAtMs: Date.now() - 21 * 86400000,
      recipients: [
        { leadId: 'l11', email: 'old@example-broken.test', name: 'Cori Pastificio' },
      ],
      messages: [
        {
          id: 'msg_c1_c_1',
          subject: 'Re: site redesign timeline',
          fromAddress: MAILHOG_FROM,
          html: SAMPLE_HTML_FOLLOWUP,
          text: '',
          sentAtRel: '3 weeks ago',
          status: 'FAILED',
          errorMessage: 'All recipients rejected by SMTP server.',
          recipients: [
            { email: 'old@example-broken.test', status: 'FAILED', errorMessage: 'Domain has no MX record' },
          ],
        },
      ],
    },
  ],
  c2: [
    {
      id: 'th_c2_a',
      campaignId: 'c2',
      createdAtRel: '1 week ago',
      updatedAtRel: '4 days ago',
      updatedAtMs: Date.now() - 4 * 86400000,
      recipients: [
        { leadId: null, email: 'intake@hodgeandassociates.com', name: 'Hodge & Associates' },
        { leadId: null, email: 'hello@vegalawgroup.com',        name: 'Vega Law Group' },
      ],
      messages: [
        {
          id: 'msg_c2_a_1',
          subject: 'Faster intake forms = more case sign-ups',
          fromAddress: MAILHOG_FROM,
          html: SAMPLE_HTML_RESERVATIONS,
          text: '',
          sentAtRel: '4 days ago',
          status: 'SENT',
          recipients: [
            { email: 'intake@hodgeandassociates.com', status: 'SENT', smtpMessageId: 'mh-201' },
            { email: 'hello@vegalawgroup.com',        status: 'SENT', smtpMessageId: 'mh-202' },
          ],
        },
      ],
    },
  ],
  y1: [
    {
      id: 'th_y1_a',
      campaignId: 'y1',
      createdAtRel: '3 days ago',
      updatedAtRel: '3 days ago',
      updatedAtMs: Date.now() - 3 * 86400000,
      recipients: [
        { leadId: 'yl0', email: 'team@devocion.com',            name: 'Devoción' },
        { leadId: 'yl1', email: 'hello@varietycoffeeroasters.com', name: 'Variety Coffee Roasters' },
        { leadId: 'yl2', email: 'orders@seycoffee.com',         name: 'Sey Coffee' },
      ],
      messages: [
        {
          id: 'msg_y1_a_1',
          subject: 'Your Yelp page is doing more work than your website',
          fromAddress: MAILHOG_FROM,
          html: SAMPLE_HTML_COFFEE,
          text: '',
          sentAtRel: '3 days ago',
          status: 'SENT',
          recipients: [
            { email: 'team@devocion.com',              status: 'SENT', smtpMessageId: 'mh-301' },
            { email: 'hello@varietycoffeeroasters.com', status: 'SENT', smtpMessageId: 'mh-302' },
            { email: 'orders@seycoffee.com',           status: 'SENT', smtpMessageId: 'mh-303' },
          ],
        },
      ],
    },
    {
      id: 'th_y1_b',
      campaignId: 'y1',
      createdAtRel: 'yesterday',
      updatedAtRel: 'yesterday',
      updatedAtMs: Date.now() - 1 * 86400000,
      recipients: [
        { leadId: 'yl9', email: 'wholesale@brooklynroasting.com', name: 'Brooklyn Roasting Co.' },
      ],
      messages: [
        {
          id: 'msg_y1_b_1',
          subject: 'Wholesale ordering site for Brooklyn Roasting',
          fromAddress: MAILHOG_FROM,
          html: SAMPLE_HTML_COFFEE,
          text: '',
          sentAtRel: 'yesterday',
          status: 'SENT',
          recipients: [
            { email: 'wholesale@brooklynroasting.com', status: 'SENT', smtpMessageId: 'mh-401' },
          ],
        },
      ],
    },
  ],
};

// Augment last-subject onto each thread for the rail (computed, not stored).
Object.keys(seedInboxThreads).forEach((cid) => {
  seedInboxThreads[cid].forEach((th) => {
    const last = th.messages[th.messages.length - 1];
    th.lastSubject = last?.subject || '(no messages)';
  });
});

Object.assign(window, {
  MAILHOG_FROM,
  seedInboxThreads,
  SAMPLE_HTML_RESERVATIONS,
  SAMPLE_HTML_FOLLOWUP,
  SAMPLE_HTML_COFFEE,
});
