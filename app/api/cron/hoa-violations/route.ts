// CRON: HOA Violation Interceptor — runs weekly on Wednesday at 10am MT
// HOAs fine homeowners for "shabby roofs" constantly. These people need a roofer
// who can work through insurance — and they need one TODAY.
//
// How it works:
//   1. Scrapes Colorado HOA directory sites for management companies to add to outbound queue
//   2. Searches Reddit r/Denver, r/Colorado for HOA fine / roof violation posts
//   3. Generates a targeted blog post for SEO: "Got an HOA fine for your roof in Colorado?"
//   4. Creates intel opportunities for any active HOA roof complaints found
//   5. Adds HOA management companies to outbound_prospects for referral outreach
//
// Requires: SUPABASE_URL
// Optional: AI_API_KEY (for blog + personalized outreach)

import { NextRequest, NextResponse } from "next/server";
import { saveOpportunity, opportunityExists } from "@/lib/intel";
import { notifyTyler } from "@/lib/notify";

export const maxDuration = 60;

// ── HOA directory scraping ────────────────────────────────────────────────────
// Public HOA directories list management companies + contact info

interface HOAManagementCo {
  name: string;
  website: string | null;
  phone: string | null;
  city: string;
}

async function scrapeColoradoHOADirectory(): Promise<HOAManagementCo[]> {
  const results: HOAManagementCo[] = [];

  // Overpass query for HOA-related offices in Colorado Front Range
  const ql = `[out:json][timeout:20];
(
  node["office"="association"](39.3,-105.3,40.9,-104.5);
  node["name"~"HOA|homeowner|association|community management",i](39.3,-105.3,40.9,-104.5)["office"];
  node["office"="property_management"]["name"~"HOA|community|association",i](39.3,-105.3,40.9,-104.5);
);
out body;`;

  try {
    const res = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `data=${encodeURIComponent(ql)}`,
      signal: AbortSignal.timeout(25000),
    });
    if (res.ok) {
      const data = await res.json() as { elements?: { tags?: Record<string, string> }[] };
      for (const el of data.elements || []) {
        const tags = el.tags || {};
        const name = tags["name"] || tags["operator"] || "";
        if (!name) continue;
        results.push({
          name,
          website: tags["website"] || tags["contact:website"] || null,
          phone: tags["phone"] || tags["contact:phone"] || null,
          city: tags["addr:city"] || "Colorado",
        });
      }
    }
  } catch (e) {
    console.error("HOA Overpass query failed:", e);
  }

  // Also try a public HOA directory
  try {
    const res = await fetch(
      "https://www.hoamanagement.com/hoa-management-companies/colorado/",
      { headers: { "User-Agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(10000) }
    );
    if (res.ok) {
      const html = await res.text();
      // Parse company listings: name, website, phone
      const entries = html.matchAll(/<h\d[^>]*>([A-Z][^<]{5,60}(?:Management|HOA|Community|Association)[^<]*)<\/h\d>[\s\S]{0,300}?(?:href="([^"]*)")?[\s\S]{0,200}?(\(\d{3}\)\s?\d{3}[-.\s]\d{4})?/gi);
      for (const m of entries) {
        const name = m[1]?.trim() || "";
        if (!name || name.length < 5) continue;
        results.push({
          name,
          website: m[2] || null,
          phone: m[3] || null,
          city: "Colorado",
        });
        if (results.length >= 30) break;
      }
    }
  } catch { /* ignore */ }

  return results;
}

// ── Reddit HOA fine / roof violation monitoring ───────────────────────────────

const HOA_SUBREDDITS = ["r/Denver", "r/Colorado", "r/HOA", "r/FirstTimeHomeBuyer"];
const HOA_KEYWORDS = [
  "hoa fine roof", "hoa violation roof", "hoa letter roof", "hoa fined roof",
  "hoa notice roof", "hoa roof", "roof violation", "fined for roof",
  "hoa complaint roof", "hoa demand roof",
];

interface RedditPost {
  data: {
    id: string;
    title: string;
    selftext: string;
    author: string;
    subreddit: string;
    url: string;
    created_utc: number;
    score: number;
  };
}

async function searchRedditHOAViolations(): Promise<RedditPost[]> {
  const found: RedditPost[] = [];
  const query = HOA_KEYWORDS.slice(0, 3).join(" OR ");

  try {
    const params = new URLSearchParams({
      q: query,
      restrict_sr: "0",
      sr_detail: "0",
      sort: "new",
      t: "week",
      limit: "20",
      type: "link",
    });

    const res = await fetch(`https://www.reddit.com/search.json?${params}`, {
      headers: { "User-Agent": "FaradayLeadBot/1.0 (by /u/faradayleads)" },
      signal: AbortSignal.timeout(10000),
      next: { revalidate: 0 },
    });

    if (!res.ok) return found;
    const data = await res.json() as { data?: { children?: RedditPost[] } };
    const posts = data?.data?.children || [];

    for (const post of posts) {
      const { title, selftext } = post.data;
      const text = `${title} ${selftext}`.toLowerCase();
      if (HOA_KEYWORDS.some(kw => text.includes(kw))) {
        // Only Colorado-relevant posts
        if (/colorado|denver|aurora|littleton|castle rock|fort collins|boulder|arvada|broomfield|lakewood/i.test(text)) {
          found.push(post);
        }
      }
    }
  } catch (e) {
    console.error("Reddit HOA search failed:", e);
  }

  return found;
}

// ── HOA-targeted blog generation ──────────────────────────────────────────────

async function generateHOABlogPost(): Promise<boolean> {
  if (!process.env.AI_API_KEY || !process.env.SUPABASE_URL) return false;

  try {
    const { getSupabase } = await import("@/lib/supabase");
    const db = getSupabase();

    const slug = "hoa-roof-violation-colorado-insurance";
    const { data: existing } = await db.from("blog_posts").select("id").eq("slug", slug).maybeSingle();
    if (existing) return false; // Already published

    const prompt = `Write an SEO blog post for Faraday Construction about HOA roof violations in Colorado.

Target keyword: "HOA roof violation Colorado"
Target audience: Homeowners who just received an HOA notice or fine about their roof

The post should:
- Explain that HOA roof fines are actually GOOD news — if your roof is bad enough for an HOA to notice, insurance likely covers the replacement
- Walk through how hail damage claims work in Colorado (most homeowners only pay their deductible)
- Position Faraday's free inspection as the first step — "before you spend your own money, let us check if insurance covers it"
- Be 500-700 words, urgent but helpful tone
- Include Faraday's phone number (720) 766-1518 and offer a free inspection
- Use the exact phrase "HOA roof violation Colorado" naturally in the first paragraph

Return ONLY JSON (no backticks):
{"title":"...","meta_description":"...","slug":"hoa-roof-violation-colorado-insurance","content":"..."}`;

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
          max_tokens: 1500,
          temperature: 0.5,
        }),
      }
    );

    if (!res.ok) return false;
    const data = await res.json() as { choices?: { message?: { content?: string } }[] };
    const text = data.choices?.[0]?.message?.content || "";
    const clean = text.replace(/```json|```/g, "").trim();
    const post = JSON.parse(clean.match(/\{[\s\S]*\}/)?.[0] || clean);

    await db.from("blog_posts").insert({
      title: post.title,
      slug: post.slug || slug,
      content: post.content,
      meta_description: post.meta_description,
      target_keyword: "HOA roof violation Colorado",
      target_city: "Colorado",
      published: true,
      published_at: new Date().toISOString(),
    });

    return true;
  } catch (e) {
    console.error("HOA blog generation failed:", e);
    return false;
  }
}

// ── Main handler ──────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results = { hoa_companies_found: 0, companies_added: 0, reddit_posts: 0, opps_saved: 0, blog_published: false };

  // ── 1. Scrape HOA management companies for outbound queue ──────────────────
  if (process.env.SUPABASE_URL) {
    const companies = await scrapeColoradoHOADirectory();
    results.hoa_companies_found = companies.length;

    if (companies.length > 0) {
      const { getSupabase } = await import("@/lib/supabase");
      const db = getSupabase();
      const { data: existing } = await db.from("outbound_prospects").select("name").limit(2000);
      const existingNames = new Set((existing || []).map(r => (r.name || "").toLowerCase()));

      for (const co of companies) {
        if (existingNames.has(co.name.toLowerCase())) continue;
        if (!co.website && !co.phone) continue;

        const email = co.website
          ? (() => { try { const d = new URL(co.website.startsWith("http") ? co.website : `https://${co.website}`).hostname.replace(/^www\./, ""); return `info@${d}`; } catch { return null; } })()
          : null;

        const { error } = await db.from("outbound_prospects").insert({
          email: email || `hoa_contact_${co.name.replace(/\s+/g, "_").toLowerCase()}@placeholder.local`,
          name: co.name,
          company: co.name,
          city: co.city,
          website: co.website,
          city_hint: co.city,
          status: "new",
          source: "hoa_manager",
          metadata: { phone: co.phone, added_by: "hoa_violations_cron" },
        }).select();

        if (!error) {
          existingNames.add(co.name.toLowerCase());
          results.companies_added++;
        }
        if (results.companies_added >= 20) break;
      }
    }
  }

  // ── 2. Reddit HOA violation monitoring ────────────────────────────────────
  const redditPosts = await searchRedditHOAViolations();
  results.reddit_posts = redditPosts.length;

  for (const post of redditPosts) {
    const { id, title, selftext, author, url, created_utc, score } = post.data;
    const sourceId = `hoa_reddit_${id}`;
    if (await opportunityExists(sourceId)) continue;

    const preview = selftext.slice(0, 200);
    const ageHours = (Date.now() - created_utc * 1000) / 3600000;
    const urgency = ageHours < 12 ? 80 : ageHours < 48 ? 65 : 50;

    const opp = await saveOpportunity({
      source: "community_import",
      source_id: sourceId,
      type: "community_post",
      priority: urgency >= 65 ? "high" : "medium",
      title: `HOA Roof Violation — Reddit: "${title.slice(0, 80)}"`,
      body: `${title}\n\n${preview}`,
      url,
      author,
      location: "Colorado",
      urgency_score: urgency,
      opportunity_score: urgency,
      why_it_matters: `${author} posted about an HOA roof violation ${ageHours.toFixed(0)}h ago. They NEED a roofer now and don't know insurance likely covers it. This is a free inspection lead if we respond today.`,
      outreach_message: `Hi ${author}! I saw your post about the HOA roof notice. Good news — if your roof has any hail or storm damage, insurance likely covers the full replacement (most homeowners just pay their deductible). Faraday offers free inspections and handles all the insurance paperwork. (720) 766-1518`,
      close_probability: urgency >= 65 ? 50 : 30,
      follow_up_schedule: "Reply to Reddit post today. These convert within 24-48h or not at all.",
    });

    if (opp) results.opps_saved++;
  }

  // ── 3. Generate SEO blog post (once, then never again) ───────────────────
  results.blog_published = await generateHOABlogPost();

  if (results.reddit_posts > 0 || results.opps_saved > 0) {
    const msg = [
      `🏘 HOA VIOLATION INTERCEPTOR`,
      results.opps_saved > 0 ? `• ${results.opps_saved} Reddit post${results.opps_saved > 1 ? "s" : ""} → check /intel` : null,
      results.companies_added > 0 ? `• ${results.companies_added} HOA management cos added to outbound queue` : null,
      results.blog_published ? `• HOA blog post published for SEO` : null,
    ].filter(Boolean).join("\n");
    await notifyTyler(msg, `🏘 HOA Violations`).catch(() => {});
  }

  console.log(`HOA violations: ${results.hoa_companies_found} found, ${results.companies_added} added, ${results.reddit_posts} reddit posts, ${results.opps_saved} opps`);
  return NextResponse.json({ success: true, ...results });
}
