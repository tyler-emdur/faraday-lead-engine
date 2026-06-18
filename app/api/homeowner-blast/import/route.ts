// POST /api/homeowner-blast/import
// Accepts a CSV upload (multipart/form-data, field: "file") or raw CSV body.
// CSV columns: name,email,zip,city (header row required)
// Protected by ADMIN_SECRET or CRON_SECRET.
//
// Usage:
//   curl -X POST https://leads.faradaysun.com/api/homeowner-blast/import \
//     -H "Authorization: Bearer $CRON_SECRET" \
//     -F "file=@homeowners.csv"

import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60;

function parseCSV(text: string): { name: string; email: string; zip: string; city: string }[] {
  const lines = text.trim().split("\n").map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];

  const header = lines[0].toLowerCase().split(",").map(h => h.trim().replace(/"/g, ""));
  const nameIdx = header.indexOf("name");
  const emailIdx = header.indexOf("email");
  const zipIdx = header.indexOf("zip");
  const cityIdx = header.indexOf("city");

  if (emailIdx === -1) return [];

  return lines.slice(1).map(line => {
    const cols = line.split(",").map(c => c.trim().replace(/^"|"$/g, ""));
    return {
      name: nameIdx >= 0 ? cols[nameIdx] || "" : "",
      email: cols[emailIdx] || "",
      zip: zipIdx >= 0 ? cols[zipIdx] || "" : "",
      city: cityIdx >= 0 ? cols[cityIdx] || "" : "",
    };
  }).filter(r => r.email && r.email.includes("@"));
}

export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization");
  const validSecret = process.env.CRON_SECRET || process.env.ADMIN_SECRET;
  if (!validSecret || auth !== `Bearer ${validSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.SUPABASE_URL) {
    return NextResponse.json({ error: "SUPABASE_URL not configured" }, { status: 500 });
  }

  let csvText = "";
  const contentType = req.headers.get("content-type") || "";

  if (contentType.includes("multipart/form-data")) {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "No file field in form data" }, { status: 400 });
    csvText = await file.text();
  } else {
    csvText = await req.text();
  }

  const records = parseCSV(csvText);
  if (records.length === 0) {
    return NextResponse.json({ error: "No valid records found. CSV needs header row with at least an 'email' column." }, { status: 400 });
  }

  const { getSupabase } = await import("@/lib/supabase");
  const db = getSupabase();

  // Upsert on email — skip duplicates, don't overwrite sent records
  const { data, error } = await db
    .from("homeowner_blast_list")
    .upsert(
      records.map(r => ({ ...r, status: "pending" })),
      { onConflict: "email", ignoreDuplicates: true }
    )
    .select("id");

  if (error) {
    console.error("Import error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    parsed: records.length,
    inserted: data?.length || 0,
    skipped_duplicates: records.length - (data?.length || 0),
  });
}
