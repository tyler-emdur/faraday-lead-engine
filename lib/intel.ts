// Lead Intelligence Engine — core types, scoring, and opportunity management

import { getSupabase } from "@/lib/supabase";

export type OpportunitySource = "storm" | "community_import" | "property_scan";
export type OpportunityType = "community_post" | "storm_victim_area" | "property_target" | "referral_request";
export type OpportunityStatus = "new" | "contacted" | "replied" | "inspection_booked" | "won" | "lost";
export type OpportunityPriority = "high" | "medium" | "low";

export interface Opportunity {
  id: string;
  source: OpportunitySource;
  source_id?: string;
  type: OpportunityType;
  priority: OpportunityPriority;
  title: string;
  body?: string;
  url?: string;
  author?: string;
  location?: string;
  zip?: string;
  urgency_score: number;
  opportunity_score: number;
  why_it_matters?: string;
  close_probability?: number;
  outreach_message?: string;
  follow_up_schedule?: string;
  status: OpportunityStatus;
  contacted_at?: string;
  replied_at?: string;
  booked_at?: string;
  closed_at?: string;
  lead_id?: string;
  created_at: string;
  updated_at: string;
}

// ─── KEYWORDS ──────────────────────────────────────────────────────────────────

export const HIGH_INTENT_KEYWORDS = [
  "need a roofer", "recommend a roofer", "good roofer", "roof contractor",
  "need roofing", "anyone know a contractor", "insurance adjuster",
  "roof claim", "hail claim", "filing a claim", "roof replacement",
  "broken window", "window replacement", "need solar", "solar installer",
];

export const MEDIUM_INTENT_KEYWORDS = [
  "hail damage", "storm damage", "roof damage", "roof leak",
  "water damage", "water stain", "water coming in", "damaged my roof",
  "hit my roof", "hit my house", "insurance claim", "roofer recommendation",
  "solar damage", "panel damage",
];

export const AWARENESS_KEYWORDS = [
  "hail", "storm hit", "worst hail", "golf balls", "size of quarters",
  "dented my car", "big storm", "severe weather", "roof repair",
];

export function detectKeywords(text: string): {
  keywords: string[];
  intent: "high" | "medium" | "awareness" | null;
} {
  const lower = text.toLowerCase();
  const matched: string[] = [];
  let intent: "high" | "medium" | "awareness" | null = null;

  for (const kw of HIGH_INTENT_KEYWORDS) {
    if (lower.includes(kw)) { matched.push(kw); intent = "high"; }
  }
  if (!intent) {
    for (const kw of MEDIUM_INTENT_KEYWORDS) {
      if (lower.includes(kw)) { matched.push(kw); intent = "medium"; }
    }
  }
  if (!intent) {
    for (const kw of AWARENESS_KEYWORDS) {
      if (lower.includes(kw)) { matched.push(kw); intent = "awareness"; }
    }
  }

  return { keywords: matched, intent };
}

// ─── SCORING ───────────────────────────────────────────────────────────────────

// ZIP → estimated median home build era (for property scoring)
const ZIP_HOME_AGE: Record<string, number> = {
  // Denver core — older stock
  "80202": 1955, "80203": 1960, "80204": 1955, "80205": 1950, "80206": 1965,
  "80207": 1955, "80208": 1960, "80209": 1965, "80210": 1960, "80211": 1955,
  "80212": 1960, "80214": 1970, "80215": 1968, "80216": 1955, "80218": 1958,
  "80219": 1960, "80220": 1958, "80221": 1970, "80222": 1972, "80223": 1955,
  "80224": 1968, "80226": 1972, "80227": 1978, "80228": 1982, "80229": 1975,
  "80230": 1990, "80231": 1978, "80232": 1978, "80233": 1982, "80234": 1985,
  "80235": 1978, "80236": 1975, "80237": 1975, "80238": 2005,
  // Aurora — mixed
  "80010": 1965, "80011": 1970, "80012": 1975, "80013": 1985,
  "80014": 1982, "80015": 2000, "80016": 2005, "80017": 1988,
  "80018": 2002, "80019": 2008,
  // Highlands Ranch / Littleton
  "80120": 1975, "80121": 1978, "80122": 1982, "80123": 1985,
  "80124": 1995, "80125": 2000, "80126": 1998, "80127": 2000,
  "80128": 1992, "80129": 2000, "80130": 2002,
  // Parker / Castle Rock
  "80134": 2002, "80138": 2005, "80108": 2003, "80109": 2006, "80104": 1995,
  // Westminster / Broomfield
  "80021": 1985, "80023": 1992, "80031": 1978, "80030": 1970, "80020": 1988,
  // Arvada / Golden
  "80002": 1968, "80003": 1972, "80004": 1975, "80005": 1982, "80007": 1998,
  "80401": 1972, "80403": 1975,
  // Thornton / Northglenn (80229 already in Denver core)
  "80241": 1988, "80260": 1975,
  // Boulder
  "80301": 1975, "80302": 1970, "80303": 1980, "80304": 1968, "80305": 1978,
  // Fort Collins
  "80521": 1975, "80524": 1980, "80525": 1985, "80526": 1988, "80528": 1995,
  // Longmont
  "80501": 1978, "80503": 1985, "80504": 1990,
  // Greeley
  "80631": 1972, "80634": 1985,
  // Loveland
  "80537": 1980, "80538": 1988,
};

function homeAgeFactor(zip?: string): number {
  if (!zip) return 10;
  const buildYear = ZIP_HOME_AGE[zip];
  if (!buildYear) return 10;
  const age = new Date().getFullYear() - buildYear;
  // Homes 15–30 years old are prime — roof reaching end of life
  if (age >= 25) return 20;
  if (age >= 15) return 15;
  if (age >= 10) return 8;
  return 3;
}

export function scoreOpportunity(params: {
  source: OpportunitySource;
  intent?: "high" | "medium" | "awareness" | null;
  hailSizeInches?: number;
  ageHours?: number;
  zip?: string;
  hasUrl?: boolean;
  hasAuthor?: boolean;
}): { score: number; priority: OpportunityPriority } {
  let score = 0;

  // Source base score
  if (params.source === "storm") {
    const hail = params.hailSizeInches || 0;
    if (hail >= 2.0) score += 45;
    else if (hail >= 1.5) score += 38;
    else if (hail >= 1.0) score += 30;
    else if (hail >= 0.75) score += 22;
    else score += 15;
  } else if (params.source === "community_import") {
    if (params.intent === "high") score += 50;
    else if (params.intent === "medium") score += 32;
    else score += 15;
  } else if (params.source === "property_scan") {
    score += 20;
  }

  // Recency bonus
  const age = params.ageHours ?? 0;
  if (age < 2) score += 20;
  else if (age < 6) score += 15;
  else if (age < 24) score += 10;
  else if (age < 72) score += 5;

  // Property age bonus
  score += homeAgeFactor(params.zip);

  // Source quality bonuses
  if (params.hasUrl) score += 3;
  if (params.hasAuthor) score += 2;

  score = Math.min(100, score);

  const priority: OpportunityPriority =
    score >= 65 ? "high" : score >= 38 ? "medium" : "low";

  return { score, priority };
}

// ─── AI ANALYSIS ───────────────────────────────────────────────────────────────

export async function generateAIAnalysis(params: {
  title: string;
  body?: string;
  source: OpportunitySource;
  location?: string;
  score: number;
  intent?: string | null;
}): Promise<{
  why_it_matters: string;
  close_probability: number;
  outreach_message: string;
  follow_up_schedule: string;
} | null> {
  if (!process.env.AI_API_KEY) return null;

  const model = (process.env.AI_MODEL || "llama-3.3-70b-versatile").trim();
  const baseUrl = (process.env.AI_BASE_URL || "https://api.groq.com/openai/v1").trim();

  const prompt = `You are a lead qualification expert for a Colorado roofing/hail damage/solar/window company.

Opportunity:
Source: ${params.source}
Title: ${params.title}
Body: ${params.body?.slice(0, 400) || "N/A"}
Location: ${params.location || "Colorado Front Range"}
Score: ${params.score}/100
Intent: ${params.intent || "unknown"}

Return ONLY valid JSON (no markdown, no explanation):
{
  "why_it_matters": "1-2 sentences on why this is worth pursuing",
  "close_probability": <integer 0-100>,
  "outreach_message": "A natural, specific outreach message to send this person (under 120 words)",
  "follow_up_schedule": "Brief follow-up plan (e.g. 'Contact today, follow up in 3 days if no reply')"
}`;

  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${(process.env.AI_API_KEY || "").trim()}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt }],
        max_tokens: 400,
        temperature: 0.3,
      }),
    });

    if (!res.ok) return null;
    const data = await res.json();
    const text = data.choices?.[0]?.message?.content || "";
    return JSON.parse(text);
  } catch {
    return null;
  }
}

// ─── SAVE OPPORTUNITY ──────────────────────────────────────────────────────────

export async function saveOpportunity(
  opp: Omit<Opportunity, "id" | "created_at" | "updated_at" | "status">
    & { status?: OpportunityStatus }
): Promise<Opportunity | null> {
  if (!process.env.SUPABASE_URL) return null;

  try {
    const { data, error } = await getSupabase()
      .from("opportunities")
      .insert({
        source: opp.source,
        source_id: opp.source_id,
        type: opp.type,
        priority: opp.priority,
        title: opp.title,
        body: opp.body,
        url: opp.url,
        author: opp.author,
        location: opp.location,
        zip: opp.zip,
        urgency_score: opp.urgency_score,
        opportunity_score: opp.opportunity_score,
        why_it_matters: opp.why_it_matters,
        close_probability: opp.close_probability,
        outreach_message: opp.outreach_message,
        follow_up_schedule: opp.follow_up_schedule,
        status: opp.status ?? "new",
        lead_id: opp.lead_id,
      })
      .select()
      .single();

    if (error) {
      console.error("Failed to save opportunity:", error.message);
      return null;
    }
    return data as Opportunity;
  } catch (e) {
    console.error("saveOpportunity error:", e);
    return null;
  }
}

// ─── DEDUPLICATION ─────────────────────────────────────────────────────────────

export async function opportunityExists(sourceId: string): Promise<boolean> {
  if (!process.env.SUPABASE_URL) return false;
  try {
    const { data } = await getSupabase()
      .from("opportunities")
      .select("id")
      .eq("source_id", sourceId)
      .maybeSingle();
    return !!data;
  } catch {
    return false;
  }
}

// ─── FETCH ──────────────────────────────────────────────────────────────────────

export async function fetchOpportunities(params: {
  priority?: OpportunityPriority;
  status?: OpportunityStatus;
  limit?: number;
  since?: string;
} = {}): Promise<Opportunity[]> {
  if (!process.env.SUPABASE_URL) return [];

  try {
    let query = getSupabase()
      .from("opportunities")
      .select("*")
      .order("opportunity_score", { ascending: false })
      .limit(params.limit ?? 100);

    if (params.priority) query = query.eq("priority", params.priority);
    if (params.status) query = query.eq("status", params.status);
    if (params.since) query = query.gte("created_at", params.since);

    const { data } = await query;
    return (data as Opportunity[]) || [];
  } catch {
    return [];
  }
}

// ─── CONVERSION STATS ──────────────────────────────────────────────────────────

export interface IntelStats {
  total: number;
  by_priority: Record<OpportunityPriority, number>;
  by_status: Record<string, number>;
  by_source: Record<OpportunitySource, number>;
  contacted_rate: number;
  booked_rate: number;
  estimated_revenue: number;
}

export async function fetchIntelStats(): Promise<IntelStats> {
  const all = await fetchOpportunities({ limit: 1000 });

  const by_priority = { high: 0, medium: 0, low: 0 };
  const by_status: Record<string, number> = {};
  const by_source = { storm: 0, community_import: 0, property_scan: 0 };

  for (const o of all) {
    by_priority[o.priority] = (by_priority[o.priority] || 0) + 1;
    by_status[o.status] = (by_status[o.status] || 0) + 1;
    by_source[o.source] = (by_source[o.source] || 0) + 1;
  }

  const contacted = all.filter(o => o.status !== "new").length;
  const booked = all.filter(o => o.status === "inspection_booked" || o.status === "won").length;
  const won = all.filter(o => o.status === "won").length;

  return {
    total: all.length,
    by_priority,
    by_status,
    by_source,
    contacted_rate: all.length ? Math.round((contacted / all.length) * 100) : 0,
    booked_rate: all.length ? Math.round((booked / all.length) * 100) : 0,
    estimated_revenue: won * 100,
  };
}
