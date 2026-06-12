// Facebook Graph API helper for auto-posting storm alerts
// Requires a Facebook Page Access Token with pages_manage_posts permission

const GRAPH_API = "https://graph.facebook.com/v19.0";

export async function postToFacebook(message: string): Promise<string | null> {
  const pageId = process.env.FACEBOOK_PAGE_ID;
  const token = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;

  if (!pageId || !token) {
    console.warn("Facebook credentials not configured, skipping post");
    return null;
  }

  try {
    const res = await fetch(`${GRAPH_API}/${pageId}/feed`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message,
        access_token: token,
      }),
    });

    const data = await res.json();

    if (data.error) {
      console.error("Facebook API error:", data.error.message);
      return null;
    }

    console.log("Posted to Facebook:", data.id);
    return data.id; // Return post ID for tracking
  } catch (error) {
    console.error("Facebook posting error:", error);
    return null;
  }
}

// Post to Google Business Profile (GBP)
// Uses the Google My Business API v4
export async function postToGBP(message: string): Promise<boolean> {
  const accountId = process.env.GOOGLE_BUSINESS_ACCOUNT_ID;
  const locationId = process.env.GOOGLE_BUSINESS_LOCATION_ID;

  if (!accountId || !locationId) {
    console.warn("GBP credentials not configured, skipping post");
    return false;
  }

  try {
    // Note: GBP API requires OAuth2 — you'll need to set up a service account
    // or use the Google Business Profile API with refresh tokens.
    // Claude Code can help you set up the OAuth flow.
    const res = await fetch(
      `https://mybusiness.googleapis.com/v4/accounts/${accountId}/locations/${locationId}/localPosts`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.GOOGLE_BUSINESS_ACCESS_TOKEN}`,
        },
        body: JSON.stringify({
          languageCode: "en",
          summary: message,
          topicType: "STANDARD",
        }),
      }
    );

    if (!res.ok) {
      console.error("GBP API error:", res.status);
      return false;
    }

    console.log("Posted to Google Business Profile");
    return true;
  } catch (error) {
    console.error("GBP posting error:", error);
    return false;
  }
}
