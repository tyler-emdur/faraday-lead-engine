// CRON: Homeowner Email Blast — runs every Monday at 9am MT (4pm UTC)
//
// Sends a weekly batch of cold emails to homeowners from a purchased list.
// List source: InfoUSA, ListGiant, Melissa Data — CO Front Range, homeowner filter.
// Upload via POST /api/homeowner-blast/import (CSV: name,email,zip,city)
//
// Each run sends up to 500 emails from the homeowner_blast_list table.
// Tracks sent status + unsubscribes to avoid re-sending.
//
// Requires: RESEND_API_KEY, SUPABASE_URL, CRON_SECRET
//
// Supabase table (run once):
//   create table homeowner_blast_list (
//     id bigint generated always as identity primary key,
//     name text,
//     email text not null unique,
//     zip text,
//     city text,
//     status text not null default 'pending',  -- pending | sent | unsubscribed | bounced
//     sent_at timestamptz,
//     created_at timestamptz default now()
//   );

import { NextRequest, NextResponse } from "next/server";
import { cronRunner } from "@/lib/logger";

export const maxDuration = 60;

const BATCH_SIZE = 500;
const DELAY_MS = 100; // stay well within Resend's rate limit
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://leads.faradaysun.com";
const PHONE = process.env.NEXT_PUBLIC_COMPANY_PHONE || "(720) 766-1518";

const EMAIL_TEMPLATES = [
  {
    subject: "Your roof may have hail damage you haven't noticed",
    html: (name: string, city: string) => `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;color:#1a1a1a;line-height:1.6;">
  <p style="font-size:15px;margin:0 0 16px;">Hi${name ? ` ${name.split(" ")[0]}` : ""},</p>
  <p style="font-size:15px;margin:0 0 16px;">
    Homeowners in ${city || "the Colorado Front Range"} who got hail in the last 1–3 years are discovering their roofs have damage they never noticed — and their insurance covers the full replacement.
  </p>
  <p style="font-size:15px;margin:0 0 16px;">
    The average Colorado hail claim is <strong>$9,000–$22,000</strong>. Most homeowners only pay their deductible.
  </p>
  <p style="font-size:15px;margin:0 0 20px;">
    Faraday Construction offers a free inspection — we come to you, document everything, and handle all the insurance paperwork. No cost, no commitment.
  </p>
  <div style="text-align:center;margin:0 0 20px;">
    <a href="${SITE_URL}?utm_source=homeowner_blast&utm_medium=email&utm_campaign=weekly"
       style="background:#f59e0b;color:#000;font-weight:700;font-size:16px;padding:14px 28px;border-radius:8px;text-decoration:none;display:inline-block;">
      Get Your Free Inspection →
    </a>
  </div>
  <p style="font-size:13px;color:#6b7280;margin:0 0 8px;">Or call/text us directly: <a href="tel:${PHONE}" style="color:#f59e0b;">${PHONE}</a></p>
  <p style="font-size:13px;color:#6b7280;margin:0;">
    — Anna, Faraday Construction<br>
    BBB A+ · Licensed &amp; Insured · Serving the Colorado Front Range since 2012
  </p>
  <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0;">
  <p style="font-size:11px;color:#9ca3af;margin:0;">
    You're receiving this because your address is in a hail-prone area of Colorado.
    <a href="${SITE_URL}/api/homeowner-blast/unsubscribe?email={{EMAIL}}" style="color:#9ca3af;">Unsubscribe</a>
  </p>
</div>`,
  },
  {
    subject: "Free roof inspection for ${city} homeowners this week",
    html: (name: string, city: string) => `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;color:#1a1a1a;line-height:1.6;">
  <p style="font-size:15px;margin:0 0 16px;">Hi${name ? ` ${name.split(" ")[0]}` : ""},</p>
  <p style="font-size:15px;margin:0 0 16px;">
    Quick question: has anyone checked your roof since the last hail season in ${city || "your area"}?
  </p>
  <p style="font-size:15px;margin:0 0 16px;">
    Hail damage is often invisible from the ground but shows up clearly in a professional inspection. And if your policy covers it — most do — the replacement costs you nothing beyond your deductible.
  </p>
  <p style="font-size:15px;margin:0 0 16px;">
    We're Faraday Construction. We do free inspections and handle the entire insurance claim for you. If there's damage, we fix it. If there isn't, you know your roof is fine.
  </p>
  <div style="text-align:center;margin:0 0 20px;">
    <a href="${SITE_URL}?utm_source=homeowner_blast&utm_medium=email&utm_campaign=weekly"
       style="background:#f59e0b;color:#000;font-weight:700;font-size:16px;padding:14px 28px;border-radius:8px;text-decoration:none;display:inline-block;">
      Schedule Free Inspection →
    </a>
  </div>
  <p style="font-size:13px;color:#6b7280;margin:0 0 8px;">Or call/text: <a href="tel:${PHONE}" style="color:#f59e0b;">${PHONE}</a></p>
  <p style="font-size:13px;color:#6b7280;margin:0;">
    — Faraday Construction · BBB A+ · Colorado Licensed &amp; Insured
  </p>
  <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0;">
  <p style="font-size:11px;color:#9ca3af;margin:0;">
    You're receiving this because your address is in a hail-prone area of Colorado.
    <a href="${SITE_URL}/api/homeowner-blast/unsubscribe?email={{EMAIL}}" style="color:#9ca3af;">Unsubscribe</a>
  </p>
</div>`,
  },
];

function weekTemplate() {
  const weekNum = Math.floor(Date.now() / (7 * 24 * 60 * 60 * 1000));
  return EMAIL_TEMPLATES[weekNum % EMAIL_TEMPLATES.length];
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.SUPABASE_URL || !process.env.RESEND_API_KEY) {
    return NextResponse.json({ success: false, message: "Missing SUPABASE_URL or RESEND_API_KEY" });
  }

  const runner = cronRunner("homeowner-blast");
  const logId = await runner.start();

  try {
    const { getSupabase } = await import("@/lib/supabase");
    const { sendEmail } = await import("@/lib/resend");
    const db = getSupabase();

    // Pull next batch of pending homeowners
    const { data: homeowners, error } = await db
      .from("homeowner_blast_list")
      .select("id, name, email, zip, city")
      .eq("status", "pending")
      .limit(BATCH_SIZE);

    if (error || !homeowners?.length) {
      await runner.finish(logId, { actionsCount: 0, skipped: "No pending homeowners in list" });
      return NextResponse.json({ success: true, sent: 0, message: "No pending homeowners. Upload a list at /api/homeowner-blast/import" });
    }

    const template = weekTemplate();
    let sent = 0;
    let bounced = 0;

    for (const homeowner of homeowners) {
      const city = homeowner.city || "Colorado";
      const html = template.html(homeowner.name || "", city)
        .replace("{{EMAIL}}", encodeURIComponent(homeowner.email));

      // Resolve subject template (may contain ${city})
      const subject = template.subject.replace("${city}", city);

      try {
        await sendEmail(homeowner.email, subject, html);

        await db.from("homeowner_blast_list")
          .update({ status: "sent", sent_at: new Date().toISOString() })
          .eq("id", homeowner.id);

        sent++;
        await new Promise(r => setTimeout(r, DELAY_MS));
      } catch (err) {
        console.error(`Failed to send to ${homeowner.email}:`, err);
        bounced++;
        await db.from("homeowner_blast_list")
          .update({ status: "bounced" })
          .eq("id", homeowner.id)
          .catch(() => {});
      }
    }

    await runner.finish(logId, { actionsCount: sent });
    return NextResponse.json({ success: true, sent, bounced, total_attempted: homeowners.length });
  } catch (error) {
    await runner.finish(logId, { error: String(error) });
    console.error("Homeowner blast error:", error);
    return NextResponse.json({ error: "Homeowner blast failed" }, { status: 500 });
  }
}
