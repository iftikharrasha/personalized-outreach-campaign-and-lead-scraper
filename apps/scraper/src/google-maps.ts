import type { BrowserContext, Page } from "playwright";
import { BlockedError, detectBlock } from "./block-detection.js";
import { logger } from "./logger.js";

export interface RawLead {
  businessName: string;
  websiteUrl:   string | null;
  phone:        string | null;
  address:      string | null;
}

const MAX_RESULTS  = Number(process.env["MAX_RESULTS_PER_SEARCH"] ?? 120);
const DELAY_MIN_MS = Number(process.env["SCROLL_DELAY_MIN_MS"]    ?? 600);
const DELAY_MAX_MS = Number(process.env["SCROLL_DELAY_MAX_MS"]    ?? 1200);

function randomDelay(min = DELAY_MIN_MS, max = DELAY_MAX_MS): Promise<void> {
  const ms = min + Math.random() * (max - min);
  return new Promise((r) => setTimeout(r, ms));
}

// Generic Google Maps panel headings that are NOT business names.
const GENERIC_HEADINGS = new Set(["ফলাফল", "Results", "Google Maps", "Search results"]);

// Scrape the detail panel that opens in-place when a result card is clicked.
// Google Maps is a SPA — clicking a card swaps the panel content WITHOUT a
// page reload. The detail panel is `div[role="main"]` and its `aria-label`
// equals the business name. We scope every query to that panel so we never
// accidentally read the search-results heading ("ফলাফল").
async function scrapeDetailPanel(page: Page, expectedName?: string): Promise<RawLead> {
  // Wait until the detail panel's main region carries a real business name.
  // The panel's role="main" aria-label is the business name; while the
  // search-results list is showing, role="main" has a generic label.
  await page.waitForFunction(
    (generics: string[]) => {
      const panels = document.querySelectorAll<HTMLElement>('div[role="main"]');
      for (const p of panels) {
        const label = (p.getAttribute("aria-label") ?? "").trim();
        if (label && !generics.includes(label)) return true;
      }
      return false;
    },
    Array.from(GENERIC_HEADINGS),
    { timeout: 8000 },
  ).catch(() => null);

  return page.evaluate((generics: string[]) => {
    // ── Locate the detail panel ────────────────────────────────────────────
    // Pick the role="main" whose aria-label is a real business name.
    let panel: HTMLElement | null = null;
    let panelName = "";
    for (const p of document.querySelectorAll<HTMLElement>('div[role="main"]')) {
      const label = (p.getAttribute("aria-label") ?? "").trim();
      if (label && !generics.includes(label)) { panel = p; panelName = label; break; }
    }
    // Fallback to whole document if no panel found
    const root: ParentNode = panel ?? document;

    // ── Business name ──────────────────────────────────────────────────────
    // Prefer the panel's aria-label; fall back to an h1 inside the panel.
    let businessName = panelName;
    if (!businessName) {
      const h1 = (root as ParentNode & { querySelector(s: string): HTMLElement | null })
        .querySelector("h1");
      const t = h1?.textContent?.trim() ?? "";
      if (t && !generics.includes(t)) businessName = t;
    }

    // ── Phone ──────────────────────────────────────────────────────────────
    let phone: string | null = null;

    const phoneByAria = root.querySelector?.('[aria-label^="Phone:"], [aria-label^="phone:"]') as HTMLElement | null;
    if (phoneByAria) {
      const v = (phoneByAria.getAttribute("aria-label") ?? "").replace(/^phone:\s*/i, "").trim();
      if (v) phone = v;
    }
    if (!phone) {
      const phoneItem = root.querySelector?.('[data-item-id*="phone"]') as HTMLElement | null;
      if (phoneItem) {
        const txt = phoneItem.textContent?.trim() ?? "";
        if (/[\d\-\(\)\+\s]{7,}/.test(txt)) phone = txt;
      }
    }
    if (!phone && panel) {
      for (const el of panel.querySelectorAll<HTMLElement>("button, span, div")) {
        if (el.children.length > 0) continue;
        const txt = el.textContent?.trim() ?? "";
        if (/^\+?[\d][\d\s\-\(\)\.]{8,18}\d$/.test(txt)) { phone = txt; break; }
      }
    }

    // ── Website ────────────────────────────────────────────────────────────
    let websiteUrl: string | null = null;

    const websiteLink = root.querySelector?.(
      'a[aria-label="Open website"], a[aria-label^="Website"], a[data-item-id*="authority"]'
    ) as HTMLAnchorElement | null;
    if (websiteLink?.href && !websiteLink.href.includes("google.com")) {
      websiteUrl = websiteLink.href;
    }
    if (!websiteUrl && panel) {
      for (const link of panel.querySelectorAll<HTMLAnchorElement>("a[data-tooltip]")) {
        const tip = (link.getAttribute("data-tooltip") ?? "").toLowerCase();
        if ((tip.includes("website") || tip.includes("web site")) && !link.href.includes("google.com")) {
          websiteUrl = link.href; break;
        }
      }
    }
    if (!websiteUrl && panel) {
      for (const link of panel.querySelectorAll<HTMLAnchorElement>("a[href]")) {
        const href = link.href ?? "";
        if (
          href.startsWith("http") &&
          !href.includes("google.com") &&
          !href.includes("goo.gl") &&
          !href.includes("maps.app") &&
          !href.includes("support.google")
        ) { websiteUrl = href; break; }
      }
    }

    // ── Address ────────────────────────────────────────────────────────────
    let address: string | null = null;

    const addrItem = root.querySelector?.('[data-item-id*="address"], [data-item-id="address"]') as HTMLElement | null;
    if (addrItem) address = addrItem.textContent?.trim() ?? null;

    if (!address) {
      const addrAria = root.querySelector?.('[aria-label*="Address" i]') as HTMLElement | null;
      if (addrAria) {
        address = (addrAria.getAttribute("aria-label") ?? addrAria.textContent ?? "")
          .replace(/^address:\s*/i, "").trim() || null;
      }
    }
    if (!address) {
      const copyBtn = root.querySelector?.(
        '[data-tooltip*="Copy address" i], [aria-label*="Copy address" i]'
      ) as HTMLElement | null;
      if (copyBtn) {
        const parent = copyBtn.closest("[data-item-id]") ?? copyBtn.parentElement;
        if (parent) address = parent.textContent?.trim() ?? null;
      }
    }

    // Strip locale-translated country suffix (keep up to US state+ZIP)
    if (address) {
      const clean = address.match(/^(.+?,\s*[A-Z]{2}\s*\d{5})/);
      if (clean?.[1]) address = clean[1];
    }

    return { businessName, phone, websiteUrl, address };
  }, Array.from(GENERIC_HEADINGS)).then((lead) => {
    // If the panel name still didn't resolve, fall back to the card's name.
    if (!lead.businessName && expectedName) lead.businessName = expectedName;
    // Google injects invisible bidi/format characters into phone strings so
    // numbers render correctly in RTL locales. Strip them so the stored value
    // is a clean phone number (and the CSV export inherits the cleanup).
    if (lead.phone) lead.phone = cleanPhone(lead.phone);
    return lead;
  });
}

// Clean a scraped phone string: remove the Material-icon glyph Google
// prefixes it with (a Private Use Area char), strip invisible bidi/format
// marks, and normalise whitespace so the stored value and CSV stay clean.
function cleanPhone(raw: string): string {
  return raw
    // Strip Unicode Private Use Area chars (U+E000-U+F8FF) - Google Maps
    // prefixes phone strings with a Material icon glyph (e.g. U+E0B0).
    .replace(/[\uE000-\uF8FF]/g, "")
    // Strip bidi & zero-width marks: ZWSP/ZWNJ/ZWJ, LRM/RLM/ALM,
    // bidi embeddings/overrides, word joiner, isolates, BOM.
    .replace(/[\u200B-\u200F\u061C\u202A-\u202E\u2060\u2066-\u2069\uFEFF]/g, "")
    // Non-breaking space (U+00A0) -> regular space
    .replace(/\u00A0/g, " ")
    // Collapse runs of whitespace
    .replace(/\s+/g, " ")
    .trim();
}

// A card in the results feed: its place-id key + its visible name.
interface FeedCard {
  key:  string;  // stable place identity (origin + pathname)
  name: string;  // business name shown on the card
}

// Read all result cards currently in the feed: stable key + name.
async function getFeedCards(page: Page): Promise<FeedCard[]> {
  return page.evaluate(() => {
    const out: { key: string; name: string }[] = [];
    const links = document.querySelectorAll<HTMLAnchorElement>(
      'div[role="feed"] div[role="article"] a[href*="/maps/place"]'
    );
    for (const link of links) {
      let key: string;
      try { const u = new URL(link.href); key = u.origin + u.pathname; }
      catch { key = link.href; }
      // The card name is on the link's aria-label
      const name = (link.getAttribute("aria-label") ?? "").trim();
      out.push({ key, name });
    }
    return out;
  });
}

export async function scrapeGoogleMaps(
  browser: BrowserContext,
  keyword: string,
  onBatch: (batch: RawLead[]) => Promise<boolean>,
): Promise<void> {
  const page = await browser.newPage();

  try {
    const url = `https://www.google.com/maps/search/${encodeURIComponent(keyword)}`;
    logger.info("navigating to google maps", { url });

    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });

    const initialBlock = await detectBlock(page);
    if (initialBlock.type !== "NONE") throw new BlockedError(initialBlock.type, initialBlock.severity);

    await page.waitForSelector('div[role="feed"] div[role="article"]', { timeout: 30_000 });

    const processedKeys = new Set<string>();
    let totalSeen = 0;
    let consecutiveNoNew = 0;
    let scrollsSinceBlockCheck = 0;

    while (totalSeen < MAX_RESULTS) {
      scrollsSinceBlockCheck++;
      if (scrollsSinceBlockCheck >= 5) {
        scrollsSinceBlockCheck = 0;
        const block = await detectBlock(page);
        if (block.type !== "NONE") throw new BlockedError(block.type, block.severity);
      }

      const cards = await getFeedCards(page);
      const newCards = cards.filter((c) => !processedKeys.has(c.key));

      if (newCards.length === 0) {
        consecutiveNoNew++;
        if (consecutiveNoNew >= 3) {
          logger.info("no new cards in 3 passes — stopping");
          break;
        }
        await page.evaluate(() => {
          document.querySelector('div[role="feed"]')?.scrollBy(0, 1200);
        });
        await randomDelay(800, 1400);
        continue;
      }
      consecutiveNoNew = 0;

      // Process each new card. Flush ONE lead at a time so the UI updates live.
      for (const card of newCards) {
        if (totalSeen >= MAX_RESULTS) break;
        processedKeys.add(card.key);

        try {
          // Find the card element by its normalised key and click it.
          // Clicking opens the detail panel IN PLACE (no page reload).
          const handle = await page.evaluateHandle((key) => {
            const links = document.querySelectorAll<HTMLAnchorElement>(
              'div[role="feed"] div[role="article"] a[href*="/maps/place"]'
            );
            for (const link of links) {
              try {
                const u = new URL(link.href);
                if (u.origin + u.pathname === key) return link;
              } catch { /* skip */ }
            }
            return null;
          }, card.key);

          const el = handle.asElement();
          if (!el) continue;

          await el.click();

          // Scrape the in-place detail panel (panel-scoped, no reload).
          const lead = await scrapeDetailPanel(page, card.name);

          if (!lead.businessName) {
            logger.debug("skipping card with no resolvable name", { key: card.key });
            continue;
          }

          logger.debug("extracted", {
            businessName: lead.businessName,
            phone:   lead.phone   ?? "(none)",
            website: lead.websiteUrl ?? "(none)",
            address: lead.address ?? "(none)",
          });

          totalSeen++;

          // Flush this single lead immediately — table updates near real-time.
          const shouldStop = await onBatch([lead]);
          if (shouldStop) {
            logger.info("scrape stopped by worker (cancellation)");
            return;
          }

          await randomDelay(250, 550);
        } catch (err) {
          logger.debug("card extraction failed, skipping", { key: card.key, error: String(err) });
        }
      }

      // End-of-results marker
      const endMarker = await page.$('span[class*="HlvSq"], p[class*="fontBodyMedium"] span');
      const endText = endMarker ? await endMarker.textContent() : "";
      if (
        endText?.toLowerCase().includes("end of results") ||
        endText?.toLowerCase().includes("no more results")
      ) {
        logger.info("reached end of results");
        break;
      }

      // Scroll to load more cards into the feed
      await page.evaluate(() => {
        document.querySelector('div[role="feed"]')?.scrollBy(0, 1200);
      });
      await randomDelay();
    }

    logger.info("extraction finished", { keyword, totalSeen });
  } finally {
    await page.close();
  }
}
