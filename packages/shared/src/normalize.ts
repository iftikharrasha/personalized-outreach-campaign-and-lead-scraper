// Normalization helpers — shared by apps/web and apps/scraper.
// Dedupe correctness depends on web and scraper producing IDENTICAL output,
// which is why this lives in a single shared module.

/**
 * Strip a URL down to a bare, lowercase domain for deduplication.
 * Removes protocol, `www.`, path, query, and trailing slash.
 * Returns null for empty input or anything without a usable host.
 *
 *   "https://www.PizzaHut.com/menu/" -> "pizzahut.com"
 *   "http://abc.com"                 -> "abc.com"
 *   null / ""                        -> null
 */
export function normalizeDomain(url: string | null | undefined): string | null {
  if (!url) return null;
  let s = url.trim().toLowerCase();
  if (!s) return null;

  // Drop protocol.
  s = s.replace(/^[a-z][a-z0-9+.-]*:\/\//, "");
  // Drop leading www.
  s = s.replace(/^www\./, "");
  // Drop path, query, fragment — keep only the host.
  s = s.split(/[/?#]/)[0] ?? "";
  // Drop a port if present.
  s = s.split(":")[0] ?? "";
  s = s.trim();

  // A real domain has at least one dot and no whitespace.
  if (!s || !s.includes(".") || /\s/.test(s)) return null;
  return s;
}

// A real, dialable phone number has at least 10 digits (US 10-digit, or an
// international number with country code). Anything shorter is a fragment.
const MIN_PHONE_DIGITS = 10;

/**
 * Reduce a phone string to digits only.
 * Returns null if fewer than 10 digits remain (not a dialable number).
 *
 *   "(555) 123-4567" -> "5551234567"
 *   "+1 555 123"     -> null   (only 7 digits — a fragment)
 */
export function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  return digits.length >= MIN_PHONE_DIGITS ? digits : null;
}

/**
 * Clean a business name: trim, collapse internal whitespace, and strip a
 * trailing legal suffix (`Inc`, `LLC`, `Ltd`, `Co`, `Corp`), with or without
 * a leading comma/period.
 *
 *   "Joe's Diner, LLC"  -> "Joe's Diner"
 *   "  Acme   Corp  "   -> "Acme"
 */
export function normalizeBusinessName(name: string): string {
  let s = (name ?? "").trim().replace(/\s+/g, " ");
  s = s.replace(/[\s,.]+(inc|llc|ltd|co|corp)\.?$/i, "");
  return s.trim();
}
