import { describe, expect, it } from "vitest";
import { extractEmail } from "../../apps/scraper/src/extract-email.js";

// ── helpers ──────────────────────────────────────────────────────────────────

function mailto(addr: string) {
  return `<html><body><a href="mailto:${addr}">Contact us</a></body></html>`;
}

function body(addr: string) {
  return `<html><body><p>Reach us at ${addr} for more info.</p></body></html>`;
}

// ── mailto: extraction ────────────────────────────────────────────────────────

describe("extractEmail — mailto: hrefs", () => {
  it("extracts a plain mailto: link", () => {
    expect(extractEmail(mailto("info@joespizza.com"), "joespizza.com"))
      .toBe("info@joespizza.com");
  });

  it("extracts with double-quoted href", () => {
    const html = `<a href="mailto:hello@bar.com">email</a>`;
    expect(extractEmail(html, "bar.com")).toBe("hello@bar.com");
  });

  it("extracts with single-quoted href", () => {
    const html = `<a href='mailto:hello@bar.com'>email</a>`;
    expect(extractEmail(html, "bar.com")).toBe("hello@bar.com");
  });

  it("strips query string from mailto: (e.g. ?subject=Hello)", () => {
    const html = `<a href="mailto:info@biz.com?subject=Hi">Contact</a>`;
    expect(extractEmail(html, "biz.com")).toBe("info@biz.com");
  });

  it("normalises to lowercase", () => {
    expect(extractEmail(mailto("INFO@JoesPizza.COM"), "joespizza.com"))
      .toBe("info@joespizza.com");
  });
});

// ── body-text fallback ────────────────────────────────────────────────────────

describe("extractEmail — body-text regex fallback", () => {
  it("extracts an email from plain body text when no mailto: present", () => {
    expect(extractEmail(body("contact@tacos.com"), "tacos.com"))
      .toBe("contact@tacos.com");
  });

  it("ignores tags and extracts from visible text only", () => {
    const html = `<div class="noreply@img.com"><p>Email: orders@sushi.com</p></div>`;
    expect(extractEmail(html, "sushi.com")).toBe("orders@sushi.com");
  });

  it("returns null when no email-like string exists anywhere", () => {
    const html = `<html><body><p>Call us at (555) 123-4567.</p></body></html>`;
    expect(extractEmail(html, "biz.com")).toBeNull();
  });
});

// ── HTML entity decoding ──────────────────────────────────────────────────────

describe("extractEmail — HTML entity decoding", () => {
  it("decodes &#64; as @", () => {
    expect(extractEmail(body("info&#64;site.com"), "site.com")).toBe("info@site.com");
  });

  it("decodes &#x40; as @", () => {
    expect(extractEmail(body("info&#x40;site.com"), "site.com")).toBe("info@site.com");
  });

  it("decodes &commat; as @", () => {
    expect(extractEmail(body("info&commat;site.com"), "site.com")).toBe("info@site.com");
  });

  it("decodes &#46; as .", () => {
    expect(extractEmail(body("info@site&#46;com"), "site.com")).toBe("info@site.com");
  });

  it("decodes combined entity-encoded address", () => {
    expect(extractEmail(body("info&#64;site&#46;com"), "site.com")).toBe("info@site.com");
  });
});

// ── denylist — hard-deny exact domains ───────────────────────────────────────

describe("extractEmail — denylist (exact domains)", () => {
  it("rejects example.com addresses", () => {
    expect(extractEmail(mailto("info@example.com"), "biz.com")).toBeNull();
  });

  it("rejects yourdomain.com addresses", () => {
    expect(extractEmail(mailto("you@yourdomain.com"), "biz.com")).toBeNull();
  });

  it("rejects sentry.io addresses", () => {
    expect(extractEmail(mailto("abc@sentry.io"), "biz.com")).toBeNull();
  });

  it("rejects addresses with image-file extensions", () => {
    expect(extractEmail(body("sprite@2x.png"), "biz.com")).toBeNull();
    expect(extractEmail(body("logo@hero.svg"), "biz.com")).toBeNull();
  });

  it("rejects asset tokens like @2x and @3x", () => {
    expect(extractEmail(body("img@2x.jpg"), "biz.com")).toBeNull();
  });
});

// ── denylist — suffix matching (subdomains) ───────────────────────────────────

describe("extractEmail — denylist (suffix/subdomain matching)", () => {
  it("rejects wixpress.com", () => {
    expect(extractEmail(mailto("token@wixpress.com"), "biz.com")).toBeNull();
  });

  it("rejects sentry.wixpress.com subdomain", () => {
    expect(extractEmail(mailto("abc123@sentry.wixpress.com"), "biz.com")).toBeNull();
  });

  it("rejects sentry-next.wixpress.com subdomain", () => {
    expect(extractEmail(mailto("xyz@sentry-next.wixpress.com"), "biz.com")).toBeNull();
  });

  it("rejects shopify.com platform emails", () => {
    expect(extractEmail(mailto("orders@shopify.com"), "biz.com")).toBeNull();
  });

  it("rejects myshopify.com store subdomains", () => {
    expect(extractEmail(mailto("noreply@store.myshopify.com"), "biz.com")).toBeNull();
  });
});

// ── tier selection ────────────────────────────────────────────────────────────

describe("extractEmail — tier selection", () => {
  it("tier 1: prefers own-domain address over gmail on same page", () => {
    const html = `
      <a href="mailto:owner@gmail.com">Owner</a>
      <a href="mailto:info@joespizza.com">Contact</a>
    `;
    expect(extractEmail(html, "joespizza.com")).toBe("info@joespizza.com");
  });

  it("tier 1: strips www. when comparing domain", () => {
    const html = `<a href="mailto:info@www.joespizza.com">Contact</a>`;
    expect(extractEmail(html, "joespizza.com")).toBe("info@www.joespizza.com");
  });

  it("tier 2: returns non-free-mail third-party address when no own-domain match", () => {
    const html = `
      <a href="mailto:owner@gmail.com">Personal</a>
      <a href="mailto:info@agency.com">Agency</a>
    `;
    // lead domain is pizza.com — neither address matches it
    expect(extractEmail(html, "pizza.com")).toBe("info@agency.com");
  });

  it("tier 3 score 0: prefers generic business handle over name-shaped free-mail", () => {
    const html = `
      <a href="mailto:john.doe@gmail.com">John</a>
      <a href="mailto:info@gmail.com">Info</a>
    `;
    expect(extractEmail(html, "pizza.com")).toBe("info@gmail.com");
  });

  it("tier 3 score 1: owner@ beats a name-shaped address", () => {
    const html = `
      <a href="mailto:jane.smith@yahoo.com">Jane</a>
      <a href="mailto:owner@gmail.com">Owner</a>
    `;
    expect(extractEmail(html, "pizza.com")).toBe("owner@gmail.com");
  });

  it("tier 3 score 2: name-shaped address returned when nothing better exists", () => {
    expect(extractEmail(mailto("jane.smith@gmail.com"), "pizza.com"))
      .toBe("jane.smith@gmail.com");
  });

  it("tier 3: returns null when no lead domain and no candidates", () => {
    expect(extractEmail("<p>No email here.</p>", null)).toBeNull();
  });

  it("returns free-mail when no lead domain is known (no domain to compare)", () => {
    expect(extractEmail(mailto("owner@gmail.com"), null)).toBe("owner@gmail.com");
  });
});

// ── deduplication ─────────────────────────────────────────────────────────────

describe("extractEmail — deduplication", () => {
  it("returns only one address when the same email appears twice", () => {
    const html = `
      <a href="mailto:info@biz.com">one</a>
      <a href="mailto:INFO@biz.com">two</a>
    `;
    // Both normalise to the same address — only one should be in the result set
    expect(extractEmail(html, "biz.com")).toBe("info@biz.com");
  });
});
