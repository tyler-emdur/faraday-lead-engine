// CRON: FEMA Disaster Declaration Monitor — runs twice daily (8am + 6pm MT)
// When FEMA declares a disaster in Colorado:
//   1. Notify Tyler immediately
//   2. Auto-publish a blog post explaining what it means for homeowners
//   3. Create high-priority intel opportunity
//
// These searches are completely uncontested — you'll be the only roofer
// with content for "[county] FEMA disaster declaration roofing".
//
// API: FEMA OpenFEMA (free, no key required)
// Docs: https://www.fema.gov/api/open/v2/disasterDeclarations

import { NextRequest, NextResponse } from "next/server";
import { notifyTyler } from "@/lib/notify";
import { saveOpportunity, opportunityExists } from "@/lib/intel";

export const maxDuration = 60;

interface FEMADeclaration {
  disasterNumber: number;
  state: string;
  declarationTitle: string;
  declarationDate: string;
  incidentType: string;
  designatedArea: string;
  incidentBeginDate: string;
  incidentEndDate: string;
  closeoutDate: string | null;
  hash: string;
}

const COLORADO_CODES = ["CO", "COLORADO"];

const ROOFING_INCIDENT_TYPES = [
  "Severe Storm",
  "Hurricane",
  "Tornado",
  "Hail",
  "Wind",
  "Winter Storm",
  "Flood",
];

async function fetchColoradoDeclarations(): Promise<FEMADeclaration[]> {
  const since = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const params = new URLSearchParams({
    "$filter": `state eq 'CO' and declarationDate ge '${since}'`,
    "$orderby": "declarationDate desc",
    "$top": "20",
    "$format": "json",
  });

  try {
    const res = await fetch(
      `https://www.fema.gov/api/open/v2/disasterDeclarations?${params}`,
      {
        headers: { "User-Agent": "FaradayLeadBot/1.0" },
        next: { revalidate: 0 },
      }
    );

    if (!res.ok) {
      console.error("FEMA API error:", res.status);
      return [];
    }

    const data = await res.json();
    return (data.DisasterDeclarations || []) as FEMADeclaration[];
  } catch (e) {
    console.error("FEMA fetch failed:", e);
    return [];
  }
}

function isRoofingRelevant(decl: FEMADeclaration): boolean {
  return ROOFING_INCIDENT_TYPES.some(t =>
    decl.incidentType.toLowerCase().includes(t.toLowerCase())
  );
}

async function generateFEMABlogPost(decl: FEMADeclaration): Promise<void> {
  if (!process.env.SUPABASE_URL || !process.env.AI_API_KEY) return;

  const { getSupabase } = await import("@/lib/supabase");
  const db = getSupabase();
  const area = decl.designatedArea.replace(" (County)", "");
  const incidentDate = new Date(decl.incidentBeginDate).toLocaleDateString("en-US", {
    month: "long", day: "numeric", year: "numeric"
  });

  try {
    const prompt = `Write an SEO blog post for Faraday Construction about FEMA's recent disaster declaration for ${area} County, Colorado due to ${decl.incidentType} on ${incidentDate}.

The post should:
- Explain what the FEMA declaration means for homeowners (assistance programs, how to apply)
- Explain how insurance claims work for ${decl.incidentType} damage
- Mention that Faraday Construction does free roof inspections and handles the insurance paperwork
- Be 500-700 words, helpful tone, no marketing fluff
- Include the city/county name naturally throughout
- End with a clear CTA to call (720) 766-1518 or visit faradaysun.com for a free inspection

Return ONLY JSON (no backticks):
{"title":"...","meta_description":"...","slug":"...","content":"..."}`;

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
          messages: [{ role: "user", content: prompt }],
          max_tokens: 2000,
          temperature: 0.5,
        }),
      }
    );

    if (!res.ok) return;
    const data = await res.json();
    const text = data.choices?.[0]?.message?.content || "";
    const clean = text.replace(/```json|```/g, "").trim();
    const post = JSON.parse(clean.match(/\{[\s\S]*\}/)?.[0] || clean);

    await db.from("blog_posts").insert({
      title: post.title,
      slug: post.slug || `fema-${decl.disasterNumber}-${area.toLowerCase().replace(/\s+/g, "-")}`,
      content: post.content,
      meta_description: post.meta_description,
      target_keyword: `FEMA disaster ${area} Colorado`,
      target_city: area,
      published: true,
      published_at: new Date().toISOString(),
    });

    console.log(`FEMA blog published for ${area}: ${post.title}`);
  } catch (e) {
    console.error("FEMA blog generation failed:", e);
  }
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const declarations = await fetchColoradoDeclarations();
  const results = { checked: declarations.length, relevant: 0, saved: 0, blogs: 0 };

  for (const decl of declarations) {
    if (!isRoofingRelevant(decl)) continue;
    results.relevant++;

    const sourceId = `fema_${decl.disasterNumber}`;
    if (await opportunityExists(sourceId)) continue;

    const area = decl.designatedArea.replace(" (County)", "");
    const declDate = new Date(decl.declarationDate).toLocaleDateString("en-US", {
      month: "short", day: "numeric"
    });

    const title = `FEMA Disaster Declaration — ${area} County, CO (${decl.incidentType}, ${declDate})`;
    const body = `FEMA declared disaster #${decl.disasterNumber} for ${area} County due to ${decl.incidentType}. Declaration: ${decl.declarationTitle}. This unlocks federal assistance programs most homeowners don't know about.`;

    const opp = await saveOpportunity({
      source: "property_scan",
      source_id: sourceId,
      type: "storm_victim_area",
      priority: "high",
      title,
      body,
      location: area,
      urgency_score: 85,
      opportunity_score: 85,
      why_it_matters: `FEMA declared ${area} County a disaster area due to ${decl.incidentType}. This means federal assistance is available — homeowners are actively searching for roofing help and there are ZERO other contractors running content on this specific declaration.`,
      outreach_message: `Hi — FEMA just declared ${area} County a disaster area due to ${decl.incidentType}. We're doing free roof inspections and can help you navigate the federal assistance + insurance claim process. Call (720) 766-1518 or visit faradaysun.com.`,
      close_probability: 60,
      follow_up_schedule: "Post blog today, run Facebook ad tomorrow, contact past leads in area this week",
    });

    if (opp) results.saved++;

    // Notify Tyler immediately
    const notifyMsg = [
      `🚨 FEMA DISASTER — ${area} County, CO`,
      `Type: ${decl.incidentType}`,
      `Declaration #${decl.disasterNumber} | ${declDate}`,
      `→ FREE searches — run blog + ad NOW`,
      `→ Check /intel for outreach message`,
    ].join("\n");

    await notifyTyler(notifyMsg, `🚨 FEMA Declared ${area} County — Act Now`)
      .catch(e => console.error("FEMA notify failed:", e));

    // Auto-publish a blog post
    await generateFEMABlogPost(decl);
    results.blogs++;
  }

  console.log(`FEMA monitor: ${results.checked} checked, ${results.relevant} relevant, ${results.saved} saved`);
  return NextResponse.json({ success: true, ...results });
}
