import { db } from "@/lib/db";
import { LeadStatus, type Lead, type Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

// Strip leading emoji / pictograph characters (e.g. the 📍 pin Google Maps
// prepends to address strings before they are stored in the DB).
function stripLeadingEmoji(s: string): string {
  // Matches any leading characters in Unicode Emoji / Pictographic blocks.
  return s.replace(/^[\p{Emoji_Presentation}\p{Extended_Pictographic}\s]+/u, "").trimStart();
}

// Escape a value for a CSV cell: wrap in quotes, double any inner quotes.
function csvCell(value: string | null | undefined, stripEmoji = false): string {
  let s = value ?? "";
  if (stripEmoji) s = stripLeadingEmoji(s);
  return `"${s.replace(/"/g, '""')}"`;
}

function toCsv(leads: Lead[]): string {
  const header = [
    "Business Name", "Phone", "Email", "Website", "Normalized Domain",
    "Status", "Notes", "Address", "Created At", "Last Updated",
  ];
  const rows = leads.map((l) => [
    csvCell(l.businessName),
    csvCell(l.phone),
    csvCell(l.email),
    csvCell(l.websiteUrl),
    csvCell(l.normalizedDomain),
    csvCell(l.status),
    csvCell(l.notes),
    csvCell(l.address, true),  // strip leading pin emoji
    csvCell(l.createdAt.toISOString()),
    csvCell(l.updatedAt.toISOString()),
  ].join(","));
  // UTF-8 BOM ensures Excel opens the file as UTF-8 (required for non-Latin scripts).
  return "﻿" + [header.map(csvCell).join(","), ...rows].join("\r\n");
}

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "campaign";
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sp = req.nextUrl.searchParams;
  const scope = sp.get("scope") ?? "all"; // all | filtered | selected

  const campaign = await db.campaign.findUnique({ where: { id } });
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const where: Prisma.LeadWhereInput = { campaignId: id };

  if (scope === "selected") {
    const ids = (sp.get("ids") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
    if (ids.length === 0)
      return NextResponse.json({ error: "selected scope requires ids" }, { status: 422 });
    where.id = { in: ids };
  } else if (scope === "filtered") {
    // Mirror the leads list filters: search (q) + status.
    const q = sp.get("q")?.trim();
    const status = sp.get("status")?.trim();
    if (q) {
      where.OR = [
        { businessName: { contains: q, mode: "insensitive" } },
        { phone:        { contains: q, mode: "insensitive" } },
        { email:        { contains: q, mode: "insensitive" } },
        { notes:        { contains: q, mode: "insensitive" } },
      ];
    }
    if (status && status !== "ALL" && status in LeadStatus) {
      where.status = status as LeadStatus;
    }
  }

  const leads = await db.lead.findMany({ where, orderBy: { createdAt: "desc" } });

  const csv = toCsv(leads);
  const date = new Date().toISOString().slice(0, 10);
  const filename = `${slugify(campaign.name)}_${date}.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type":        "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
