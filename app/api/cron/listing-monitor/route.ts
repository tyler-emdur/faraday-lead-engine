// CRON: Listing Monitor — runs daily at 9am MT
// Watches Colorado real estate listings for new Pending/Under Contract status.
// When a home goes under contract, the home inspection almost always flags the roof.
//
// Sources:
//   PRIMARY:  Redfin unofficial JSON API (free, no key required)
//   FALLBACK: ATTOM Data API (ATTOM_API_KEY required)
//
// Actions:
//   - Auto-emails the listing agent when email is found (Resend)
//   - Saves to /intel for manual follow-up when no email

import { NextRequest, NextResponse } from "next/server";
import { saveOpportunity, opportunityExists } from "@/lib/intel";
import { notifyTyler } from "@/lib/notify";
import { sendEmail } from "@/lib/resend";
import { getSupabase } from "@/lib/supabase";

export const maxDuration = 60;

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://leads.faradaysun.com").trim();

// ── Redfin API (free, unofficial) ────────────────────────────────────────────
// status=2 = Under Contract / Pending on Redfin
// Note: strip the "{}&&" JSONP prefix before parsing

interface RedfinHome {
  mlsId?: { value?: string };
  streetLine?: { value?: string };
  city?: string;
  state?: string;
  zip?: string;
  listingPrice?: { value?: number };
  agentName?: string;
  agentEmail?: string;
  officeName?: string;
  statusDisplayValue?: string;
  url?: string;
}

interface RedfinResponse {
  errorMessage?: string;
  payload?: {
    homes?: RedfinHome[];
  };
}

// Denver/Front Range region IDs (Denver metro = 13, Boulder = 5, Fort Collins = 17)
const REDFIN_MARKETS = [
  { region_id: "13", market: "denver", label: "Denver Metro" },
  { region_id: "5",  market: "boulder", label: "Boulder" },
  { region_id: "17", market: "fort-collins", label: "Fort Collins" },
];

async function fetchRedfinPending(): Promise<{ address: string; city: string; zip: string; agentName: string; agentEmail: string | null; url: string; price: number }[]> {
  const all: { address: string; city: string; zip: string; agentName: string; agentEmail: string | null; url: string; price: number }[] = [];

  for (const mkt of REDFIN_MARKETS) {
    try {
      const params = new URLSearchParams({
        al: "1",
        market: mkt.market,
        status: "2", // pending
        num_homes: "50",
        uipt: "1,2,3",
        start: "0",
        region_type: "6",
        region_id: mkt.region_id,
      });

      const res = await fetch(
        `https://www.redfin.com/stingray/api/gis?${params}`,
        {
          headers: {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
            "Accept": "application/json, text/javascript, */*",
          },
          signal: AbortSignal.timeout(12000),
          next: { revalidate: 0 },
        }
      );

      if (!res.ok) continue;
      let text = await res.text();
      // Redfin prepends "{}&&" to prevent JSON hijacking
      text = text.replace(/^\{\}&&/, "");
      const data = JSON.parse(text) as RedfinResponse;
      const homes = data?.payload?.homes || [];

      for (const home of homes) {
        const address = home.streetLine?.value || "";
        if (!address) continue;
        // Only Colorado properties — Redfin region IDs sometimes bleed across state lines
        if (home.state && home.state.toUpperCase() !== "CO") continue;
        all.push({
          address,
          city: home.city || mkt.label,
          zip: home.zip || "",
          agentName: home.agentName || "the listing agent",
          agentEmail: home.agentEmail || null,
          url: home.url ? `https://www.redfin.com${home.url}` : `https://www.redfin.com`,
          price: home.listingPrice?.value || 0,
        });
      }
    } catch (e) {
      console.error(`Redfin fetch failed for ${mkt.label}:`, e);
    }
  }

  return all;
}

// ── Upsert agent into outbound_prospects for 4-touch follow-up ───────────────

async function addAgentToOutreach(agentName: string, agentEmail: string, city: string): Promise<void> {
  try {
    const db = getSupabase();
    await db.from("outbound_prospects").upsert({
      name: agentName,
      company: agentName,
      email: agentEmail.toLowerCase(),
      city,
      source: "realtor",
      status: "new",
      follow_up_count: 0,
      metadata: { segment: "realtor", origin: "listing_monitor", email_status: "confirmed" },
    }, { onConflict: "email", ignoreDuplicates: true });
  } catch (e) {
    console.error("Failed to add agent to outreach:", e);
  }
}

// ── Queue no-email agents for manual lookup ───────────────────────────────────

async function queueAgentLookup(agentName: string, address: string, city: string, listingUrl: string): Promise<void> {
  try {
    const db = getSupabase();

    const { data: existing } = await db
      .from("contact_form_queue")
      .select("id")
      .eq("business_name", `FIND EMAIL: ${agentName}`)
      .maybeSingle();
    if (existing) return;

    await db.from("contact_form_queue").insert({
      business_name: `FIND EMAIL: ${agentName}`,
      website: listingUrl,
      city,
      source: "listing_monitor",
      drafted_message: `Agent ${agentName} has a pending listing at ${address}, ${city}. Find their email on the MLS or their brokerage website and forward this:\n\nHi ${agentName.split(" ")[0]},\n\nI noticed ${address} just went under contract — congrats! If the home inspector flags any roof issues, Faraday Construction can turn around a same-day cert or repair so your deal doesn't fall through. We've saved a lot of Colorado closings. Happy to be your go-to roofer for this one and future listings — and I pay $100 per referral when a client of yours ends up getting work done.\n\n(720) 766-1518\n— Tyler, Faraday Construction`,
      status: "pending_send",
    });
  } catch (e) {
    console.error("Failed to queue agent lookup:", e);
  }
}

// ── Auto-email to listing agent ───────────────────────────────────────────────

function agentEmailHtml(agentName: string, address: string): string {
  const firstName = agentName.split(" ")[0] || "there";
  return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;color:#1a1a1a;">
  <p>Hi ${firstName},</p>
  <p>Congrats on the contract at <strong>${address}</strong>!</p>
  <p>If the home inspector flags any roof issues — very common in Colorado after hail seasons — Faraday Construction can turn around a same-day inspection and cert so your deal doesn't fall through.</p>
  <p>I'd also love to be your go-to roofer for future listings. I pay <strong>$100 per referral</strong> when a client of yours gets work done — no contracts, just a quick call when something comes up.</p>
  <p>Direct line: <strong>(720) 766-1518</strong>. Call or text anytime.</p>
  <p>— Tyler Emdur<br>Faraday Construction<br>(720) 766-1518</p>
  <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0;">
  <p style="font-size:12px;color:#9ca3af;">You're receiving this because your listing at ${address} recently went under contract. <a href="${SITE_URL}/unsubscribe">Unsubscribe</a></p>
</div>`;
}

// ── ATTOM fallback (requires API key) ────────────────────────────────────────

interface ATTOMProperty {
  identifier?: { attomId?: number };
  address?: { line1?: string; city?: string; state?: string; postal1?: string };
  sale?: { agentName?: string; agentEmail?: string; listingStatus?: string; listingType?: string };
}

const CO_FIPS = ["08001", "08005", "08013", "08031", "08035", "08059", "08069", "08123"];

async function fetchATTOMPending(): Promise<ATTOMProperty[]> {
  const apiKey = process.env.ATTOM_API_KEY;
  if (!apiKey) return [];
  try {
    const yesterday = new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const params = new URLSearchParams({
      geoIdV4: CO_FIPS.slice(0, 3).join(","),
      statusChangeDate: yesterday,
      listingStatus: "Pending",
      pageSize: "50",
    });
    const res = await fetch(
      `https://api.gateway.attomdata.com/propertyapi/v1.0.0/sale/snapshot?${params}`,
      { headers: { apikey: apiKey, Accept: "application/json" }, next: { revalidate: 0 } }
    );
    if (!res.ok) return [];
    const data = await res.json() as { property?: ATTOMProperty[] };
    return data.property || [];
  } catch { return []; }
}

// ── Main handler ──────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results = { pending_checked: 0, saved: 0, emails_sent: 0, high_priority: 0 };
  const highPriorityFinds: string[] = [];

  // ── Redfin (primary, free) ─────────────────────────────────────────────────
  const redfinHomes = await fetchRedfinPending();
  results.pending_checked += redfinHomes.length;

  for (const home of redfinHomes) {
    const sourceId = `redfin_pending_${home.address.replace(/\s+/g, "_").toLowerCase()}_${home.zip}`;
    if (await opportunityExists(sourceId)) continue;

    const agentEmail = home.agentEmail;
    const firstName = home.agentName.split(" ")[0] || "";

    // Auto-email the agent if we have their email and Resend is configured
    // Also add them to outbound_prospects for 4-touch follow-up sequence
    // If no email, queue a manual lookup task in contact_form_queue
    let emailSent = false;
    if (agentEmail && process.env.RESEND_API_KEY) {
      emailSent = await sendEmail(
        agentEmail,
        `Re: ${home.address} — Roof cert if anything comes up`,
        agentEmailHtml(home.agentName, home.address)
      ).catch(() => false);
      if (emailSent) results.emails_sent++;
      // Add to outbound_prospects so the 4-touch sequence continues
      await addAgentToOutreach(home.agentName, agentEmail, home.city);
    } else {
      // Queue manual lookup so Tyler can find and email them
      await queueAgentLookup(home.agentName, home.address, home.city, home.url);
    }

    const opp = await saveOpportunity({
      source: "property_scan",
      source_id: sourceId,
      type: "property_target",
      priority: agentEmail ? "high" : "medium",
      title: `Pending sale: ${home.address}, ${home.city}`,
      body: `Status: Pending. Agent: ${home.agentName}${agentEmail ? ` (${agentEmail})` : ""}. Price: ${home.price ? `$${home.price.toLocaleString()}` : "unknown"}.`,
      url: home.url,
      location: home.city,
      zip: home.zip,
      urgency_score: agentEmail ? 80 : 60,
      opportunity_score: agentEmail ? 80 : 60,
      why_it_matters: `${home.address} just went under contract. Home inspectors almost always flag Colorado roofs. Reaching the agent now — before inspection — lets Faraday save the deal and earn a referral source for life.`,
      outreach_message: agentEmail
        ? `Hi${firstName ? ` ${firstName}` : ""}! I saw ${home.address} just went under contract — congrats! If the home inspector flags any roof issues, Faraday Construction can get out there same-day for a cert or repair. We've saved a lot of Colorado deals. (720) 766-1518`
        : `Find agent for ${home.address} and call/text — deal inspection likely within 7 days.`,
      close_probability: agentEmail ? 40 : 25,
      follow_up_schedule: emailSent
        ? "Email sent. Follow up in 3 days if no reply — inspection is usually within first week."
        : "Contact agent within 24h — inspection is this week.",
    });

    if (opp) {
      results.saved++;
      if (agentEmail) {
        results.high_priority++;
        highPriorityFinds.push(`${home.address}, ${home.city}${emailSent ? " ✉️" : ""}`);
      }
    }
  }

  // ── ATTOM fallback (when API key set) ──────────────────────────────────────
  if (process.env.ATTOM_API_KEY) {
    const attomProps = await fetchATTOMPending();
    results.pending_checked += attomProps.length;

    for (const prop of attomProps) {
      const attomId = prop.identifier?.attomId;
      if (!attomId) continue;
      const sourceId = `attom_pending_${attomId}`;
      if (await opportunityExists(sourceId)) continue;

      const a = prop.address;
      const address = [a?.line1, a?.city, a?.state, a?.postal1].filter(Boolean).join(", ");
      const city = a?.city || "Colorado";
      const agentName = prop.sale?.agentName || "the listing agent";
      const agentEmail = prop.sale?.agentEmail;

      let emailSent = false;
      if (agentEmail && process.env.RESEND_API_KEY) {
        emailSent = await sendEmail(
          agentEmail,
          `Re: ${address} — Roof cert if anything comes up`,
          agentEmailHtml(agentName, address)
        ).catch(() => false);
        if (emailSent) results.emails_sent++;
        await addAgentToOutreach(agentName, agentEmail, city);
      } else {
        await queueAgentLookup(agentName, address, city, `https://www.attomdata.com`);
      }

      await saveOpportunity({
        source: "property_scan",
        source_id: sourceId,
        type: "property_target",
        priority: agentEmail ? "high" : "medium",
        title: `Pending sale (ATTOM): ${address}`,
        body: `Agent: ${agentName}${agentEmail ? ` (${agentEmail})` : ""}. Under contract as of today.`,
        location: city,
        urgency_score: agentEmail ? 75 : 60,
        opportunity_score: agentEmail ? 75 : 60,
        why_it_matters: `${address} just went under contract. Roof inspection window is this week.`,
        outreach_message: agentEmail
          ? `Hi${agentName !== "the listing agent" ? ` ${agentName.split(" ")[0]}` : ""}! Saw ${address} just went under contract. Faraday does same-day roof certs if inspector flags anything. (720) 766-1518`
          : `Find agent for ${address} on MLS — contact immediately.`,
        close_probability: 35,
        follow_up_schedule: emailSent ? "Email sent. Follow up in 3 days." : "Contact agent within 24h.",
      });

      results.saved++;
      if (agentEmail) {
        results.high_priority++;
        highPriorityFinds.push(`${address}${emailSent ? " ✉️" : ""}`);
      }
    }
  }

  if (highPriorityFinds.length > 0) {
    const msg = [
      `🏡 ${highPriorityFinds.length} PENDING SALE${highPriorityFinds.length > 1 ? "S" : ""} — ${results.emails_sent > 0 ? `${results.emails_sent} agents auto-emailed` : "agents found"}`,
      ...highPriorityFinds.slice(0, 3).map(f => `• ${f}`),
      results.emails_sent > 0
        ? `Emails sent — follow up in 3 days if no reply`
        : `→ Email agents NOW — inspection is this week`,
    ].join("\n");
    await notifyTyler(msg, `🏡 Pending Listings`).catch(() => {});
  }

  console.log(`Listing monitor: ${results.pending_checked} pending checked, ${results.saved} saved, ${results.emails_sent} auto-emailed`);
  return NextResponse.json({ success: true, ...results });
}
