import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  try {
    const db = getSupabase();
    const url = new URL(req.url);
    const limit = parseInt(url.searchParams.get("limit") || "100");

    const { data: activity, error } = await db
      .from("activity_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      return NextResponse.json({ error: "Failed to fetch activity" }, { status: 500 });
    }

    return NextResponse.json({ activity });
  } catch (error) {
    console.error("Activity fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch activity" }, { status: 500 });
  }
}
