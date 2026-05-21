// Public surface of @outrich/shared.

export {
  normalizeDomain,
  normalizePhone,
  normalizeBusinessName,
} from "./normalize.js";

// Status enums re-exported from the generated Prisma client so web + scraper
// reference one source of truth without each importing @prisma/client directly.
export {
  CampaignStatus,
  LeadStatus,
  ScrapeRunStatus,
} from "@prisma/client";
