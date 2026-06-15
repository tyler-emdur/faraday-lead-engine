// CRON: Listing Monitor — runs daily at 9am MT
// Watches Colorado real estate listings for:
//   1. "Pending" status changes → email the listing agent: "same-day roof cert"
//   2. FSBO / "Coming Soon" listings → email the seller: "don't let roof kill your deal"
//
// Both convert at high rates because there's a built-in deadline.
//
// Requires: ATTOM_API_KEY (attomdata.com — free trial available)
// ATTOM Data API docs: https://api.gateway.attomdata.com/

import { NextRequest, NextResponse } from "next/server";
import { saveOpportunity, opportunityExists } from "@/lib/intel";
import { notifyTyler } from "@/lib/notify";

export const maxDuration = 60;

interface ATTOMProperty {
  identifier?: { attomId?: number; fips?: string };
  address?: { line1?: string; city?: string; state?: string; postal1?: string };
  sale?: {
    amount?: { saleamt?: number };
    contractDate?: string;
    listingStatus?: string;
    listingType?: string;
    agentName?: string;
    agentEmail?: string;
    agentPhone?: string;
  };
  building?: { size?: { grosssize?: number } };
  lot?: { lotsize1?: number };
}

const CO_FIPS_COUNTIES = [
  "08001", // Adams
  "08005", // Arapahoe
  "08013", // Boulder
  "08031", // Denver
  "08035", // Douglas
  "08059", // Jefferson
  "08069", // Larimer
  "08123", // Weld
];

async function fetchPendingListings(): Promise<ATTOMProperty[]> {
  const apiKey = process.env.ATTOM_API_KEY;
  if (!apiKey) return [];

  try {
    const yesterday = new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const params = new URLSearchParams({
      geoIdV4: CO_FIPS_COUNTIES.slice(0, 3).join(","), // Start with top 3 counties
      statusChangeDate: yesterday,
      listingStatus: "Pending",
      pageSize: "50",
    });

    const res = await fetch(
      `https://api.gateway.attomdata.com/propertyapi/v1.0.0/sale/snapshot?${params}`,
      {
        headers: {
          apikey: apiKey,
          Accept: "application/json",
        },
        next: { revalidate: 0 },
      }
    );

    if (!res.ok) {
      console.error("ATTOM pending listings error:", res.status);
      return [];
    }

    const data = await res.json();
    return data.property || [];
  } catch (e) {
    console.error("ATTOM pending listings fetch failed:", e);
    return [];
  }
}

async function fetchFSBOListings(): Promise<ATTOMProperty[]> {
  const apiKey = process.env.ATTOM_API_KEY;
  if (!apiKey) return [];

  try {
    const params = new URLSearchParams({
      geoIdV4: CO_FIPS_COUNTIES.slice(0, 3).join(","),
      listingType: "FSBO",
      pageSize: "25",
    });

    const res = await fetch(
      `https://api.gateway.attomdata.com/propertyapi/v1.0.0/sale/snapshot?${params}`,
      {
        headers: { apikey: apiKey, Accept: "application/json" },
        next: { revalidate: 0 },
      }
    );

    if (!res.ok) return [];
    const data = await res.json();
    return data.property || [];
  } catch (e) {
    console.error("ATTOM FSBO fetch failed:", e);
    return [];
  }
}

function formatAddress(prop: ATTOMProperty): string {
  const a = prop.address;
  if (!a) return "Unknown Address";
  return [a.line1, a.city, a.state, a.postal1].filter(Boolean).join(", ");
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.ATTOM_API_KEY) {
    return NextResponse.json({
      success: false,
      message: "ATTOM_API_KEY not set — sign up at attomdata.com (free trial available)",
    });
  }

  const results = { pending_checked: 0, fsbo_checked: 0, saved: 0 };
  const highPriorityFinds: string[] = [];

  const [pendingListings, fsboListings] = await Promise.all([
    fetchPendingListings(),
    fetchFSBOListings(),
  ]);

  // ── Pending listings ────────────────────────────────────────────────────────
  results.pending_checked = pendingListings.length;

  for (const prop of pendingListings) {
    const attomId = prop.identifier?.attomId;
    if (!attomId) continue;

    const sourceId = `attom_pending_${attomId}`;
    if (await opportunityExists(sourceId)) continue;

    const address = formatAddress(prop);
    const city = prop.address?.city || "Colorado";
    const agentName = prop.sale?.agentName || "the listing agent";
    const agentEmail = prop.sale?.agentEmail;

    const opp = await saveOpportunity({
      source: "property_scan",
      source_id: sourceId,
      type: "property_target",
      priority: agentEmail ? "high" : "medium",
      title: `Pending sale: ${address}`,
      body: `Status changed to Pending. Agent: ${agentName}${agentEmail ? ` (${agentEmail})` : ""}. Home inspection will flag roof issues if present.`,
      location: city,
      urgency_score: 70,
      opportunity_score: 70,
      why_it_matters: `${address} just went under contract. Home inspectors almost always flag roof issues in Colorado. If we reach the agent now, we can save the deal with a same-day roof cert or repair — and that agent becomes a referral source for life.`,
      outreach_message: agentEmail
        ? `Hi${agentName !== "the listing agent" ? ` ${agentName.split(" ")[0]}` : ""}! I saw ${address} just went under contract — congrats! If the home inspector flags any roof issues, Faraday Construction can get out there same-day for a cert or repair. We've saved a lot of Colorado deals. (720) 766-1518`
        : `Looking up agent contact for ${address}...`,
      close_probability: 35,
      follow_up_schedule: "Contact agent within 24h of status change — inspection is usually within the first week.",
    });

    if (opp) {
      results.saved++;
      if (agentEmail) highPriorityFinds.push(`Pending: ${address}`);
    }
  }

  // ── FSBO listings ───────────────────────────────────────────────────────────
  results.fsbo_checked = fsboListings.length;

  for (const prop of fsboListings) {
    const attomId = prop.identifier?.attomId;
    if (!attomId) continue;

    const sourceId = `attom_fsbo_${attomId}`;
    if (await opportunityExists(sourceId)) continue;

    const address = formatAddress(prop);
    const city = prop.address?.city || "Colorado";

    await saveOpportunity({
      source: "property_scan",
      source_id: sourceId,
      type: "property_target",
      priority: "medium",
      title: `FSBO listing: ${address}`,
      body: `For Sale By Owner — no agent, seller handles everything. Sellers on deadline convert at very high rates.`,
      location: city,
      urgency_score: 55,
      opportunity_score: 55,
      why_it_matters: `${address} is listed FSBO. Sellers are handling everything themselves and often overlook roof issues that kill deals at inspection. Time pressure is built in — they want to close fast.`,
      outreach_message: `Hi! I noticed your home at ${address} is listed for sale. Roof issues are the #1 deal-killer in Colorado home inspections, especially after recent hail storms. Faraday Construction does free roof certs — if you get ahead of it now, it won't cost you your deal. (720) 766-1518`,
      close_probability: 20,
      follow_up_schedule: "Outreach within 48h of listing. Time pressure increases as they approach an offer.",
    });

    results.saved++;
  }

  if (highPriorityFinds.length > 0) {
    const msg = [
      `🏡 ${highPriorityFinds.length} PENDING SALE${highPriorityFinds.length > 1 ? "S" : ""} — Agent contact found`,
      ...highPriorityFinds.slice(0, 3).map(f => `• ${f}`),
      `→ Email agent NOW — inspection is this week`,
    ].join("\n");
    await notifyTyler(msg, `🏡 Pending Listings — Act Fast`).catch(() => {});
  }

  console.log(`Listing monitor: ${results.pending_checked} pending, ${results.fsbo_checked} FSBO, ${results.saved} saved`);
  return NextResponse.json({ success: true, ...results });
}
