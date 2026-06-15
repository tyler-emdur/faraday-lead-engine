// POST /api/leads — Save a captured lead
// GET  /api/leads — Fetch leads (used by admin dashboard)
//
// Storage: Supabase (source of truth)
// Notification: Tyler via ntfy push + email (Resend); lead gets confirmation email

import { NextRequest, NextResponse } from "next/server";
import { scoreLead, gradeLead } from "@/lib/scoring";
import { notifyTyler, confirmLead } from "@/lib/notify";
import { normalizePhone } from "@/lib/phone";

// Simple in-memory rate limiter: max 5 lead submissions per IP per 10 minutes
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + 10 * 60 * 1000 });
    return true;
  }
  if (entry.count >= 5) return false;
  entry.count++;
  return true;
}

type LeadBody = {
  name?: string;
  phone?: string;
  email?: string;
  zip?: string;
  city?: string;
  service?: string;
  homeowner?: boolean;
  roof_age?: number;
  damage_visible?: boolean;
  damage_description?: string;
  insurance_filed?: string | boolean;
  urgency?: string;
  electric_bill?: string;
  notes?: string;
  conversation?: unknown;
  source?: string;
  source_detail?: string;
};

export async function POST(req: NextRequest) {
  try {
    // Rate limiting
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (!checkRateLimit(ip)) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const body: LeadBody = await req.json();

    // Normalize phone number for consistency and deduplication
    const normalizedPhone = normalizePhone(body.phone);

    // Normalize insurance_filed: the estimator sends a boolean, scoreLead expects string
    const scoreInput = {
      ...body,
      phone: normalizedPhone,
      insurance_filed: body.insurance_filed != null ? String(body.insurance_filed) : undefined,
    };
    const score = scoreLead(scoreInput);
    const { grade } = gradeLead(score);

    // Build the lead record — used for notifications + sheet even without DB
    const lead = {
      id: crypto.randomUUID(),
      name: body.name || null,
      phone: normalizedPhone,
      email: body.email || null,
      zip: body.zip || null,
      city: body.city || null,
      service: body.service || null,
      homeowner: body.homeowner ?? null,
      roof_age: body.roof_age || null,
      damage_visible: body.damage_visible ?? null,
      damage_description: body.damage_description || null,
      insurance_filed: body.insurance_filed ? String(body.insurance_filed) : null,
      urgency: body.urgency || null,
      electric_bill: body.electric_bill || null,
      notes: body.notes || null,
      score,
      grade,
      conversation: body.conversation || null,
      source: body.source || "chat",
      source_detail: body.source_detail || null,
      status: "New",
    };

    // ── SUPABASE (optional) ──
    // If SUPABASE_URL is set, save to DB for admin dashboard + follow-up triggers.
    // If not configured, Google Sheets is the source of truth.
    if (process.env.SUPABASE_URL) {
      try {
        const { getSupabase } = await import("@/lib/supabase");
        const db = getSupabase();

        // Deduplication: if a lead with the same phone submitted in the last 30 days,
        // update their record rather than creating a duplicate.
        if (normalizedPhone) {
          const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
          const { data: existing } = await db
            .from("leads")
            .select("id, score")
            .eq("phone", normalizedPhone)
            .gte("created_at", thirtyDaysAgo)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (existing && score > existing.score) {
            // Upgrade the existing record with better data (higher score = more info)
            await db.from("leads").update({ score, grade, notes: lead.notes, source_detail: lead.source_detail }).eq("id", existing.id);
            lead.id = existing.id;
            return NextResponse.json({ success: true, lead, deduplicated: true });
          } else if (existing) {
            lead.id = existing.id;
            return NextResponse.json({ success: true, lead, deduplicated: true });
          }
        }

        const { data: dbLead, error } = await db
          .from("leads")
          .insert({
            name: lead.name,
            phone: lead.phone,
            email: lead.email,
            zip: lead.zip,
            city: lead.city,
            service: lead.service,
            homeowner: lead.homeowner,
            roof_age: lead.roof_age,
            damage_visible: lead.damage_visible,
            damage_description: lead.damage_description,
            insurance_filed: lead.insurance_filed,
            urgency: lead.urgency,
            electric_bill: lead.electric_bill,
            notes: lead.notes,
            score,
            grade,
            conversation: lead.conversation,
            source: lead.source,
            source_detail: lead.source_detail,
          })
          .select()
          .single();

        if (!error && dbLead) {
          lead.id = dbLead.id; // use the DB-assigned ID

          // Log activity
          db.from("activity_log").insert({
            type: "lead_captured",
            description: `New ${grade}-grade lead: ${lead.name || "Unknown"} — ${lead.service || "unknown"}`,
            metadata: { lead_id: lead.id, score, grade },
          }).then(() => {});
        } else {
          console.warn("Supabase lead save failed (continuing):", error?.message);
        }
      } catch (e) {
        console.warn("Supabase unavailable — lead saved to Sheets only:", e);
      }
    }

    // ── NOTIFICATIONS (fire and forget — never block the response) ──
    const serviceLabel: Record<string, string> = {
      hail_damage: "Hail Damage", roofing: "Roofing",
      solar: "Solar", windows: "Windows", multiple: "Multiple",
    };
    const gradeEmoji = grade === "A" ? "🔥" : grade === "B" ? "✅" : "📋";
    const urgencyFlag = lead.urgency === "emergency" ? " ⚠️ EMERGENCY" : "";

    const tylerMsg = [
      `${gradeEmoji} NEW LEAD — $100 opportunity${urgencyFlag}`,
      `${lead.name || "Unknown"} | ${lead.phone || "no phone"}`,
      `${lead.city || "Unknown city"} | ${serviceLabel[lead.service || ""] || lead.service || "Unknown"}`,
      `Grade: ${grade} (score: ${score}) | via ${lead.source || "chat"}`,
      `→ Forward to Faraday: (720) 766-1518`,
    ].join("\n");

    const notify = [
      notifyTyler(tylerMsg, `${gradeEmoji} New Lead — ${lead.name || "Unknown"}, ${lead.city || ""}`).catch(e =>
        console.error("Tyler notification failed:", e)
      ),
      confirmLead(lead).catch(e =>
        console.error("Lead confirmation failed:", e)
      ),
    ];

    Promise.all(notify).then(() => {
      // Mark as notified in DB if it exists
      if (process.env.SUPABASE_URL) {
        import("@/lib/supabase").then(({ getSupabase }) => {
          getSupabase()
            .from("leads")
            .update({ team_notified: true })
            .eq("id", lead.id)
            .then(() => {});
        }).catch(() => {});
      }
    });

    return NextResponse.json({ success: true, lead });
  } catch (error) {
    console.error("Lead capture error:", error);
    return NextResponse.json({ error: "Failed to capture lead" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  // Admin dashboard requires Supabase
  if (!process.env.SUPABASE_URL) {
    return NextResponse.json(
      { leads: [], note: "Supabase not configured" },
      { status: 200 }
    );
  }

  try {
    const { getSupabase } = await import("@/lib/supabase");
    const db = getSupabase();
    const url = new URL(req.url);

    const status = url.searchParams.get("status");
    const service = url.searchParams.get("service");
    const grade = url.searchParams.get("grade");
    const limit = parseInt(url.searchParams.get("limit") || "100");

    let query = db
      .from("leads")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (status) query = query.eq("status", status);
    if (service) query = query.eq("service", service);
    if (grade) query = query.eq("grade", grade);

    const { data: leads, error } = await query;

    if (error) {
      return NextResponse.json({ error: "Failed to fetch leads" }, { status: 500 });
    }

    return NextResponse.json({ leads });
  } catch (error) {
    console.error("Leads fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch leads" }, { status: 500 });
  }
}
