// CRON: Reddit Keyword Monitor — runs every 15 minutes
// Watches CO subreddits for posts where someone is actively looking for a roofer
// or describing storm damage. These are the warmest leads you'll ever find.
// When found → instant SMS to Tyler with the post link so he can reply first.

import { NextRequest, NextResponse } from "next/server";
import { notifyTyler } from "@/lib/notify";

export const maxDuration = 45;

// Subreddits to watch — high-value CO communities
const SUBREDDITS = [
  "Denver",
  "Boulder",
  "FortCollins",
  "ColoradoSprings",
  "Longmont",
  "Colorado",
  "HomeImprovement",
];

// Keyword groups — ordered by lead quality (highest first)
const HIGH_INTENT = [
  "need a roofer",
  "recommend a roofer",
  "good roofer",
  "roof contractor",
  "need roofing",
  "anyone know a contractor",
  "insurance adjuster",
  "roof claim",
  "hail claim",
  "filing a claim",
];

const MEDIUM_INTENT = [
  "hail damage",
  "storm damage",
  "roof damage",
  "roof leak",
  "roof repair",
  "water damage ceiling",
  "water stain",
  "damaged my roof",
  "hit my roof",
  "hit my house",
];

const STORM_INTENT = [
  "hail",
  "storm hit",
  "got pounded",
  "worst hail",
  "size of golf balls",
  "size of quarters",
  "dented my car",
];

interface RedditPost {
  id: string;
  title: string;
  selftext: string;
  url: string;
  permalink: string;
  created_utc: number;
  subreddit: string;
  author: string;
  score: number;
  num_comments: number;
}

async function fetchRecentPosts(subreddit: string): Promise<RedditPost[]> {
  try {
    const res = await fetch(
      `https://www.reddit.com/r/${subreddit}/new.json?limit=25`,
      {
        headers: {
          "User-Agent": "FaradayLeadBot/1.0 (lead generation monitoring)",
        },
        next: { revalidate: 0 },
      }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return (data?.data?.children || []).map(
      (c: { data: RedditPost }) => c.data
    );
  } catch {
    return [];
  }
}

function matchesKeywords(
  post: RedditPost
): { matched: boolean; intent: "high" | "medium" | "storm" | null; keyword: string } {
  const text = `${post.title} ${post.selftext}`.toLowerCase();

  for (const kw of HIGH_INTENT) {
    if (text.includes(kw)) return { matched: true, intent: "high", keyword: kw };
  }
  for (const kw of MEDIUM_INTENT) {
    if (text.includes(kw)) return { matched: true, intent: "medium", keyword: kw };
  }
  for (const kw of STORM_INTENT) {
    if (text.includes(kw)) return { matched: true, intent: "storm", keyword: kw };
  }
  return { matched: false, intent: null, keyword: "" };
}

function alertSms(post: RedditPost, intent: string, keyword: string): string {
  const intentLabel =
    intent === "high"
      ? "HOT LEAD"
      : intent === "medium"
      ? "WARM LEAD"
      : "STORM TALK";

  const age = Math.round((Date.now() / 1000 - post.created_utc) / 60);
  const ageStr = age < 60 ? `${age}m ago` : `${Math.round(age / 60)}h ago`;

  return [
    `🔥 ${intentLabel} — r/${post.subreddit}`,
    `"${post.title.slice(0, 80)}${post.title.length > 80 ? "…" : ""}"`,
    `Keyword: "${keyword}" • ${ageStr} • ${post.num_comments} comments`,
    `→ reddit.com${post.permalink}`,
    `Reply fast — be the first roofer in the thread`,
  ].join("\n");
}

// Simple deduplication — track seen post IDs in Supabase activity_log
// Falls back to time-based check if Supabase not configured
async function getSeenPostIds(): Promise<Set<string>> {
  if (!process.env.SUPABASE_URL) return new Set();
  try {
    const { getSupabase } = await import("@/lib/supabase");
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data } = await getSupabase()
      .from("activity_log")
      .select("metadata")
      .eq("type", "reddit_alert_sent")
      .gte("created_at", since);

    const ids = new Set<string>();
    for (const row of data || []) {
      if (row.metadata?.post_id) ids.add(row.metadata.post_id);
    }
    return ids;
  } catch {
    return new Set();
  }
}

async function markPostSeen(postId: string, subreddit: string): Promise<void> {
  if (!process.env.SUPABASE_URL) return;
  try {
    const { getSupabase } = await import("@/lib/supabase");
    await getSupabase().from("activity_log").insert({
      type: "reddit_alert_sent",
      description: `Reddit lead alert sent for post ${postId} in r/${subreddit}`,
      metadata: { post_id: postId, subreddit },
    });
  } catch {}
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results = { posts_checked: 0, alerts_sent: 0, high_intent: 0 };
  const seenIds = await getSeenPostIds();
  const CUTOFF_SECONDS = 20 * 60; // Only look at posts from last 20 min

  for (const subreddit of SUBREDDITS) {
    const posts = await fetchRecentPosts(subreddit);

    for (const post of posts) {
      results.posts_checked++;

      // Skip old posts
      const ageSeconds = Date.now() / 1000 - post.created_utc;
      if (ageSeconds > CUTOFF_SECONDS) continue;

      // Skip already alerted
      if (seenIds.has(post.id)) continue;

      const { matched, intent, keyword } = matchesKeywords(post);
      if (!matched || !intent) continue;

      const message = alertSms(post, intent, keyword);
      const intentLabel = intent === "high" ? "HOT LEAD" : intent === "medium" ? "Warm Lead" : "Storm Talk";
      const subject = `🔥 ${intentLabel} — r/${subreddit}: "${post.title.slice(0, 60)}"`;

      await notifyTyler(message, subject).catch(e =>
        console.error(`Reddit notification failed for ${post.id}:`, e)
      );

      await markPostSeen(post.id, subreddit);
      seenIds.add(post.id);
      results.alerts_sent++;
      if (intent === "high") results.high_intent++;
      console.log(`Reddit alert sent: r/${subreddit} — "${post.title.slice(0, 60)}"`);
    }
  }

  console.log(`Reddit monitor: ${results.posts_checked} posts checked, ${results.alerts_sent} alerts sent`);
  return NextResponse.json({ success: true, ...results });
}
