import type { Page } from "playwright";
import { logger } from "./logger.js";

export type BlockType = "RATE_LIMIT" | "CAPTCHA" | "IP_BAN" | "NONE";
export type BlockSeverity = "soft" | "hard";

export interface BlockResult {
  type:     BlockType;
  severity: BlockSeverity;
}

export class BlockedError extends Error {
  constructor(
    public readonly blockType: BlockType,
    public readonly severity: BlockSeverity,
  ) {
    super(`Blocked by Google: ${blockType}`);
    this.name = "BlockedError";
  }
}

export async function detectBlock(page: Page): Promise<BlockResult> {
  const url = page.url();

  // HTTP-level block: 403 or sorry.google.com redirect
  if (url.includes("sorry.google.com") || url.includes("/sorry/")) {
    logger.warn("block detected: IP_BAN (sorry page)");
    return { type: "IP_BAN", severity: "hard" };
  }

  const result = await page.evaluate((): { type: BlockType; severity: BlockSeverity } => {
    const body = document.body?.innerText?.toLowerCase() ?? "";
    const html = document.documentElement?.innerHTML ?? "";

    // CAPTCHA — hardest block
    if (
      document.querySelector('iframe[src*="recaptcha"]') ||
      document.querySelector('iframe[src*="google.com/recaptcha"]') ||
      body.includes("enter the characters") ||
      body.includes("type the characters") ||
      body.includes("prove you're not a robot")
    ) {
      return { type: "CAPTCHA", severity: "hard" };
    }

    // IP ban signals
    if (
      body.includes("access denied") ||
      body.includes("your computer or network may be sending automated") ||
      html.includes("status=403")
    ) {
      return { type: "IP_BAN", severity: "hard" };
    }

    // Rate limit / unusual traffic
    if (
      body.includes("detected unusual traffic") ||
      body.includes("unusual traffic from your computer") ||
      body.includes("systems have detected unusual") ||
      body.includes("too many requests")
    ) {
      return { type: "RATE_LIMIT", severity: "soft" };
    }

    return { type: "NONE", severity: "soft" };
  });

  if (result.type !== "NONE") {
    logger.warn("block detected", { type: result.type, severity: result.severity, url });
  }

  return result;
}
