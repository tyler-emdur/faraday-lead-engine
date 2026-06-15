// Validated environment variables
// All env vars are accessed through this file — never process.env directly in app code.
// Groups: supabase, twilio, resend, ai, googleAds, social, partner, app

function req(name: string): string {
  const val = process.env[name]?.trim();
  if (!val) {
    // In build time some vars aren't set — only throw at runtime
    if (typeof window === "undefined" && process.env.NODE_ENV === "production") {
      console.warn(`Missing required env var: ${name}`);
    }
    return "";
  }
  return val;
}

function opt(name: string, fallback = ""): string {
  return process.env[name]?.trim() || fallback;
}

export const env = {
  // ── App ──────────────────────────────────────────────────────────────────
  app: {
    siteUrl: opt("NEXT_PUBLIC_SITE_URL", "https://leads.faradaysun.com"),
    companyPhone: opt("NEXT_PUBLIC_COMPANY_PHONE", "7207661518"),
    cronSecret: req("CRON_SECRET"),
    adminPassword: opt("NEXT_PUBLIC_ADMIN_PASSWORD", "faraday2024"),
  },

  // ── Supabase ─────────────────────────────────────────────────────────────
  supabase: {
    url: req("SUPABASE_URL"),
    serviceRoleKey: req("SUPABASE_SERVICE_ROLE_KEY"),
    publicUrl: opt("NEXT_PUBLIC_SUPABASE_URL"),
    anonKey: opt("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  },

  // ── Twilio ───────────────────────────────────────────────────────────────
  twilio: {
    accountSid: opt("TWILIO_ACCOUNT_SID"),
    authToken: opt("TWILIO_AUTH_TOKEN"),
    phoneNumber: opt("TWILIO_PHONE_NUMBER"),
    get configured() {
      return !!(this.accountSid && this.authToken && this.phoneNumber);
    },
  },

  // ── Resend ───────────────────────────────────────────────────────────────
  resend: {
    apiKey: opt("RESEND_API_KEY"),
    fromEmail: opt("FROM_EMAIL", "anna@faradaysun.com"),
    tylerEmail: opt("TYLER_EMAIL"),
    teamEmail: opt("TEAM_EMAIL"),
    get configured() {
      return !!this.apiKey;
    },
  },

  // ── AI ───────────────────────────────────────────────────────────────────
  ai: {
    apiKey: opt("AI_API_KEY"),
    baseUrl: opt("AI_BASE_URL", "https://api.groq.com/openai/v1"),
    model: opt("AI_MODEL", "llama-3.3-70b-versatile"),
    get configured() {
      return !!this.apiKey;
    },
  },

  // ── Tyler Notifications ───────────────────────────────────────────────────
  notify: {
    tylerPhone: opt("TYLER_PHONE"),
    teamPhone: opt("TEAM_PHONE"),
    ntfyTopic: opt("NTFY_TOPIC"),
    ntfyToken: opt("NTFY_TOKEN"),
  },

  // ── Google Ads ───────────────────────────────────────────────────────────
  googleAds: {
    developerToken: opt("GOOGLE_ADS_DEVELOPER_TOKEN"),
    customerId: opt("GOOGLE_ADS_CUSTOMER_ID"),
    clientId: opt("GOOGLE_ADS_CLIENT_ID"),
    clientSecret: opt("GOOGLE_ADS_CLIENT_SECRET"),
    refreshToken: opt("GOOGLE_ADS_REFRESH_TOKEN"),
    budgetMicros: parseInt(opt("GOOGLE_ADS_BUDGET_MICROS", "30000000")),
    videoAssetId: opt("GOOGLE_ADS_VIDEO_ASSET_ID"),
    get configured() {
      return !!(this.developerToken && this.customerId && this.clientId && this.refreshToken);
    },
  },

  // ── Social ───────────────────────────────────────────────────────────────
  social: {
    facebookPageToken: opt("FACEBOOK_PAGE_ACCESS_TOKEN"),
    facebookPageId: opt("FACEBOOK_PAGE_ID"),
    bufferToken: opt("BUFFER_ACCESS_TOKEN"),
    bufferProfileIds: opt("BUFFER_PROFILE_IDS"),
    manychatApiKey: opt("MANYCHAT_API_KEY"),
    googlePlacesKey: opt("GOOGLE_PLACES_API_KEY"),
    googleBusinessToken: opt("GOOGLE_BUSINESS_ACCESS_TOKEN"),
    googleBusinessAccountId: opt("GOOGLE_BUSINESS_ACCOUNT_ID"),
    googleBusinessLocationId: opt("GOOGLE_BUSINESS_LOCATION_ID"),
  },

  // ── Partner ──────────────────────────────────────────────────────────────
  partner: {
    stackadaptApiKey: opt("STACKADAPT_API_KEY"),
    stackadaptAdvertiserId: opt("STACKADAPT_ADVERTISER_ID"),
    attomApiKey: opt("ATTOM_API_KEY"),
    denverPermitsToken: opt("DENVER_PERMITS_APP_TOKEN"),
  },
} as const;
