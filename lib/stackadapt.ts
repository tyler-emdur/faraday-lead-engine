// StackAdapt geofencing campaign creator
// Creates mobile display campaigns in storm-hit zip codes.
// Targets people whose phones enter the affected area — prime intent moment.
//
// Required env vars:
//   STACKADAPT_API_KEY      — from StackAdapt → Settings → API Keys
//   STACKADAPT_ADVERTISER_ID — your advertiser ID in StackAdapt
//   STACKADAPT_CAMPAIGN_TEMPLATE_ID — optional: clone an existing campaign
//
// StackAdapt API docs: https://docs.stackadapt.com/

const SA_API = "https://api.stackadapt.com/service/v1";

interface GeofenceCampaignParams {
  city: string;
  hailNote: string;
  zips?: string[];
  budgetCents?: number; // Daily budget in cents (default $200/day = 20000)
}

async function saFetch(path: string, method: "GET" | "POST" | "PUT", body?: unknown) {
  const apiKey = process.env.STACKADAPT_API_KEY;
  if (!apiKey) return null;

  try {
    const res = await fetch(`${SA_API}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      console.error(`StackAdapt API ${method} ${path} failed:`, res.status);
      return null;
    }

    return await res.json();
  } catch (e) {
    console.error("StackAdapt API error:", e);
    return null;
  }
}

// Build zip-code geofence targeting segments
function buildGeoTargeting(city: string, zips?: string[]) {
  if (zips && zips.length > 0) {
    return { zip_codes: zips };
  }
  // Fall back to city-level targeting
  return { cities: [{ name: city, country: "US", region: "CO" }] };
}

export async function createGeofenceCampaign(params: GeofenceCampaignParams): Promise<string | null> {
  const advertiserId = process.env.STACKADAPT_ADVERTISER_ID;
  if (!advertiserId || !process.env.STACKADAPT_API_KEY) {
    console.warn("StackAdapt not configured — skipping geofencing");
    return null;
  }

  const { city, hailNote, zips, budgetCents = 20000 } = params;

  // End date: 2 weeks after storm (diminishing returns after that)
  const endDate = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);
  const campaignName = `Storm Geofence — ${city} ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;

  // ── Create campaign ───────────────────────────────────────────────────────
  const campaign = await saFetch("/campaigns", "POST", {
    name: campaignName,
    advertiser_id: advertiserId,
    status: "active",
    start_date: new Date().toISOString().slice(0, 10),
    end_date: endDate,
    daily_budget_cents: budgetCents,
    channel: "display",
    targeting: {
      ...buildGeoTargeting(city, zips),
      // Target homeowners — StackAdapt audience data
      audience_segments: ["homeowners", "property_owners", "home_improvement"],
      device_types: ["mobile", "tablet"],
    },
    frequency_cap: { impressions: 8, period: "day" },
  });

  if (!campaign?.id) {
    console.error("StackAdapt: campaign creation failed");
    return null;
  }

  // ── Create ad creative ────────────────────────────────────────────────────
  const landingPage = `${process.env.NEXT_PUBLIC_SITE_URL || "https://faradaysun.com"}?utm_source=stackadapt&utm_campaign=geofence&utm_term=${city.toLowerCase().replace(/\s+/g, "_")}`;

  await saFetch(`/campaigns/${campaign.id}/creatives`, "POST", {
    name: `${city} Hail — Mobile Display`,
    type: "banner",
    headline: `${city} Hail Damage?`,
    description: `Free inspection. Insurance covers it. Call (720) 766-1518.`,
    call_to_action: "Free Inspection",
    click_url: landingPage,
    // StackAdapt can auto-generate responsive ads from headline/description
    // or you can upload creative assets separately
    sizes: ["320x50", "300x250", "728x90"],
  });

  console.log(`StackAdapt geofence created for ${city}: ${campaign.id} (ends ${endDate})`);
  return campaign.id;
}
