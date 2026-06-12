import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  try {
    const db = getSupabase();
    const url = new URL(req.url);
    const limit = parseInt(url.searchParams.get("limit") || "50");

    const { data: storms, error } = await db
      .from("storm_alerts")
      .select("*")
      .order("detected_at", { ascending: false })
      .limit(limit);

    if (error) {
      return NextResponse.json({ error: "Failed to fetch storms" }, { status: 500 });
    }

    return NextResponse.json({ storms });
  } catch (error) {
    console.error("Storms fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch storms" }, { status: 500 });
  }
}
