// CRON: Competitor Review Mining — runs every Monday at 7am MT
// Finds 1–2 star reviews on competing Colorado roofers.
// These people need roofing work, are angry at a competitor, and are ready to switch.
// Conversion rate is 3–5x higher than cold outreach.
//
// Sources:
//   PRIMARY:  Google Places API (GOOGLE_PLACES_API_KEY)
//   OPTIONAL: Yelp Fusion API (YELP_API_KEY — free tier, 500 calls/day)
//
// For each hot review, Anna:
//   - Uses AI to extract location clues and summarize the complaint
//   - Drafts a hyper-targeted outreach message referencing the specific complaint
//   - Saves to /intel for Tyler to reach out via Google Maps / Yelp / direct mail

import { NextRequest, NextResponse } from "next/server";
import { notifyTyler } from "@/lib/notify";
import { saveOpportunity, opportunityExists } from "@/lib/intel";

export const maxDuration = 60;

const COMPETITOR_SEARCHES = [
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
  "damage", "leak", "still leaking", "worse than before", "deposit", "vanished",
];

// ── AI review analysis ────────────────────────────────────────────────────────

interface ReviewContext {
  complaint_summary: string;
  possible_city: string | null;
  personalized_outreach: string;
  severity: "high" | "medium";
}

async function analyzeReview(
  reviewText: string,
  reviewerName: string,
  competitorName: string
): Promise<ReviewContext | null> {
  if (!process.env.AI_API_KEY) return null;

  try {
    const res = await fetch(
      `${(process.env.AI_BASE_URL || "https://api.groq.com/openai/v1").trim()}/chat/completions`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${(process.env.AI_API_KEY || "").trim()}`,
        },
        body: JSON.stringify({
          model: (process.env.AI_MODEL || "llama-3.3-70b-versatile").trim(),
          messages: [{
            role: "user",
            content: `Analyze this 1-2 star review of ${competitorName} (a Colorado roofer) left by "${reviewerName}":

"${reviewText.slice(0, 500)}"

Return ONLY valid JSON:
{
  "complaint_summary": "one sentence describing the core problem",
  "possible_city": "Colorado city if mentioned, else null",
  "personalized_outreach": "A 2-3 sentence outreach message from Tyler at Faraday Construction to ${reviewerName} referencing their specific complaint. Be empathetic, not salesy. Offer a free inspection. Include (720) 766-1518.",
  "severity": "high if they mention money/insurance/safety issues, else medium"
}`,
          }],
          max_tokens: 300,
          temperature: 0.3,
        }),
      }
    );
    if (!res.ok) return null;
    const data = await res.json() as { choices?: { message?: { content?: string } }[] };
    const text = data.choices?.[0]?.message?.content || "";
    return JSON.parse(text) as ReviewContext;
  } catch { return null; }
}

// ── Google Places reviews ─────────────────────────────────────────────────────

interface GoogleReview {
  author_name: string;
  rating: number;
  text: string;
  time: number;
  relative_time_description: string;
}

async function googleFindPlaceId(search: string): Promise<string | null> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) return null;
  try {
    const params = new URLSearchParams({
      input: search, inputtype: "textquery", fields: "place_id", key: apiKey,
      locationbias: "circle:200000@39.7392,-104.9903",
    });
    const res = await fetch(`https://maps.googleapis.com/maps/api/place/findplacefromtext/json?${params}`, { next: { revalidate: 0 } });
    if (!res.ok) return null;
    const data = await res.json() as { candidates?: { place_id: string }[] };
    return data.candidates?.[0]?.place_id || null;
  } catch { return null; }
}

async function googleGetReviews(placeId: string): Promise<GoogleReview[]> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) return [];
  try {
    const params = new URLSearchParams({ place_id: placeId, fields: "reviews", key: apiKey });
    const res = await fetch(`https://maps.googleapis.com/maps/api/place/details/json?${params}`, { next: { revalidate: 0 } });
    if (!res.ok) return [];
    const data = await res.json() as { result?: { reviews?: GoogleReview[] } };
    return (data.result?.reviews || []) as GoogleReview[];
  } catch { return []; }
}

// ── Yelp Fusion reviews ───────────────────────────────────────────────────────

interface YelpReview {
  id: string;
  text: string;
  rating: number;
  user: { name: string };
  time_created: string;
}

async function yelpSearchBusiness(name: string): Promise<string | null> {
  const apiKey = process.env.YELP_API_KEY;
  if (!apiKey) return null;
  try {
    const params = new URLSearchParams({ term: name, location: "Denver, CO", limit: "1" });
    const res = await fetch(`https://api.yelp.com/v3/businesses/search?${params}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) return null;
    const data = await res.json() as { businesses?: { id: string }[] };
    return data.businesses?.[0]?.id || null;
  } catch { return null; }
}

async function yelpGetReviews(businessId: string): Promise<YelpReview[]> {
  const apiKey = process.env.YELP_API_KEY;
  if (!apiKey) return [];
  try {
    const res = await fetch(`https://api.yelp.com/v3/businesses/${businessId}/reviews?limit=20&sort_by=yelp_sort`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) return [];
    const data = await res.json() as { reviews?: YelpReview[] };
    return (data.reviews || []).filter(r => r.rating <= 2);
  } catch { return []; }
}

// ── Scoring ───────────────────────────────────────────────────────────────────

function scoreReviewText(text: string, rating: number, ageDays: number): number {
  if (rating > 2) return 0;
  const lower = text.toLowerCase();
  let score = 40;
  for (const kw of ANGRY_KEYWORDS) {
    if (lower.includes(kw)) score += 8;
  }
  if (ageDays < 30) score += 20;
  else if (ageDays < 90) score += 10;
  else if (ageDays > 365) score -= 10;
  return Math.min(90, score);
}

// ── Main handler ──────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.GOOGLE_PLACES_API_KEY && !process.env.YELP_API_KEY) {
    return NextResponse.json({
      success: false,
      message: "Set GOOGLE_PLACES_API_KEY and/or YELP_API_KEY to enable review mining",
    });
  }

  const results = { competitors_checked: 0, reviews_scanned: 0, hot_leads: 0, saved: 0 };
  const hotFinds: string[] = [];

  for (const competitor of COMPETITOR_SEARCHES) {
    let lowRatedReviews: { author: string; text: string; rating: number; ageMs: number; source: string }[] = [];

    // Google Places
    const placeId = await googleFindPlaceId(competitor.search);
    if (placeId) {
      results.competitors_checked++;
      const reviews = await googleGetReviews(placeId);
      for (const r of reviews.filter(r => r.rating <= 2)) {
        lowRatedReviews.push({
          author: r.author_name,
          text: r.text,
          rating: r.rating,
          ageMs: Date.now() - r.time * 1000,
          source: "google",
        });
      }
    }

    // Yelp (additional source when key set)
    if (process.env.YELP_API_KEY) {
      const yelpId = await yelpSearchBusiness(competitor.name);
      if (yelpId) {
        if (!placeId) results.competitors_checked++; // don't double-count
        const yelpReviews = await yelpGetReviews(yelpId);
        for (const r of yelpReviews) {
          lowRatedReviews.push({
            author: r.user.name,
            text: r.text,
            rating: r.rating,
            ageMs: Date.now() - new Date(r.time_created).getTime(),
            source: "yelp",
          });
        }
      }
    }

    results.reviews_scanned += lowRatedReviews.length;

    for (const review of lowRatedReviews) {
      const ageDays = review.ageMs / 86400000;
      const score = scoreReviewText(review.text, review.rating, ageDays);
      if (score < 45) continue;

      const sourceId = `review_${competitor.name.replace(/\s+/g, "_")}_${review.source}_${Math.round(review.ageMs / 60000)}`;
      if (await opportunityExists(sourceId)) continue;

      const priority = score >= 70 ? "high" as const : "medium" as const;

      // AI analysis for high-scoring reviews
      const aiCtx = priority === "high"
        ? await analyzeReview(review.text, review.author, competitor.name)
        : null;

      const preview = review.text.slice(0, 200);

      await saveOpportunity({
        source: "community_import",
        source_id: sourceId,
        type: "community_post",
        priority,
        title: `${review.rating}⭐ on ${competitor.name} (${review.source}): "${preview.slice(0, 80)}…"`,
        body: review.text,
        url: review.source === "google"
          ? `https://www.google.com/maps/search/${encodeURIComponent(competitor.name)}/`
          : `https://www.yelp.com/search?find_desc=${encodeURIComponent(competitor.name)}&find_loc=Denver%2C+CO`,
        author: review.author,
        location: aiCtx?.possible_city || "Colorado Front Range",
        urgency_score: score,
        opportunity_score: score,
        why_it_matters: aiCtx
          ? `${review.author} is furious at ${competitor.name}: ${aiCtx.complaint_summary}. They need a better roofer RIGHT NOW.`
          : `${review.author} left a ${review.rating}-star review on ${competitor.name} — they need roofing work and are actively looking for alternatives.`,
        outreach_message: aiCtx?.personalized_outreach
          || `Hi ${review.author.split(" ")[0]}, I saw your review of ${competitor.name} and I'm sorry you had that experience. At Faraday we do things differently — free inspection, we handle all insurance paperwork. (720) 766-1518`,
        close_probability: score >= 70 ? 45 : 25,
        follow_up_schedule: "Reach out via Google Maps / Yelp review reply within 48h of review posting.",
      });

      results.saved++;
      if (priority === "high") {
        results.hot_leads++;
        hotFinds.push(`${review.rating}⭐ on ${competitor.name} [${review.source}]: "${preview.slice(0, 60)}…"`);
      }
    }
  }

  if (hotFinds.length > 0) {
    const msg = [
      `😤 ${hotFinds.length} ANGRY COMPETITOR REVIEW${hotFinds.length > 1 ? "S" : ""}`,
      ...hotFinds.slice(0, 3).map(f => `• ${f}`),
      `→ Check /intel — reach out on Google Maps / Yelp today`,
    ].join("\n");
    await notifyTyler(msg, `😤 Hot Competitor Leads — Faraday`).catch(() => {});
  }

  console.log(`Competitor reviews: ${results.competitors_checked} checked, ${results.reviews_scanned} reviewed, ${results.saved} saved`);
  return NextResponse.json({ success: true, ...results });
}
