import type { RawLead } from "./google-maps.js";
import { logger } from "./logger.js";

const YELP_API_BASE = "https://api.yelp.com/v3";

// ── Typed errors the fetcher / worker can surface ─────────────────────────────

export class YelpApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
    this.name = "YelpApiError";
  }
}

export class YelpMissingKeyError extends YelpApiError {
  constructor() {
    super("Yelp API key is missing or invalid");
    this.name = "YelpMissingKeyError";
  }
}

export class YelpRateLimitError extends YelpApiError {
  constructor() {
    super("Yelp rate limit reached — try again tomorrow", 429);
    this.name = "YelpRateLimitError";
  }
}

export class YelpLocationError extends YelpApiError {
  constructor() {
    super("Yelp could not find that city", 400);
    this.name = "YelpLocationError";
  }
}

// ── Yelp Fusion API response shapes (minimal — only fields we use) ─────────────

interface YelpBusiness {
  id:       string;
  name:     string;
  phone?:   string;   // E.164 e.g. "+16195551234"
  url?:     string;   // Yelp page URL — NOT the business website
  location: {
    display_address: string[];
  };
  attributes?: {
    business_url?: string; // The business's own website (not always present)
  };
}

interface YelpSearchResponse {
  businesses: YelpBusiness[];
  total:      number;
}

// ── Normalizer: Yelp business → RawLead ───────────────────────────────────────

function normalizeYelpBusiness(biz: YelpBusiness): RawLead {
  // Yelp's `url` is the Yelp page, not the business website.
  // The real website lives in attributes.business_url when present.
  const websiteUrl = biz.attributes?.business_url ?? null;

  const address =
    biz.location.display_address.length > 0
      ? biz.location.display_address.join(", ")
      : null;

  return {
    businessName: biz.name,
    websiteUrl,
    phone:   biz.phone || null,
    address,
  };
}

// ── Public API ─────────────────────────────────────────────────────────────────

export interface YelpSearchResult {
  businesses: RawLead[];
  total:      number;
}

/**
 * Fetch one page (up to 50) of Yelp business search results.
 * Normalizes into the same RawLead shape the Google Maps scraper produces.
 *
 * @param term     - search keyword, e.g. "restaurants"
 * @param location - "City, State" e.g. "San Diego, CA"
 * @param offset   - pagination offset (0-based, max 950)
 */
export async function fetchYelpBusinesses(
  term:     string,
  location: string,
  offset:   number,
): Promise<YelpSearchResult> {
  const apiKey = process.env["YELP_API_KEY"];
  if (!apiKey) throw new YelpMissingKeyError();

  const params = new URLSearchParams({
    term,
    location,
    offset: String(offset),
    limit:  "50",
  });

  const url = `${YELP_API_BASE}/businesses/search?${params}`;

  logger.debug("yelp fetch", { term, location, offset });

  let res: Response;
  try {
    res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept:        "application/json",
      },
    });
  } catch (err) {
    throw new YelpApiError(`Network error: ${err instanceof Error ? err.message : String(err)}`);
  }

  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      throw new YelpApiError("Yelp API key is invalid", res.status);
    }
    if (res.status === 429) {
      throw new YelpRateLimitError();
    }
    // 400 with LOCATION_NOT_FOUND in the body
    if (res.status === 400) {
      let body = "";
      try { body = await res.text(); } catch { /* ignore */ }
      if (body.includes("LOCATION_NOT_FOUND") || body.includes("location")) {
        throw new YelpLocationError();
      }
      throw new YelpApiError(`Yelp API error: ${body || res.statusText}`, res.status);
    }
    throw new YelpApiError(`Yelp API error ${res.status}: ${res.statusText}`, res.status);
  }

  const data = (await res.json()) as YelpSearchResponse;

  return {
    businesses: data.businesses.map(normalizeYelpBusiness),
    total:      data.total,
  };
}
