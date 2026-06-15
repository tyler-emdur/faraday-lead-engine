// CRON: SEO Blog Generator — Runs every Monday at 9am
// Uses the 52-keyword rotation from lib/blog-keywords.ts.
// Tracks position in Supabase. Anna writes 1,200–1,800 word posts.
//
// Requires: AI_API_KEY, SUPABASE_URL
// Optional: CRON_SECRET (required in production)

import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { generateBlogPost } from "@/lib/anna";
import { getKeywordForWeek, BLOG_KEYWORDS } from "@/lib/blog-keywords";
import { cronRunner } from "@/lib/logger";

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const runner = cronRunner("blog-generate");
  const logId = await runner.start();

  if (!process.env.AI_API_KEY) {
    await runner.finish(logId, { error: "AI_API_KEY not set" });
    return NextResponse.json({ success: false, message: "AI_API_KEY not set" });
  }

  try {
    const db = getSupabase();

    // Get or advance keyword position
    const { data: posRow } = await db
      .from("activity_log")
      .select("id, metadata")
      .eq("type", "blog_keyword_position")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const currentPosition = (posRow?.metadata as { position?: number } | null)?.position ?? 0;
    const nextPosition = (currentPosition + 1) % BLOG_KEYWORDS.length;
    const keyword = getKeywordForWeek(currentPosition);

    // Check if we already have a post for this keyword
    const { data: existing } = await db
      .from("blog_posts")
      .select("id")
      .eq("target_keyword", keyword)
      .maybeSingle();

    if (existing) {
      // Already published — advance and pick next
      await db.from("activity_log").insert({
        type: "blog_keyword_position",
        description: `Blog keyword rotated to position ${nextPosition}`,
        metadata: { position: nextPosition },
      });
      await runner.finish(logId, { metadata: { skipped: keyword, reason: "already published" } });
      return NextResponse.json({ success: true, skipped: keyword, nextKeyword: getKeywordForWeek(nextPosition) });
    }

    // Generate the blog post
    const post = await generateBlogPost(keyword, "Colorado");

    if (!post.content) {
      await runner.finish(logId, { error: "Blog generation returned empty content" });
      return NextResponse.json({ success: false, error: "Empty content" }, { status: 500 });
    }

    // Save to database
    const { error: insertErr } = await db.from("blog_posts").upsert({
      title: post.title,
      slug: post.slug,
      content: post.content,
      meta_description: post.metaDescription,
      target_keyword: post.keyword,
      published: true,
      published_at: new Date().toISOString(),
    }, { onConflict: "slug" });

    if (insertErr) {
      await runner.finish(logId, { error: insertErr.message });
      return NextResponse.json({ success: false, error: insertErr.message }, { status: 500 });
    }

    // Advance keyword position
    await db.from("activity_log").insert({
      type: "blog_keyword_position",
      description: `Blog post published: "${post.title}"`,
      metadata: { position: nextPosition, keyword, slug: post.slug },
    });

    await runner.finish(logId, { actionsCount: 1, metadata: { keyword, slug: post.slug, title: post.title } });
    console.log(`Blog post published: ${post.title} (slug: ${post.slug})`);

    return NextResponse.json({
      success: true,
      post: { title: post.title, slug: post.slug, keyword },
      nextKeyword: getKeywordForWeek(nextPosition),
    });
  } catch (e) {
    const err = e instanceof Error ? e.message : String(e);
    await runner.finish(logId, { error: err });
    console.error("blog-generate cron error:", e);
    return NextResponse.json({ success: false, error: err });
  }
}
