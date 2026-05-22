/**
 * Pure email extraction from an HTML string.
 * Strategy (§8 of PHASE_6_EMAIL_ENRICHMENT.md):
 *   1. Decode HTML entities that obscure @ and .
 *   2. Collect mailto: hrefs first (unambiguously real).
 *   3. Fall back to body-text regex only if no mailto: survives the denylist.
 *   4. Apply denylist (image extensions, placeholder domains, asset tokens).
 *   5. Prefer same-domain address over third-party.
 *   6. Normalize (lowercase, trim) and return the single best candidate.
 */

const EMAIL_RE = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;

// Exact domains that are never real contact emails.
const DENYLIST_EXACT = new Set([
  "example.com",
  "domain.com",
  "email.com",
  "yourdomain.com",
  "test.com",
  "sentry.io",
  "mailchimp.com",
  "sendgrid.net",
  "amazonaws.com",
  "googletagmanager.com",
  "google.com",
  "facebook.com",
  "schema.org",
]);

// Any email whose domain ends with one of these suffixes is infrastructure /
// platform noise, never a real business contact address.
const DENYLIST_SUFFIXES = [
  "wixpress.com",       // covers sentry.wixpress.com, sentry-next.wixpress.com, etc.
  "squarespace.com",
  "shopify.com",
  "myshopify.com",
  "weebly.com",
  "godaddy.com",
  "zendesk.com",
  "intercom.io",
  "hubspot.com",
  "klaviyo.com",
  "mailgun.org",
  "sparkpostmail.com",
];

// Free-mail providers: personal addresses from bios, not business contacts.
// Only used to de-prioritise, not to hard-deny (a solo operator may use Gmail).
const FREE_MAIL_DOMAINS = new Set([
  "gmail.com",
  "yahoo.com",
  "hotmail.com",
  "outlook.com",
  "live.com",
  "icloud.com",
  "me.com",
  "aol.com",
  "protonmail.com",
  "proton.me",
]);

const DENYLIST_EXTENSIONS  = /\.(png|jpg|jpeg|svg|gif|webp|ico|woff|woff2|ttf|eot)$/i;
const DENYLIST_ASSET_TOKENS = /@[23]x\b/i;

/** Decode the two HTML-entity forms that commonly obfuscate @ and . */
function decodeEntities(html: string): string {
  return html
    .replace(/&#64;|&#x40;|&commat;/gi, "@")
    .replace(/&#46;|&#x2e;|&period;/gi, ".");
}

function isDenylisted(email: string): boolean {
  const lower = email.toLowerCase();
  if (DENYLIST_EXTENSIONS.test(lower)) return true;
  if (DENYLIST_ASSET_TOKENS.test(lower)) return true;
  const atIdx = lower.indexOf("@");
  if (atIdx < 0) return true;
  const domain = lower.slice(atIdx + 1);
  if (DENYLIST_EXACT.has(domain)) return true;
  // Block any subdomain of a denylisted suffix (e.g. sentry.wixpress.com)
  if (DENYLIST_SUFFIXES.some((s) => domain === s || domain.endsWith("." + s))) return true;
  return false;
}

function isFreeMail(email: string): boolean {
  const atIdx = email.indexOf("@");
  if (atIdx < 0) return false;
  return FREE_MAIL_DOMAINS.has(email.slice(atIdx + 1));
}

// Local-part prefixes that strongly suggest a business-operated free-mail account
// (e.g. a restaurant using info@gmail.com). Scored highest among free-mail.
const FREE_MAIL_BUSINESS_LOCALS = new Set([
  "info", "contact", "hello", "enquiries", "enquiry",
  "bookings", "reservations", "office", "mail", "admin",
  "reception", "general", "customerservice", "customer.service",
]);

// Local-part prefixes that suggest a staff member in a decision-making role.
// Useful for outreach even if personal.
const FREE_MAIL_STAFF_LOCALS = new Set([
  "owner", "manager", "director", "gm", "ceo", "president",
  "team", "support", "sales", "marketing", "careers",
]);

/**
 * Score a free-mail address for outreach quality. Lower = better.
 *   0 — generic business handle (info@, contact@, …)
 *   1 — owner/manager signal
 *   2 — name-shaped local (firstname.lastname or single word ≥4 chars)
 *   3 — everything else
 */
function freeMailScore(email: string): number {
  const local = email.slice(0, email.indexOf("@")).toLowerCase();
  if (FREE_MAIL_BUSINESS_LOCALS.has(local)) return 0;
  if (FREE_MAIL_STAFF_LOCALS.has(local))    return 1;
  // name-shaped: letters + optional dot/hyphen, no digits, reasonable length
  if (/^[a-z]{2,}([.\-][a-z]{2,})?$/.test(local)) return 2;
  return 3;
}

function isValidEmail(email: string): boolean {
  const i = email.indexOf("@");
  if (i < 1) return false;
  const afterAt = email.slice(i + 1);
  return afterAt.includes(".");
}

/** Normalize to lowercase and trim. */
function normalize(email: string): string {
  return email.toLowerCase().trim();
}

/**
 * Extract `mailto:` href values from raw HTML.
 * Returns only the address part (strips `mailto:` prefix and any query string).
 */
function extractMailtoEmails(html: string): string[] {
  const results: string[] = [];
  // Match href="mailto:..." — single or double quoted
  const re = /href=["']mailto:([^"'?# \t\r\n>]+)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const raw = m[1]!.trim();
    if (raw) results.push(raw);
  }
  return results;
}

/**
 * Extract all email-like strings from body text via regex.
 * Only called when no mailto: candidates survive the denylist.
 */
function extractBodyEmails(html: string): string[] {
  // Strip tags first to avoid false positives inside attribute strings
  const stripped = html.replace(/<[^>]*>/g, " ");
  const results: string[] = [];
  let m: RegExpExecArray | null;
  const re = new RegExp(EMAIL_RE.source, "g");
  while ((m = re.exec(stripped)) !== null) {
    results.push(m[0]!);
  }
  return results;
}

/**
 * Given a list of candidate email strings, apply denylist + validation,
 * prefer same-domain addresses, skip free-mail when a domain is known,
 * and return the single best or null.
 */
function pickBest(candidates: string[], leadDomain: string | null): string | null {
  const valid = [...new Set(
    candidates.map(normalize).filter((e) => isValidEmail(e) && !isDenylisted(e))
  )];

  if (valid.length === 0) return null;

  const ownDomain = leadDomain
    ? leadDomain.replace(/^www\./i, "").toLowerCase()
    : null;

  // Tier 1: same domain as the lead's website (e.g. info@joespizza.com)
  if (ownDomain) {
    const tier1 = valid.filter((e) => {
      const domain = e.slice(e.indexOf("@") + 1).replace(/^www\./i, "");
      return domain === ownDomain;
    });
    if (tier1.length > 0) return tier1[0]!;
  }

  // Tier 2: non-free-mail business addresses on a third-party domain
  // (e.g. info@partneragency.com found on the page — rare but real).
  if (ownDomain) {
    const tier2 = valid.filter((e) => !isFreeMail(e));
    if (tier2.length > 0) return tier2[0]!;
  }

  // Tier 3: free-mail — scored and ranked so the best staff/business address
  // wins. info@gmail.com beats eric.rynne@gmail.com beats x4j2k9@yahoo.com.
  const freeMail = valid.filter(isFreeMail);
  if (freeMail.length > 0) {
    freeMail.sort((a, b) => freeMailScore(a) - freeMailScore(b));
    return freeMail[0]!;
  }

  return null;
}

/**
 * Extract the best contact email from an HTML page.
 *
 * @param html       Raw HTML string of the page.
 * @param leadDomain The lead's normalized domain (e.g. "joespizza.com") for
 *                   same-domain preference.  May be null/empty.
 * @returns          The best email found, or null.
 */
export function extractEmail(html: string, leadDomain: string | null): string | null {
  const decoded = decodeEntities(html);

  // Step 1: try mailto: hrefs — most trustworthy source
  const mailtoEmails = extractMailtoEmails(decoded);
  const mailtoResult = pickBest(mailtoEmails, leadDomain);
  if (mailtoResult) return mailtoResult;

  // Step 2: fall back to body-text regex
  const bodyEmails = extractBodyEmails(decoded);
  return pickBest(bodyEmails, leadDomain);
}
