// CRON: SEO Blog Generator — Runs every Monday at 9am
// AI-generates blog posts targeting "[city] hail damage roof repair" keywords
// Works with any OpenAI-compatible provider: Groq, Together, OpenRouter, Ollama, etc.
import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import OpenAI from "openai";

export const maxDuration = 60;

const KEYWORD_TEMPLATES = [
  { template: "hail damage roof repair {city} CO", service: "hail_damage" },
  { template: "roof replacement cost {city} Colorado", service: "roofing" },
  { template: "solar panel installation {city} Colorado", service: "solar" },
  { template: "replacement windows {city} CO", service: "windows" },
  { template: "storm damage roof insurance claim {city}", service: "hail_damage" },
  { template: "how to tell if roof has hail damage {city}", service: "hail_damage" },
  { template: "best roofing company {city} Colorado", service: "roofing" },
  { template: "free roof inspection {city} CO", service: "roofing" },
  { template: "energy efficient windows {city} Colorado", service: "windows" },
  { template: "solar incentives Colorado {city} homeowners", service: "solar" },
];

const CITIES = [
  "Denver", "Boulder", "Fort Collins", "Colorado Springs", "Longmont",
  "Loveland", "Broomfield", "Thornton", "Arvada", "Westminster",
  "Aurora", "Castle Rock", "Parker", "Golden", "Brighton", "Greeley",
];

function getClient() {
  return new OpenAI({
    apiKey: (process.env.AI_API_KEY || "no-key").trim(),
    baseURL: (process.env.AI_BASE_URL || "https://api.groq.com/openai/v1").trim(),
  });
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getSupabase();

  try {
    const { data: existingPosts } = await db
      .from("blog_posts")
      .select("target_keyword, target_city");

    const usedCombos = new Set(
      (existingPosts || []).map((p) => `${p.target_keyword}|${p.target_city}`)
    );

    let chosenKeyword = null;
    let chosenCity = null;

    for (const kw of KEYWORD_TEMPLATES) {
      for (const city of CITIES) {
        if (!usedCombos.has(`${kw.template}|${city}`)) {
          chosenKeyword = kw;
          chosenCity = city;
          break;
        }
      }
      if (chosenKeyword) break;
    }

    if (!chosenKeyword || !chosenCity) {
      return NextResponse.json({ success: true, message: "All keyword combinations used" });
    }

    const targetKeyword = chosenKeyword.template.replace("{city}", chosenCity);
    const model = (process.env.AI_MODEL || "llama-3.3-70b-versatile").trim();
    const client = getClient();

    const completion = await client.chat.completions.create({
      model,
      max_tokens: 2000,
      messages: [
        {
          role: "system",
          content: `You are an SEO content writer for Faraday Construction, a roofing, solar, and windows company in Colorado. Write helpful, informative blog posts that rank on Google and naturally lead readers to contact Faraday for a free inspection.

RULES:
- Write 600-900 words
- Use the target keyword naturally 3-5 times
- Include the city name naturally throughout
- Be genuinely helpful — not spammy or keyword-stuffed
- Include a clear call-to-action at the end mentioning free inspections
- Mention insurance coverage where relevant (hail/storm posts)
- Use a warm, knowledgeable tone
- Do NOT use asterisks, markdown bold, or formatting — just plain paragraph text with line breaks

Respond ONLY with JSON (no backticks, no markdown):
{"title":"Post Title","meta_description":"155 char meta description","slug":"url-friendly-slug","content":"Full blog post content with paragraphs separated by double newlines"}`,
        },
        {
          role: "user",
          content: `Write a blog post targeting: "${targetKeyword}"
City: ${chosenCity}, Colorado
Service: ${chosenKeyword.service}
Company: Faraday Construction
Phone: ${process.env.NEXT_PUBLIC_COMPANY_PHONE || "(303) 555-0123"}`,
        },
      ],
    });

    const text = completion.choices[0]?.message?.content || "";
    const clean = text.replace(/```json|```/g, "").trim();
    let post;
    try {
      post = JSON.parse(clean);
    } catch {
      const match = clean.match(/\{[\s\S]*\}/);
      if (!match) throw new Error(`AI returned unparseable response: ${clean.slice(0, 200)}`);
      post = JSON.parse(match[0]);
    }

    const { data: saved } = await db
      .from("blog_posts")
      .insert({
        title: post.title,
        slug: post.slug,
        content: post.content,
        meta_description: post.meta_description,
        target_keyword: chosenKeyword.template,
        target_city: chosenCity,
        published: true,
        published_at: new Date().toISOString(),
      })
      .select()
      .single();

    await db.from("activity_log").insert({
      type: "blog_published",
      description: `Published: "${post.title}" targeting "${targetKeyword}"`,
      metadata: { post_id: saved?.id, keyword: targetKeyword, city: chosenCity },
    });

    console.log(`Blog post generated: "${post.title}" → /${post.slug}`);

    return NextResponse.json({
      success: true,
      post: { title: post.title, slug: post.slug, keyword: targetKeyword },
    });
  } catch (error) {
    console.error("Blog generation error:", error);
    return NextResponse.json({ error: "Blog generation failed" }, { status: 500 });
  }
}
