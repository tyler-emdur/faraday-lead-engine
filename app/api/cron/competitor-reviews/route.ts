// CRON: Competitor Review Mining — runs every Monday at 7am MT
// Finds 1–2 star reviews on competing Colorado roofers.
// These people are proven to need roofing work and are actively angry.
// Conversion rate is 3–5x higher than cold outreach.
//
// Requires: GOOGLE_PLACES_API_KEY
// Tyler reviews findings in /intel and reaches out manually on Google Maps / Yelp.

import { NextRequest, NextResponse } from "next/server";
import { notifyTyler } from "@/lib/notify";
import { saveOpportunity, opportunityExists } from "@/lib/intel";

export const maxDuration = 60;

// Top Colorado roofing competitors — add/remove as market changes
// Get place IDs from: https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=COMPANY&inputtype=textquery&key=KEY
const COMPETITOR_PLACE_IDS = [
  { name: "Apex Roofing and Restoration", search: "Apex Roofing Restoration Denver Colorado" },
  { name: "Blue Nail Roofing", search: "Blue Nail Roofing Colorado" },
  { name: "Mighty Dog Roofing", search: "Mighty Dog Roofing Denver" },
  { name: "Premier Roofing", search: "Premier Roofing Colorado" },
  { name: "National Roofing and Restoration", search: "National Roofing Restoration Denver" },
  { name: "All American Roofing", search: "All American Roofing Colorado" },
  { name: "Restoration Roofing", search: "Restoration Roofing Colorado" },
  { name: "First Choice Roofing", search: "First Choice Roofing Colorado" },
];

const ANGRY_KEYWORDS = [
  "never called", "no show", "didn't show", "never showed", "ghosted",
  "insurance", "claim", "adjuster", "refused", "denied",
  "terrible", "awful", "horrible", "scam", "rip off", "ripoff",
  "slow", "months", "still waiting", "not done", "incomplete",
  "damage", "leak", "still leaking", "worse than before",
];

interface GoogleReview {
  author_name: string;
  rating: number;
  text: string;
  time: number;
  relative_time_description: string;
}

async function findPlaceId(searchTerm: string): Promise<string | null> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) return null;

  try {
    const params = new URLSearchParams({
      input: searchTerm,
      inputtype: "textquery",
      fields: "place_id",
      key: apiKey,
      locationbias: "circle:200000@39.7392,-104.9903", // Denver center, 200km radius
    });

    const res = await fetch(
      `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?${params}`,
      { next: { revalidate: 0 } }
    );

    if (!res.ok) return null;
    const data = await res.json();
    return data.candidates?.[0]?.place_id || null;
  } catch {
    return null;
  }
}

async function getReviews(placeId: string): Promise<GoogleReview[]> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) return [];

  try {
    const params = new URLSearchParams({
      place_id: placeId,
      fields: "reviews",
      key: apiKey,
    });

    const res = await fetch(
      `https://maps.googleapis.com/maps/api/place/details/json?${params}`,
      { next: { revalidate: 0 } }
    );

    if (!res.ok) return [];
    const data = await res.json();
    return (data.result?.reviews || []) as GoogleReview[];
  } catch {
    return [];
  }
}

function scoreReview(review: GoogleReview): number {
  if (review.rating > 2) return 0;
  const text = review.text.toLowerCase();
  let score = 40; // base for 1-2 star

  for (const kw of ANGRY_KEYWORDS) {
    if (text.includes(kw)) score += 8;
  }

  // Recency bonus
  const ageMs = Date.now() - review.time * 1000;
  const ageDays = ageMs / 86400000;
  if (ageDays < 30) score += 20;
  else if (ageDays < 90) score += 10;
  else if (ageDays > 365) score -= 10;

  return Math.min(90, score);
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.GOOGLE_PLACES_API_KEY) {
    return NextResponse.json({
      success: false,
      message: "GOOGLE_PLACES_API_KEY not set — add to Vercel env vars",
    });
  }

  const results = { competitors_checked: 0, reviews_scanned: 0, hot_leads: 0, saved: 0 };
  const hotFinds: string[] = [];

  for (const competitor of COMPETITOR_PLACE_IDS) {
    const placeId = await findPlaceId(competitor.search);
    if (!placeId) continue;

    results.competitors_checked++;
    const reviews = await getReviews(placeId);
    const lowRated = reviews.filter(r => r.rating <= 2);
    results.reviews_scanned += lowRated.length;

    for (const review of lowRated) {
      const score = scoreReview(review);
      if (score < 45) continue;

      const sourceId = `review_${placeId}_${review.time}`;
      if (await opportunityExists(sourceId)) continue;

      const priority = score >= 70 ? "high" as const : "medium" as const;

      const preview = review.text.slice(0, 200);
      const title = `${review.rating}⭐ review on ${competitor.name}: "${preview.slice(0, 80)}…"`;

      await saveOpportunity({
        source: "community_import",
        source_id: sourceId,
        type: "community_post",
        priority,
        title,
        body: review.text,
        url: `https://www.google.com/maps/place/?q=place_id:${placeId}`,
        author: review.author_name,
        location: "Colorado Front Range",
        urgency_score: score,
        opportunity_score: score,
        why_it_matters: `${review.author_name} left a ${review.rating}-star review on ${competitor.name} ${review.relative_time_description}. They need roofing work, they're frustrated with a competitor, and they're actively looking for alternatives. Warmest cold outreach possible.`,
        outreach_message: `Hi ${review.author_name.split(" ")[0]}, I saw your review of [competitor] and I'm really sorry you had that experience. At Faraday Construction we do things differently — we'd love to make it right with a free inspection. (720) 766-1518`,
        close_probability: score >= 70 ? 45 : 25,
        follow_up_schedule: "Reach out on Google Maps within 48h of review posting for best response rate.",
      });

      results.saved++;
      if (priority === "high") {
        results.hot_leads++;
        hotFinds.push(`${review.rating}⭐ on ${competitor.name}: "${preview.slice(0, 60)}…"`);
      }
    }
  }

  if (hotFinds.length > 0) {
    const msg = [
      `😤 ${hotFinds.length} ANGRY COMPETITOR REVIEW${hotFinds.length > 1 ? "S" : ""}`,
      ...hotFinds.slice(0, 3).map(f => `• ${f}`),
      `→ Check /intel — reach out on Google Maps today`,
    ].join("\n");
    await notifyTyler(msg, `😤 Hot Competitor Leads — Faraday`).catch(() => {});
  }

  console.log(`Competitor reviews: ${results.competitors_checked} checked, ${results.reviews_scanned} reviewed, ${results.saved} saved`);
  return NextResponse.json({ success: true, ...results });
}
