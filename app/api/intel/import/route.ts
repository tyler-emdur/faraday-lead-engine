// Manual community post import — Facebook groups, Nextdoor posts, etc.
// Tyler pastes in a URL + text snippet from a post he found manually.
// The system scores it, generates AI analysis, and creates an opportunity.

import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import {
  detectKeywords,
  scoreOpportunity,
  generateAIAnalysis,
  saveOpportunity,
} from "@/lib/intel";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body?.text) {
    return NextResponse.json({ error: "text is required" }, { status: 400 });
  }

  const {
    text,
    source = "facebook",
    url,
    author,
    location,
    zip,
    posted_at,
  } = body;

  if (!["facebook", "nextdoor", "other"].includes(source)) {
    return NextResponse.json({ error: "Invalid source" }, { status: 400 });
  }

  const { keywords, intent } = detectKeywords(text);

  if (!intent) {
    return NextResponse.json({
      matched: false,
      message: "No relevant keywords found — not saved as opportunity",
    });
  }

  const ageHours = posted_at
    ? (Date.now() - new Date(posted_at).getTime()) / 3_600_000
    : 1;

  const { score, priority } = scoreOpportunity({
    source: "community_import",
    intent,
    ageHours,
    zip,
    hasUrl: !!url,
    hasAuthor: !!author,
  });

  const title = author
    ? `${source === "facebook" ? "Facebook" : source === "nextdoor" ? "Nextdoor" : "Post"} — ${author}${location ? ` in ${location}` : ""}`
    : `${source === "facebook" ? "Facebook" : source === "nextdoor" ? "Nextdoor" : "Manual"} import${location ? ` — ${location}` : ""}`;

  // Generate AI analysis for medium and high priority
  let analysis = null;
  if (priority !== "low") {
    analysis = await generateAIAnalysis({ title, body: text, source: "community_import", location, score, intent });
  }

  const opportunity = await saveOpportunity({
    source: "community_import",
    type: intent === "high" ? "referral_request" : "community_post",
    priority,
    title,
    body: text.slice(0, 1000),
    url,
    author,
    location,
    zip,
    urgency_score: score,
    opportunity_score: score,
    why_it_matters: analysis?.why_it_matters,
    close_probability: analysis?.close_probability,
    outreach_message: analysis?.outreach_message,
    follow_up_schedule: analysis?.follow_up_schedule,
  });

  // Also save to community_posts table for record
  if (process.env.SUPABASE_URL && opportunity) {
    await getSupabase().from("community_posts").insert({
      source,
      url,
      author,
      text: text.slice(0, 2000),
      location,
      posted_at: posted_at || null,
      urgency_score: score,
      matched_keywords: keywords,
      opportunity_id: opportunity.id,
    });
  }

  return NextResponse.json({
    matched: true,
    priority,
    score,
    keywords,
    opportunity_id: opportunity?.id,
  });
}
