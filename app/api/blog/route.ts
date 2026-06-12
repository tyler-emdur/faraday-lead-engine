import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  try {
    const db = getSupabase();
    const url = new URL(req.url);
    const limit = parseInt(url.searchParams.get("limit") || "50");

    const { data: posts, error } = await db
      .from("blog_posts")
      .select("id, title, slug, target_keyword, target_city, published, published_at, created_at")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      return NextResponse.json({ error: "Failed to fetch posts" }, { status: 500 });
    }

    return NextResponse.json({ posts });
  } catch (error) {
    console.error("Blog fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch posts" }, { status: 500 });
  }
}
