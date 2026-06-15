// Meta Marketing API — auto-create and auto-pause zip-targeted Facebook ads
// Triggered by storm-check when hail hits a specific area.
//
// Required env vars:
//   META_ACCESS_TOKEN    — long-lived Page or User access token
//   META_AD_ACCOUNT_ID   — format: 1234567890 (no "act_" prefix needed, we add it)
//   META_PAGE_ID         — Facebook Page ID for the ad creative
// Optional:
//   META_HAIL_IMAGE_HASH — pre-uploaded image hash for the creative
//   META_HAIL_DAILY_BUDGET_CENTS — default 1000 ($10/day)

const BASE = "https://graph.facebook.com/v22.0";

function token() {
  return (process.env.META_ACCESS_TOKEN || "").trim();
}

function accountId() {
  const raw = (process.env.META_AD_ACCOUNT_ID || "").trim();
  return raw.startsWith("act_") ? raw : `act_${raw}`;
}

async function metaPost(path: string, body: Record<string, unknown>): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(`${BASE}${path}?access_token=${token()}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json() as Record<string, unknown>;
    if (!res.ok || (data as { error?: { message: string } }).error) {
      console.error("Meta API error:", JSON.stringify((data as { error?: unknown }).error));
      return null;
    }
    return data;
  } catch (e) {
    console.error("Meta API request failed:", e);
    return null;
  }
}

async function metaDelete(path: string): Promise<boolean> {
  try {
    const res = await fetch(`${BASE}${path}?access_token=${token()}`, { method: "DELETE" });
    return res.ok;
  } catch {
    return false;
  }
}

async function metaPatch(path: string, body: Record<string, unknown>): Promise<boolean> {
  try {
    const res = await fetch(`${BASE}${path}?access_token=${token()}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...body, _method: "POST" }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export interface MetaAdResult {
  campaign_id: string;
  ad_set_id: string;
  ad_id: string;
  zip_code: string;
  daily_budget_cents: number;
  pause_after_days: number;
  pause_at: string;
}

// Create a geo-fenced storm ad for a single zip code.
// Returns IDs needed to pause the ad later.
export async function createZipAd(params: {
  zipCode: string;
  city: string;
  hailNote: string;
  pauseAfterDays?: number;
}): Promise<MetaAdResult | null> {
  if (!token() || !process.env.META_AD_ACCOUNT_ID || !process.env.META_PAGE_ID) return null;

  const { zipCode, city, hailNote, pauseAfterDays = 7 } = params;
  const pageId = process.env.META_PAGE_ID.trim();
  const dailyBudget = parseInt(process.env.META_HAIL_DAILY_BUDGET_CENTS || "1000", 10);

  // 1. Campaign
  const campaign = await metaPost(`/${accountId()}/campaigns`, {
    name: `Faraday Storm — ${city} ${zipCode} ${new Date().toISOString().slice(0, 10)}`,
    objective: "OUTCOME_LEADS",
    status: "ACTIVE",
    special_ad_categories: [],
  });
  if (!campaign?.id) return null;
  const campaignId = campaign.id as string;

  // 2. Ad Set (zip-targeted, $10/day default)
  const pauseAt = new Date(Date.now() + pauseAfterDays * 86400_000);

  const adSet = await metaPost(`/${accountId()}/adsets`, {
    name: `Hail — ${zipCode}`,
    campaign_id: campaignId,
    daily_budget: dailyBudget,
    billing_event: "IMPRESSIONS",
    optimization_goal: "LEAD_GENERATION",
    targeting: {
      geo_locations: {
        zips: [{ key: `US:${zipCode}`, name: zipCode, country: "US" }],
      },
      age_min: 28,
      age_max: 65,
    },
    status: "ACTIVE",
    end_time: Math.floor(pauseAt.getTime() / 1000),
  });
  if (!adSet?.id) {
    await metaDelete(`/${campaignId}`);
    return null;
  }
  const adSetId = adSet.id as string;

  // 3. Ad Creative — use a page post as the creative
  const headline = `${city} Homeowners: Hail Damage May Be Fully Covered`;
  const message = `${hailNote.charAt(0).toUpperCase() + hailNote.slice(1)} just hit ${city}. Your roof damage may be 100% covered by insurance — most homeowners only pay their deductible.\n\nFaraday Construction is doing FREE inspections this week. Average insurance claim: $9,000–$22,000.\n\nDon't wait — claim windows close fast.\n📞 (720) 766-1518`;

  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://leads.faradaysun.com").trim();
  const creative = await metaPost(`/${accountId()}/adcreatives`, {
    name: `Hail Creative — ${zipCode}`,
    object_story_spec: {
      page_id: pageId,
      link_data: {
        link: `${siteUrl}/?utm_source=facebook&utm_campaign=hail_${zipCode}`,
        message,
        name: headline,
        description: "Free inspection. No commitment. BBB A+ rated.",
        call_to_action: { type: "LEARN_MORE" },
      },
    },
  });
  if (!creative?.id) {
    await metaDelete(`/${campaignId}`);
    return null;
  }

  // 4. Ad
  const ad = await metaPost(`/${accountId()}/ads`, {
    name: `Faraday Hail Ad — ${zipCode}`,
    adset_id: adSetId,
    creative: { creative_id: creative.id },
    status: "ACTIVE",
  });
  if (!ad?.id) {
    await metaDelete(`/${campaignId}`);
    return null;
  }

  return {
    campaign_id: campaignId,
    ad_set_id: adSetId,
    ad_id: ad.id as string,
    zip_code: zipCode,
    daily_budget_cents: dailyBudget,
    pause_after_days: pauseAfterDays,
    pause_at: pauseAt.toISOString(),
  };
}

// Pause an ad campaign (called after pauseAfterDays elapsed)
export async function pauseAdCampaign(campaignId: string): Promise<boolean> {
  if (!token()) return false;
  try {
    const res = await fetch(`${BASE}/${campaignId}?access_token=${token()}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "PAUSED" }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
