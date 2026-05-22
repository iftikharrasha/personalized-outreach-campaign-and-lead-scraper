import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mock fetch and the DB before importing the engine so the engine uses them.
// ---------------------------------------------------------------------------

const writtenEmails: Array<{ leadId: string; email: string }> = [];

vi.mock("../../apps/scraper/src/db.js", () => ({
  db: {
    lead: {
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: { email: string } }) => {
        writtenEmails.push({ leadId: where.id, email: data.email });
        return {};
      }),
    },
  },
}));

// fetch is global in Node 20 — spy on it via vi.stubGlobal
type FetchFn = typeof fetch;
let mockFetch: ReturnType<typeof vi.fn>;

beforeEach(() => {
  writtenEmails.length = 0;
  mockFetch = vi.fn();
  vi.stubGlobal("fetch", mockFetch);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// Helpers to build minimal fetch responses
function htmlResp(html: string, url = "https://example.com"): Response {
  return new Response(html, {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8" },
    url,
  } as ResponseInit & { url: string });
}

function notFound(): Response {
  return new Response("", { status: 404 });
}

// Import after mocks are in place
const { enrichLead, enrichLeads } = await import("../../apps/scraper/src/enrich.js");
const { writeLeadEmail }          = await import("../../apps/scraper/src/enrich.js");

// ── enrichLead — URL resolution ───────────────────────────────────────────────

describe("enrichLead — base URL resolution", () => {
  it("returns null when both https and www. variants fail", async () => {
    mockFetch.mockResolvedValue(new Response("", { status: 503 }));
    expect(await enrichLead("unreachable.com")).toBeNull();
  });

  it("falls back to www. when bare domain returns 503", async () => {
    mockFetch
      .mockResolvedValueOnce(new Response("", { status: 503 }))   // bare HEAD fails
      .mockResolvedValueOnce(new Response("", { status: 200 }))   // www HEAD succeeds
      .mockResolvedValueOnce(htmlResp(                             // www GET for homepage
        '<a href="mailto:info@biz.com">Contact</a>',
      ));
    expect(await enrichLead("biz.com")).toBe("info@biz.com");
  });
});

// ── enrichLead — homepage extraction ─────────────────────────────────────────

describe("enrichLead — homepage", () => {
  it("returns email found directly on homepage", async () => {
    mockFetch
      .mockResolvedValueOnce(new Response("", { status: 200 }))   // HEAD
      .mockResolvedValueOnce(htmlResp(
        '<a href="mailto:hello@tacos.com">Email us</a>',
      ));
    expect(await enrichLead("tacos.com")).toBe("hello@tacos.com");
  });

  it("returns null when homepage returns no email and no contact links exist", async () => {
    mockFetch
      .mockResolvedValueOnce(new Response("", { status: 200 }))   // HEAD
      .mockResolvedValueOnce(htmlResp("<p>No contact info here.</p>"))
      // Fallback guessed paths — all 404
      .mockResolvedValue(notFound());
    expect(await enrichLead("tacos.com")).toBeNull();
  });
});

// ── enrichLead — contact link discovery ──────────────────────────────────────

describe("enrichLead — contact link discovery", () => {
  it("follows a /contact link found on homepage", async () => {
    const homepageHtml = `
      <p>Visit us!</p>
      <a href="/contact">Contact us</a>
    `;
    mockFetch
      .mockResolvedValueOnce(new Response("", { status: 200 }))   // HEAD bare
      .mockResolvedValueOnce(htmlResp(homepageHtml, "https://biz.com"))
      .mockResolvedValueOnce(htmlResp(                             // /contact page
        '<a href="mailto:info@biz.com">Email</a>',
        "https://biz.com/contact",
      ));
    expect(await enrichLead("biz.com")).toBe("info@biz.com");
  });

  it("stops at the first page that yields an email (does not fetch remaining)", async () => {
    const homepage = `<a href="/about">About</a><a href="/team">Team</a>`;
    mockFetch
      .mockResolvedValueOnce(new Response("", { status: 200 }))   // HEAD
      .mockResolvedValueOnce(htmlResp(homepage, "https://biz.com"))
      .mockResolvedValueOnce(htmlResp(                             // /about yields email
        '<a href="mailto:info@biz.com">Email</a>',
        "https://biz.com/about",
      ));
    // /team is never fetched
    expect(await enrichLead("biz.com")).toBe("info@biz.com");
    // HEAD + homepage + /about = 3 calls; /team would be a 4th
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it("falls back to guessed /contact path when homepage has no contact links", async () => {
    mockFetch
      .mockResolvedValueOnce(new Response("", { status: 200 }))   // HEAD
      .mockResolvedValueOnce(htmlResp("<p>Welcome!</p>"))          // homepage — no links
      .mockResolvedValueOnce(htmlResp(                             // /contact fallback
        '<a href="mailto:hello@biz.com">hello</a>',
        "https://biz.com/contact",
      ));
    expect(await enrichLead("biz.com")).toBe("hello@biz.com");
  });

  it("skips a contact page that times out and tries the next", async () => {
    const homepage = `<a href="/contact">Contact</a><a href="/about">About</a>`;
    mockFetch
      .mockResolvedValueOnce(new Response("", { status: 200 }))   // HEAD
      .mockResolvedValueOnce(htmlResp(homepage, "https://biz.com"))
      .mockRejectedValueOnce(new DOMException("timeout", "AbortError"))  // /contact times out
      .mockResolvedValueOnce(htmlResp(                              // /about succeeds
        '<a href="mailto:info@biz.com">Email</a>',
        "https://biz.com/about",
      ));
    expect(await enrichLead("biz.com")).toBe("info@biz.com");
  });

  it("skips a contact page that returns 404 and tries the next", async () => {
    const homepage = `<a href="/contact">Contact</a><a href="/about">About</a>`;
    mockFetch
      .mockResolvedValueOnce(new Response("", { status: 200 }))   // HEAD
      .mockResolvedValueOnce(htmlResp(homepage, "https://biz.com"))
      .mockResolvedValueOnce(notFound())                            // /contact 404
      .mockResolvedValueOnce(htmlResp(                              // /about OK
        '<a href="mailto:info@biz.com">Email</a>',
      ));
    expect(await enrichLead("biz.com")).toBe("info@biz.com");
  });
});

// ── enrichLeads — batch processing ───────────────────────────────────────────

describe("enrichLeads — batch processing", () => {
  it("calls onProgress for each lead and writes email on success", async () => {
    // Both leads run concurrently inside the batch (Promise.all), so fetch calls
    // interleave: lead-1 HEAD, lead-2 HEAD, lead-1 GET, lead-2 GET.
    // We use a URL-aware mock so each call gets the right response regardless of order.
    mockFetch.mockImplementation(async (url: string, init?: RequestInit) => {
      if (init?.method === "HEAD") {
        return new Response("", { status: 200 });
      }
      // GET — return page matching the domain
      if (typeof url === "string" && url.includes("biz1")) {
        return htmlResp('<a href="mailto:info@biz1.com">Contact</a>');
      }
      return htmlResp("<p>no email</p>");
    });

    const progress: Array<{ leadId: string; email: string | null; skipped: boolean }> = [];

    await enrichLeads(
      [
        { id: "lead-1", normalizedDomain: "biz1.com", email: null },
        { id: "lead-2", normalizedDomain: "biz2.com", email: null },
      ],
      async (p) => { progress.push(p); },
      async () => false,
    );

    expect(progress).toHaveLength(2);
    expect(progress.find((p) => p.leadId === "lead-1")?.email).toBe("info@biz1.com");
    expect(progress.find((p) => p.leadId === "lead-2")?.email).toBeNull();
  });

  it("marks a lead as skipped (not processed) when it already has an email", async () => {
    const progress: Array<{ leadId: string; skipped: boolean }> = [];

    await enrichLeads(
      [{ id: "lead-1", normalizedDomain: "biz.com", email: "already@biz.com" }],
      async (p) => { progress.push(p); },
      async () => false,
    );

    expect(progress).toHaveLength(1);
    expect(progress[0]!.skipped).toBe(true);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("skips a lead with no normalizedDomain (counts as failed)", async () => {
    const progress: Array<{ email: string | null; skipped: boolean }> = [];

    await enrichLeads(
      [{ id: "lead-x", normalizedDomain: null, email: null }],
      async (p) => { progress.push(p); },
      async () => false,
    );

    expect(progress[0]!.email).toBeNull();
    expect(progress[0]!.skipped).toBe(false);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("throws CancelledError when isCancelled returns true before a batch", async () => {
    const { CancelledError } = await import("../../apps/scraper/src/dedupe.js");

    await expect(
      enrichLeads(
        [{ id: "lead-1", normalizedDomain: "biz.com", email: null }],
        async () => {},
        async () => true,  // cancelled immediately
      )
    ).rejects.toBeInstanceOf(CancelledError);

    expect(mockFetch).not.toHaveBeenCalled();
  });
});

// ── writeLeadEmail ────────────────────────────────────────────────────────────

describe("writeLeadEmail", () => {
  it("writes the email to the DB lead row", async () => {
    await writeLeadEmail("lead-99", "test@biz.com");
    expect(writtenEmails).toContainEqual({ leadId: "lead-99", email: "test@biz.com" });
  });
});
