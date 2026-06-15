-- Anna Full-Stack Lead Agent — schema additions
-- Run this in Supabase SQL editor to enable:
--   • Storm opt-in subscriber list (Strategy #1)
--   • SMS conversation memory for inbound texts (Strategy #3)
--   • Jobs table for review/referral cron (if not already exists)

-- ── STORM SUBSCRIBERS ─────────────────────────────────────────────────────────
-- People who opt in at faradaysun.com/storm-alerts to get hail notifications.
-- When a storm fires, the storm-check cron blasts everyone in the affected area.

CREATE TABLE IF NOT EXISTS storm_subscribers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT NOT NULL UNIQUE,
  name TEXT,
  email TEXT,
  city TEXT,
  zip TEXT,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'unsubscribed', 'bounced')),
  source TEXT DEFAULT 'web_optin',   -- 'web_optin', 'sms_keyword', 'manual'
  opted_in_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL,
  unsubscribed_at TIMESTAMP WITH TIME ZONE,
  blast_count INTEGER DEFAULT 0,
  last_blast_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS storm_subscribers_city ON storm_subscribers (city);
CREATE INDEX IF NOT EXISTS storm_subscribers_status ON storm_subscribers (status);

ALTER TABLE storm_subscribers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access storm_subscribers"
  ON storm_subscribers FOR ALL USING (auth.role() = 'service_role');


-- ── JOBS TABLE ────────────────────────────────────────────────────────────────
-- Tracks completed jobs for review requests + referral asks.
-- The review-request cron sends texts 3 days after completion.
-- The referral cron sends 10 days after the review request.

CREATE TABLE IF NOT EXISTS jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  customer_name TEXT,
  customer_phone TEXT,
  customer_email TEXT,
  service_type TEXT,                   -- 'hail_damage', 'roofing', 'solar', 'windows'
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'complete', 'cancelled')),
  completed_at TIMESTAMP WITH TIME ZONE,
  review_requested BOOLEAN DEFAULT false,
  review_requested_at TIMESTAMP WITH TIME ZONE,
  referral_requested BOOLEAN DEFAULT false,
  referral_requested_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS jobs_status ON jobs (status);
CREATE INDEX IF NOT EXISTS jobs_completed_at ON jobs (completed_at);

ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access jobs"
  ON jobs FOR ALL USING (auth.role() = 'service_role');


-- ── OUTBOUND PROSPECTS — additional segment types ─────────────────────────────
-- The prospect-scraper adds: 'insurance_agent', 'mortgage_broker',
-- 'property_manager', 'hoa_manager', 'realtor'
-- No schema change needed — source column already accepts any text.
-- Add a segment_type column for easier filtering:

ALTER TABLE outbound_prospects
  ADD COLUMN IF NOT EXISTS segment_type TEXT;

COMMENT ON COLUMN outbound_prospects.segment_type IS
  'insurance_agent | mortgage_broker | property_manager | hoa_manager | realtor | other';


-- ── STORM SUBSCRIBER SIGN-UP FUNCTION ─────────────────────────────────────────
-- Called from the /storm-alerts landing page form to add opt-ins.
-- The function deduplicates by phone and returns the subscriber record.

CREATE OR REPLACE FUNCTION add_storm_subscriber(
  p_phone TEXT,
  p_name TEXT DEFAULT NULL,
  p_email TEXT DEFAULT NULL,
  p_city TEXT DEFAULT NULL,
  p_zip TEXT DEFAULT NULL,
  p_source TEXT DEFAULT 'web_optin'
)
RETURNS storm_subscribers
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_sub storm_subscribers;
BEGIN
  INSERT INTO storm_subscribers (phone, name, email, city, zip, source)
  VALUES (p_phone, p_name, p_email, p_city, p_zip, p_source)
  ON CONFLICT (phone) DO UPDATE
    SET
      name = COALESCE(EXCLUDED.name, storm_subscribers.name),
      email = COALESCE(EXCLUDED.email, storm_subscribers.email),
      city = COALESCE(EXCLUDED.city, storm_subscribers.city),
      zip = COALESCE(EXCLUDED.zip, storm_subscribers.zip),
      status = 'active'   -- re-activate if they previously unsubscribed
  RETURNING * INTO v_sub;

  RETURN v_sub;
END;
$$;
