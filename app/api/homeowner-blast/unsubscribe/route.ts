// GET /api/homeowner-blast/unsubscribe?email=...
// One-click unsubscribe link included in every blast email.

import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get("email");
  if (!email || !email.includes("@")) {
    return new NextResponse("Invalid unsubscribe link.", { status: 400, headers: { "Content-Type": "text/plain" } });
  }

  if (process.env.SUPABASE_URL) {
    try {
      const { getSupabase } = await import("@/lib/supabase");
      await getSupabase()
        .from("homeowner_blast_list")
        .update({ status: "unsubscribed" })
        .eq("email", decodeURIComponent(email));
    } catch (e) {
      console.error("Unsubscribe error:", e);
    }
  }

  return new NextResponse(
    `<!DOCTYPE html><html><body style="font-family:sans-serif;text-align:center;padding:60px;color:#374151;">
      <h2 style="color:#10b981;">You've been unsubscribed.</h2>
      <p>You won't receive any more emails from Faraday Construction at this address.</p>
    </body></html>`,
    { headers: { "Content-Type": "text/html" } }
  );
}
