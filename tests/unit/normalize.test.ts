import { describe, it, expect } from "vitest";
import {
  normalizeDomain,
  normalizePhone,
  normalizeBusinessName,
} from "@shared/normalize";

describe("normalizeDomain", () => {
  it("strips protocol, www, and path", () => {
    expect(normalizeDomain("https://www.PizzaHut.com/menu/")).toBe(
      "pizzahut.com",
    );
  });

  it("strips a bare protocol", () => {
    expect(normalizeDomain("http://abc.com")).toBe("abc.com");
  });

  it("returns null for null", () => {
    expect(normalizeDomain(null)).toBeNull();
  });

  it("returns null for blank input", () => {
    expect(normalizeDomain("  ")).toBeNull();
  });

  it("strips a port and query string", () => {
    expect(normalizeDomain("https://shop.example.com:8080/cart?id=2")).toBe(
      "shop.example.com",
    );
  });

  it("returns null for a host with no dot", () => {
    expect(normalizeDomain("localhost")).toBeNull();
  });
});

describe("normalizePhone", () => {
  it("keeps digits only", () => {
    expect(normalizePhone("(555) 123-4567")).toBe("5551234567");
  });

  it("returns null when under 7 digits", () => {
    expect(normalizePhone("+1 555 123")).toBeNull();
  });

  it("returns null for null", () => {
    expect(normalizePhone(null)).toBeNull();
  });

  it("handles an international format", () => {
    expect(normalizePhone("+44 20 7946 0958")).toBe("442079460958");
  });
});

describe("normalizeBusinessName", () => {
  it("strips a trailing legal suffix", () => {
    expect(normalizeBusinessName("Joe's Diner, LLC")).toBe("Joe's Diner");
  });

  it("collapses whitespace and strips Corp", () => {
    expect(normalizeBusinessName("  Acme   Corp  ")).toBe("Acme");
  });

  it("leaves a clean name untouched", () => {
    expect(normalizeBusinessName("Born & Raised")).toBe("Born & Raised");
  });

  it("strips Inc with a trailing period", () => {
    expect(normalizeBusinessName("Globex Inc.")).toBe("Globex");
  });
});
