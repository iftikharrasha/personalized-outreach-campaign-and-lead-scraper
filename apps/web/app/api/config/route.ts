import { NextResponse } from "next/server";

// Returns runtime feature flags the client needs to know about.
// Never expose secrets — only boolean flags.
export function GET() {
  return NextResponse.json({
    yelpKeyConfigured: Boolean(process.env["YELP_API_KEY"]),
  });
}
