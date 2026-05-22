/**
 * Email enrichment engine (§3–§7 of PHASE_6_EMAIL_ENRICHMENT.md).
 *
 * Core API:
 *   enrichLead(domain)           — fetch pages for one lead, return email or null
 *   enrichLeads(leads, opts)     — batch of 5, conditional delay, per-lead DB write
 */

import { db } from "./db.js";
import { logger } from "./logger.js";
import { extractEmail } from "./extract-email.js";

// ── Request configuration (§9) ────────────────────────────────────────────────

const FETCH_TIMEOUT_MS = 5000;
const MAX_CONCURRENT   = 5;
const BATCH_DELAY_MS   = 500; // only applied when total leads > 50 (§6)
const LARGE_RUN_THRESHOLD = 50;

const FETCH_HEADERS: Record<string, string> = {
  "User-Agent":      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept":          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
};

// ── URL discovery constants (§4) ─────────────────────────────────────────────

/** Keyword patterns that identify real contact links in homepage hrefs/text. */
const CONTACT_KEYWORDS = /contact|about|team|get-in-touch/i;
/** Max real contact links to follow per lead. */
const MAX_CONTACT_LINKS = 3;
/** Fallback guessed paths tried only when homepage exposed no contact links. */
const FALLBACK_PATHS = ["/contact", "/about", "/team"];

// ── Helpers ──────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Fetch a URL's HTML with a 5 s timeout. Returns null on any failure
 * (timeout, non-200, network error) — callers skip to the next URL.
 */
async function fetchHTML(url: string): Promise<string | null> {
  try {
    const resp = await fetch(url, {
      signal:  AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: FETCH_HEADERS,
      redirect: "follow",
    });
    if (!resp.ok) return null;
    const ct = resp.headers.get("content-type") ?? "";
    if (!ct.includes("html")) return null;
    return await resp.text();
  } catch {
    return null;
  }
}

/**
 * Resolve the fetchable base URL for a lead domain.
 * Tries HTTPS bare domain first, then www. prefix.
 * Returns the resolved URL string or null if both fail.
 */
async function resolveBaseUrl(domain: string): Promise<string | null> {
  const candidates = [
    `https://${domain}`,
    `https://www.${domain}`,
  ];
  for (const url of candidates) {
    try {
      const resp = await fetch(url, {
        signal:  AbortSignal.timeout(FETCH_TIMEOUT_MS),
        headers: FETCH_HEADERS,
        redirect: "follow",
        method: "HEAD",
      });
      if (resp.ok || resp.status === 405) {
        // 405 = Method Not Allowed on HEAD — server is reachable, use GET
        return url;
      }
    } catch {
      // try next variant
    }
  }
  return null;
}

/**
 * Extract up to MAX_CONTACT_LINKS hrefs from homepage HTML whose href or
 * anchor text matches CONTACT_KEYWORDS. Resolves relative paths against base.
 */
function extractContactLinks(html: string, baseUrl: string): string[] {
  const results: string[] = [];
  // Match <a href="...">...</a> — captures href and visible text
  const re = /<a\s[^>]*href=["']([^"'#?][^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null && results.length < MAX_CONTACT_LINKS) {
    const href = m[1]!.trim();
    const text = m[2]!.replace(/<[^>]*>/g, "").trim();
    if (!CONTACT_KEYWORDS.test(href) && !CONTACT_KEYWORDS.test(text)) continue;
    // Skip mailto: and external links
    if (/^mailto:|^javascript:|^tel:/i.test(href)) continue;
    try {
      const resolved = new URL(href, baseUrl).href;
      if (!results.includes(resolved)) results.push(resolved);
    } catch {
      // unparseable href — skip
    }
  }
  return results;
}

// ── Core: enrich one lead ────────────────────────────────────────────────────

/**
 * Attempt to find a contact email for a single lead domain.
 * Returns the email string or null.
 */
export async function enrichLead(domain: string): Promise<string | null> {
  const baseUrl = await resolveBaseUrl(domain);
  if (!baseUrl) return null;

  const homepageHtml = await fetchHTML(baseUrl);
  if (!homepageHtml) return null;

  // Check homepage immediately
  const homepageEmail = extractEmail(homepageHtml, domain);
  if (homepageEmail) return homepageEmail;

  // Collect real contact links from homepage
  const contactLinks = extractContactLinks(homepageHtml, baseUrl);

  // Determine pages to walk: real contact links first, then fallbacks if none found
  const pagesToWalk = contactLinks.length > 0
    ? contactLinks
    : FALLBACK_PATHS.map((p) => baseUrl.replace(/\/$/, "") + p);

  for (const pageUrl of pagesToWalk) {
    const html = await fetchHTML(pageUrl);
    if (!html) continue;
    const email = extractEmail(html, domain);
    if (email) return email;
  }

  return null;
}

// ── Progress callback shape ───────────────────────────────────────────────────

export interface EnrichProgress {
  leadId:  string;
  email:   string | null; // null = not found
  skipped: boolean;       // true = already had an email at processing time
}

export type EnrichProgressCallback = (progress: EnrichProgress) => Promise<void>;

// ── Batch engine: enrich many leads ──────────────────────────────────────────

export interface LeadForEnrichment {
  id:               string;
  normalizedDomain: string | null;
  email:            string | null;
}

/**
 * Process a list of leads in batches of 5 (§5).
 * Calls onProgress after each lead so the worker can update DB counters
 * and write found emails immediately.
 * Throws CancelledError (imported from dedupe.ts) if cancelled between batches.
 */
export async function enrichLeads(
  leads: LeadForEnrichment[],
  onProgress: EnrichProgressCallback,
  isCancelled: () => Promise<boolean>,
): Promise<void> {
  const isLargeRun = leads.length > LARGE_RUN_THRESHOLD;

  for (let i = 0; i < leads.length; i += MAX_CONCURRENT) {
    // Check for cancellation before each batch
    if (await isCancelled()) {
      const { CancelledError } = await import("./dedupe.js");
      throw new CancelledError();
    }

    const batch = leads.slice(i, i + MAX_CONCURRENT);

    // Process each lead in the batch concurrently; URLs within a lead are sequential (inside enrichLead)
    await Promise.all(
      batch.map(async (lead) => {
        // Re-check: if another enrichment path already wrote an email, skip
        if (lead.email) {
          await onProgress({ leadId: lead.id, email: null, skipped: true });
          return;
        }
        if (!lead.normalizedDomain) {
          await onProgress({ leadId: lead.id, email: null, skipped: false });
          return;
        }
        const email = await enrichLead(lead.normalizedDomain);
        await onProgress({ leadId: lead.id, email, skipped: false });
      })
    );

    // Conditional batch delay (§6): only for large runs and not after the last batch
    const isLastBatch = i + MAX_CONCURRENT >= leads.length;
    if (isLargeRun && !isLastBatch) {
      await sleep(BATCH_DELAY_MS);
    }
  }
}

// ── Convenience: write email to DB (used by worker) ──────────────────────────

export async function writeLeadEmail(leadId: string, email: string): Promise<void> {
  await db.lead.update({
    where: { id: leadId },
    data:  { email },
  });
  logger.debug("email written", { leadId, email });
}
