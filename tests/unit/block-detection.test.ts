import { describe, expect, it, vi } from "vitest";
import { BlockedError, detectBlock } from "../../apps/scraper/src/block-detection.js";

function makePage(overrides: { url?: string; innerText?: string; innerHTML?: string; hasRecaptcha?: boolean }) {
  return {
    url: vi.fn(() => overrides.url ?? "https://www.google.com/maps/search/restaurants"),
    evaluate: vi.fn(async (fn: (o: { url: string; innerText: string; innerHTML: string; hasRecaptcha: boolean }) => unknown) => {
      return fn({
        url:           overrides.url      ?? "",
        innerText:     overrides.innerText ?? "",
        innerHTML:     overrides.innerHTML ?? "",
        hasRecaptcha:  overrides.hasRecaptcha ?? false,
      });
    }),
  };
}

// detectBlock uses page.evaluate with a function that runs in browser context.
// We stub page.evaluate to run the callback with controlled DOM text.

describe("detectBlock", () => {
  it("returns NONE for a normal results page", async () => {
    // Provide a real-ish page stub via vi.fn page shape
    const page = {
      url: vi.fn(() => "https://www.google.com/maps/search/restaurants+in+ny"),
      evaluate: vi.fn(async () => ({ type: "NONE", severity: "soft" })),
    };
    const result = await detectBlock(page as never);
    expect(result.type).toBe("NONE");
  });

  it("returns IP_BAN for sorry.google.com URL", async () => {
    const page = {
      url: vi.fn(() => "https://sorry.google.com/sorry/consent?continue=..."),
      evaluate: vi.fn(async () => ({ type: "NONE", severity: "soft" })),
    };
    const result = await detectBlock(page as never);
    expect(result.type).toBe("IP_BAN");
    expect(result.severity).toBe("hard");
  });

  it("returns CAPTCHA when evaluate reports captcha signals", async () => {
    const page = {
      url: vi.fn(() => "https://www.google.com/maps"),
      evaluate: vi.fn(async () => ({ type: "CAPTCHA", severity: "hard" })),
    };
    const result = await detectBlock(page as never);
    expect(result.type).toBe("CAPTCHA");
    expect(result.severity).toBe("hard");
  });

  it("returns RATE_LIMIT for unusual traffic signal", async () => {
    const page = {
      url: vi.fn(() => "https://www.google.com/maps"),
      evaluate: vi.fn(async () => ({ type: "RATE_LIMIT", severity: "soft" })),
    };
    const result = await detectBlock(page as never);
    expect(result.type).toBe("RATE_LIMIT");
    expect(result.severity).toBe("soft");
  });
});

describe("BlockedError", () => {
  it("is instanceof Error", () => {
    const err = new BlockedError("CAPTCHA", "hard");
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toBe("Blocked by Google: CAPTCHA");
    expect(err.blockType).toBe("CAPTCHA");
    expect(err.severity).toBe("hard");
  });

  it("can be distinguished from generic errors", () => {
    const err = new BlockedError("RATE_LIMIT", "soft");
    expect(err instanceof BlockedError).toBe(true);
    expect(err instanceof TypeError).toBe(false);
  });
});
