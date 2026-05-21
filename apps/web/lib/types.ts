import type { Campaign, Lead, ScrapeRun } from "@prisma/client";

export type { Campaign, Lead, ScrapeRun };

export interface CampaignWithStats extends Campaign {
  totalLeads: number;
  contacted: number;
  newSinceLast: number;
  lastRun: string;
  progress: number;
}
