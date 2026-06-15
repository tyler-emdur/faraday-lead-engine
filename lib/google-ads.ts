// Google Ads auto-campaign creator
// Creates a targeted search campaign when a storm is detected.
// Bids on storm-specific keywords that nobody else is targeting.
//
// Required env vars:
//   GOOGLE_ADS_DEVELOPER_TOKEN — from Google Ads API Center
//   GOOGLE_ADS_CLIENT_ID       — OAuth2 client ID
//   GOOGLE_ADS_CLIENT_SECRET   — OAuth2 client secret
//   GOOGLE_ADS_REFRESH_TOKEN   — long-lived refresh token (from OAuth flow)
//   GOOGLE_ADS_CUSTOMER_ID     — 10-digit customer ID (no dashes)
//   GOOGLE_ADS_BUDGET_MICROS   — daily budget in micros (e.g. 30000000 = $30/day)
//   NEXT_PUBLIC_SITE_URL       — landing page for the ad

const API_VERSION = "v18";
const ADS_API_BASE = `https://googleads.googleapis.com/${API_VERSION}`;

interface StormCampaignParams {
  city: string;
  hailNote: string; // e.g. "1.5-inch hail"
  stormDate: string; // e.g. "June 14"
  budgetMicros?: number;
}

async function getAccessToken(): Promise<string | null> {
  const { GOOGLE_ADS_CLIENT_ID, GOOGLE_ADS_CLIENT_SECRET, GOOGLE_ADS_REFRESH_TOKEN } = process.env;
  if (!GOOGLE_ADS_CLIENT_ID || !GOOGLE_ADS_CLIENT_SECRET || !GOOGLE_ADS_REFRESH_TOKEN) {
    return null;
  }

  try {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: GOOGLE_ADS_CLIENT_ID,
        client_secret: GOOGLE_ADS_CLIENT_SECRET,
        refresh_token: GOOGLE_ADS_REFRESH_TOKEN,
        grant_type: "refresh_token",
      }),
    });

    if (!res.ok) return null;
    const data = await res.json();
    return data.access_token || null;
  } catch {
    return null;
  }
}

function makeHeaders(accessToken: string): Record<string, string> {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${accessToken}`,
    "developer-token": (process.env.GOOGLE_ADS_DEVELOPER_TOKEN || "").trim(),
  };
}

function slugify(city: string): string {
  return city.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

export async function createStormCampaign(params: StormCampaignParams): Promise<string | null> {
  const customerId = (process.env.GOOGLE_ADS_CUSTOMER_ID || "").replace(/-/g, "");
  if (!customerId) {
    console.warn("GOOGLE_ADS_CUSTOMER_ID not set — skipping Google Ads campaign");
    return null;
  }

  const accessToken = await getAccessToken();
  if (!accessToken) {
    console.warn("Could not get Google Ads access token — skipping campaign creation");
    return null;
  }

  const { city, hailNote, stormDate } = params;
  const budgetMicros = params.budgetMicros ?? parseInt(process.env.GOOGLE_ADS_BUDGET_MICROS || "30000000");
  const landingPage = process.env.NEXT_PUBLIC_SITE_URL || "https://faradaysun.com";
  const campaignName = `Storm — ${city} ${stormDate}`;
  const headers = makeHeaders(accessToken);
  const base = `${ADS_API_BASE}/customers/${customerId}`;

  // ── 1. Create budget ─────────────────────────────────────────────────────
  let budgetResourceName: string;
  try {
    const budgetRes = await fetch(`${base}/campaignBudgets:mutate`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        operations: [{
          create: {
            name: `${campaignName} Budget`,
            amountMicros: budgetMicros,
            deliveryMethod: "STANDARD",
            explicitlyShared: false,
          }
        }]
      }),
    });

    const budgetData = await budgetRes.json();
    budgetResourceName = budgetData.results?.[0]?.resourceName;
    if (!budgetResourceName) throw new Error("No budget resource name returned");
  } catch (e) {
    console.error("Google Ads: budget creation failed:", e);
    return null;
  }

  // ── 2. Create campaign ───────────────────────────────────────────────────
  // Auto-pause after 14 days
  const pauseDate = new Date(Date.now() + 14 * 86400000)
    .toISOString().slice(0, 10).replace(/-/g, "");

  let campaignResourceName: string;
  try {
    const campaignRes = await fetch(`${base}/campaigns:mutate`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        operations: [{
          create: {
            name: campaignName,
            status: "ENABLED",
            advertisingChannelType: "SEARCH",
            campaignBudget: budgetResourceName,
            endDate: pauseDate,
            networkSettings: {
              targetGoogleSearch: true,
              targetSearchNetwork: true,
              targetContentNetwork: false,
            },
            biddingStrategyType: "MANUAL_CPC",
            manualCpc: { enhancedCpcEnabled: true },
          }
        }]
      }),
    });

    const campaignData = await campaignRes.json();
    campaignResourceName = campaignData.results?.[0]?.resourceName;
    if (!campaignResourceName) throw new Error("No campaign resource name returned");
  } catch (e) {
    console.error("Google Ads: campaign creation failed:", e);
    return null;
  }

  // ── 3. Create ad group ───────────────────────────────────────────────────
  let adGroupResourceName: string;
  try {
    const adGroupRes = await fetch(`${base}/adGroups:mutate`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        operations: [{
          create: {
            name: `${city} Hail Damage`,
            campaign: campaignResourceName,
            status: "ENABLED",
            type: "SEARCH_STANDARD",
            cpcBidMicros: 2500000, // $2.50 CPC — low competition storm keywords
          }
        }]
      }),
    });

    const adGroupData = await adGroupRes.json();
    adGroupResourceName = adGroupData.results?.[0]?.resourceName;
    if (!adGroupResourceName) throw new Error("No ad group resource name returned");
  } catch (e) {
    console.error("Google Ads: ad group creation failed:", e);
    return null;
  }

  // ── 4. Add keywords (exact match on storm-specific terms) ────────────────
  const keywords = [
    `${city} hail damage`,
    `${city} hail ${stormDate}`,
    `${city} hail storm`,
    `${city} roof damage insurance`,
    `hail damage ${city} Colorado`,
    `free roof inspection ${city}`,
    `${city} hail damage repair`,
  ];

  try {
    await fetch(`${base}/adGroupCriteria:mutate`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        operations: keywords.map(kw => ({
          create: {
            adGroup: adGroupResourceName,
            status: "ENABLED",
            keyword: {
              text: kw,
              matchType: "EXACT",
            }
          }
        }))
      }),
    });
  } catch (e) {
    console.error("Google Ads: keyword creation failed:", e);
  }

  // ── 5. Create responsive search ad ────────────────────────────────────────
  try {
    await fetch(`${base}/adGroupAds:mutate`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        operations: [{
          create: {
            adGroup: adGroupResourceName,
            status: "ENABLED",
            ad: {
              finalUrls: [`${landingPage}?utm_source=google&utm_campaign=storm&utm_term=${slugify(city)}`],
              responsiveSearchAd: {
                headlines: [
                  { text: `${city} Hail Damage? Free Inspection` },
                  { text: `Insurance Covers ${hailNote} Damage` },
                  { text: `We Handle Your Claim — You Pay $0` },
                  { text: `Free Roof Inspection — ${city} CO` },
                  { text: `Storm Damage? Free Inspection Today` },
                ],
                descriptions: [
                  { text: `${hailNote} just hit ${city}. Faraday Construction does FREE inspections — insurance usually covers 100%. Call (720) 766-1518.` },
                  { text: `BBB A+ rated. We handle all insurance paperwork. Average claim: $9,000–$22,000. Only pay your deductible.` },
                ],
              }
            }
          }
        }]
      }),
    });
  } catch (e) {
    console.error("Google Ads: ad creation failed:", e);
  }

  console.log(`Google Ads: storm campaign created for ${city} — expires ${pauseDate}`);
  return campaignResourceName;
}

// ── YouTube Pre-Roll Campaign ─────────────────────────────────────────────────
// Creates a 15-second non-skippable video campaign targeting YouTube searches
// for "colorado hail storm [city]" — zero other roofers do this.
//
// Additional env vars required:
//   GOOGLE_ADS_VIDEO_ASSET_ID — YouTube video ID (e.g. "dQw4w9WgXcQ")
//                               Upload a 30s job site or hail damage video once.

interface VideoAdParams {
  city: string;
  hailNote: string;
  stormDate: string;
  budgetMicros?: number;
}

export async function createStormVideoAd(params: VideoAdParams): Promise<string | null> {
  const customerId = (process.env.GOOGLE_ADS_CUSTOMER_ID || "").replace(/-/g, "");
  const videoAssetId = process.env.GOOGLE_ADS_VIDEO_ASSET_ID;

  if (!customerId || !videoAssetId) {
    console.warn("Google Ads video: GOOGLE_ADS_CUSTOMER_ID or GOOGLE_ADS_VIDEO_ASSET_ID not set");
    return null;
  }

  const accessToken = await getAccessToken();
  if (!accessToken) return null;

  const { city, hailNote, stormDate } = params;
  const budgetMicros = params.budgetMicros ?? parseInt(process.env.GOOGLE_ADS_BUDGET_MICROS || "15000000"); // $15/day default
  const headers = makeHeaders(accessToken);
  const base = `${ADS_API_BASE}/customers/${customerId}`;
  const endDate = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10).replace(/-/g, "");
  const landingPage = `${process.env.NEXT_PUBLIC_SITE_URL || "https://faradaysun.com"}?utm_source=youtube&utm_campaign=storm_preroll&utm_term=${slugify(city)}`;

  // ── Budget ─────────────────────────────────────────────────────────────────
  let budgetResourceName: string;
  try {
    const r = await fetch(`${base}/campaignBudgets:mutate`, {
      method: "POST", headers,
      body: JSON.stringify({
        operations: [{
          create: { name: `Storm YouTube Budget — ${city} ${stormDate}`, amountMicros: budgetMicros, deliveryMethod: "STANDARD", explicitlyShared: false }
        }]
      }),
    });
    const d = await r.json();
    budgetResourceName = d.results?.[0]?.resourceName;
    if (!budgetResourceName) throw new Error("No budget resource");
  } catch (e) {
    console.error("Google Ads video: budget creation failed:", e);
    return null;
  }

  // ── Campaign ───────────────────────────────────────────────────────────────
  let campaignResourceName: string;
  try {
    const r = await fetch(`${base}/campaigns:mutate`, {
      method: "POST", headers,
      body: JSON.stringify({
        operations: [{
          create: {
            name: `Storm YouTube — ${city} ${stormDate}`,
            status: "ENABLED",
            advertisingChannelType: "VIDEO",
            campaignBudget: budgetResourceName,
            endDate,
            networkSettings: { targetYouTubeVideos: true, targetYouTubeSearch: true },
            biddingStrategyType: "TARGET_CPM",
            targetCpm: { targetCpm: { value: "3000000" } }, // $3 CPM
          }
        }]
      }),
    });
    const d = await r.json();
    campaignResourceName = d.results?.[0]?.resourceName;
    if (!campaignResourceName) throw new Error("No campaign resource");
  } catch (e) {
    console.error("Google Ads video: campaign creation failed:", e);
    return null;
  }

  // ── Ad group with keyword targeting ─────────────────────────────────────────
  let adGroupResourceName: string;
  try {
    const r = await fetch(`${base}/adGroups:mutate`, {
      method: "POST", headers,
      body: JSON.stringify({
        operations: [{
          create: {
            name: `${city} Hail Video`,
            campaign: campaignResourceName,
            status: "ENABLED",
            type: "VIDEO_TRUE_VIEW_IN_STREAM",
          }
        }]
      }),
    });
    const d = await r.json();
    adGroupResourceName = d.results?.[0]?.resourceName;
    if (!adGroupResourceName) throw new Error("No ad group resource");
  } catch (e) {
    console.error("Google Ads video: ad group creation failed:", e);
    return null;
  }

  // ── Video ad ───────────────────────────────────────────────────────────────
  try {
    await fetch(`${base}/adGroupAds:mutate`, {
      method: "POST", headers,
      body: JSON.stringify({
        operations: [{
          create: {
            adGroup: adGroupResourceName,
            status: "ENABLED",
            ad: {
              finalUrls: [landingPage],
              videoAd: {
                video: { youtubeVideoId: videoAssetId },
                inStream: {
                  actionButtonLabel: "Free Inspection",
                  actionHeadline: `${city} Hail Damage?`,
                  companionBanners: [{
                    resourceName: null,
                    squareCompanionBanner: { imageMediaId: null }, // Optional — can be null
                  }],
                },
              },
            }
          }
        }]
      }),
    });
  } catch (e) {
    console.error("Google Ads video: ad creation failed:", e);
  }

  // ── Keyword targeting — storm search videos ────────────────────────────────
  try {
    const keywords = [
      `${city} hail storm`, `colorado hail ${stormDate}`, `hail damage ${city}`,
      "colorado hail storm", "colorado severe weather", "hail damage roof",
    ];
    await fetch(`${base}/adGroupCriteria:mutate`, {
      method: "POST", headers,
      body: JSON.stringify({
        operations: keywords.map(kw => ({
          create: {
            adGroup: adGroupResourceName,
            status: "ENABLED",
            keyword: { text: kw, matchType: "BROAD" },
          }
        }))
      }),
    });
  } catch (e) {
    console.error("Google Ads video: keyword targeting failed:", e);
  }

  console.log(`Google Ads: YouTube video campaign created for ${city} — expires ${endDate}`);
  return campaignResourceName;
}
