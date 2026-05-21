import type { BrowserContext, Page } from "playwright";
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

// Strip query params and fragments from a Google Maps place URL so we can
// use it as a stable identity key regardless of locale/auth params.
function normalizeHref(href: string): string {
  try {
    const u = new URL(href);
    // Keep only the pathname — everything up to /maps/place/Name/data=...
    // The data= segment is the stable place identifier.
    return u.origin + u.pathname;
  } catch {
    return href;
  }
}

// Scrape everything from the detail panel — name, phone, website, address.
// Called after the page has navigated to /maps/place/...
async function scrapeDetailPanel(page: Page): Promise<RawLead> {
  // Wait for ANY contact-info element to appear (up to 5s), fall back to 2.5s hard wait.
  await Promise.race([
    page.waitForSelector(
      '[aria-label^="Phone:"], [aria-label^="phone:"], [data-item-id*="phone"], [data-item-id*="address"], a[aria-label="Open website"], a[data-item-id*="authority"], h1',
      { timeout: 5000 }
    ).catch(() => null),
    page.waitForTimeout(2500),
  ]);

  return page.evaluate(() => {
    // ── Business name ──────────────────────────────────────────────────────
    // The h1 on the detail panel is always the business name — ground truth.
    const businessName =
      document.querySelector<HTMLElement>("h1")?.textContent?.trim() ?? "";

    // ── Phone ──────────────────────────────────────────────────────────────
    let phone: string | null = null;

    // Strategy 1: aria-label="Phone: 01234-567890"
    const phoneByAriaLabel = document.querySelector<HTMLElement>(
      '[aria-label^="Phone:"], [aria-label^="phone:"]'
    );
    if (phoneByAriaLabel) {
      const extracted = (phoneByAriaLabel.getAttribute("aria-label") ?? "")
        .replace(/^phone:\s*/i, "").trim();
      if (extracted) phone = extracted;
    }

    // Strategy 2: data-item-id contains "phone"
    if (!phone) {
      const phoneItem = document.querySelector<HTMLElement>('[data-item-id*="phone"]');
      if (phoneItem) {
        const txt = phoneItem.textContent?.trim() ?? "";
        if (/[\d\-\(\)\+\s]{7,}/.test(txt)) phone = txt;
      }
    }

    // Strategy 3: jsaction containing "phone"
    if (!phone) {
      for (const el of document.querySelectorAll<HTMLElement>('[jsaction*="phone"]')) {
        const txt = el.textContent?.trim() ?? "";
        if (/^[+\(]?[\d\s\-\(\)\.]{9,20}$/.test(txt)) { phone = txt; break; }
      }
    }

    // Strategy 4: leaf-node text matching phone pattern
    if (!phone) {
      for (const el of document.querySelectorAll<HTMLElement>("span, div")) {
        if (el.children.length > 0) continue;
        const txt = el.textContent?.trim() ?? "";
        if (/^\+?[\d][\d\s\-\(\)\.]{8,18}\d$/.test(txt)) { phone = txt; break; }
      }
    }

    // ── Website ────────────────────────────────────────────────────────────
    let websiteUrl: string | null = null;

    // Strategy 1: explicit website link labels
    const websiteLink = document.querySelector<HTMLAnchorElement>(
      'a[aria-label="Open website"], a[aria-label^="Website"], a[data-item-id*="authority"]'
    );
    if (websiteLink?.href && !websiteLink.href.includes("google.com")) {
      websiteUrl = websiteLink.href;
    }

    // Strategy 2: data-tooltip mentions "website"
    if (!websiteUrl) {
      for (const link of document.querySelectorAll<HTMLAnchorElement>("a[data-tooltip]")) {
        const tip = (link.getAttribute("data-tooltip") ?? "").toLowerCase();
        if ((tip.includes("website") || tip.includes("web site")) && !link.href.includes("google.com")) {
          websiteUrl = link.href; break;
        }
      }
    }

    // Strategy 3: first external http link
    if (!websiteUrl) {
      for (const link of document.querySelectorAll<HTMLAnchorElement>("a[href]")) {
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

    const addrByDataItem = document.querySelector<HTMLElement>(
      '[data-item-id*="address"], [data-item-id="address"]'
    );
    if (addrByDataItem) address = addrByDataItem.textContent?.trim() ?? null;

    if (!address) {
      const addrByAria = document.querySelector<HTMLElement>('[aria-label*="Address" i]');
      if (addrByAria) {
        address = (addrByAria.getAttribute("aria-label") ?? addrByAria.textContent ?? "")
          .replace(/^address:\s*/i, "").trim() || null;
      }
    }

    if (!address) {
      const copyBtn = document.querySelector<HTMLElement>(
        '[data-tooltip*="Copy address" i], [aria-label*="Copy address" i]'
      );
      if (copyBtn) {
        const parent = copyBtn.closest("[data-item-id]") ?? copyBtn.parentElement;
        if (parent) address = parent.textContent?.trim() ?? null;
      }
    }

    // Strip locale-translated country suffix (e.g. Bengali "মার্কিন যুক্তরাষ্ট্র")
    // Keep everything up to state+ZIP for US addresses, leave others intact.
    if (address) {
      const clean = address.match(/^(.+?,\s*[A-Z]{2}\s*\d{5})/);
      if (clean) address = clean[1];
    }

    return { businessName, phone, websiteUrl, address };
  });
}

// Get stable (normalised) hrefs of all result cards currently in the feed.
async function getResultCards(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const cards = document.querySelectorAll<HTMLAnchorElement>(
      'div[role="feed"] div[role="article"] a[href*="/maps/place"]'
    );
    return Array.from(cards).map((el) => {
      // Strip query params/fragments so the key is stable across page reloads
      try { const u = new URL(el.href); return u.origin + u.pathname; }
      catch { return el.href; }
    });
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
    await page.waitForSelector('div[role="feed"]', { timeout: 30_000 });
    await page.waitForTimeout(1500);

    const processedKeys = new Set<string>();
    let totalSeen = 0;
    let consecutiveNoNew = 0;

    while (totalSeen < MAX_RESULTS) {
      const keys = await getResultCards(page);
      const newKeys = keys.filter((k) => !processedKeys.has(k));

      if (newKeys.length === 0) {
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

      const batch: RawLead[] = [];

      for (const key of newKeys) {
        if (totalSeen + batch.length >= MAX_RESULTS) break;
        processedKeys.add(key);

        try {
          // Find the card link whose normalised href matches the key.
          // We can't use exact href match because the DOM href has query params.
          const cardHandle = await page.evaluateHandle((key) => {
            const cards = document.querySelectorAll<HTMLAnchorElement>(
              'div[role="feed"] div[role="article"] a[href*="/maps/place"]'
            );
            for (const card of cards) {
              try {
                const u = new URL(card.href);
                if (u.origin + u.pathname === key) return card;
              } catch { /* skip */ }
            }
            return null;
          }, key);

          const cardEl = cardHandle.asElement();
          if (!cardEl) continue;

          await cardEl.click();

          // Wait for the URL to change to a place detail URL
          await page.waitForURL(/\/maps\/place\//, { timeout: 10_000 }).catch(() => null);
          await page.waitForLoadState("domcontentloaded");

          // Extract name + all contact info from the detail panel
          const lead = await scrapeDetailPanel(page);

          if (!lead.businessName) {
            // Panel didn't load properly — go back and skip
            await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20_000 });
            await page.waitForSelector('div[role="feed"]', { timeout: 15_000 });
            continue;
          }

          logger.debug("extracted", {
            businessName: lead.businessName,
            phone:   lead.phone   ?? "(none)",
            website: lead.websiteUrl ?? "(none)",
            address: lead.address ?? "(none)",
          });
          batch.push(lead);

          // Return to the search results list
          await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20_000 });
          await page.waitForSelector('div[role="feed"]', { timeout: 15_000 });
          await randomDelay(300, 600);
        } catch (err) {
          logger.debug("card extraction failed, skipping", { key, error: String(err) });
          // Ensure we're back on the search results page
          if (!page.url().startsWith(url)) {
            await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20_000 }).catch(() => null);
            await page.waitForSelector('div[role="feed"]', { timeout: 15_000 }).catch(() => null);
          }
        }
      }

      if (batch.length > 0) {
        totalSeen += batch.length;
        logger.info("batch ready", { total: totalSeen, batchSize: batch.length });
        const shouldStop = await onBatch(batch);
        if (shouldStop) {
          logger.info("scrape stopped by worker (cancellation)");
          break;
        }
      }

      // Check for end-of-results marker
      const endMarker = await page.$('span[class*="HlvSq"], p[class*="fontBodyMedium"] span');
      const endText = endMarker ? await endMarker.textContent() : "";
      if (
        endText?.toLowerCase().includes("end of results") ||
        endText?.toLowerCase().includes("no more results")
      ) {
        logger.info("reached end of results");
        break;
      }

      // Scroll to load more
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
